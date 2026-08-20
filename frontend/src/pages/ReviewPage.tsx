import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, ArrowLeft, Loader2, AlertCircle, Info, Coins, FileEdit, ChevronRight, ScrollText, CornerDownRight, Award, ClipboardList } from 'lucide-react';
import ExportButtons from '../components/ExportButtons';
import WorkflowSteps from '../components/WorkflowSteps';
import FileImportButton from '../components/FileImportButton';
import { Button } from '../components/ui/button';
import { preSubmissionReview, getProfile } from '../api/core';
import type { WorkflowResponse } from '../api/core';

const venueGroups = [
  {
    label: 'ACL/EMNLP 审稿',
    venues: [
      { id: 'ACL', label: 'ACL / EMNLP / NAACL', badge: 'NLP 顶会' },
      { id: 'CVPR', label: 'CVPR / ICCV / ECCV', badge: '计算机视觉' },
    ],
  },
  {
    label: 'SCI 期刊审稿',
    venues: [
      { id: 'SCI-1', label: 'SCI 一区期刊', badge: 'Top 期刊' },
      { id: 'SCI-2', label: 'SCI 二区期刊', badge: '优秀期刊' },
    ],
  },
  {
    label: '国内核心审稿',
    venues: [
      { id: 'CSSCI', label: 'CSSCI / 北大核心', badge: '人文社科' },
      { id: 'CSCD', label: 'CSCD / 国内理工核心', badge: '自然科学' },
    ],
  },
];

const sceneTags = [
  { id: 'conference', label: 'ACL/EMNLP审稿', icon: '🎯', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { id: 'sci', label: 'SCI期刊审稿', icon: '📘', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { id: 'core', label: '国内核心审稿', icon: '📖', color: 'bg-amber-50 text-amber-700 border-amber-200' },
];

function getSceneTag(venue: string) {
  if (['ACL', 'CVPR'].includes(venue)) return sceneTags[0];
  if (['SCI-1', 'SCI-2'].includes(venue)) return sceneTags[1];
  return sceneTags[2];
}

// 主要问题严重度配色（一眼可见：红=Critical / 琥珀=Major / 黄=Minor）
const sevStyles: Record<string, { color: string; badge: string; label: string }> = {
  critical: { color: 'border-red-200 bg-red-50', badge: 'bg-red-600 text-white', label: 'Critical' },
  major:    { color: 'border-amber-300 bg-amber-50', badge: 'bg-amber-500 text-white', label: 'Major' },
  minor:    { color: 'border-yellow-200 bg-yellow-50', badge: 'bg-yellow-500 text-white', label: 'Minor' },
};

// 从总体评价文本里识别推荐意见，用于顶部徽章
function getRecommendation(overall?: string): { label: string; color: string } | null {
  if (!overall) return null;
  const t = overall;
  if (/reject/i.test(t)) return { label: 'Reject', color: 'bg-red-100 text-red-700 border-red-200' };
  if (/bor[dt]erline/i.test(t)) return { label: 'Borderline', color: 'bg-amber-100 text-amber-700 border-amber-200' };
  if (/weak accept/i.test(t)) return { label: 'Weak Accept', color: 'bg-orange-100 text-orange-700 border-orange-200' };
  if (/accept/i.test(t)) return { label: 'Accept', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
  return null;
}

// ─── 需求10：分平台审稿单样式模拟 ───
// 平台类别：conference(ACL/EMNLP) / sci(SCI期刊) / core(国内核心)，各自拟真审稿单布局
type PlatformId = 'conference' | 'sci' | 'core';
type SectionKey = 'overall' | 'issues' | 'strengths' | 'suggestions';

interface PlatformTemplate {
  id: PlatformId;
  label: string;
  short: string;
  // 审稿单头部说明（模拟投稿表单）
  headerNote: string;
  accent: string;          // 审稿单顶部渐变
  badge: string;           // 类别徽章
  // 平台特有审稿单各部分的顺序与标题
  sections: { key: SectionKey; title: string; icon: string }[];
}

const platformTemplates: Record<PlatformId, PlatformTemplate> = {
  conference: {
    id: 'conference',
    label: 'ACL / EMNLP 审稿单',
    short: 'ACL审稿单',
    headerNote: 'OpenReview 风格审稿单 · Reviewer 匿名评审',
    accent: 'from-indigo-600 to-violet-700',
    badge: 'bg-indigo-600 text-white',
    sections: [
      { key: 'overall', title: 'Summary & Overall Assessment', icon: '📋' },
      { key: 'issues', title: 'Weaknesses / Main Concerns', icon: '⚠️' },
      { key: 'strengths', title: 'Strengths', icon: '✅' },
      { key: 'suggestions', title: 'Suggestions for Revision', icon: '📝' },
    ],
  },
  sci: {
    id: 'sci',
    label: 'SCI 期刊审稿单',
    short: 'SCI审稿单',
    headerNote: 'Editorial Manager · Section Editor 评价',
    accent: 'from-emerald-600 to-teal-700',
    badge: 'bg-emerald-600 text-white',
    sections: [
      { key: 'overall', title: 'Recommendation & Overall Assessment', icon: '🏅' },
      { key: 'issues', title: 'Major & Minor Comments', icon: '🔍' },
      { key: 'suggestions', title: 'Specific Suggestions to Authors', icon: '📖' },
      { key: 'strengths', title: 'Strengths', icon: '👍' },
    ],
  },
  core: {
    id: 'core',
    label: '国内核心期刊审稿单',
    short: '国内审稿单',
    headerNote: '编辑部审稿意见表 · 专家评审',
    accent: 'from-amber-500 to-orange-600',
    badge: 'bg-amber-500 text-white',
    sections: [
      { key: 'overall', title: '综合评价（选题·方法·语言）', icon: '📌' },
      { key: 'issues', title: '主要问题与修改意见', icon: '📢' },
      { key: 'suggestions', title: '具体修改建议', icon: '🖊️' },
      { key: 'strengths', title: '值得肯定之处', icon: '✒️' },
    ],
  },
};

function getPlatformId(venue: string): PlatformId {
  if (['ACL', 'CVPR'].includes(venue)) return 'conference';
  if (['SCI-1', 'SCI-2'].includes(venue)) return 'sci';
  return 'core';
}

export default function ReviewPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [text, setText] = useState('');
  const [venue, setVenue] = useState('ACL');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WorkflowResponse | null>(null);
  const [error, setError] = useState('');
  const [credits, setCredits] = useState<number | null>(null);
  // 需求10：审稿单视图样式（默认跟随所选平台，可切换预览其他平台样式）
  const [viewMode, setViewMode] = useState<PlatformId | 'platform'>(() => getPlatformId(venue));

  useEffect(() => {
    getProfile().then(r => setCredits(r.data.credits)).catch(() => {});
  }, []);

  const handleSubmit = async () => {
    if (text.length < 300) { setError('请输入至少 300 字，建议包含摘要和核心章节'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await preSubmissionReview({ text, venue });
      setResult(res.data);
      setStep(3);
      getProfile().then(r => setCredits(r.data.credits));
    } catch (e: any) {
      setError(e.response?.data?.detail || '请求失败');
    } finally {
      setLoading(false);
    }
  };

  // 单条问题带去修改页（reviewer 场景，feedback = 该条问题）
  const goModifyIssue = (issueText: string) => {
    navigate('/revision', {
      state: { feedback: issueText, originalText: text, scenario: 'reviewer' }
    });
  };

  // 需求10：当前审稿单模板（跟随平台或手动指定）+ 分类/推荐视觉
  const activePlatform: PlatformId = viewMode === 'platform' ? getPlatformId(venue) : viewMode;
  const tmpl = platformTemplates[activePlatform];
  const rec = result ? getRecommendation(result.overall) : null;

  const renderSection = (key: SectionKey) => {
    if (!result) return null;
    if (key === 'issues') {
      if (!result.major_issues || result.major_issues.length === 0) return null;
      return (
        <div className="space-y-2">
          {result.major_issues.map((issue, i) => {
            const s = sevStyles[issue.severity] || sevStyles.minor;
            return (
              <div key={i} className={`rounded-xl border ${s.color} overflow-hidden`}>
                <div className="flex items-start gap-3 p-3.5">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold text-white shrink-0 ${s.badge}`}>
                    {s.label}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{issue.text}</p>
                  </div>
                  <button
                    onClick={() => goModifyIssue(issue.text)}
                    className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 bg-white text-indigo-600 rounded-lg text-xs font-medium border border-indigo-200 hover:bg-indigo-50 transition-all shadow-sm"
                  >
                    <CornerDownRight size={13} />
                    针对此条修改
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      );
    }
    if (key === 'overall') {
      if (!result.overall) return null;
      return (
        <div className="whitespace-pre-wrap text-sm text-gray-800 leading-relaxed">{result.overall}</div>
      );
    }
    if (key === 'strengths') {
      if (!result.strengths) return null;
      return <div className="whitespace-pre-wrap text-sm text-gray-800 leading-relaxed">{result.strengths}</div>;
    }
    if (key === 'suggestions') {
      if (!result.suggestions) return null;
      return <div className="whitespace-pre-wrap text-sm text-emerald-800 leading-relaxed">{result.suggestions}</div>;
    }
    return null;
  };

  const scene = getSceneTag(venue);

  return (
    <div className="max-w-4xl mx-auto">
      {/* 顶部导航 */}
      <div className="flex items-center justify-between mb-5">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-indigo-600 transition-colors">
          <ArrowLeft size={16} /> 返回
        </button>
      </div>

      {/* 使用时机提示 */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 mb-5 text-sm text-amber-800">
        <div className="flex items-start gap-2.5">
          <Info size={18} className="shrink-0 mt-0.5 text-amber-500" />
          <div>
            <p className="font-medium mb-1">投稿前心里没底？让 AI 模拟审稿人帮你把把关</p>
            <p>
              选择目标期刊/会议，粘贴你的论文（建议 2000 字以上，包含摘要、方法、实验），
              AI 将模拟该领域审稿人，从结构、方法、语言三个维度进行全面审查，
              生成优先级修改清单，帮你提前发现 critical 问题。
            </p>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
        {/* 头部 */}
        <div className="p-6 pb-0">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-gradient-to-br from-amber-50 to-orange-50 text-amber-600 rounded-xl shadow-sm border border-amber-100">
              <ShieldCheck size={24} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-foreground">投稿前审查</h1>
                {/* 角色场景标签 */}
                {scene && (
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${scene.color}`}>
                    <span className="text-sm leading-none">{scene.icon}</span>
                    {scene.label}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500">选择目标期刊/会议，模拟审稿视角，提前发现致命问题</p>
            </div>
          </div>

          {/* 余额提示条 */}
          {credits !== null && (
            <div className="flex items-center gap-1.5 mb-4 px-3 py-2 bg-gray-50/80 rounded-lg text-sm text-gray-600 border border-gray-100">
              <Coins size={14} className="text-amber-500 shrink-0" />
              当前余额：<span className="font-medium text-gray-800">{credits.toFixed(0)} 点</span>
              {credits < 500 && (
                <button onClick={() => navigate('/credits')} className="ml-auto text-indigo-600 hover:underline text-xs font-medium">
                  余额不足？去充值 →
                </button>
              )}
            </div>
          )}
        </div>

        {/* 步骤1：输入参数 */}
        {step === 1 && (
          <div className="p-6 space-y-6">
            {/* 场景标签导航 - 快速切换 */}
            <div className="flex flex-wrap gap-2 pb-1">
              {venueGroups.map((group, gi) => (
                <div key={gi} className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">{group.label}</span>
                  <div className="flex gap-1">
                    {group.venues.map(v => (
                      <button
                        key={v.id}
                        onClick={() => setVenue(v.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                          venue === v.id
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm'
                            : 'border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300'
                        }`}
                      >
                        <span className="mr-1">{v.label.split('（')[0]}</span>
                        <span className="opacity-60">({v.badge})</span>
                      </button>
                    ))}
                  </div>
                  {gi < venueGroups.length - 1 && <ChevronRight size={14} className="text-gray-300 mx-0.5" />}
                </div>
              ))}
            </div>

            {/* 论文输入 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">
                  粘贴论文内容
                </label>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400">PDF 需为可选中文本（非扫描图片）</span>
                  <FileImportButton onText={setText} />
                </div>
              </div>
              <textarea
                className="w-full h-56 border border-gray-200 rounded-xl p-4 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow resize-y bg-gray-50/50 hover:bg-white focus:bg-white"
                placeholder={`粘贴论文主要章节...\n\n建议至少包含：\n· 摘要（Abstract）\n· 引言与相关工作\n· 方法与实验设计\n· 实验结果与分析`}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <div className="flex justify-between mt-1.5">
                <span className="text-xs text-gray-400">{text.length < 300 ? '至少 300 字' : '字数充足'}</span>
                <span className="text-xs text-gray-400">{text.length} 字</span>
              </div>
            </div>

            {error && <p className="text-sm text-red-600 flex items-center gap-1.5 bg-red-50 border border-red-100 rounded-lg px-3 py-2"><AlertCircle size={14} /> {error}</p>}

            <Button
              onClick={handleSubmit}
              disabled={loading || text.length < 300}
              className="w-full gap-2"
            >
              {loading && <Loader2 size={18} className="animate-spin" />}
              {loading ? '审查中...' : <><ShieldCheck size={18} /> 开始审查</>}
            </Button>
          </div>
        )}

        {/* 步骤3：结果展示 */}
        {step === 3 && result && (
          <div className="p-6 space-y-5">
            {/* 工作流可视化 */}
            {result.workflow && <WorkflowSteps workflow={result.workflow} />}

            {/* 结果操作栏 */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-gray-900 text-lg">审稿报告</h3>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${scene.color}`}>
                  <span className="text-sm leading-none">{scene.icon}</span>
                  {scene.label}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    navigate('/revision', {
                      state: { feedback: result.result, originalText: text, scenario: 'reviewer' }
                    });
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-medium hover:bg-emerald-100 border border-emerald-200 transition-all shadow-sm"
                >
                  <FileEdit size={14} />
                  根据审稿建议修改原文
                </button>
                <ExportButtons content={result.result} title={`审稿报告-${venue}`} />
                <button
                  onClick={() => { setStep(1); setResult(null); setText(''); setError(''); }}
                  className="text-xs text-gray-500 hover:text-indigo-600 transition-colors px-2 py-1"
                >
                  重新审查
                </button>
              </div>
            </div>

            {/* 需求10：分平台审稿单样式模拟 + 分部分展示 */}
            {result.major_issues && result.major_issues.length > 0 ? (
              <div className="space-y-4">
                {/* 审稿单样式切换（默认跟随平台，可预览其他平台模板） */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                    <ClipboardList size={13} className="text-gray-400" />
                    审稿单样式
                  </span>
                  <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                    {(['platform', 'conference', 'sci', 'core'] as const).map(m => (
                      <button
                        key={m}
                        onClick={() => setViewMode(m)}
                        className={`px-3 py-1.5 text-xs font-medium border-r last:border-r-0 transition-all ${
                          viewMode === m
                            ? 'bg-indigo-600 text-white'
                            : m === 'platform'
                              ? 'bg-white text-gray-600 hover:bg-gray-50'
                              : 'bg-white text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        {m === 'platform' ? `跟随平台（${platformTemplates[getPlatformId(venue)].short}）` : platformTemplates[m].short}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 拟真审稿单卡片 */}
                <div className="rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  {/* 审稿单头：模拟投稿表单信息条 */}
                  <div className={`bg-gradient-to-r ${tmpl.accent} text-white px-5 py-4`}>
                    <div className="flex items-start justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-white/20 rounded-lg">
                          <Award size={18} />
                        </div>
                        <div>
                          <div className="font-bold text-sm leading-tight">{tmpl.label}</div>
                          <div className="text-[11px] text-white/80 mt-0.5">{tmpl.headerNote}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {rec && (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${tmpl.badge}`}>
                            {rec.label}
                          </span>
                        )}
                        {scene && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-white/15 text-white">
                            <span className="text-sm leading-none">{scene.icon}</span>{scene.label}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 分部分展示：按平台模板定义的部分顺序 */}
                  <div className="divide-y divide-gray-100">
                    {tmpl.sections.map(sec => {
                      const content = renderSection(sec.key);
                      if (!content && sec.key !== 'issues') return null;
                      if (sec.key === 'issues' && (!result.major_issues || result.major_issues.length === 0)) return null;
                      return (
                        <div key={sec.key} className="px-5 py-4">
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-base leading-none">{sec.icon}</span>
                            <h4 className="font-semibold text-gray-800 text-sm">{sec.title}</h4>
                            {sec.key === 'issues' && result.major_issues && (
                              <span className="text-[11px] text-gray-400">（{result.major_issues.length} 条）</span>
                            )}
                          </div>
                          {renderSection(sec.key)}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              /* 无结构化数据时回退：平铺完整报告 */
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
                  <ScrollText size={14} className="text-gray-400" />
                  <span className="text-sm font-medium text-gray-600">完整审查报告</span>
                </div>
                <div className="p-4">
                  <pre className="whitespace-pre-wrap font-sans text-sm text-gray-800 leading-relaxed">
                    {result.result}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 页脚水印 */}
        {step === 1 && (
          <div className="px-6 pb-6">
            <div className="flex items-center justify-center gap-2 text-xs text-gray-300 mt-2">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-gray-300" />
              模拟审稿仅作参考，正式投稿前建议结合同行评议反馈
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-gray-300" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
