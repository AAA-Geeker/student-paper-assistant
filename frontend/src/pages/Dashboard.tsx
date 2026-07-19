import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, FileEdit, Sparkles, ChevronRight, Loader2, Plus, FileText, Clock, ArrowRight } from 'lucide-react';
import { getProfile } from '../api/core';
import { listPapers } from '../api/papers';
import type { UserProfile } from '../api/core';
import type { Paper } from '../api/papers';

const coreFeatures = [
  {
    id: 'aigc',
    title: '降重 / 降 AIGC',
    subtitle: '查重和AI检测不通过？一键改写降低重复率',
    icon: Sparkles,
    color: 'bg-rose-50 text-rose-600 border-rose-200',
    hoverColor: 'hover:border-rose-400 hover:shadow-rose-100',
    desc: '论文查重太高或AIGC检测亮红灯？把有问题的段落贴进来，AI自动改写，保留原意和专业术语，降低重复率与AI痕迹。支持知网、维普、Turnitin、GPTZero等平台。',
    tags: ['知网/维普', 'Turnitin', 'GPTZero'],
    cta: '开始降重',
    path: '/aigc',
    stats: '改写1段 · 约 30-200 点',
  },
  {
    id: 'review',
    title: '投稿前审查',
    subtitle: '模拟审稿人视角，提前发现论文致命问题',
    icon: ShieldCheck,
    color: 'bg-amber-50 text-amber-600 border-amber-200',
    hoverColor: 'hover:border-amber-400 hover:shadow-amber-100',
    desc: '投稿前心里没底？让AI模拟ACL、SCI、CSSCI等期刊的审稿人，从结构、论证、实验、语言四个维度审查你的论文，找出critical问题，生成优先级修改清单。',
    tags: ['ACL/EMNLP', 'SCI/SSCI', '国内核心'],
    cta: '生成审稿报告',
    path: '/review',
    stats: '审查整篇 · 约 500-1500 点',
  },
  {
    id: 'revision',
    title: '论文修改',
    subtitle: '收到导师修改意见不知如何下手？AI帮你逐条改',
    icon: FileEdit,
    color: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    hoverColor: 'hover:border-emerald-400 hover:shadow-emerald-100',
    desc: '导师或审稿人给了修改意见，但不知道怎么改？把原文和反馈意见粘贴进来，AI解析每条意见，提供最小改动、标准改写、深度重构三种方案，帮你逐条落实修改。',
    tags: ['导师意见', '审稿反馈', '逐条修改'],
    cta: '开始修改',
    path: '/revision',
    stats: '修改1节 · 约 100-800 点',
  },
];

export default function Dashboard() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      getProfile(),
      listPapers(),
    ])
      .then(([p, pp]) => {
        setProfile(p.data);
        setPapers(pp.data);
      })
      .catch(() => navigate('/login'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Loader2 size={32} className="animate-spin text-indigo-600" /></div>;

  return (
    <div className="space-y-8">
      {/* 欢迎区 */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 sm:p-8 text-white shadow-lg">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold mb-2">
              {profile ? `你好，${profile.email.split('@')[0]} 👋` : '欢迎来到论文助手'}
            </h1>
            <p className="text-indigo-100 max-w-2xl">
              论文写作最痛的三个阶段——降重、审稿、修改，我们都帮你准备好了。选择一个开始吧。
            </p>
          </div>
          {profile && (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-white/10 rounded-full text-sm">
              <span>💎</span>
              <span className="font-bold">{profile.credits.toFixed(0)} 点</span>
            </div>
          )}
        </div>
        {profile && (
          <div className="mt-4 flex flex-wrap gap-3">
            <div className="px-4 py-2 bg-white/10 rounded-lg backdrop-blur-sm">
              <span className="text-indigo-200 text-xs">余额</span>
              <div className="font-bold">{profile.credits.toFixed(0)} 点</div>
            </div>
            <div className="px-4 py-2 bg-white/10 rounded-lg backdrop-blur-sm">
              <span className="text-indigo-200 text-xs">套餐</span>
              <div className="font-bold capitalize">{profile.subscription_plan}</div>
            </div>
            <button
              onClick={() => navigate('/credits')}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg backdrop-blur-sm text-sm transition-colors"
            >
              充值 / 升级 →
            </button>
          </div>
        )}
      </div>

      {/* 三大核心模块 */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-xl font-bold text-gray-800">选择你要解决的问题</h2>
        </div>
        <p className="text-sm text-gray-500 mb-5">论文写作最常遇到的三个痛点，每个都为你量身定制了解决方案</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {coreFeatures.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.id}
                onClick={() => navigate(f.path)}
                className={`group relative rounded-2xl border-2 p-6 cursor-pointer transition-all hover:-translate-y-1 hover:shadow-xl ${f.color} ${f.hoverColor}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="p-3 rounded-xl bg-white/80 shadow-sm">
                    <Icon size={28} />
                  </div>
                  <ChevronRight size={20} className="opacity-30 group-hover:opacity-100 transition-opacity" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">{f.title}</h3>
                <p className="text-sm font-medium text-gray-700 mb-3">{f.subtitle}</p>
                <p className="text-sm text-gray-600 leading-relaxed mb-4">{f.desc}</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {f.tags.map((tag) => (
                    <span key={tag} className="text-xs px-2.5 py-1 bg-white/80 rounded-full text-gray-600 font-medium">
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <button className="flex-1 py-2.5 rounded-lg bg-white font-medium text-sm shadow-sm hover:shadow transition-all text-gray-800">
                    {f.cta}
                  </button>
                  <span className="text-xs text-gray-400 ml-3">{f.stats}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 最近论文列表 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <FileText size={18} className="text-indigo-500" />
            我的论文
          </h2>
          <button
            onClick={() => navigate('/editor/new')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus size={16} /> 新建论文
          </button>
        </div>

        {papers.length > 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {papers.slice(0, 5).map((paper) => (
              <div
                key={paper.id}
                onClick={() => navigate(`/editor/${paper.id}`)}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FileText size={16} className="text-gray-400 shrink-0" />
                  <span className="text-sm font-medium text-gray-900 truncate">{paper.title || '未命名论文'}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-400 shrink-0">
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    {new Date(paper.updated_at).toLocaleDateString('zh-CN')}
                  </span>
                  <ArrowRight size={14} className="text-gray-300" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <FileText size={36} className="text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm mb-3">还没有论文，开始写一篇吧</p>
            <button
              onClick={() => navigate('/editor/new')}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700"
            >
              <Plus size={16} /> 新建论文
            </button>
          </div>
        )}
      </div>

      {/* 辅助功能快捷入口（折叠式，不抢三大核心注意力） */}
      <details className="bg-white rounded-xl border border-gray-200 group">
        <summary className="flex items-center justify-between px-4 py-3 cursor-pointer text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-xl transition-colors">
          <span className="flex items-center gap-2">
            <span className="text-base">🔧</span>
            <span className="font-medium">其他辅助功能</span>
            <span className="text-xs text-gray-400">论文润色 · 修改复查 · 答辩准备 · 新建论文</span>
          </span>
          <span className="text-gray-300 group-open:rotate-180 transition-transform">▼</span>
        </summary>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-4 pb-4 border-t border-gray-100 pt-3">
          <button
            onClick={() => navigate('/editor/new')}
            className="bg-white rounded-lg border border-gray-200 p-3 text-left hover:shadow-sm hover:-translate-y-0.5 transition-all"
          >
            <div className="text-xl mb-1">✍️</div>
            <div className="text-sm font-medium text-gray-900">新建论文</div>
            <div className="text-xs text-gray-400">从零开始写一篇新论文</div>
          </button>
          <button
            onClick={() => navigate('/aigc')}
            className="bg-white rounded-lg border border-gray-200 p-3 text-left hover:shadow-sm hover:-translate-y-0.5 transition-all"
          >
            <div className="text-xl mb-1">📝</div>
            <div className="text-sm font-medium text-gray-900">论文润色</div>
            <div className="text-xs text-gray-400">AI 润色提升语言表达</div>
          </button>
          <button
            onClick={() => navigate('/aux/revision-review')}
            className="bg-white rounded-lg border border-gray-200 p-3 text-left hover:shadow-sm hover:-translate-y-0.5 transition-all"
          >
            <div className="text-xl mb-1">✅</div>
            <div className="text-sm font-medium text-gray-900">改后复查</div>
            <div className="text-xs text-gray-400">对照意见判断修改是否达标</div>
          </button>
          <button
            onClick={() => navigate('/aux/defense-simulation')}
            className="bg-white rounded-lg border border-gray-200 p-3 text-left hover:shadow-sm hover:-translate-y-0.5 transition-all"
          >
            <div className="text-xl mb-1">🎤</div>
            <div className="text-sm font-medium text-gray-900">答辩模拟</div>
            <div className="text-xs text-gray-400">模拟答辩委员会提问</div>
          </button>
          <button
            onClick={() => navigate('/aux/format-check')}
            className="bg-white rounded-lg border border-gray-200 p-3 text-left hover:shadow-sm hover:-translate-y-0.5 transition-all"
          >
            <div className="text-xl mb-1">📐</div>
            <div className="text-sm font-medium text-gray-900">格式预检</div>
            <div className="text-xs text-gray-400">按期刊模板规范格式</div>
          </button>
          <button
            onClick={() => navigate('/aux/literature-review')}
            className="bg-white rounded-lg border border-gray-200 p-3 text-left hover:shadow-sm hover:-translate-y-0.5 transition-all"
          >
            <div className="text-xl mb-1">📚</div>
            <div className="text-sm font-medium text-gray-900">文献综述</div>
            <div className="text-xs text-gray-400">输入文献 AI 生成综述段落</div>
          </button>
          <button
            onClick={() => navigate('/aux/cn-to-en')}
            className="bg-white rounded-lg border border-gray-200 p-3 text-left hover:shadow-sm hover:-translate-y-0.5 transition-all"
          >
            <div className="text-xl mb-1">🌐</div>
            <div className="text-sm font-medium text-gray-900">中译英</div>
            <div className="text-xs text-gray-400">中文论文翻译为学术英文</div>
          </button>
          {/* 占位保持 4 列对齐 */}
          <div />
        </div>
      </details>

      {/* 使用提示 */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-5">
        <h3 className="font-bold text-gray-800 text-sm mb-2">💡 使用建议</h3>
        <ul className="text-sm text-gray-600 space-y-1.5">
          <li>• 刚注册？系统已赠送 <strong>1000 点</strong>，可以直接体验三大核心功能</li>
          <li>• 字数越多、功能越复杂，消耗点数越多，建议分段落处理</li>
          <li>• 订阅 Pro/Premium 套餐可享受每日免费次数和折扣</li>
          <li>• 所有功能都支持「先估算、后执行」，确认费用后再扣点</li>
        </ul>
      </div>
    </div>
  );
}
