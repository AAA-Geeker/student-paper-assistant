import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, ArrowLeft, Loader2, AlertCircle, CheckCircle, Info, Coins, FileEdit } from 'lucide-react';
import ExportButtons from '../components/ExportButtons';
import { preSubmissionReview, estimatePreSubmissionReview, getProfile } from '../api/core';

const venues = [
  { id: 'ACL', label: 'ACL / EMNLP / NAACL（NLP 顶会）' },
  { id: 'CVPR', label: 'CVPR / ICCV / ECCV（计算机视觉）' },
  { id: 'SCI-1', label: 'SCI 一区期刊' },
  { id: 'SCI-2', label: 'SCI 二区期刊' },
  { id: 'CSSCI', label: 'CSSCI / 北大核心（国内人文社科）' },
  { id: 'CSCD', label: 'CSCD / 国内理工核心' },
];

const availableModels = [
  { id: 'deepseek', label: 'DeepSeek (省钱)', desc: '性价比最高，适合日常使用' },
  { id: 'gpt-4o-mini', label: 'GPT-4o-mini (标准)', desc: '质量稳定，中等消耗' },
  { id: 'gpt-4o', label: 'GPT-4o (高级)', desc: '质量最佳，消耗较高' },
];

export default function ReviewPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [text, setText] = useState('');
  const [venue, setVenue] = useState('ACL');
  const [venueType, setVenueType] = useState<'conference' | 'journal'>('conference');
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
    if (text.length < 300) { setError('请输入至少 300 字，建议包含摘要和核心章节'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await estimatePreSubmissionReview({ text, venue, venue_type: venueType });
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
      const res = await preSubmissionReview({ text, venue, venue_type: venueType, urgent, model });
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
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-indigo-600 mb-4">
        <ArrowLeft size={16} /> 返回
      </button>

      {/* 💡 使用时机提示 */}
      <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 mb-5 text-sm text-sky-800">
        <div className="flex items-start gap-2">
          <Info size={18} className="shrink-0 mt-0.5 text-sky-500" />
          <div>
            <p className="font-medium mb-1">💡 什么时候用这个功能？</p>
            <p>
              投稿前心里没底？把论文贴进来，让 AI 模拟你目标期刊/会议的审稿人进行全面审查。
              建议粘贴 2000 字以上（包含摘要、方法、实验部分），字数越少审查越不全面。
              审查完成后会生成优先级修改清单，帮你提前发现 critical 问题。
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl"><ShieldCheck size={24} /></div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">投稿前审查</h1>
            <p className="text-sm text-gray-500">模拟审稿人视角，提前发现论文致命问题</p>
          </div>
        </div>

        {/* 余额提示条 */}
        {credits !== null && (
          <div className="flex items-center gap-1.5 mb-4 px-3 py-2 bg-gray-50 rounded-lg text-sm text-gray-600">
            <Coins size={14} className="text-amber-500" />
            当前余额：<span className="font-medium text-gray-800">{credits.toFixed(0)} 点</span>
            {credits < 500 && (
              <button onClick={() => navigate('/credits')} className="ml-auto text-indigo-600 hover:underline text-xs font-medium">
                余额不足？去充值 →
              </button>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">1. 选择目标期刊/会议</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                {venues.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setVenue(v.id)}
                    className={`text-left p-3 rounded-lg border text-sm transition-all ${
                      venue === v.id ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-300' : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                {(['conference', 'journal'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setVenueType(t)}
                    className={`px-3 py-1 rounded-full text-xs border ${
                      venueType === t ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200'
                    }`}
                  >
                    {t === 'conference' ? '会议' : '期刊'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">2. 粘贴论文内容（建议包含摘要、方法、实验）</label>
              <textarea
                className="w-full h-64 border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="粘贴论文主要章节...&#10;建议至少包含：摘要、Introduction、方法、实验与结果"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <div className="text-right text-xs text-gray-400 mt-1">{text.length} 字</div>
            </div>

            {/* 模型选择 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">3. 选择 AI 模型（影响质量和消耗）</label>
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
                id="urgent-review"
                type="checkbox"
                checked={urgent}
                onChange={(e) => setUrgent(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="urgent-review" className="text-sm text-gray-700">加急处理（2 倍点数，优先返回）</label>
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
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle size={18} className="text-indigo-600" />
                <h3 className="font-bold text-indigo-900">费用预估</h3>
              </div>
              <p className="text-sm text-indigo-800 mb-1">
                目标 {venue}，约 {text.length} 字，预计消耗
                <span className="font-bold">{estimate.is_free ? '0' : estimate.points} 点</span>
              </p>
              <p className="text-xs text-indigo-600">
                {estimate.is_free ? '今天还有免费次数，本次不扣点' : '确认后将立即扣点并生成审稿报告'}
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
                className="flex-1 bg-indigo-600 text-white py-2.5 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading && <Loader2 size={18} className="animate-spin" />}
                {loading ? '生成中...' : '确认并生成报告'}
              </button>
            </div>
            {error && <p className="text-sm text-red-600 flex items-center gap-1"><AlertCircle size={14} /> {error}</p>}
          </div>
        )}

        {step === 3 && result && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="font-bold text-gray-900">审稿报告</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    // 跳转到修改页，带上原文和审稿意见
                    navigate('/revision', {
                      state: { feedback: result, originalText: text }
                    });
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-medium hover:bg-emerald-100 border border-emerald-200 transition-colors"
                >
                  <FileEdit size={14} />
                  根据审稿建议修改原文
                </button>
                <button
                  onClick={() => { setStep(1); setResult(''); setText(''); }}
                  className="text-sm text-indigo-600 hover:underline"
                >
                  重新审查
                </button>
              </div>
            </div>
            {/* 导出按钮 */}
            <div className="flex justify-end">
              <ExportButtons content={result} title={`审稿报告-${venue}`} />
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
