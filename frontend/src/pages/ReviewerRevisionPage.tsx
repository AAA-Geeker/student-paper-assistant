import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, AlertCircle, Coins, MessageSquareReply } from 'lucide-react';
import WorkflowSteps from '../components/WorkflowSteps';
import ExportButtons from '../components/ExportButtons';
import { getProfile, reviewerRevision } from '../api/core';
import type { Workflow, ComparisonResult } from '../api/core';

export default function ReviewerRevisionPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [originalText, setOriginalText] = useState('');
  const [reviewerComments, setReviewerComments] = useState('');
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

  useEffect(() => {
    getProfile().then(r => setCredits(r.data.credits)).catch(() => {});
  }, []);

  const handleSubmit = async () => {
    if (!originalText.trim()) { setError('请输入论文内容'); return; }
    if (!reviewerComments.trim()) { setError('请输入审稿人意见'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await reviewerRevision({ original_text: originalText, reviewer_comments: reviewerComments });
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

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-orange-50 text-orange-600 rounded-xl">
            <MessageSquareReply size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">审稿人修改</h1>
            <p className="text-sm text-gray-500">导入审稿人评审意见，逐条回复并修改论文，生成 Response Letter</p>
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
            <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 text-sm text-sky-800">
              <p className="font-medium mb-1">💡 工作流说明</p>
              <ol className="list-decimal list-inside space-y-0.5 text-xs text-sky-700">
                <li>审稿意见导入 → 逐条分析审稿人核心要求</li>
                <li>生成审稿回复（Response Letter）</li>
                <li>根据意见修改论文</li>
                <li>输出回复信 + 修改后论文 + 对照表</li>
              </ol>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                1. 粘贴审稿人评审意见 <span className="text-red-500">*</span>
              </label>
              <textarea
                className="w-full h-40 border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="粘贴审稿人发给你的评审意见（包括评分和具体建议）...&#10;例如：Reviewer 1: Contribution is limited. The authors should...&#10;Reviewer 2: Experiments lack ablation studies. Please add..."
                value={reviewerComments}
                onChange={(e) => setReviewerComments(e.target.value)}
              />
              <div className="text-right text-xs text-gray-400 mt-1">{reviewerComments.length} 字</div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                2. 粘贴论文原文 <span className="text-red-500">*</span>
              </label>
              <textarea
                className="w-full h-48 border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="粘贴需要修改的论文章节..."
                value={originalText}
                onChange={(e) => setOriginalText(e.target.value)}
              />
              <div className="text-right text-xs text-gray-400 mt-1">{originalText.length} 字</div>
            </div>

            {error && <p className="text-sm text-red-600 flex items-center gap-1"><AlertCircle size={14} /> {error}</p>}

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full bg-orange-600 text-white py-2.5 rounded-lg font-medium hover:bg-orange-700 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={18} className="animate-spin" />}
              {loading ? '工作流执行中...' : '开始审稿修改工作流'}
            </button>
          </div>
        )}

        {step === 2 && loading && (
          <div className="text-center py-10">
            <Loader2 size={32} className="animate-spin text-orange-600 mx-auto mb-3" />
            <p className="text-sm text-gray-600">正在执行审稿修改工作流...</p>
          </div>
        )}

        {step === 3 && result && (
          <div className="space-y-4">
            {result.workflow && <WorkflowSteps workflow={result.workflow} currentStep={5} />}

            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="font-bold text-gray-900">修改结果</h3>
              <div className="flex items-center gap-2">
                <ExportButtons content={result.result || result.revised_text} title="审稿人修改结果" />
                <button
                  onClick={() => { setStep(1); setResult(null); setOriginalText(''); setReviewerComments(''); }}
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
