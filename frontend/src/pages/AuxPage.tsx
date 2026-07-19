import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, AlertCircle, Coins } from 'lucide-react';
import ExportButtons from '../components/ExportButtons';
import { getProfile } from '../api/core';

interface AuxPageConfig {
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  placeholder: string;
  placeholder2?: string;
  estimateLabel?: string;
  apiFn: (data: any) => Promise<any>;
  buildPayload: (inputs: Record<string, string>, model: string) => any;
  hints?: string[];
}

const availableModels = [
  { id: 'deepseek', label: 'DeepSeek (省钱)', desc: '性价比最高，适合日常使用' },
  { id: 'gpt-4o-mini', label: 'GPT-4o-mini (标准)', desc: '质量稳定，中等消耗' },
  { id: 'gpt-4o', label: 'GPT-4o (高级)', desc: '质量最佳，消耗较高' },
];

const CONFIGS: Record<string, AuxPageConfig> = {
  'defense-simulation': {
    title: '答辩模拟',
    subtitle: '模拟答辩委员会提问，预判评审问题',
    icon: '🎤',
    color: 'from-purple-600 to-pink-600',
    placeholder: '粘贴你的论文全文（摘要 + 目录 + 关键章节）...',
    apiFn: (d: any) => import('../api/core').then(m => m.defenseSimulation(d)),
    buildPayload: (inputs, model) => ({ text: inputs.text, model }),
    hints: ['建议粘贴论文完整内容，包含摘要、目录、方法和实验结果', '生成 10-15 个模拟提问 + 致命问题预警'],
  },
  'format-check': {
    title: '投稿格式预检',
    subtitle: '按期刊模板规范化格式（IEEE / ACL / CSSCI）',
    icon: '📐',
    color: 'from-blue-600 to-cyan-600',
    placeholder: '粘贴论文全文...',
    apiFn: (d: any) => import('../api/core').then(m => m.formatCheck(d)),
    buildPayload: (inputs, model) => ({ text: inputs.text, venue: inputs.venue || 'ACL', model }),
    hints: ['检查结构完整性、引用格式、图表编号', '支持 ACL/IEEE/SCI/CSSCI 等格式标准'],
  },
  'revision-review': {
    title: '改后复查',
    subtitle: '修改完成后 AI 对照反馈意见判断是否达标',
    icon: '✅',
    color: 'from-emerald-600 to-teal-600',
    placeholder: '粘贴论文原文（修改前版本）...',
    placeholder2: '粘贴修改后的论文内容...',
    apiFn: (d: any) => import('../api/core').then(m => m.revisionReview(d)),
    buildPayload: (inputs, model) => ({ original_text: inputs.text, revised_text: inputs.text2 || '', feedback: inputs.feedback || '', model }),
    hints: ['逐条对照反馈意见检查修改是否到位', '输出完成百分比 + 遗留问题清单'],
  },
  'literature-review': {
    title: '文献综述生成',
    subtitle: '输入 5-10 篇文献，AI 生成综述段落',
    icon: '📚',
    color: 'from-amber-600 to-orange-600',
    placeholder: '逐行粘贴文献标题和摘要...\n每行一篇，格式：标题（作者，年份）\n例：\nAttention Is All You Need (Vaswani et al., 2017)\nBERT: Pre-training of Deep Bidirectional Transformers (Devlin et al., 2019)',
    apiFn: (d: any) => import('../api/core').then(m => m.literatureReview(d)),
    buildPayload: (inputs, model) => ({ references: inputs.text, topic: inputs.topic || '', model }),
    hints: ['建议输入 5-10 篇文献，太少综述不够全面', '可以指定主题让综述更聚焦'],
  },
  'cn-to-en': {
    title: '中译英学术润色',
    subtitle: '中文论文翻译为学术英文，保留术语和风格',
    icon: '🌐',
    color: 'from-indigo-600 to-violet-600',
    placeholder: '粘贴需要翻译的中文论文内容...',
    apiFn: (d: any) => import('../api/core').then(m => m.cnToEn(d)),
    buildPayload: (inputs, model) => ({ text: inputs.text, model }),
    hints: ['保留专业术语，翻译为地道的学术英语', '附术语对照表和翻译说明'],
  },
};

export default function AuxPage({ configKey }: { configKey: string }) {
  const navigate = useNavigate();
  const cfg = CONFIGS[configKey];
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [inputs, setInputs] = useState<Record<string, string>>({ text: '', text2: '', feedback: '', venue: 'ACL', topic: '' });
  const [model, setModel] = useState('deepseek');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const [credits, setCredits] = useState<number | null>(null);
  const [estimate, setEstimate] = useState<{ points: number } | null>(null);

  useEffect(() => {
    getProfile().then(r => setCredits(r.data.credits)).catch(() => {});
  }, []);

  // 预估费用（简化：固定价格大致估算）
  const handleEstimate = async () => {
    if (!inputs.text?.trim()) { setError('请输入内容'); return; }
    setError('');
    setEstimate({ points: Math.max(100, Math.floor(inputs.text.length / 100) * 50) });
    setStep(2);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      const payload = cfg.buildPayload(inputs, model);
      const res = await cfg.apiFn(payload);
      setResult(res.data.result);
      setStep(3);
      getProfile().then(r => setCredits(r.data.credits));
    } catch (e: any) {
      setError(e.response?.data?.detail || '请求失败');
    } finally {
      setLoading(false);
    }
  };

  const isBalanceLow = credits !== null && estimate !== null && credits < estimate.points;

  const updateInput = (key: string, val: string) => setInputs(prev => ({ ...prev, [key]: val }));

  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-indigo-600 mb-4">
        <ArrowLeft size={16} /> 返回
      </button>

      {/* 使用提示 */}
      {cfg.hints && (
        <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 mb-5 text-sm text-sky-800">
          <p className="font-medium mb-1">💡 使用建议</p>
          <ul className="list-disc list-inside space-y-0.5">
            {cfg.hints.map((h, i) => <li key={i}>{h}</li>)}
          </ul>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-gray-50 rounded-xl text-3xl leading-none">{cfg.icon}</div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{cfg.title}</h1>
            <p className="text-sm text-gray-500">{cfg.subtitle}</p>
          </div>
        </div>

        {credits !== null && (
          <div className="flex items-center gap-1.5 mb-4 px-3 py-2 bg-gray-50 rounded-lg text-sm text-gray-600">
            <Coins size={14} className="text-amber-500" />
            当前余额：<span className="font-medium text-gray-800">{credits.toFixed(0)} 点</span>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">1. {cfg.placeholder2 ? '粘贴原文' : '粘贴内容'}</label>
              <textarea
                className="w-full h-40 border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder={cfg.placeholder}
                value={inputs.text}
                onChange={(e) => updateInput('text', e.target.value)}
              />
            </div>

            {cfg.placeholder2 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">2. 粘贴修改后的内容</label>
                <textarea
                  className="w-full h-40 border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder={cfg.placeholder2}
                  value={inputs.text2}
                  onChange={(e) => updateInput('text2', e.target.value)}
                />
              </div>
            )}

            {configKey === 'revision-review' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">3. 粘贴反馈意见</label>
                <textarea
                  className="w-full h-28 border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="导师或审稿人的修改意见..."
                  value={inputs.feedback}
                  onChange={(e) => updateInput('feedback', e.target.value)}
                />
              </div>
            )}

            {configKey === 'format-check' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">选择目标期刊/会议</label>
                <select
                  value={inputs.venue}
                  onChange={(e) => updateInput('venue', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm"
                >
                  <option value="ACL">ACL / EMNLP / NAACL</option>
                  <option value="IEEE">IEEE 期刊/会议</option>
                  <option value="SCI-1">SCI 一区</option>
                  <option value="CSSCI">CSSCI / 北大核心</option>
                  <option value="CSCD">CSCD / 国内理工核心</option>
                </select>
              </div>
            )}

            {configKey === 'literature-review' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">综述主题（可选）</label>
                <input
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm"
                  placeholder="例如：基于Transformer的文本分类方法"
                  value={inputs.topic}
                  onChange={(e) => updateInput('topic', e.target.value)}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">选择 AI 模型</label>
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
              <h3 className="font-bold text-indigo-900 mb-1">费用预估</h3>
              <p className="text-sm text-indigo-800">
                约消耗 <span className="font-bold">{estimate.points} 点</span>
              </p>
            </div>

            {isBalanceLow && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-2">
                <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-800">点数不足</p>
                  <button onClick={() => navigate('/credits')} className="mt-1 px-3 py-1 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700">
                    去充值 →
                  </button>
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
                {loading ? '处理中...' : '确认并执行'}
              </button>
            </div>
            {error && <p className="text-sm text-red-600 flex items-center gap-1"><AlertCircle size={14} /> {error}</p>}
          </div>
        )}

        {step === 3 && result && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900">生成结果</h3>
              <div className="flex items-center gap-2">
                <ExportButtons content={result} title={cfg.title} />
                <button onClick={() => { setStep(1); setResult(''); }} className="text-sm text-indigo-600 hover:underline">
                  继续使用
                </button>
              </div>
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
