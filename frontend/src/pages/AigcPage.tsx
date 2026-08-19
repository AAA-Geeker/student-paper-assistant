import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowLeft, Loader2, AlertCircle, Coins, CheckCircle2, ChevronRight } from 'lucide-react';
import ComparisonView from '../components/ComparisonView';
import WorkflowSteps from '../components/WorkflowSteps';
import ExportButtons from '../components/ExportButtons';
import FileImportButton from '../components/FileImportButton';
import { Button } from '../components/ui/button';
import { aigcRewrite, getProfile } from '../api/core';
import type { WorkflowResponse } from '../api/core';

const platforms = ['知网', '维普', '万方', 'Turnitin', 'GPTZero', '格子达'];

export default function AigcPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [text, setText] = useState('');
  const [platform, setPlatform] = useState('知网');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WorkflowResponse | null>(null);
  const [error, setError] = useState('');
  const [credits, setCredits] = useState<number | null>(null);

  useEffect(() => {
    getProfile()
      .then(r => setCredits(r.data.credits))
      .catch(() => { /* not logged in */ });
  }, []);

  // ── 直接执行 ────────────────────────────────────
  const handleSubmit = async () => {
    const trimmed = text.trim();
    if (trimmed.length < 100) {
      setError('请输入至少 100 字');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await aigcRewrite({
        text: trimmed,
        target: 'plagiarism',
        platform,
      });
      setResult(res.data);
      setStep(3);
      // 刷新余额
      getProfile()
        .then(r => setCredits(r.data.credits))
        .catch(() => {});
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.message ?? '请求失败');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setStep(1);
    setResult(null);
    setText('');
    setError('');
  };

  // ── 步骤 ①：输入 ────────────────────────────────
  const renderInputStep = () => (
    <div className="space-y-6">
      {/* 文本区 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700">
            粘贴需要处理的文本
          </label>
          <FileImportButton onText={setText} hint="PDF 需为可选中文本（非扫描图片），.doc 请另存为 .docx" />
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="建议粘贴论文中重复率或 AIGC 率较高的段落…"
          className="w-full h-44 border border-gray-300 rounded-xl p-4 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow resize-y placeholder:text-gray-400"
        />
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-xs text-gray-400">
            {text.length < 100
              ? `还需 ${100 - text.length} 字`
              : '✓ 字数达标'}
          </span>
          <span className="text-xs text-gray-400">{text.length} 字</span>
        </div>
      </div>

      {/* 平台选择 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          检测平台（用于匹配改写风格）
        </label>
        <div className="flex flex-wrap gap-2">
          {platforms.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPlatform(p)}
              className={`px-3 py-1.5 rounded-lg text-sm border transition-all font-medium ${
                platform === p
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <Button
        type="button"
        onClick={handleSubmit}
        disabled={loading || text.length < 100}
        className="w-full gap-2"
      >
        {loading ? (
          <><Loader2 size={18} className="animate-spin" /> 处理中…</>
        ) : (
          <><Sparkles size={18} /> 开始处理</>
        )}
      </Button>
    </div>
  );

  // ── 步骤 ③：结果 ────────────────────────────────
  const renderResultStep = () => {
    if (!result) return null;
    return (
      <div className="space-y-5">
        {/* 工作流可视化 */}
        <WorkflowSteps workflow={result.workflow} />

        {/* 结果操作栏 */}
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900 text-base">改写结果</h3>
          <div className="flex items-center gap-2">
            <ExportButtons
              content={result.revised_text || result.result}
              title="降重改写结果"
            />
            <button
              type="button"
              onClick={resetForm}
              className="text-sm text-indigo-600 hover:text-indigo-700 font-medium hover:underline"
            >
              继续改写
            </button>
          </div>
        </div>

        {/* 对比视图 */}
        <ComparisonView
          comparison={result.comparison ?? null}
          originalText={result.original_text}
          revisedText={result.revised_text}
        />

        {/* 原文 / 改后 fallback */}
        {!result.comparison && (
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">原文</h4>
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                {result.original_text}
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">修改后</h4>
              <div className="bg-white rounded-xl p-4 border border-gray-200 text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                {result.revised_text || result.result}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── 主渲染 ─────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto pb-10">
      {/* 返回 */}
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-indigo-600 mb-4 transition-colors"
      >
        <ArrowLeft size={16} /> 返回
      </button>

      {/* 头部 */}
      <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
        {/* 装饰条 */}
        <div className="h-1.5 bg-gradient-to-r from-rose-400 via-primary to-fuchsia-400" />

        <div className="p-6 sm:p-8">
          {/* 标题区 */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-rose-50 text-rose-600 rounded-xl shadow-sm">
                <Sparkles size={24} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">降重 / 降 AIGC</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  帮助查重或 AIGC 检测不通过的段落，保留原意、降低重复率
                </p>
              </div>
            </div>

            {/* 余额 */}
            {credits !== null && (
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 rounded-full text-sm text-gray-600 border border-gray-100">
                <Coins size={14} className="text-amber-500" />
                <span className="font-medium text-gray-800">{credits.toFixed(0)} 点</span>
                {credits < 200 && (
                  <button
                    onClick={() => navigate('/credits')}
                    className="ml-1 text-indigo-600 hover:underline text-xs font-medium"
                  >
                    充值
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 步骤指示器 */}
          <div className="flex items-center gap-2 mb-6 text-sm">
            {(['输入文本', '查看结果'] as const).map((label, idx) => {
              const stepNum = (idx + 1) as 1 | 2 | 3;
              const isActive = step === stepNum;
              const isDone = step > stepNum;
              return (
                <div key={label} className="flex items-center gap-2">
                  <div
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-indigo-100 text-indigo-700'
                        : isDone
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-gray-50 text-gray-400'
                    }`}
                  >
                    {isDone ? (
                      <CheckCircle2 size={12} />
                    ) : (
                      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold bg-current text-white">
                        {stepNum}
                      </span>
                    )}
                    <span>{label}</span>
                  </div>
                  {stepNum < 3 && <ChevronRight size={14} className="text-gray-300" />}
                </div>
              );
            })}
          </div>

          {/* 余额移动端提示 */}
          {credits !== null && credits < 200 && step < 3 && (
            <div className="flex sm:hidden items-center gap-1.5 mb-4 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
              <Coins size={14} />
              <span>
                余额 <span className="font-medium">{credits.toFixed(0)} 点</span>，
                <button
                  onClick={() => navigate('/credits')}
                  className="text-indigo-600 hover:underline font-medium ml-1"
                >
                  去充值 →
                </button>
              </span>
            </div>
          )}

          {/* 使用时机（仅步骤 1 显示） */}
          {step === 1 && (
            <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 mb-6 text-sm text-sky-800">
              <div className="flex items-start gap-2">
                <span className="text-base shrink-0 mt-0.5">💡</span>
                <div>
                  <p className="font-semibold mb-1">什么时候用这个功能？</p>
                  <p className="leading-relaxed">
                    如果你收到查重报告（知网 / 维普 / Turnitin）标红的段落，或者 AIGC 检测报告（GPTZero / 格子达）显示 AI 率过高，把有问题的段落粘贴进来。
                    如果还没检测过，建议先联系学校或使用查重服务。
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 步骤内容 */}
          {step === 1 && renderInputStep()}
          {step === 3 && renderResultStep()}
        </div>
      </div>
    </div>
  );
}
