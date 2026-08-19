import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  FileEdit, ArrowLeft, Loader2, AlertCircle, CheckCircle, Info, Coins,
  User, BookOpen, Pencil, MessageSquare, Upload,
  Copy
} from 'lucide-react';
import ExportButtons from '../components/ExportButtons';
import WorkflowSteps from '../components/WorkflowSteps';
import FileImportButton from '../components/FileImportButton';
import { Button } from '../components/ui/button';
import { paperRevision, advisorRevision, uploadAdvisorPDF, reviewerRevision, getProfile } from '../api/core';
import type { WorkflowResponse } from '../api/core';

const scenarioTags = [
  {
    id: 'advisor',
    label: '导师意见修改',
    icon: User,
    desc: '根据导师的批注和修改意见逐条落实修改',
    color: 'from-violet-500 to-purple-600',
    lightColor: 'border-violet-200 bg-violet-50',
    textColor: 'text-violet-700',
    ringColor: 'ring-violet-300',
  },
  {
    id: 'reviewer',
    label: '审稿反馈修改',
    icon: BookOpen,
    desc: '根据审稿人意见修改论文，应对审稿周期',
    color: 'from-blue-500 to-indigo-600',
    lightColor: 'border-blue-200 bg-blue-50',
    textColor: 'text-blue-700',
    ringColor: 'ring-blue-300',
  },
  {
    id: 'self',
    label: '自我修改',
    icon: Pencil,
    desc: '自己发现的表达问题或逻辑漏洞，主动修改提升质量',
    color: 'from-emerald-500 to-teal-600',
    lightColor: 'border-emerald-200 bg-emerald-50',
    textColor: 'text-emerald-700',
    ringColor: 'ring-emerald-300',
  },
];

type Step = 'input' | 'result';

const workflowNodes = {
  input: [
    { id: 'parse', name: '解析反馈', description: '理解反馈意见的深层需求', icon: '📋', status: 'pending' as const },
    { id: 'revise', name: '逐条修改', description: '针对每条反馈落实修改', icon: '✏️', status: 'pending' as const },
    { id: 'integrate', name: '整合输出', description: '合并所有修改生成完整段落', icon: '🔄', status: 'pending' as const },
    { id: 'review', name: '复查确认', description: '对照反馈检查修改是否达标', icon: '✅', status: 'pending' as const },
  ],
  running: [
    { id: 'parse', name: '解析反馈', description: '理解反馈意见的深层需求', icon: '📋', status: 'completed' as const },
    { id: 'revise', name: '逐条修改', description: '针对每条反馈落实修改', icon: '✏️', status: 'running' as const },
    { id: 'integrate', name: '整合输出', description: '合并所有修改生成完整段落', icon: '🔄', status: 'pending' as const },
    { id: 'review', name: '复查确认', description: '对照反馈检查修改是否达标', icon: '✅', status: 'pending' as const },
  ],
  complete: [
    { id: 'parse', name: '解析反馈', description: '理解反馈意见的深层需求', icon: '📋', status: 'completed' as const },
    { id: 'revise', name: '逐条修改', description: '针对每条反馈落实修改', icon: '✏️', status: 'completed' as const },
    { id: 'integrate', name: '整合输出', description: '合并所有修改生成完整段落', icon: '🔄', status: 'completed' as const },
    { id: 'review', name: '复查确认', description: '对照反馈检查修改是否达标', icon: '✅', status: 'completed' as const },
  ],
  error: [
    { id: 'parse', name: '解析反馈', description: '理解反馈意见的深层需求', icon: '📋', status: 'completed' as const },
    { id: 'revise', name: '逐条修改', description: '针对每条反馈落实修改', icon: '✏️', status: 'error' as const },
    { id: 'integrate', name: '整合输出', description: '合并所有修改生成完整段落', icon: '🔄', status: 'pending' as const },
    { id: 'review', name: '复查确认', description: '对照反馈检查修改是否达标', icon: '✅', status: 'pending' as const },
  ],
};

/** 导师场景专用：上传带批注 PDF，调用后端直接生成批注修改结果 */
function AdvisorPdfUploadButton({ loading, onFile }: { loading: boolean; onFile: (file: File) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-400 hidden sm:inline">支持含高亮/批注的PDF</span>
      <button
        type="button"
        disabled={loading}
        onClick={() => ref.current?.click()}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-violet-200 bg-violet-50 text-violet-700 text-sm font-medium hover:bg-violet-100 disabled:opacity-50 transition-colors"
      >
        {loading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
        上传带批注PDF
      </button>
      <input
        ref={ref}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}

export default function RevisionPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as Record<string, any> | null;

  const [step, setStep] = useState<Step>('input');

  const [text, setText] = useState(locationState?.originalText || '');
  const [feedback, setFeedback] = useState(locationState?.feedback || '');
  const [scenario, setScenario] = useState(locationState?.scenario || 'advisor');

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WorkflowResponse | null>(null);
  const [error, setError] = useState('');
  const [credits, setCredits] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getProfile().then(r => setCredits(r.data.credits)).catch(() => {});
  }, []);

  // 当 location.state 变化时自动填充
  useEffect(() => {
    if (locationState?.originalText) setText(locationState.originalText);
    if (locationState?.feedback) setFeedback(locationState.feedback);
    if (locationState?.scenario) setScenario(locationState.scenario);
  }, [locationState]);

  /** 校验输入，然后按所选场景分发给对应后端能力，直接执行 */
  const handleStart = async () => {
    if (text.length < 100) { setError('请输入至少 100 字的论文内容'); return; }
    if (!feedback.trim()) {
      setError(scenario === 'advisor' ? '请输入导师批注意见' : scenario === 'reviewer' ? '请输入审稿人意见' : '请输入反馈意见');
      return;
    }
    setLoading(true);
    setError('');
    try {
      let res;
      if (scenario === 'advisor') {
        res = await advisorRevision({ original_text: text, annotations: feedback });
      } else if (scenario === 'reviewer') {
        res = await reviewerRevision({ original_text: text, reviewer_comments: feedback });
      } else {
        res = await paperRevision({ text, feedback });
      }
      setResult(res.data);
      setStep('result');
      getProfile().then(r => setCredits(r.data.credits));
    } catch (e: any) {
      setError(e.response?.data?.detail || '请求失败');
    } finally {
      setLoading(false);
    }
  };

  /** 导师场景：直接上传带批注 PDF（跳过估算，与后端 upload 端点对应用完即出结果） */
  const handleAdvisorPdf = async (file: File) => {
    setLoading(true);
    setError('');
    try {
      const res = await uploadAdvisorPDF(file);
      setResult(res.data);
      setStep('result');
      getProfile().then(r => setCredits(r.data.credits));
    } catch (e: any) {
      setError(e.response?.data?.detail || 'PDF 处理失败');
    } finally {
      setLoading(false);
    }
  };

  const resetAll = () => {
    setStep('input');
    setResult(null);
    setError('');
    setCopied(false);
  };

  const handleCopy = (content: string) => {
    navigator.clipboard?.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const activeScenarioTag = scenarioTags.find(s => s.id === scenario);

  // ─── workflow structure ───
  const workflow = result
    ? result.workflow || {
        type: 'revision',
        title: `论文修改 — ${scenarioTags.find(s => s.id === scenario)?.label || ''}`,
        description: '修改流程',
        nodes: workflowNodes.complete,
      }
    : loading
    ? {
        type: 'revision',
        title: '正在修改...',
        description: '逐条处理反馈意见',
        nodes: workflowNodes.running,
      }
    : null;

  const currentProgress = loading ? 1 : result ? 4 : undefined;

  return (
    <div className="max-w-4xl mx-auto">
      {/* 返回按钮 */}
      <button
        onClick={() => step === 'result' ? resetAll() : navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 mb-5 transition-colors group"
      >
        <ArrowLeft size={15} className="group-hover:-translate-x-0.5 transition-transform" />
        {step === 'result' ? '返回修改' : '返回'}
      </button>

      {/* 页面标题 */}
      <div className="flex items-start gap-4 mb-6">
        <div className={`p-3 rounded-xl bg-gradient-to-br ${activeScenarioTag?.color || 'from-emerald-500 to-emerald-600'} text-white shadow-lg shrink-0`}>
          <FileEdit size={24} />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">论文修改</h1>
          <p className="text-sm text-gray-500">
            粘贴原文和反馈意见，AI 逐条解析并生成修改方案
          </p>
        </div>
      </div>

      {/* 余额提示条 */}
      {credits !== null && (
        <div className="flex items-center gap-2 mb-5 px-4 py-2.5 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200 text-sm text-amber-800">
          <Coins size={15} className="text-amber-500 shrink-0" />
          <span>
            余额：<span className="font-bold">{credits.toFixed(0)} 点</span>
          </span>
          {credits < 300 && (
            <button
              onClick={() => navigate('/credits')}
              className="ml-auto text-amber-700 hover:text-amber-900 font-medium text-xs px-2.5 py-1 rounded-lg bg-white/70 hover:bg-white transition-colors"
            >
              去充值 →
            </button>
          )}
        </div>
      )}

      {/* 工作流可视化 */}
      {step === 'result' || loading ? (
        <WorkflowSteps
          workflow={workflow}
          currentStep={currentProgress}
        />
      ) : null}

      {/* ======== STEP 1: 输入 ======== */}
      {step === 'input' && (
        <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
          {/* 场景选择 */}
          <div className="px-6 pt-6 pb-2 border-b border-gray-100">
            <label className="block text-sm font-semibold text-gray-800 mb-3">
              修改场景
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {scenarioTags.map((tag) => {
                const TagIcon = tag.icon;
                const isActive = scenario === tag.id;
                return (
                  <button
                    key={tag.id}
                    onClick={() => setScenario(tag.id)}
                    className={`relative text-left p-3.5 rounded-xl border-2 text-sm transition-all ${
                      isActive
                        ? `${tag.lightColor} ${tag.ringColor} ring-1 scale-[1.02]`
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <div className={`p-1.5 rounded-lg ${isActive ? `bg-white/70 ${tag.textColor}` : 'bg-gray-100 text-gray-500'}`}>
                        <TagIcon size={16} />
                      </div>
                      <span className={`font-semibold ${isActive ? tag.textColor : 'text-gray-800'}`}>
                        {tag.label}
                      </span>
                      {isActive && (
                        <CheckCircle size={14} className={`ml-auto ${tag.textColor}`} />
                      )}
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed pl-[42px]">
                      {tag.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-6 space-y-5">
            {/* 反馈意见输入（随场景变化） */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                  <MessageSquare size={15} className="text-gray-400" />
                  {scenario === 'advisor'
                    ? <>粘贴导师批注 <span className="text-red-500">*</span></>
                    : scenario === 'reviewer'
                      ? <>粘贴审稿人意见 <span className="text-red-500">*</span></>
                      : <>粘贴反馈意见 <span className="text-red-500">*</span></>}
                </label>
                {scenario === 'advisor' ? (
                  <AdvisorPdfUploadButton loading={loading} onFile={handleAdvisorPdf} />
                ) : (
                  <FileImportButton onText={setText} hint=".doc 请另存为 .docx；PDF 需为可选中文本" />
                )}
              </div>
              <textarea
                className="w-full h-28 border border-gray-200 rounded-xl p-3.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow resize-y placeholder:text-gray-300"
                placeholder={
                  scenario === 'advisor'
                    ? `导师说"这段逻辑不够清晰"、"实验部分需要完善"——把导师的原话或批注贴在这里...`
                    : scenario === 'reviewer'
                      ? `粘贴审稿人发给你的评审意见（含评分和具体建议）...`
                      : `导师或审稿人的反馈意见贴在这里...`
                }
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
              />
              <div className="flex items-center justify-between mt-1.5">
                <p className="text-xs text-gray-400">贴得越详细，修改越精准</p>
                <span className={`text-xs ${feedback.length > 100 ? 'text-gray-400' : 'text-gray-300'}`}>
                  {feedback.length} 字
                </span>
              </div>
            </div>

            {/* 论文原文输入 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                  <FileEdit size={15} className="text-gray-400" />
                  粘贴论文原文（需要修改的段落） <span className="text-red-500">*</span>
                </label>
                <FileImportButton onText={setText} hint=".doc 请另存为 .docx；PDF 需为可选中文本" />
              </div>
              <textarea
                className="w-full h-44 border border-gray-200 rounded-xl p-3.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow resize-y placeholder:text-gray-300"
                placeholder="把论文中需要根据反馈意见修改的段落粘贴在这里..."
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <div className="text-right mt-1.5">
                <span className={`text-xs ${text.length > 100 ? 'text-gray-400' : 'text-gray-300'}`}>
                  {text.length} 字
                </span>
              </div>
            </div>

            {/* 提示横幅 */}
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-4 border border-indigo-100">
              <div className="flex items-start gap-2.5">
                <Info size={16} className="shrink-0 mt-0.5 text-indigo-400" />
                <div className="text-xs text-indigo-700 leading-relaxed">
                  <span className="font-medium">点击执行即可。</span>
                  系统将直接生成修改方案，无需额外确认。
                </div>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                <AlertCircle size={15} className="shrink-0" />
                {error}
              </div>
            )}

            <Button
              onClick={handleStart}
              disabled={loading}
              className="w-full gap-2"
            >
              {loading ? (
                <><Loader2 size={18} className="animate-spin" /> 处理中...</>
              ) : (
                <><FileEdit size={18} /> 开始修改</>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* ======== STEP 2 结果 ======== */}
      {step === 'result' && result && (
        <div className="space-y-5">
          {/* 结果头部：标签 + 导出 */}
          <div className="flex items-center flex-wrap gap-3">
            {/* 场景标签 */}
            {activeScenarioTag && (
              <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium ${activeScenarioTag.lightColor} ${activeScenarioTag.textColor}`}>
                <User size={13} />
                {activeScenarioTag.label}
              </div>
            )}
            {/* 字数变化 */}
            {result.comparison && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-50 border border-gray-200 text-xs text-gray-500">
                原文 {result.comparison.stats.original_chars} 字 →
                修改后 {result.comparison.stats.revised_chars} 字
              </div>
            )}
            <div className="ml-auto flex items-center gap-2">
              <ExportButtons content={result.result || result.revised_text} title="论文修改方案" />
            </div>
          </div>

          {/* 修改结果 */}
          <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
            <div className="p-5">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-gray-800">修改后文本</h4>
                  <button
                    onClick={() => handleCopy(result.result || result.revised_text)}
                    className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-all ${
                      copied
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    {copied ? <CheckCircle size={13} /> : <Copy size={13} />}
                    {copied ? '已复制' : '复制'}
                  </button>
                </div>
                <div
                  className="prose prose-sm max-w-none bg-gradient-to-br from-gray-50 to-white p-5 rounded-xl border border-gray-200 whitespace-pre-wrap text-sm text-gray-800 leading-relaxed"
                >
                  {(result.result || result.revised_text).split('\n').map((line, i) => (
                    <p key={i} className={line.trim() === '' ? 'h-3' : 'mb-2'}>
                      {line || '\u00A0'}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 继续修改 */}
          <div className="flex justify-center">
            <button
              onClick={resetAll}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-white border-2 border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:border-indigo-300 hover:text-indigo-700 hover:shadow-sm transition-all group"
            >
              <FileEdit size={16} className="group-hover:scale-110 transition-transform" />
              继续修改另一段
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
