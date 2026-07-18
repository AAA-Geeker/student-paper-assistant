import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileEdit, ArrowLeft, Loader2, AlertCircle, CheckCircle, Info, Coins } from 'lucide-react';
import { paperRevision, estimatePaperRevision, getProfile } from '../api/core';

const revisionStyles = [
  { id: 'minimal' as const, label: '最小改动', desc: '只修改反馈中明确指出的问题，尽量保持原文结构' },
  { id: 'standard' as const, label: '标准改写', desc: '针对每条反馈重写相关段落，提升表达质量（推荐）' },
  { id: 'deep' as const, label: '深度重构', desc: '必要时调整段落结构、补充论证、重新组织内容' },
];

const availableModels = [
  { id: 'deepseek', label: 'DeepSeek (省钱)', desc: '性价比最高，适合日常使用' },
  { id: 'gpt-4o-mini', label: 'GPT-4o-mini (标准)', desc: '质量稳定，中等消耗' },
  { id: 'gpt-4o', label: 'GPT-4o (高级)', desc: '质量最佳，消耗较高' },
];

export default function RevisionPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [text, setText] = useState('');
  const [feedback, setFeedback] = useState('');
  const [style, setStyle] = useState<'minimal' | 'standard' | 'deep'>('standard');
  const [urgent, setUrgent] = useState(false);
  const [model, setModel] = useState('deepseek');
  const [estimate, setEstimate] = useState<{ points: number; is_free: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const [credits, setCredits] = useState<number | null>(null);

  useEffect(() => {
    getProfile().then(r => setCredits(r.data.credits)).catch(() => {});
  }, []);

  const handleEstimate = async () => {
    if (text.length < 100) { setError('请输入至少 100 字的论文内容'); return; }
    if (!feedback.trim()) { setError('请输入导师或审稿人的反馈意见'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await estimatePaperRevision({ text, feedback, style });
      setEstimate(res.data);
      setStep(2);
    } catch (e: any) {
      setError(e.response?.data?.detail || '请求失败，请检查网络或重新登录');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await paperRevision({ text, feedback, style, urgent, model });
      setResult(res.data.result);
      setStep(3);
      getProfile().then(r => setCredits(r.data.credits));
    } catch (e: any) {
      setError(e.response?.data?.detail || '请求失败');
    } finally {
      setLoading(false);
    }
  };

  const isBalanceLow = credits !== null && estimate !== null && !estimate.is_free && credits < estimate.points;

  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={() => navigate('/dashboard')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-indigo-600 mb-4">
        <ArrowLeft size={16} /> 返回工作台
      </button>

      {/* 💡 使用时机提示 */}
      <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 mb-5 text-sm text-sky-800">
        <div className="flex items-start gap-2">
          <Info size={18} className="shrink-0 mt-0.5 text-sky-500" />
          <div>
            <p className="font-medium mb-1">💡 什么时候用这个功能？</p>
            <p>
              导师说"这段逻辑不够清晰"、"实验部分需要完善"——但不知道具体怎么改？
              把论文原文和导师的原话（或审稿人的修改意见）一起贴进来，AI 逐条解析反馈，
              生成具体的修改方案。支持最小改动、标准改写、深度重构三种力度。
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl"><FileEdit size={24} /></div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">论文修改——根据反馈改稿</h1>
            <p className="text-sm text-gray-500">收到导师或审稿人的修改意见？把原文和反馈贴进来，一键生成修改方案</p>
          </div>
        </div>

        {/* 余额提示条 */}
        {credits !== null && (
          <div className="flex items-center gap-1.5 mb-4 px-3 py-2 bg-gray-50 rounded-lg text-sm text-gray-600">
            <Coins size={14} className="text-amber-500" />
            当前余额：<span className="font-medium text-gray-800">{credits.toFixed(0)} 点</span>
            {credits < 300 && (
              <button onClick={() => navigate('/credits')} className="ml-auto text-indigo-600 hover:underline text-xs font-medium">
                余额不足？去充值 →
              </button>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                1. 粘贴导师/审稿人的反馈意见 <span className="text-red-500">*</span>
              </label>
              <textarea
                className="w-full h-32 border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="把导师或审稿人给你的修改意见粘贴在这里...&#10;例如：实验部分缺少消融实验、Introduction 的故事线不够清晰、结论部分需要补充局限性分析..."
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
              />
              <div className="text-right text-xs text-gray-400 mt-1">{feedback.length} 字</div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                2. 粘贴需要修改的论文内容 <span className="text-red-500">*</span>
              </label>
              <textarea
                className="w-full h-48 border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="粘贴论文中需要根据反馈内容修改的章节..."
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <div className="text-right text-xs text-gray-400 mt-1">{text.length} 字</div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">3. 选择修改风格</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {revisionStyles.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setStyle(s.id as 'minimal' | 'standard' | 'deep')}
                    className={`text-left p-3 rounded-lg border text-sm transition-all ${
                      style === s.id ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-300' : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="font-medium text-gray-900 mb-1">{s.label}</div>
                    <div className="text-xs text-gray-500">{s.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* 模型选择 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">4. 选择 AI 模型（影响质量和消耗）</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {availableModels.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setModel(m.id)}
                    className={`text-left p-2.5 rounded-lg border text-sm transition-all ${
                      model === m.id ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-300' : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="font-medium text-gray-900">{m.label}</div>
                    <div className="text-xs text-gray-500">{m.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
              <input
                id="urgent-revision"
                type="checkbox"
                checked={urgent}
                onChange={(e) => setUrgent(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="urgent-revision" className="text-sm text-gray-700">加急处理（2 倍点数，优先返回）</label>
            </div>

            {error && <p className="text-sm text-red-600 flex items-center gap-1"><AlertCircle size={14} /> {error}</p>}

            <button
              onClick={handleEstimate}
              className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-medium hover:bg-indigo-700"
            >
              下一步：预估费用
            </button>
          </div>
        )}

        {step === 2 && estimate && (
          <div className="space-y-5">
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle size={18} className="text-emerald-600" />
                <h3 className="font-bold text-emerald-900">费用预估</h3>
              </div>
              <p className="text-sm text-emerald-800 mb-1">
                论文约 {text.length} 字，采用「{revisionStyles.find(s => s.id === style)?.label || '标准改写'}」，预计消耗
                <span className="font-bold">{estimate.is_free ? '0' : estimate.points} 点</span>
              </p>
              <p className="text-xs text-emerald-600">
                {estimate.is_free ? '今天还有免费次数，本次不扣点' : '确认后将立即扣点并生成修改方案'}
              </p>
            </div>

            {/* 余额不足警示 */}
            {isBalanceLow && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-800">点数不足</p>
                    <p className="text-xs text-red-600 mt-1">当前余额 {credits?.toFixed(0)} 点，需要 {estimate.points} 点</p>
                    <button
                      onClick={() => navigate('/credits')}
                      className="mt-2 px-3 py-1.5 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700"
                    >
                      去充值 →
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                返回修改
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || isBalanceLow}
                className="flex-1 bg-emerald-600 text-white py-2.5 rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading && <Loader2 size={18} className="animate-spin" />}
                {loading ? '正在生成修改方案...' : '确认并生成方案'}
              </button>
            </div>
            {error && <p className="text-sm text-red-600 flex items-center gap-1"><AlertCircle size={14} /> {error}</p>}
          </div>
        )}

        {step === 3 && result && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900">修改方案</h3>
              <button
                onClick={() => { setStep(1); setResult(''); setText(''); setFeedback(''); }}
                className="text-sm text-indigo-600 hover:underline"
              >
                继续修改
              </button>
            </div>
            <div className="prose prose-sm max-w-none bg-gray-50 p-4 rounded-lg border border-gray-200">
              <pre className="whitespace-pre-wrap font-sans text-sm text-gray-800">{result}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
