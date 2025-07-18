#!/bin/bash
# GOST 多实例管理脚本
# 支持在同一台机器上运行多个 GOST 实例
# 
# 使用方法:
#   交互式安装: ./install.sh
#   命令行安装: ./install.sh -a "服务器地址" -s "密钥"
#   
# 参数说明:
#   -a: 服务器地址
#   -s: 密钥  
#
# 下载地址
DOWNLOAD_URL="https://raw.githubusercontent.com/bqlpfy/forward-panel/refs/heads/main/go-gost/gost"

# 获取实例名称
get_instance_name() {
  if [[ -z "$INSTANCE_NAME" ]]; then
    echo ""
    echo "🏷️ 实例名称配置..."
    read -p "请输入实例名称 (留空使用默认名称 'gost'): " INSTANCE_NAME
    if [[ -z "$INSTANCE_NAME" ]]; then
      INSTANCE_NAME="gost"
    fi
  fi
  
  # 设置动态变量
  if [[ "$INSTANCE_NAME" == "gost" ]]; then
    INSTALL_DIR="/etc/gost"
    SERVICE_NAME="gost"
  else
    INSTALL_DIR="/etc/gost-${INSTANCE_NAME}"
    SERVICE_NAME="gost-${INSTANCE_NAME}"
  fi
  
  echo "✅ 实例名称: $INSTANCE_NAME"
  echo "📁 安装目录: $INSTALL_DIR"
  echo "🔧 服务名称: $SERVICE_NAME"
}

# 显示菜单
show_menu() {
  echo "==============================================="
  echo "              管理脚本"
  echo "==============================================="
  echo "请选择操作："
  echo "1. 安装"
  echo "2. 更新"  
  echo "3. 卸载"
  echo "4. 查看已有服务"
  echo "5. 退出"
  echo "==============================================="
}

# 查看已有服务
list_services() {
  echo "🔍 查看已有的 GOST 服务..."
  echo ""
  
  # 检查是否支持systemctl
  if ! command -v systemctl &> /dev/null; then
    echo "❌ 此功能需要 systemd 支持（Linux 系统）"
    echo "💡 当前系统不支持 systemctl 命令"
    return 0
  fi
  
  # 查找所有gost相关的服务
  GOST_SERVICES=$(systemctl list-units --all --no-pager | grep -E "gost.*\.service" | awk '{print $1}' || true)
  
  if [[ -z "$GOST_SERVICES" ]]; then
    echo "❌ 未找到任何 GOST 服务"
    return 0
  fi
  
  echo "📋 已安装的 GOST 服务："
  echo "==============================================="
  
  for service in $GOST_SERVICES; do
    # 提取实例名称
    if [[ "$service" == "gost.service" ]]; then
      instance_name="gost (默认)"
      config_dir="/etc/gost"
    else
      instance_name=$(echo "$service" | sed 's/gost-//' | sed 's/\.service//')
      config_dir="/etc/gost-${instance_name}"
    fi
    
    # 获取服务状态
    status=$(systemctl is-active "$service" 2>/dev/null || echo "unknown")
    enabled=$(systemctl is-enabled "$service" 2>/dev/null || echo "unknown")
    
    # 显示服务信息
    echo "🔧 服务名称: $service"
    echo "🏷️ 实例名称: $instance_name"
    echo "📁 配置目录: $config_dir"
    echo "🟢 运行状态: $status"
    echo "⚡ 开机启动: $enabled"
    
    # 显示配置信息（如果配置文件存在）
    if [[ -f "$config_dir/config.json" ]]; then
      server_addr=$(grep -o '"addr":[[:space:]]*"[^"]*"' "$config_dir/config.json" 2>/dev/null | cut -d'"' -f4 || echo "未知")
      echo "🌐 服务器地址: $server_addr"
    else
      echo "🌐 服务器地址: 配置文件不存在"
    fi
    
    echo "-----------------------------------------------"
  done
  
  echo ""
  echo "💡 服务管理命令："
  echo "  查看状态: systemctl status <服务名>"
  echo "  启动服务: systemctl start <服务名>"
  echo "  停止服务: systemctl stop <服务名>"
  echo "  查看日志: journalctl -u <服务名> -f"
  echo "==============================================="
}

# 检查并安装 tcpkill
check_and_install_tcpkill() {
  # 检查 tcpkill 是否已安装
  if command -v tcpkill &> /dev/null; then
    return 0
  fi
  
  # 检测操作系统类型
  OS_TYPE=$(uname -s)
  
  # 检查是否需要 sudo
  if [[ $EUID -ne 0 ]]; then
    SUDO_CMD="sudo"
  else
    SUDO_CMD=""
  fi
  
  if [[ "$OS_TYPE" == "Darwin" ]]; then
    if command -v brew &> /dev/null; then
      brew install dsniff &> /dev/null
    fi
    return 0
  fi
  
  # 检测 Linux 发行版并安装对应的包
  if [ -f /etc/os-release ]; then
    . /etc/os-release
    DISTRO=$ID
  elif [ -f /etc/redhat-release ]; then
    DISTRO="rhel"
  elif [ -f /etc/debian_version ]; then
    DISTRO="debian"
  else
    return 0
  fi
  
  case $DISTRO in
    ubuntu|debian)
      $SUDO_CMD apt update &> /dev/null
      $SUDO_CMD apt install -y dsniff &> /dev/null
      ;;
    centos|rhel|fedora)
      if command -v dnf &> /dev/null; then
        $SUDO_CMD dnf install -y dsniff &> /dev/null
      elif command -v yum &> /dev/null; then
        $SUDO_CMD yum install -y dsniff &> /dev/null
      fi
      ;;
    alpine)
      $SUDO_CMD apk add --no-cache dsniff &> /dev/null
      ;;
    arch|manjaro)
      $SUDO_CMD pacman -S --noconfirm dsniff &> /dev/null
      ;;
    opensuse*|sles)
      $SUDO_CMD zypper install -y dsniff &> /dev/null
      ;;
    gentoo)
      $SUDO_CMD emerge --ask=n net-analyzer/dsniff &> /dev/null
      ;;
    void)
      $SUDO_CMD xbps-install -Sy dsniff &> /dev/null
      ;;
  esac
  
  return 0
}

# 获取用户输入的配置参数
get_config_params() {
  if [[ -z "$SERVER_ADDR" || -z "$SECRET" ]]; then
    echo "请输入配置参数："
    
    if [[ -z "$SERVER_ADDR" ]]; then
      read -p "服务器地址: " SERVER_ADDR
    fi
    
    if [[ -z "$SECRET" ]]; then
      read -p "密钥: " SECRET
    fi
    
    if [[ -z "$SERVER_ADDR" || -z "$SECRET" ]]; then
      echo "❌ 参数不完整，操作取消。"
      exit 1
    fi
  fi
}

# 解析命令行参数
while getopts "a:s:" opt; do
  case $opt in
    a) SERVER_ADDR="$OPTARG" ;;
    s) SECRET="$OPTARG" ;;
    *) echo "❌ 无效参数"; exit 1 ;;
  esac
done

# 安装功能
install_gost() {
  echo "🚀 开始安装 GOST..."
  get_instance_name
  get_config_params
  
  # 询问是否有加速下载地址
  echo ""
  echo "📥 检查下载地址..."
  read -p "是否有加速下载地址？(留空使用默认地址): " custom_url
  if [[ -n "$custom_url" ]]; then
    DOWNLOAD_URL="$custom_url"
    echo "✅ 使用自定义下载地址: $DOWNLOAD_URL"
  else
    echo "✅ 使用默认下载地址: $DOWNLOAD_URL"
  fi
  
  # 检查并安装 tcpkill
  check_and_install_tcpkill
  mkdir -p "$INSTALL_DIR"

  # 停止并禁用已有服务
  if systemctl list-units --full -all | grep -Fq "${SERVICE_NAME}.service"; then
    echo "🔍 检测到已存在的${SERVICE_NAME}服务"
    systemctl stop ${SERVICE_NAME} 2>/dev/null && echo "🛑 停止服务"
    systemctl disable ${SERVICE_NAME} 2>/dev/null && echo "🚫 禁用自启"
  fi

  # 删除旧文件
  [[ -f "$INSTALL_DIR/gost" ]] && echo "🧹 删除旧文件 gost" && rm -f "$INSTALL_DIR/gost"

  # 下载 gost
  echo "⬇️ 下载 gost 中..."
  curl -L "$DOWNLOAD_URL" -o "$INSTALL_DIR/gost"
  if [[ ! -f "$INSTALL_DIR/gost" || ! -s "$INSTALL_DIR/gost" ]]; then
    echo "❌ 下载失败，请检查网络或下载链接。"
    exit 1
  fi
  chmod +x "$INSTALL_DIR/gost"
  echo "✅ 下载完成"

  # 打印版本
  echo "🔎 gost 版本：$($INSTALL_DIR/gost -V)"

  # 写入 config.json (安装时总是创建新的)
  CONFIG_FILE="$INSTALL_DIR/config.json"
  echo "📄 创建新配置: config.json"
  cat > "$CONFIG_FILE" <<EOF
{
  "addr": "$SERVER_ADDR",
  "secret": "$SECRET"
}
EOF

  # 写入 gost.json
  GOST_CONFIG="$INSTALL_DIR/gost.json"
  if [[ -f "$GOST_CONFIG" ]]; then
    echo "⏭️ 跳过配置文件: gost.json (已存在)"
  else
    echo "📄 创建新配置: gost.json"
    cat > "$GOST_CONFIG" <<EOF
{}
EOF
  fi

  # 加强权限
  chmod 600 "$INSTALL_DIR"/*.json

  # 创建 systemd 服务
  SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
  cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=Gost Proxy Service ($INSTANCE_NAME)
After=network.target

[Service]
WorkingDirectory=$INSTALL_DIR
ExecStart=$INSTALL_DIR/gost
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

  # 启动服务
  systemctl daemon-reload
  systemctl enable ${SERVICE_NAME}
  systemctl start ${SERVICE_NAME}

  # 检查状态
  echo "🔄 检查服务状态..."
  if systemctl is-active --quiet ${SERVICE_NAME}; then
    echo "✅ 安装完成，${SERVICE_NAME}服务已启动并设置为开机启动。"
    echo "📁 配置目录: $INSTALL_DIR"
    echo "🔧 服务状态: $(systemctl is-active ${SERVICE_NAME})"
  else
    echo "❌ ${SERVICE_NAME}服务启动失败，请执行以下命令查看日志："
    echo "journalctl -u ${SERVICE_NAME} -f"
  fi
}

# 更新功能
update_gost() {
  echo "🔄 开始更新 GOST..."
  get_instance_name
  
  if [[ ! -d "$INSTALL_DIR" ]]; then
    echo "❌ GOST 实例 '$INSTANCE_NAME' 未安装，请先选择安装。"
    return 1
  fi
  
  # 询问是否有加速下载地址
  echo ""
  echo "📥 检查下载地址..."
  read -p "是否有加速下载地址？(留空使用默认地址): " custom_url
  if [[ -n "$custom_url" ]]; then
    DOWNLOAD_URL="$custom_url"
    echo "✅ 使用自定义下载地址: $DOWNLOAD_URL"
  else
    echo "✅ 使用默认下载地址: $DOWNLOAD_URL"
  fi
  
  # 检查并安装 tcpkill
  check_and_install_tcpkill
  # 先下载新版本
  echo "⬇️ 下载最新版本..."
  curl -L "$DOWNLOAD_URL" -o "$INSTALL_DIR/gost.new"
  if [[ ! -f "$INSTALL_DIR/gost.new" || ! -s "$INSTALL_DIR/gost.new" ]]; then
    echo "❌ 下载失败。"
    return 1
  fi

  # 停止服务
  if systemctl list-units --full -all | grep -Fq "${SERVICE_NAME}.service"; then
    echo "🛑 停止 ${SERVICE_NAME} 服务..."
    systemctl stop ${SERVICE_NAME}
  fi

  # 替换文件
  mv "$INSTALL_DIR/gost.new" "$INSTALL_DIR/gost"
  chmod +x "$INSTALL_DIR/gost"
  
  # 打印版本
  echo "🔎 新版本：$($INSTALL_DIR/gost -V)"

  # 重启服务
  echo "🔄 重启服务..."
  systemctl start ${SERVICE_NAME}
  
  echo "✅ 更新完成，服务已重新启动。"
}

# 卸载功能
uninstall_gost() {
  echo "🗑️ 开始卸载 GOST..."
  get_instance_name
  
  read -p "确认卸载 GOST 实例 '$INSTANCE_NAME' 吗？此操作将删除所有相关文件 (y/N): " confirm
  if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
    echo "❌ 取消卸载"
    return 0
  fi

  # 停止并禁用服务
  if systemctl list-units --full -all | grep -Fq "${SERVICE_NAME}.service"; then
    echo "🛑 停止并禁用服务..."
    systemctl stop ${SERVICE_NAME} 2>/dev/null
    systemctl disable ${SERVICE_NAME} 2>/dev/null
  fi

  # 删除服务文件
  if [[ -f "/etc/systemd/system/${SERVICE_NAME}.service" ]]; then
    rm -f "/etc/systemd/system/${SERVICE_NAME}.service"
    echo "🧹 删除服务文件"
  fi

  # 删除安装目录
  if [[ -d "$INSTALL_DIR" ]]; then
    rm -rf "$INSTALL_DIR"
    echo "🧹 删除安装目录: $INSTALL_DIR"
  fi

  # 重载 systemd
  systemctl daemon-reload

  echo "✅ 卸载完成"
}

# 主逻辑
main() {
  # 如果提供了命令行参数，直接执行安装
  if [[ -n "$SERVER_ADDR" && -n "$SECRET" ]]; then
    install_gost
    exit 0
  fi

  # 显示交互式菜单
  while true; do
    show_menu
    read -p "请输入选项 (1-5): " choice
    
    case $choice in
      1)
        install_gost
        break
        ;;
      2)
        update_gost
        break
        ;;
      3)
        uninstall_gost
        break
        ;;
      4)
        list_services
        break
        ;;
      5)
        echo "👋 退出脚本"
        exit 0
        ;;
      *)
        echo "❌ 无效选项，请输入 1-5"
        echo ""
        ;;
    esac
  done
}

# 执行主函数
main