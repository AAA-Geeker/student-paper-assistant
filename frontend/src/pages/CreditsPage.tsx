import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToastStore } from '../components/Toast';
import { ArrowLeft, Coins, Crown, Gift, Loader2 } from 'lucide-react';
import { getProfile, getCredits, getTopUpPackages, getSubscriptionPlans, topUp, subscribe } from '../api/core';
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

  useEffect(() => {
    Promise.all([
      getProfile(),
      getCredits(),
      getTopUpPackages(),
      getSubscriptionPlans(),
    ]).then(([p, c, pkgs, pl]) => {
      setProfile(p.data);
      setTxns(c.data.transactions);
      setPackages((pkgs.data as any).packages || pkgs.data);
      setPlans((pl.data as any).plans || pl.data);
    }).catch(() => navigate('/login'))
    .finally(() => setLoading(false));
  }, []);

  const handleTopUp = async (pkgId: string) => {
    setProcessing(pkgId);
    try {
      const res = await topUp(pkgId);
      addToast('ok', `充值成功！到账 ${res.data.credits_added.toFixed(0)} 点，当前余额 ${res.data.balance.toFixed(0)} 点`);
      setProfile(prev => prev ? { ...prev, credits: res.data.balance } : null);
    } catch {
      addToast('err', '充值失败，请重试');
    } finally {
      setProcessing(null);
    }
  };

  const handleSubscribe = async (plan: string) => {
    setProcessing(plan);
    try {
      const res = await subscribe(plan);
      addToast('ok', `已切换到「${res.data.subscription.plan_label}」套餐！`);
    } catch {
      addToast('err', '操作失败');
    } finally {
      setProcessing(null);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 size={32} className="animate-spin text-indigo-600" /></div>;

  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={() => navigate('/dashboard')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-indigo-600 mb-4">
        <ArrowLeft size={16} /> 返回工作台
      </button>

      {/* 资产概览卡片 */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 text-white shadow-lg mb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold">我的资产</h1>
          <span className="text-indigo-200 text-sm">{profile?.email}</span>
        </div>
        <div className="flex gap-6">
          <div>
            <div className="text-indigo-200 text-sm">可用点数</div>
            <div className="text-3xl font-bold mt-1">{profile?.credits.toFixed(0)} <span className="text-lg text-indigo-200">点</span></div>
          </div>
          <div className="w-px bg-white/20" />
          <div>
            <div className="text-indigo-200 text-sm">已消耗</div>
            <div className="text-xl font-bold mt-1">{profile?.credits_used.toFixed(0)} 点</div>
          </div>
          <div className="w-px bg-white/20" />
          <div>
            <div className="text-indigo-200 text-sm">当前套餐</div>
            <div className="text-xl font-bold mt-1 capitalize">{profile?.subscription_plan}</div>
          </div>
        </div>
      </div>

      {/* Tab 切换 */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('credits')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'credits' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 border hover:bg-gray-50'
          }`}
        ><Coins size={16} /> 充值点数</button>
        <button
          onClick={() => setActiveTab('subscribe')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'subscribe' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 border hover:bg-gray-50'
          }`}
        ><Crown size={16} /> 订阅套餐</button>
      </div>

      {/* 充值点数 */}
      {activeTab === 'credits' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Gift size={18} className="text-indigo-600" />
            <h2 className="font-bold text-gray-800">选择充值套餐</h2>
          </div>
          <p className="text-sm text-gray-500 mb-4">1 元 = 100 点，充值越多赠送越多</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {packages.map((pkg) => (
              <div key={pkg.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-gray-900">{pkg.name}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {pkg.bonus > 0 ? `赠送 ${pkg.bonus} 点` : '无额外赠送'}
                    </p>
                  </div>
                  <div className="text-2xl font-bold text-indigo-600">¥{pkg.price_rmb}</div>
                </div>
                <div className="text-sm text-gray-700 mb-4">
                  <span className="font-medium">{pkg.credits}</span> 点
                  {pkg.bonus > 0 && <span className="text-emerald-600 ml-1">+ 赠 {pkg.bonus} 点</span>}
                </div>
                <button
                  onClick={() => handleTopUp(pkg.id)}
                  disabled={processing === pkg.id}
                  className="w-full py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {processing === pkg.id && <Loader2 size={14} className="animate-spin" />}
                  {processing === pkg.id ? '处理中...' : '立即充值'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 订阅套餐 */}
      {activeTab === 'subscribe' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Crown size={18} className="text-amber-500" />
            <h2 className="font-bold text-gray-800">选择订阅套餐</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`bg-white rounded-xl border p-5 hover:shadow-md transition-shadow ${
                  profile?.subscription_plan === plan.id ? 'border-amber-400 ring-2 ring-amber-200' : 'border-gray-200'
                }`}
              >
                <div className="text-center mb-4">
                  <div className="text-3xl mb-2">
                    {plan.id === 'free' ? '🆓' : plan.id === 'pro' ? '⭐' : '👑'}
                  </div>
                  <h3 className="font-bold text-gray-900">{plan.name}</h3>
                  <div className="text-2xl font-bold text-indigo-600 mt-2">
                    {plan.monthly_price_rmb > 0 ? `¥${plan.monthly_price_rmb}` : '免费'}
                    {plan.monthly_price_rmb > 0 && <span className="text-sm text-gray-500">/月</span>}
                  </div>
                </div>
                <div className="text-sm text-gray-600 space-y-2 mb-4">
                  <p>每日免费核心功能：<strong>{plan.daily_free_core} 次</strong></p>
                  <p>辅助功能折扣：<strong>{plan.discount_percent}%</strong></p>
                  <p className="text-xs text-gray-400 mt-2">{plan.description}</p>
                </div>
                <button
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={processing === plan.id || profile?.subscription_plan === plan.id}
                  className={`w-full py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 ${
                    profile?.subscription_plan === plan.id
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : plan.id === 'free'
                      ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      : 'bg-amber-500 text-white hover:bg-amber-600'
                  } disabled:opacity-60`}
                >
                  {processing === plan.id && <Loader2 size={14} className="animate-spin" />}
                  {profile?.subscription_plan === plan.id ? '当前套餐' : plan.id === 'free' ? '切换为免费版' : '订阅'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 更多付费场景介绍 */}
      <div className="mt-8 bg-gray-50 rounded-xl border border-gray-200 p-5">
        <h2 className="font-bold text-gray-800 mb-3">更多付费场景（即将开放）</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="bg-white rounded-lg p-3 border border-gray-100">
            <div className="text-lg mb-1">📐</div>
            <div className="text-sm font-medium text-gray-900">投稿格式预检</div>
            <div className="text-xs text-gray-500">按期刊模板规范化格式（IEEE / ACL / CSSCI）</div>
          </div>
          <div className="bg-white rounded-lg p-3 border border-gray-100">
            <div className="text-lg mb-1">✅</div>
            <div className="text-sm font-medium text-gray-900">改后复查</div>
            <div className="text-xs text-gray-500">修改完成后，AI 对照反馈意见判断是否达标</div>
          </div>
          <div className="bg-white rounded-lg p-3 border border-gray-100">
            <div className="text-lg mb-1">🎤</div>
            <div className="text-sm font-medium text-gray-900">答辩模拟</div>
            <div className="text-xs text-gray-500">AI 模拟答辩委员会提问，预判评审问题</div>
          </div>
          <div className="bg-white rounded-lg p-3 border border-gray-100">
            <div className="text-lg mb-1">📚</div>
            <div className="text-sm font-medium text-gray-900">文献综述生成</div>
            <div className="text-xs text-gray-500">输入 5-10 篇文献标题/摘要，AI 生成综述段落</div>
          </div>
          <div className="bg-white rounded-lg p-3 border border-gray-100">
            <div className="text-lg mb-1">🌐</div>
            <div className="text-sm font-medium text-gray-900">中译英学术润色</div>
            <div className="text-xs text-gray-500">中文论文翻译为学术英文，保留术语和风格</div>
          </div>
        </div>
      </div>

      {/* 最近交易记录 */}
      <div className="mt-8">
        <h2 className="font-bold text-gray-800 mb-3">最近交易记录</h2>
        <div className="bg-white rounded-xl border border-gray-200 divide-y">
          {txns.slice(0, 10).map((txn) => (
            <div key={txn.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <span className="text-gray-900">{txn.description || txn.scene}</span>
                <span className="text-xs text-gray-400 ml-2">{new Date(txn.created_at).toLocaleString('zh-CN')}</span>
              </div>
              <span className={`font-medium ${txn.type === 'income' ? 'text-emerald-600' : 'text-red-500'}`}>
                {txn.type === 'income' ? '+' : '-'}{txn.amount.toFixed(0)} 点
              </span>
            </div>
          ))}
          {txns.length === 0 && <div className="px-4 py-6 text-center text-sm text-gray-400">暂无交易记录</div>}
        </div>
      </div>
    </div>
  );
}
