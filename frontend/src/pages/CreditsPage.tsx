import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToastStore } from '../components/Toast';
import { ArrowLeft, Coins, Crown, Gift, Loader2, CheckCircle, Star, Zap, RefreshCw } from 'lucide-react';
import { getProfile, getCredits, getTopUpPackages, getSubscriptionPlans, subscribe } from '../api/core';
import client from '../api/client';
import type { UserProfile, TopUpPackage, SubscriptionPlan, CreditTransaction } from '../api/core';

export default function CreditsPage() {
  const navigate = useNavigate();
  const addToast = useToastStore((s) => s.addToast);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [txns, setTxns] = useState<CreditTransaction[]>([]);
  const [packages, setPackages] = useState<TopUpPackage[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [activeTab, setActiveTab] = useState<'credits' | 'subscribe'>('credits');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [payMethod, setPayMethod] = useState<'alipay' | 'wechat'>('alipay');
  const [selectedPkg, setSelectedPkg] = useState<TopUpPackage | null>(null);
  const [showPayDialog, setShowPayDialog] = useState(false);
  const [payStep, setPayStep] = useState<'confirm' | 'qr' | 'verifying' | 'done'>('confirm');
  const [currentOrder, setCurrentOrder] = useState<any>(null);
  const [pollCount, setPollCount] = useState(0);
  const [selectedCycle, setSelectedCycle] = useState<'monthly' | 'yearly'>('monthly');

  useEffect(() => {
    Promise.all([getProfile(), getCredits(), getTopUpPackages(), getSubscriptionPlans()])
      .then(([p, c, pkgs, pl]) => {
        setProfile(p.data);
        setTxns(c.data.transactions);
        setPackages((pkgs.data as any).packages || pkgs.data);
        setPlans((pl.data as any).plans || pl.data);
      }).catch(() => navigate('/login'))
      .finally(() => setLoading(false));
  }, []);

  const handleTopUp = async (pkg: TopUpPackage) => {
    setSelectedPkg(pkg);
    setPayStep('confirm');
    setShowPayDialog(true);
  };

  const confirmPayment = async () => {
    if (!selectedPkg) return;
    setPayStep('qr');
    setProcessing(selectedPkg.id);
    try {
      // 创建支付订单
      const res = await client.post('/me/payment/create', {
        package_id: selectedPkg.id,
        pay_method: payMethod,
      });
      setCurrentOrder(res.data);
      setPayStep('qr');
    } catch {
      addToast('err', '创建订单失败，请重试');
      setPayStep('confirm');
    } finally {
      setProcessing(null);
    }
  };

  // 模拟支付扫描（用户点击"我已支付"后验证）
  const simulateScan = async () => {
    if (!currentOrder) return;
    setPayStep('verifying');
    try {
      // 模拟支付成功（生产环境由异步回调自动完成）
      const res = await client.post('/me/payment/simulate', null, {
        params: { order_id: currentOrder.id }
      });
      if (res.data.code === 'SUCCESS') {
        addToast('ok', `支付成功！到账 ${res.data.credits_added} 点，当前余额 ${res.data.balance.toFixed(0)} 点`);
        setPayStep('done');
        setProfile(prev => prev ? { ...prev, credits: res.data.balance } : null);
        // 刷新交易记录
        getCredits().then(r => setTxns(r.data.transactions));
      } else {
        addToast('err', '支付验证失败');
        setPayStep('qr');
      }
    } catch {
      addToast('err', '支付验证失败，请重试');
      setPayStep('qr');
    }
  };

  // 轮询支付状态（生产环境前端轮询二维码状态）
  useEffect(() => {
    if (payStep !== 'qr' || !currentOrder || pollCount > 30) return;
    const timer = setTimeout(async () => {
      try {
        const res = await client.get(`/me/payment/status/${currentOrder.id}`);
        if (res.data.paid) {
          addToast('ok', `支付成功！到账 ${currentOrder.total_credits} 点`);
          setPayStep('done');
          setProfile(prev => prev ? { ...prev, credits: (prev?.credits || 0) + currentOrder.total_credits } : null);
          getCredits().then(r => setTxns(r.data.transactions));
          return;
        }
        setPollCount(c => c + 1);
      } catch { /* 继续轮询 */ }
    }, 2000);
    return () => clearTimeout(timer);
  }, [payStep, currentOrder, pollCount]);

  const resetPayDialog = () => {
    setShowPayDialog(false);
    setSelectedPkg(null);
    setCurrentOrder(null);
    setPayStep('confirm');
    setPollCount(0);
  };

  const handleSubscribe = async (plan: string) => {
    setProcessing(`${plan}-${selectedCycle}`);
    try {
      const res = await subscribe(plan);
      const label = res.data.subscription?.plan_label || plan;
      addToast('ok', `已切换到「${label}」套餐！`);
    } catch {
      addToast('err', '操作失败');
    } finally {
      setProcessing(null);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 size={32} className="animate-spin text-primary" /></div>;

  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-4">
        <ArrowLeft size={16} /> 返回
      </button>

      {/* 资产概览 */}
      <div className="bg-gradient-to-r from-primary via-indigo-600 to-fuchsia-600 rounded-2xl p-6 text-white shadow-lg mb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold">我的资产</h1>
          <span className="text-foreground/80 text-sm">{profile?.email}</span>
        </div>
        <div className="flex gap-6">
          <div>
            <div className="text-foreground/80 text-sm">可用点数</div>
            <div className="text-3xl font-bold mt-1">{profile?.credits.toFixed(0)} <span className="text-lg text-foreground/80">点</span></div>
          </div>
          <div className="w-px bg-white/20" />
          <div>
            <div className="text-foreground/80 text-sm">已消耗</div>
            <div className="text-xl font-bold mt-1">{profile?.credits_used.toFixed(0)} 点</div>
          </div>
          <div className="w-px bg-white/20" />
          <div>
            <div className="text-foreground/80 text-sm">当前套餐</div>
            <div className="text-xl font-bold mt-1 capitalize">{profile?.subscription_plan}</div>
          </div>
        </div>
      </div>

      {/* Tab */}
      <div className="flex gap-2 mb-6">
        <button onClick={() => setActiveTab('credits')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'credits' ? 'bg-primary text-primary-foreground' : 'bg-white text-foreground/80 border hover:bg-muted/40'}`}
        ><Coins size={16} /> 充值点数</button>
        <button onClick={() => setActiveTab('subscribe')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'subscribe' ? 'bg-primary text-primary-foreground' : 'bg-white text-foreground/80 border hover:bg-muted/40'}`}
        ><Crown size={16} /> 订阅套餐</button>
      </div>

      {/* ─── 充值 ─── */}
      {activeTab === 'credits' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Gift size={18} className="text-primary" />
            <h2 className="font-bold text-foreground">选择充值套餐</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">1 元 = 100 点，充值越多赠送越多</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {packages.map((pkg) => {
              const rate = pkg.total_credits / pkg.price_rmb;
              const isBest = pkg.bonus > 0 && (pkg.bonus / pkg.credits) >= 0.15;
              return (
                <div key={pkg.id} className={`bg-white rounded-xl border p-5 hover:shadow-md transition-shadow relative ${isBest ? 'border-amber-300 ring-1 ring-amber-200' : 'border-border'}`}>
                  {isBest && <span className="absolute -top-2 -right-2 bg-amber-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">推荐</span>}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-bold text-foreground">{pkg.name}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{pkg.bonus > 0 ? `赠送 ${pkg.bonus} 点` : '无额外赠送'}</p>
                    </div>
                    <div className="text-2xl font-bold text-primary">¥{pkg.price_rmb}</div>
                  </div>
                  <div className="text-sm text-foreground/80 mb-1">
                    <span className="font-medium">{pkg.total_credits}</span> 点 &nbsp;
                    <span className="text-muted-foreground/70">({rate.toFixed(1)} 点/元)</span>
                  </div>
                  {pkg.bonus > 0 && (
                    <div className="text-xs text-emerald-600 mb-4">+ 赠 {pkg.bonus} 点（多 {Math.round(pkg.bonus / pkg.credits * 100)}%）</div>
                  )}
                  <button onClick={() => handleTopUp(pkg)} disabled={processing === pkg.id}
                    className="w-full py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {processing === pkg.id && <Loader2 size={14} className="animate-spin" />}
                    {processing === pkg.id ? '创建订单中...' : '立即充值'}
                  </button>
                </div>
              );
            })}
          </div>

          {/* 支付方式 */}
          <div className="bg-muted/60 rounded-xl p-4 border border-border">
            <p className="text-xs text-muted-foreground mb-3">选择支付方式</p>
            <div className="flex gap-3">
              <button onClick={() => setPayMethod('alipay')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm transition-all ${payMethod === 'alipay' ? 'border-blue-500 bg-blue-50' : 'border-border bg-card hover:bg-muted/40'}`}
              >
                <span className="text-blue-500 font-bold text-base">支</span>
                <span className="text-foreground/80">支付宝</span>
                {payMethod === 'alipay' && <CheckCircle size={14} className="text-blue-500" />}
              </button>
              <button onClick={() => setPayMethod('wechat')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm transition-all ${payMethod === 'wechat' ? 'border-green-500 bg-green-50' : 'border-border bg-card hover:bg-muted/40'}`}
              >
                <span className="text-green-500 font-bold text-base">微</span>
                <span className="text-foreground/80">微信支付</span>
                {payMethod === 'wechat' && <CheckCircle size={14} className="text-green-500" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground/70 mt-2">💡 支付网关已就绪，支持支付宝/微信支付</p>
          </div>

          {/* ─── 支付弹窗 ─── */}
          {showPayDialog && selectedPkg && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={resetPayDialog}>
              <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl" onClick={e => e.stopPropagation()}>

                {/* 确认支付 */}
                {payStep === 'confirm' && (
                  <>
                    <div className="text-center mb-4">
                      <div className="text-5xl mb-3">{payMethod === 'alipay' ? '💳' : '💚'}</div>
                      <h3 className="text-lg font-bold text-foreground">确认支付</h3>
                      <p className="text-sm text-muted-foreground mt-1">{payMethod === 'alipay' ? '支付宝' : '微信支付'}</p>
                    </div>
                    <div className="bg-muted/60 rounded-xl p-4 mb-4 text-sm space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">套餐</span>
                        <span className="font-medium">{selectedPkg.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">到账点数</span>
                        <span className="font-medium text-primary">{selectedPkg.total_credits} 点</span>
                      </div>
                      {selectedPkg.bonus > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">赠送</span>
                          <span className="font-medium text-emerald-600">+{selectedPkg.bonus} 点</span>
                        </div>
                      )}
                      <div className="border-t pt-2 flex justify-between">
                        <span className="text-foreground font-medium">金额</span>
                        <span className="text-xl font-bold text-red-600">¥{selectedPkg.price_rmb}</span>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button onClick={resetPayDialog} className="flex-1 py-2.5 border border-input rounded-lg text-sm text-foreground/80 hover:bg-muted/40">取消</button>
                      <button onClick={confirmPayment} className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">
                        {processing === selectedPkg.id ? '创建订单...' : `确认支付 ¥${selectedPkg.price_rmb}`}
                      </button>
                    </div>
                  </>
                )}

                {/* 二维码扫描 */}
                {payStep === 'qr' && currentOrder && (
                  <>
                    <div className="text-center mb-4">
                      <div className="text-5xl mb-3">{payMethod === 'alipay' ? '📱' : '📱'}</div>
                      <h3 className="text-lg font-bold text-foreground">扫码支付</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        请使用{payMethod === 'alipay' ? '支付宝' : '微信'}扫码完成支付
                      </p>
                    </div>
                    {/* 模拟二维码 */}
                    <div className="flex justify-center mb-4">
                      <div className="bg-white border-2 border-border rounded-xl p-4 inline-block">
                        <div className="w-48 h-48 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg flex items-center justify-center">
                          <div className="text-center">
                            <div className="text-6xl mb-2">{payMethod === 'alipay' ? '💳' : '💚'}</div>
                            <div className="text-xs text-muted-foreground">模拟二维码</div>
                            <div className="text-xs text-muted-foreground/70 mt-1">¥{currentOrder.amount_rmb}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="bg-muted/60 rounded-xl p-3 mb-4 text-xs text-muted-foreground space-y-1">
                      <div className="flex justify-between"><span>订单号</span><span className="font-mono text-foreground/80">{currentOrder.id}</span></div>
                      <div className="flex justify-between"><span>金额</span><span className="font-bold text-red-600">¥{currentOrder.amount_rmb}</span></div>
                      <div className="flex justify-between"><span>到账点数</span><span className="text-primary">{currentOrder.total_credits} 点</span></div>
                    </div>
                    <div className="space-y-2">
                      <button onClick={simulateScan} className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 flex items-center justify-center gap-2">
                        <CheckCircle size={16} /> 我已支付（模拟验证）
                      </button>
                      <button onClick={resetPayDialog} className="w-full py-2 border border-input rounded-lg text-sm text-foreground/80 hover:bg-muted/40">
                        取消支付
                      </button>
                      {pollCount > 0 && (
                        <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground/70">
                          <RefreshCw size={12} className="animate-spin" />
                          支付确认中...（{pollCount}/30）
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* 验证中 */}
                {payStep === 'verifying' && (
                  <div className="text-center py-6">
                    <Loader2 size={40} className="animate-spin text-primary mx-auto mb-3" />
                    <h3 className="font-bold text-foreground mb-1">验证支付结果</h3>
                    <p className="text-sm text-muted-foreground">正在确认支付到账...</p>
                  </div>
                )}

                {/* 支付成功 */}
                {payStep === 'done' && (
                  <div className="text-center py-4">
                    <div className="text-5xl mb-3">🎉</div>
                    <h3 className="text-lg font-bold text-foreground mb-1">支付成功！</h3>
                    <div className="bg-emerald-50 rounded-xl p-4 mb-4 text-sm">
                      <div className="text-emerald-800">
                        已到账 <span className="font-bold">{currentOrder?.total_credits || selectedPkg.total_credits}</span> 点
                      </div>
                    </div>
                    <button onClick={resetPayDialog} className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">完成</button>
                  </div>
                )}

              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── 订阅 ─── */}
      {activeTab === 'subscribe' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Crown size={18} className="text-amber-500" />
            <h2 className="font-bold text-foreground">选择订阅套餐</h2>
          </div>
          <div className="flex gap-2 mb-4">
            <button onClick={() => setSelectedCycle('monthly')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${selectedCycle === 'monthly' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
            >月付</button>
            <button onClick={() => setSelectedCycle('yearly')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${selectedCycle === 'yearly' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
            >
              年付
              {plans.some(p => p.yearly_price_rmb > 0 && p.monthly_discount_label) && (
                <span className="ml-1 text-emerald-500 text-xs">省更多</span>
              )}
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {plans.map((plan) => {
              const isActive = profile?.subscription_plan === plan.id;
              const price = selectedCycle === 'monthly' ? plan.monthly_price_rmb : plan.yearly_price_rmb;
              const showDiscount = selectedCycle === 'yearly' && plan.monthly_discount_label;
              const isPro = plan.id === 'pro';
              const isPremium = plan.id === 'premium';
              return (
                <div key={plan.id}
                  className={`bg-white rounded-xl border p-5 hover:shadow-md transition-shadow relative ${isActive ? 'border-amber-400 ring-2 ring-amber-200' : 'border-border'}`}
                >
                  {isPro && plan.id !== 'free' && (
                    <span className="absolute -top-2.5 left-4 bg-primary text-primary-foreground text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-0.5">
                      <Star size={10} /> 热门
                    </span>
                  )}
                  {isPremium && (
                    <span className="absolute -top-2.5 left-4 bg-purple-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-0.5">
                      <Zap size={10} /> 旗舰
                    </span>
                  )}
                  <div className="text-center mb-4 mt-1">
                    <div className="text-3xl mb-2">{plan.id === 'free' ? '🆓' : isPro ? '⭐' : '👑'}</div>
                    <h3 className="font-bold text-foreground">{plan.name}</h3>
                    <div className="mt-2">
                      <span className="text-2xl font-bold text-primary">{price > 0 ? `¥${price}` : '免费'}</span>
                      {price > 0 && <span className="text-sm text-muted-foreground ml-1">{selectedCycle === 'monthly' ? '/月' : '/年'}</span>}
                    </div>
                    {showDiscount && <span className="inline-block mt-1 text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-medium">{plan.monthly_discount_label}</span>}
                    <div className="text-xs text-muted-foreground/70 mt-1">
                      {selectedCycle === 'yearly' && plan.monthly_price_rmb > 0 ? `约 ¥${(price / 12).toFixed(0)}/月` : ''}
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground space-y-2 mb-4">
                    <p>每日免费核心功能：<strong>{plan.daily_free_core} 次</strong></p>
                    <p>辅助功能折扣：<strong>{plan.discount_percent}%</strong></p>
                    <p className="text-xs text-muted-foreground/70 mt-2">{plan.description}</p>
                  </div>
                  <button onClick={() => handleSubscribe(plan.id)}
                    disabled={processing === `${plan.id}-${selectedCycle}` || isActive}
                    className={`w-full py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 ${isActive ? 'bg-muted text-muted-foreground/60 cursor-not-allowed' : plan.id === 'free' ? 'bg-secondary text-secondary-foreground hover:bg-secondary/80' : 'bg-amber-500 text-white hover:bg-amber-600'} disabled:opacity-60`}
                  >
                    {processing === `${plan.id}-${selectedCycle}` && <Loader2 size={14} className="animate-spin" />}
                    {isActive ? '当前套餐' : plan.id === 'free' ? '切换为免费版' : '订阅'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 更多付费场景 */}
      <div className="mt-8 bg-muted/60 rounded-xl border border-border p-5">
        <h2 className="font-bold text-foreground mb-3">更多付费场景（即将开放）</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { icon: '📐', title: '投稿格式预检', desc: '按期刊模板规范化格式' },
            { icon: '✅', title: '改后复查', desc: '对照反馈判断修改是否达标' },
            { icon: '🎤', title: '答辩模拟', desc: '模拟答辩委员会提问' },
            { icon: '📚', title: '文献综述生成', desc: '输入文献生成综述段落' },
            { icon: '🌐', title: '中译英学术润色', desc: '翻译为学术英文' },
          ].map(s => (
            <div key={s.title} className="bg-card rounded-lg p-3 border border-border">
              <div className="text-lg mb-1">{s.icon}</div>
              <div className="text-sm font-medium text-foreground">{s.title}</div>
              <div className="text-xs text-muted-foreground">{s.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 交易记录 */}
      <div className="mt-8">
        <h2 className="font-bold text-foreground mb-3">最近交易记录</h2>
        <div className="bg-card rounded-xl border border-border divide-y">
          {txns.slice(0, 10).map((txn) => (
            <div key={txn.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <span className="text-foreground">{txn.description || txn.scene}</span>
                <span className="text-xs text-muted-foreground/70 ml-2">{new Date(txn.created_at).toLocaleString('zh-CN')}</span>
              </div>
              <span className={`font-medium ${txn.type === 'income' ? 'text-emerald-600' : 'text-red-500'}`}>
                {txn.type === 'income' ? '+' : '-'}{txn.amount.toFixed(0)} 点
              </span>
            </div>
          ))}
          {txns.length === 0 && <div className="px-4 py-6 text-center text-sm text-muted-foreground/70">暂无交易记录</div>}
        </div>
      </div>
    </div>
  );
}
