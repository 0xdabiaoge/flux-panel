import { useState, useEffect } from "react";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";
import { Switch } from "@heroui/switch";
import toast from 'react-hot-toast';

import AdminLayout from "@/layouts/admin";
import { 
  createForward, 
  getForwardList, 
  updateForward, 
  deleteForward,
  forceDeleteForward,
  userTunnel, 
  pauseForwardService,
  resumeForwardService
} from "@/api";

interface Forward {
  id: number;
  name: string;
  tunnelId: number;
  tunnelName: string;
  inIp: string;
  inPort: number;
  remoteAddr: string;
  strategy: string;
  status: number;
  inFlow: number;
  outFlow: number;
  serviceRunning: boolean;
  createdTime: string;
  userName?: string;
}

interface Tunnel {
  id: number;
  name: string;
  inNodePortSta?: number;
  inNodePortEnd?: number;
}

interface ForwardForm {
  id?: number;
  name: string;
  tunnelId: number | null;
  inPort: number | null;
  remoteAddr: string;
  strategy: string;
}

interface AddressItem {
  id: number;
  address: string;
  copying: boolean;
}

export default function ForwardPage() {
  const [loading, setLoading] = useState(true);
  const [forwards, setForwards] = useState<Forward[]>([]);
  const [tunnels, setTunnels] = useState<Tunnel[]>([]);
  
  // 模态框状态
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [forwardToDelete, setForwardToDelete] = useState<Forward | null>(null);
  const [addressModalTitle, setAddressModalTitle] = useState('');
  const [addressList, setAddressList] = useState<AddressItem[]>([]);
  
  // 表单状态
  const [form, setForm] = useState<ForwardForm>({
    name: '',
    tunnelId: null,
    inPort: null,
    remoteAddr: '',
    strategy: 'fifo'
  });
  
  // 表单验证错误
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [selectedTunnel, setSelectedTunnel] = useState<Tunnel | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  // 加载所有数据
  const loadData = async () => {
    setLoading(true);
    try {
      const [forwardsRes, tunnelsRes] = await Promise.all([
        getForwardList(),
        userTunnel()
      ]);
      
      if (forwardsRes.code === 0) {
        setForwards(forwardsRes.data?.map((forward: any) => ({
          ...forward,
          serviceRunning: forward.status === 1
        })) || []);
      } else {
        toast.error(forwardsRes.msg || '获取转发列表失败');
      }
      
      if (tunnelsRes.code === 0) {
        setTunnels(tunnelsRes.data || []);
      } else {
        console.warn('获取隧道列表失败:', tunnelsRes.msg);
      }
    } catch (error) {
      console.error('加载数据失败:', error);
      toast.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 表单验证
  const validateForm = (): boolean => {
    const newErrors: {[key: string]: string} = {};
    
    if (!form.name.trim()) {
      newErrors.name = '请输入转发名称';
    } else if (form.name.length < 2 || form.name.length > 50) {
      newErrors.name = '转发名称长度应在2-50个字符之间';
    }
    
    if (!form.tunnelId) {
      newErrors.tunnelId = '请选择关联隧道';
    }
    
    if (!form.remoteAddr.trim()) {
      newErrors.remoteAddr = '请输入远程地址';
    } else {
      // 验证地址格式
      const addresses = form.remoteAddr.split('\n').map(addr => addr.trim()).filter(addr => addr);
      const ipv4Pattern = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?):\d+$/;
      const ipv6FullPattern = /^\[((([0-9a-fA-F]{1,4}:){7}([0-9a-fA-F]{1,4}|:))|(([0-9a-fA-F]{1,4}:){6}(:[0-9a-fA-F]{1,4}|((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9a-fA-F]{1,4}:){5}(((:[0-9a-fA-F]{1,4}){1,2})|:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9a-fA-F]{1,4}:){4}(((:[0-9a-fA-F]{1,4}){1,3})|((:[0-9a-fA-F]{1,4})?:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9a-fA-F]{1,4}:){3}(((:[0-9a-fA-F]{1,4}){1,4})|((:[0-9a-fA-F]{1,4}){0,2}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9a-fA-F]{1,4}:){2}(((:[0-9a-fA-F]{1,4}){1,5})|((:[0-9a-fA-F]{1,4}){0,3}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9a-fA-F]{1,4}:){1}(((:[0-9a-fA-F]{1,4}){1,6})|((:[0-9a-fA-F]{1,4}){0,4}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(:(((:[0-9a-fA-F]{1,4}){1,7})|((:[0-9a-fA-F]{1,4}){0,5}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:)))\]:\d+$/;
      const domainPattern = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*:\d+$/;
      
      for (let i = 0; i < addresses.length; i++) {
        const addr = addresses[i];
        if (!ipv4Pattern.test(addr) && !ipv6FullPattern.test(addr) && !domainPattern.test(addr)) {
          newErrors.remoteAddr = `第${i + 1}行地址格式错误`;
          break;
        }
      }
    }
    
    if (form.inPort !== null && (form.inPort < 1 || form.inPort > 65535)) {
      newErrors.inPort = '端口号必须在1-65535之间';
    }
    
    if (selectedTunnel && selectedTunnel.inNodePortSta && selectedTunnel.inNodePortEnd && form.inPort) {
      if (form.inPort < selectedTunnel.inNodePortSta || form.inPort > selectedTunnel.inNodePortEnd) {
        newErrors.inPort = `端口号必须在${selectedTunnel.inNodePortSta}-${selectedTunnel.inNodePortEnd}范围内`;
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 新增转发
  const handleAdd = () => {
    setIsEdit(false);
    setForm({
      name: '',
      tunnelId: null,
      inPort: null,
      remoteAddr: '',
      strategy: 'fifo'
    });
    setSelectedTunnel(null);
    setErrors({});
    setModalOpen(true);
  };

  // 编辑转发
  const handleEdit = (forward: Forward) => {
    setIsEdit(true);
    setForm({
      id: forward.id,
      name: forward.name,
      tunnelId: forward.tunnelId,
      inPort: forward.inPort,
      remoteAddr: forward.remoteAddr.split(',').join('\n'),
      strategy: forward.strategy || 'fifo'
    });
    const tunnel = tunnels.find(t => t.id === forward.tunnelId);
    setSelectedTunnel(tunnel || null);
    setErrors({});
    setModalOpen(true);
  };

  // 显示删除确认
  const handleDelete = (forward: Forward) => {
    setForwardToDelete(forward);
    setDeleteModalOpen(true);
  };

  // 确认删除转发
  const confirmDelete = async () => {
    if (!forwardToDelete) return;
    
    setDeleteLoading(true);
    try {
      const res = await deleteForward(forwardToDelete.id);
      if (res.code === 0) {
        toast.success('删除成功');
        setDeleteModalOpen(false);
        loadData();
      } else {
        // 删除失败，询问是否强制删除
        const confirmed = window.confirm(`常规删除失败：${res.msg || '删除失败'}\n\n是否需要强制删除？\n\n⚠️ 注意：强制删除不会去验证节点端是否已经删除对应的转发服务。`);
        if (confirmed) {
          const forceRes = await forceDeleteForward(forwardToDelete.id);
          if (forceRes.code === 0) {
            toast.success('强制删除成功');
            setDeleteModalOpen(false);
            loadData();
          } else {
            toast.error(forceRes.msg || '强制删除失败');
          }
        }
      }
    } catch (error) {
      console.error('删除失败:', error);
      toast.error('删除失败');
    } finally {
      setDeleteLoading(false);
    }
  };

  // 处理隧道选择变化
  const handleTunnelChange = (tunnelId: string) => {
    const tunnel = tunnels.find(t => t.id === parseInt(tunnelId));
    setSelectedTunnel(tunnel || null);
    setForm(prev => ({ ...prev, tunnelId: parseInt(tunnelId) }));
  };

  // 提交表单
  const handleSubmit = async () => {
    if (!validateForm()) return;
    
    setSubmitLoading(true);
    try {
      const processedRemoteAddr = form.remoteAddr
        .split('\n')
        .map(addr => addr.trim())
        .filter(addr => addr)
        .join(',');

      const addressCount = processedRemoteAddr.split(',').length;
      
      let res;
      if (isEdit) {
        res = await updateForward({
          ...form,
          remoteAddr: processedRemoteAddr,
          strategy: addressCount > 1 ? form.strategy : 'fifo'
        });
      } else {
        const { id, ...createData } = form;
        res = await createForward({
          ...createData,
          remoteAddr: processedRemoteAddr,
          strategy: addressCount > 1 ? form.strategy : 'fifo'
        });
      }
      
      if (res.code === 0) {
        toast.success(isEdit ? '修改成功' : '创建成功');
        setModalOpen(false);
        loadData();
      } else {
        toast.error(res.msg || '操作失败');
      }
    } catch (error) {
      console.error('提交失败:', error);
      toast.error('操作失败');
    } finally {
      setSubmitLoading(false);
    }
  };

  // 处理服务开关
  const handleServiceToggle = async (forward: Forward) => {
    if (forward.status !== 1 && forward.status !== 0) {
      toast.error('转发状态异常，无法操作');
      return;
    }

    const targetState = !forward.serviceRunning;
    
    try {
      // 乐观更新UI
      setForwards(prev => prev.map(f => 
        f.id === forward.id 
          ? { ...f, serviceRunning: targetState }
          : f
      ));

      let res;
      if (targetState) {
        res = await resumeForwardService(forward.id);
      } else {
        res = await pauseForwardService(forward.id);
      }
      
      if (res.code === 0) {
        toast.success(targetState ? '服务已启动' : '服务已暂停');
        // 更新转发状态
        setForwards(prev => prev.map(f => 
          f.id === forward.id 
            ? { ...f, status: targetState ? 1 : 0 }
            : f
        ));
      } else {
        // 操作失败，恢复UI状态
        setForwards(prev => prev.map(f => 
          f.id === forward.id 
            ? { ...f, serviceRunning: !targetState }
            : f
        ));
        toast.error(res.msg || '操作失败');
      }
    } catch (error) {
      // 操作失败，恢复UI状态
      setForwards(prev => prev.map(f => 
        f.id === forward.id 
          ? { ...f, serviceRunning: !targetState }
          : f
      ));
      console.error('服务开关操作失败:', error);
      toast.error('网络错误，操作失败');
    }
  };

  // 格式化流量
  const formatFlow = (value: number): string => {
    if (value === 0) return '0 B';
    if (value < 1024) return value + ' B';
    if (value < 1024 * 1024) return (value / 1024).toFixed(2) + ' KB';
    if (value < 1024 * 1024 * 1024) return (value / (1024 * 1024)).toFixed(2) + ' MB';
    return (value / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  };

  // 格式化入口地址
  const formatInAddress = (ipString: string, port: number): string => {
    if (!ipString || !port) return '';
    
    const ips = ipString.split(',').map(ip => ip.trim()).filter(ip => ip);
    if (ips.length === 0) return '';
    
    if (ips.length === 1) {
      const ip = ips[0];
      if (ip.includes(':') && !ip.startsWith('[')) {
        return `[${ip}]:${port}`;
      } else {
        return `${ip}:${port}`;
      }
    }
    
    const firstIp = ips[0];
    let formattedFirstIp;
    if (firstIp.includes(':') && !firstIp.startsWith('[')) {
      formattedFirstIp = `[${firstIp}]`;
    } else {
      formattedFirstIp = firstIp;
    }
    
    return `${formattedFirstIp}:${port} (+${ips.length - 1})`;
  };

  // 格式化远程地址
  const formatRemoteAddress = (addressString: string): string => {
    if (!addressString) return '';
    
    const addresses = addressString.split(',').map(addr => addr.trim()).filter(addr => addr);
    if (addresses.length === 0) return '';
    if (addresses.length === 1) return addresses[0];
    
    return `${addresses[0]} (+${addresses.length - 1})`;
  };

  // 检查是否有多个地址
  const hasMultipleAddresses = (addressString: string): boolean => {
    if (!addressString) return false;
    const addresses = addressString.split(',').map(addr => addr.trim()).filter(addr => addr);
    return addresses.length > 1;
  };

  // 显示地址列表弹窗
  const showAddressModal = (addressString: string, port: number | null, title: string) => {
    if (!addressString) return;
    
    let addresses: string[];
    if (port !== null) {
      // 入口地址处理
      const ips = addressString.split(',').map(ip => ip.trim()).filter(ip => ip);
      if (ips.length <= 1) {
        copyToClipboard(formatInAddress(addressString, port), title);
        return;
      }
      addresses = ips.map(ip => {
        if (ip.includes(':') && !ip.startsWith('[')) {
          return `[${ip}]:${port}`;
        } else {
          return `${ip}:${port}`;
        }
      });
    } else {
      // 远程地址处理
      addresses = addressString.split(',').map(addr => addr.trim()).filter(addr => addr);
      if (addresses.length <= 1) {
        copyToClipboard(addressString, title);
        return;
      }
    }
    
    setAddressList(addresses.map((address, index) => ({
      id: index,
      address,
      copying: false
    })));
    setAddressModalTitle(`${title} (${addresses.length}个)`);
    setAddressModalOpen(true);
  };

  // 复制到剪贴板
  const copyToClipboard = async (text: string, label: string = '内容') => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`已复制${label}`);
    } catch (error) {
      toast.error('复制失败');
    }
  };

  // 复制地址
  const copyAddress = async (addressItem: AddressItem) => {
    try {
      setAddressList(prev => prev.map(item => 
        item.id === addressItem.id ? { ...item, copying: true } : item
      ));
      await copyToClipboard(addressItem.address, '地址');
    } catch (error) {
      toast.error('复制失败');
    } finally {
      setAddressList(prev => prev.map(item => 
        item.id === addressItem.id ? { ...item, copying: false } : item
      ));
    }
  };

  // 复制所有地址
  const copyAllAddresses = async () => {
    if (addressList.length === 0) return;
    const allAddresses = addressList.map(item => item.address).join('\n');
    await copyToClipboard(allAddresses, '所有地址');
  };

  // 获取状态显示
  const getStatusDisplay = (status: number) => {
    switch (status) {
      case 1:
        return { color: 'success', text: '正常' };
      case 0:
        return { color: 'warning', text: '暂停' };
      case -1:
        return { color: 'danger', text: '异常' };
      default:
        return { color: 'default', text: '未知' };
    }
  };

  // 获取策略显示
  const getStrategyDisplay = (strategy: string) => {
    switch (strategy) {
      case 'fifo':
        return { color: 'primary', text: '主备' };
      case 'round':
        return { color: 'success', text: '轮询' };
      case 'rand':
        return { color: 'warning', text: '随机' };
      default:
        return { color: 'default', text: '未知' };
    }
  };

  // 获取地址数量
  const getAddressCount = (addressString: string): number => {
    if (!addressString) return 0;
    const addresses = addressString.split('\n').map(addr => addr.trim()).filter(addr => addr);
    return addresses.length;
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center gap-3">
            <Spinner size="sm" />
            <span className="text-default-600">正在加载...</span>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="px-3 lg:px-6 py-8">
        {/* 页面头部 */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-foreground">转发管理</h1>
          <Button 
            color="primary" 
            onPress={handleAdd}
            startContent={
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
            }
          >
            新增转发
          </Button>
        </div>

        {/* 转发卡片网格 */}
        {forwards.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
            {forwards.map((forward) => {
              const statusDisplay = getStatusDisplay(forward.status);
              const strategyDisplay = getStrategyDisplay(forward.strategy);
              
              return (
                <Card key={forward.id} className="shadow-sm border border-gray-200 dark:border-gray-700">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start w-full">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground truncate">{forward.name}</h3>
                        <p className="text-sm text-default-500 truncate mt-1">{forward.tunnelName}</p>
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        <Switch
                          size="sm"
                          isSelected={forward.serviceRunning}
                          onValueChange={() => handleServiceToggle(forward)}
                          isDisabled={forward.status !== 1 && forward.status !== 0}
                        />
                        <Chip 
                          color={statusDisplay.color as any} 
                          variant="flat" 
                          size="sm"
                        >
                          {statusDisplay.text}
                        </Chip>
                      </div>
                    </div>
                  </CardHeader>
                  <CardBody className="pt-0">
                    <div className="space-y-3">
                      {/* 地址信息 */}
                      <div className="space-y-2">
                        <div 
                          className={`cursor-pointer p-2 bg-green-50 dark:bg-green-500/10 rounded border border-green-200 dark:border-green-500/20 ${
                            hasMultipleAddresses(forward.inIp) ? 'hover:bg-green-100 dark:hover:bg-green-500/20' : ''
                          }`}
                          onClick={() => showAddressModal(forward.inIp, forward.inPort, '入口地址')}
                          title={formatInAddress(forward.inIp, forward.inPort)}
                        >
                          <div className="text-xs text-green-600 dark:text-green-400 mb-1">入口地址</div>
                          <code className="text-xs font-mono text-green-700 dark:text-green-300 truncate block">
                            {formatInAddress(forward.inIp, forward.inPort)}
                          </code>
                        </div>
                        
                        <div className="text-center text-default-400 text-xs">↓</div>
                        
                        <div 
                          className={`cursor-pointer p-2 bg-blue-50 dark:bg-blue-500/10 rounded border border-blue-200 dark:border-blue-500/20 ${
                            hasMultipleAddresses(forward.remoteAddr) ? 'hover:bg-blue-100 dark:hover:bg-blue-500/20' : ''
                          }`}
                          onClick={() => showAddressModal(forward.remoteAddr, null, '目标地址')}
                          title={formatRemoteAddress(forward.remoteAddr)}
                        >
                          <div className="text-xs text-blue-600 dark:text-blue-400 mb-1">目标地址</div>
                          <code className="text-xs font-mono text-blue-700 dark:text-blue-300 truncate block">
                            {formatRemoteAddress(forward.remoteAddr)}
                          </code>
                        </div>
                      </div>

                      {/* 策略和流量 */}
                      <div className="flex justify-between items-center pt-2 border-t border-gray-200 dark:border-default-200">
                        <div className="text-center flex-1">
                          <div className="text-xs text-default-500 mb-1">策略</div>
                          <Chip color={strategyDisplay.color as any} variant="flat" size="sm">
                            {strategyDisplay.text}
                          </Chip>
                        </div>
                        <div className="text-center flex-1">
                          <div className="text-xs text-default-500 mb-1">总流量</div>
                          <div className="text-xs font-medium text-primary">
                            {formatFlow((forward.inFlow || 0) + (forward.outFlow || 0))}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 mt-4">
                      <Button
                        size="sm"
                        variant="flat"
                        color="primary"
                        onPress={() => handleEdit(forward)}
                        className="flex-1"
                        startContent={
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                          </svg>
                        }
                      >
                        编辑
                      </Button>
                      <Button
                        size="sm"
                        variant="flat"
                        color="danger"
                        onPress={() => handleDelete(forward)}
                        className="flex-1"
                        startContent={
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" clipRule="evenodd" />
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 012 0v4a1 1 0 11-2 0V7zM12 7a1 1 0 012 0v4a1 1 0 11-2 0V7z" clipRule="evenodd" />
                          </svg>
                        }
                      >
                        删除
                      </Button>
                    </div>
                  </CardBody>
                </Card>
              );
            })}
          </div>
        ) : (
          /* 空状态 */
          <Card className="shadow-sm border border-gray-200 dark:border-gray-700">
            <CardBody className="text-center py-16">
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 bg-default-100 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-default-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">暂无转发配置</h3>
                  <p className="text-default-500 text-sm mt-1">还没有创建任何转发配置，点击上方按钮开始创建</p>
                </div>
              </div>
            </CardBody>
          </Card>
        )}

        {/* 新增/编辑模态框 */}
        <Modal 
          isOpen={modalOpen}
          onOpenChange={setModalOpen}
          size="lg"
          scrollBehavior="inside"
        >
          <ModalContent>
            {(onClose) => (
              <>
                <ModalHeader className="flex flex-col gap-1">
                  <h2 className="text-xl font-bold">
                    {isEdit ? '编辑转发' : '新增转发'}
                  </h2>
                  <p className="text-small text-default-500">
                    {isEdit ? '修改现有转发配置的信息' : '创建新的转发配置'}
                  </p>
                </ModalHeader>
                <ModalBody>
                  <div className="space-y-4">
                    <Input
                      label="转发名称"
                      placeholder="请输入转发名称"
                      value={form.name}
                      onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                      isInvalid={!!errors.name}
                      errorMessage={errors.name}
                      variant="bordered"
                    />
                    
                    <Select
                      label="选择隧道"
                      placeholder="请选择关联的隧道"
                      selectedKeys={form.tunnelId ? [form.tunnelId.toString()] : []}
                      onSelectionChange={(keys) => {
                        const selectedKey = Array.from(keys)[0] as string;
                        if (selectedKey) {
                          handleTunnelChange(selectedKey);
                        }
                      }}
                      isInvalid={!!errors.tunnelId}
                      errorMessage={errors.tunnelId}
                      variant="bordered"
                    >
                      {tunnels.map((tunnel) => (
                        <SelectItem key={tunnel.id} value={tunnel.id}>
                          {tunnel.name}
                        </SelectItem>
                      ))}
                    </Select>
                    
                    <Input
                      label="入口端口"
                      placeholder="留空自动分配"
                      type="number"
                      value={form.inPort?.toString() || ''}
                      onChange={(e) => setForm(prev => ({ 
                        ...prev, 
                        inPort: e.target.value ? parseInt(e.target.value) : null 
                      }))}
                      isInvalid={!!errors.inPort}
                      errorMessage={errors.inPort}
                      variant="bordered"
                      description={
                        selectedTunnel && selectedTunnel.inNodePortSta && selectedTunnel.inNodePortEnd
                          ? `允许范围: ${selectedTunnel.inNodePortSta}-${selectedTunnel.inNodePortEnd}`
                          : '留空将自动分配可用端口'
                      }
                    />
                    
                    <Input
                      label="远程地址"
                      placeholder="请输入远程地址，多个地址用换行分隔"
                      value={form.remoteAddr}
                      onChange={(e) => setForm(prev => ({ ...prev, remoteAddr: e.target.value }))}
                      isInvalid={!!errors.remoteAddr}
                      errorMessage={errors.remoteAddr}
                      variant="bordered"
                      description="格式: IP:端口 或 域名:端口，支持多个地址（每行一个）"
                    />
                    
                    {getAddressCount(form.remoteAddr) > 1 && (
                      <Select
                        label="负载策略"
                        placeholder="请选择负载均衡策略"
                        selectedKeys={[form.strategy]}
                        onSelectionChange={(keys) => {
                          const selectedKey = Array.from(keys)[0] as string;
                          setForm(prev => ({ ...prev, strategy: selectedKey }));
                        }}
                        variant="bordered"
                        description="多个目标地址的负载均衡策略"
                      >
                        <SelectItem key="fifo" value="fifo">主备模式 - 自上而下</SelectItem>
                        <SelectItem key="round" value="round">轮询模式 - 依次轮换</SelectItem>
                        <SelectItem key="rand" value="rand">随机模式 - 随机选择</SelectItem>
                      </Select>
                    )}
                  </div>
                </ModalBody>
                <ModalFooter>
                  <Button variant="light" onPress={onClose}>
                    取消
                  </Button>
                  <Button 
                    color="primary" 
                    onPress={handleSubmit}
                    isLoading={submitLoading}
                  >
                    {isEdit ? '保存修改' : '创建转发'}
                  </Button>
                </ModalFooter>
              </>
            )}
          </ModalContent>
        </Modal>

        {/* 删除确认模态框 */}
        <Modal 
          isOpen={deleteModalOpen}
          onOpenChange={setDeleteModalOpen}
          size="sm"
        >
          <ModalContent>
            {(onClose) => (
              <>
                <ModalHeader className="flex flex-col gap-1">
                  <h2 className="text-lg font-bold text-danger">确认删除</h2>
                </ModalHeader>
                <ModalBody>
                  <p className="text-default-600">
                    确定要删除转发 <span className="font-semibold text-foreground">"{forwardToDelete?.name}"</span> 吗？
                  </p>
                  <p className="text-small text-default-500 mt-2">
                    此操作无法撤销，删除后该转发将永久消失。
                  </p>
                </ModalBody>
                <ModalFooter>
                  <Button variant="light" onPress={onClose}>
                    取消
                  </Button>
                  <Button 
                    color="danger" 
                    onPress={confirmDelete}
                    isLoading={deleteLoading}
                  >
                    确认删除
                  </Button>
                </ModalFooter>
              </>
            )}
          </ModalContent>
        </Modal>

        {/* 地址列表弹窗 */}
        <Modal isOpen={addressModalOpen} onClose={() => setAddressModalOpen(false)} size="lg">
          <ModalContent>
            <ModalHeader className="text-base">{addressModalTitle}</ModalHeader>
            <ModalBody className="pb-6">
              <div className="mb-4 text-right">
                <Button size="sm" onClick={copyAllAddresses}>
                  复制全部
                </Button>
              </div>
              
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {addressList.map((item) => (
                  <div key={item.id} className="flex justify-between items-center p-3 border border-default-200 dark:border-default-100 rounded-lg">
                    <code className="text-sm flex-1 mr-3 text-foreground">{item.address}</code>
                    <Button
                      size="sm"
                      variant="light"
                      isLoading={item.copying}
                      onClick={() => copyAddress(item)}
                    >
                      复制
                    </Button>
                  </div>
                ))}
              </div>
            </ModalBody>
          </ModalContent>
        </Modal>
      </div>
    </AdminLayout>
  );
} 