import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, AlertCircle, Coins, Upload, FileText, MessageSquareText } from 'lucide-react';
import WorkflowSteps from '../components/WorkflowSteps';
import ExportButtons from '../components/ExportButtons';
import { getProfile, advisorRevision, uploadAdvisorPDF } from '../api/core';
import type { Workflow, ComparisonResult } from '../api/core';

export default function AdvisorRevisionPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [originalText, setOriginalText] = useState('');
  const [annotations, setAnnotations] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    workflow?: Workflow;
    original_text: string;
    revised_text: string;
    comparison?: ComparisonResult;
    result: string;
  } | null>(null);
  const [error, setError] = useState('');
  const [credits, setCredits] = useState<number | null>(null);
  const [activeRole, setActiveRole] = useState<string>('advisor');
  const [importMode, setImportMode] = useState<'paste' | 'upload'>('paste');

  useEffect(() => {
    getProfile().then(r => setCredits(r.data.credits)).catch(() => {});
  }, []);

  const handleSubmit = async () => {
    if (!originalText.trim()) { setError('请输入论文内容'); return; }
    if (!annotations.trim() && !uploadedFile) { setError('请输入或上传导师批注'); return; }

    setLoading(true);
    setError('');
    try {
      let res;
      if (importMode === 'upload' && uploadedFile) {
        res = await uploadAdvisorPDF(uploadedFile);
      } else {
        res = await advisorRevision({ original_text: originalText, annotations });
      }
      setResult(res.data);
      setStep(3);
      getProfile().then(r => setCredits(r.data.credits));
    } catch (e: any) {
      setError(e.response?.data?.detail || '请求失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4 transition-colors">
        <ArrowLeft size={16} /> 返回
      </button>

      {/* 角色场景切换 */}
      <div className="flex gap-1.5 mb-5 p-1 bg-gray-100 rounded-xl w-fit">
        {[
          { id: 'advisor' as const, icon: '📝', label: '导师批注修改', desc: '处理PDF或文本批注' },
          { id: 'peer' as const, icon: '👥', label: '同行评审修改', desc: '处理同行评审意见' },
        ].map(r => (
          <button
            key={r.id}
            onClick={() => { setActiveRole(r.id); setStep(1); setResult(null); }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              activeRole === r.id ? 'bg-white shadow-sm text-indigo-700' : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <span>{r.icon}</span>
            <span className="hidden sm:inline">{r.label}</span>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-violet-50 text-violet-600 rounded-xl">
            <MessageSquareText size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">导师批注修改</h1>
            <p className="text-sm text-gray-500">导入含批注的PDF或粘贴批注意见，逐条修改并生成对比文档</p>
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
            {/* 导入方式切换 */}
            <div className="flex gap-2 mb-2">
              <button
                onClick={() => setImportMode('paste')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  importMode === 'paste' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                }`}
              >
                <FileText size={15} /> 粘贴批注意见
              </button>
              <button
                onClick={() => setImportMode('upload')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  importMode === 'upload' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                }`}
              >
                <Upload size={15} /> 上传PDF文件
              </button>
            </div>

            {importMode === 'upload' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">上传含导师批注的PDF</label>
                <div
                  className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-indigo-400 transition-colors cursor-pointer"
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = '.pdf';
                    input.onchange = (e: any) => {
                      const file = e.target?.files?.[0];
                      if (file) setUploadedFile(file);
                    };
                    input.click();
                  }}
                >
                  {uploadedFile ? (
                    <div className="text-sm">
                      <FileText size={36} className="mx-auto mb-2 text-indigo-500" />
                      <p className="font-medium text-gray-900">{uploadedFile.name}</p>
                      <p className="text-xs text-gray-400 mt-1">{(uploadedFile.size / 1024).toFixed(1)} KB</p>
                      <button
                        onClick={(e) => { e.stopPropagation(); setUploadedFile(null); }}
                        className="mt-2 text-xs text-red-500 hover:underline"
                      >
                        移除
                      </button>
                    </div>
                  ) : (
                    <div>
                      <Upload size={36} className="mx-auto mb-2 text-gray-400" />
                      <p className="text-sm text-gray-600 font-medium">点击选择PDF文件</p>
                      <p className="text-xs text-gray-400 mt-1">支持含高亮和批注的PDF</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">1. 粘贴导师批注意见</label>
                <textarea
                  className="w-full h-32 border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  placeholder={"粘贴导师在论文上的批注意见...\n例如：第3页 — \"这段结论不够充分，需要补充数据支撑\"\n或者：第5页图2 — \"标注不清晰，建议重新绘制\""}
                  value={annotations}
                  onChange={(e) => setAnnotations(e.target.value)}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">2. 粘贴论文原文（被批注的章节）</label>
              <textarea
                className="w-full h-40 border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                placeholder="粘贴论文中导师批注对应的原文内容..."
                value={originalText}
                onChange={(e) => setOriginalText(e.target.value)}
              />
            </div>

            {error && <p className="text-sm text-red-600 flex items-center gap-1"><AlertCircle size={14} /> {error}</p>}

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full bg-violet-600 text-white py-2.5 rounded-lg font-medium hover:bg-violet-700 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={18} className="animate-spin" />}
              {loading ? '工作流执行中...' : '开始批注修改工作流'}
            </button>
          </div>
        )}

        {step === 2 && loading && (
          <div className="text-center py-10">
            <Loader2 size={32} className="animate-spin text-violet-600 mx-auto mb-3" />
            <p className="text-sm text-gray-600">正在执行批注修改工作流...</p>
          </div>
        )}

        {step === 3 && result && (
          <div className="space-y-4">
            {/* 工作流状态 */}
            {result.workflow && <WorkflowSteps workflow={result.workflow} currentStep={5} />}

            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="font-bold text-gray-900">修改结果</h3>
              <div className="flex items-center gap-2">
                <ExportButtons content={result.result || result.revised_text} title="导师批注修改结果" />
                <button
                  onClick={() => { setStep(1); setResult(null); setOriginalText(''); setAnnotations(''); }}
                  className="text-sm text-indigo-600 hover:underline"
                >
                  继续修改
                </button>
              </div>
            </div>

            {/* 修改结果 */}
            <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
              <pre className="whitespace-pre-wrap font-sans text-sm text-gray-800">{result.result || result.revised_text}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
