import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, FileEdit, Sparkles, ChevronRight, Loader2, Plus, FileText, Clock, ArrowRight, MessageSquareText, MessageSquareReply } from 'lucide-react';
import { getProfile } from '../api/core';
import { listPapers } from '../api/papers';
import { Button } from '../components/ui/button';
import type { UserProfile } from '../api/core';
import type { Paper } from '../api/papers';

const coreFeatures = [
  {
    id: 'aigc', title: '降重 / 降 AIGC', subtitle: '查重和AI检测不通过？一键改写降低重复率',
    icon: Sparkles, color: 'bg-rose-50 text-rose-600 border-rose-200', hoverColor: 'hover:border-rose-400 hover:shadow-rose-100',
    desc: '论文查重太高或AIGC检测亮红灯？把有问题的段落贴进来，自动改写，保留原意和专业术语。',
    tags: ['知网/维普', 'Turnitin', 'GPTZero'], cta: '开始降重', path: '/aigc', stats: '改写1段 · 约 30-200 点',
  },
  {
    id: 'review', title: '投稿前审查', subtitle: '模拟审稿人视角，提前发现论文致命问题',
    icon: ShieldCheck, color: 'bg-amber-50 text-amber-600 border-amber-200', hoverColor: 'hover:border-amber-400 hover:shadow-amber-100',
    desc: '模拟ACL、SCI、CSSCI等期刊的审稿人，从结构、论证、实验、语言四个维度审查。',
    tags: ['ACL/EMNLP', 'SCI/SSCI', '国内核心'], cta: '生成审稿报告', path: '/review', stats: '审查整篇 · 约 500-1500 点',
  },
  {
    id: 'revision', title: '论文修改', subtitle: '收到导师修改意见不知如何下手？逐条改',
    icon: FileEdit, color: 'bg-emerald-50 text-emerald-600 border-emerald-200', hoverColor: 'hover:border-emerald-400 hover:shadow-emerald-100',
    desc: '导师或审稿人给了修改意见？把原文和反馈贴进来，逐条修改，三种力度可选。',
    tags: ['导师意见', '审稿反馈', '逐条修改'], cta: '开始修改', path: '/revision', stats: '修改1节 · 约 100-800 点',
  },
];

const roleFeatures = [
  {
    id: 'advisor-revision', title: '导师批注修改', subtitle: '导入含批注PDF或粘贴意见',
    icon: MessageSquareText, color: 'bg-violet-50 text-violet-600 border-violet-200', hoverColor: 'hover:border-violet-400',
    desc: '导入导师在PDF上的批注，自动解析并逐条生成修改方案。',
    tags: ['PDF导入', '批注解析'], cta: '处理批注', path: '/revision', scenario: 'advisor',
  },
  {
    id: 'reviewer-revision', title: '审稿人修改', subtitle: '逐条回复 + Response Letter',
    icon: MessageSquareReply, color: 'bg-orange-50 text-orange-600 border-orange-200', hoverColor: 'hover:border-orange-400',
    desc: '收到审稿人评审意见？逐条回复、修改论文、输出Response Letter。',
    tags: ['审稿回复', '修改对照'], cta: '开始处理', path: '/revision', scenario: 'reviewer',
  },
];

export default function Dashboard() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([getProfile(), listPapers()])
      .then(([p, pp]) => { setProfile(p.data); setPapers(pp.data); })
      .catch(() => navigate('/login'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Loader2 size={32} className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-8">
      {/* 欢迎区 */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary via-indigo-600 to-fuchsia-600 p-6 sm:p-8 text-white shadow-lg shadow-primary/10">
        <div className="absolute inset-0 bg-grid opacity-15" />
        <div className="relative flex items-start justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold mb-2">
              {profile ? `你好，${profile.email.split('@')[0]} 👋` : '欢迎来到论文助手'}
            </h1>
            <p className="text-indigo-100 max-w-2xl">论文写作最痛的阶段——降重、审稿、修改、批注处理、审稿回复，我们都准备好了。</p>
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
            <Button onClick={() => navigate('/credits')} className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg backdrop-blur-sm text-sm h-auto">
              充值 / 升级 →
            </Button>
          </div>
        )}
      </div>

      {/* 三大核心模块 */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-xl font-bold text-foreground">选择你要解决的问题</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-5">论文写作最常遇到的三大痛点</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {coreFeatures.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.id} onClick={() => navigate(f.path)}
                className={`group relative rounded-2xl border-2 p-6 cursor-pointer transition-all hover:-translate-y-1 hover:shadow-xl ${f.color} ${f.hoverColor}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="p-3 rounded-xl bg-white/80 shadow-sm"><Icon size={28} /></div>
                  <ChevronRight size={20} className="opacity-30 group-hover:opacity-100 transition-opacity" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-1">{f.title}</h3>
                <p className="text-sm font-medium text-foreground/80 mb-3">{f.subtitle}</p>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">{f.desc}</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {f.tags.map((tag) => (
                    <span key={tag} className="text-xs px-2.5 py-1 bg-white/80 rounded-full text-muted-foreground font-medium">{tag}</span>
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <button className="flex-1 py-2.5 rounded-lg bg-white font-medium text-sm shadow-sm hover:shadow transition-all text-foreground">{f.cta}</button>
                  <span className="text-xs text-muted-foreground/70 ml-3">{f.stats}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 多角色入口 */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-xl font-bold text-foreground">按角色选择入口</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-5">针对不同场景的专用功能入口</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {roleFeatures.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.id} onClick={() => navigate(f.path, { state: { scenario: f.scenario } })}
                className={`group relative rounded-2xl border-2 p-5 cursor-pointer transition-all hover:-translate-y-1 hover:shadow-xl ${f.color} ${f.hoverColor}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="p-2.5 rounded-xl bg-white/80 shadow-sm"><Icon size={22} /></div>
                  <ChevronRight size={18} className="opacity-30 group-hover:opacity-100 transition-opacity" />
                </div>
                <h3 className="font-bold text-foreground mb-0.5">{f.title}</h3>
                <p className="text-xs font-medium text-foreground/80 mb-2">{f.subtitle}</p>
                <p className="text-xs text-muted-foreground leading-relaxed mb-3">{f.desc}</p>
                <div className="flex flex-wrap gap-1.5">
                  {f.tags.map((tag) => (
                    <span key={tag} className="text-xs px-2 py-0.5 bg-white/80 rounded-full text-muted-foreground">{tag}</span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 最近论文 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <FileText size={18} className="text-indigo-500" /> 我的论文
          </h2>
          <Button onClick={() => navigate('/editor/new')} size="sm" className="gap-1.5">
            <Plus size={16} /> 新建论文
          </Button>
        </div>
        {papers.length > 0 ? (
          <div className="bg-card rounded-xl border border-border divide-y divide-border">
            {papers.slice(0, 5).map((paper) => (
              <div key={paper.id} onClick={() => navigate(`/editor/${paper.id}`)}
                className="flex items-center justify-between px-4 py-3 hover:bg-muted/40 cursor-pointer transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText size={16} className="text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium text-foreground truncate">{paper.title || '未命名论文'}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                  <span className="flex items-center gap-1"><Clock size={12} /> {new Date(paper.updated_at).toLocaleDateString('zh-CN')}</span>
                  <ArrowRight size={14} className="text-muted-foreground/50" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-card rounded-xl border border-border p-8 text-center">
            <FileText size={36} className="text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm mb-3">还没有论文，开始写一篇吧</p>
            <Button onClick={() => navigate('/editor/new')} size="sm" className="gap-1.5">
              <Plus size={16} /> 新建论文
            </Button>
          </div>
        )}
      </div>

      {/* 辅助功能 */}
      <details className="bg-card rounded-xl border border-border group">
        <summary className="flex items-center justify-between px-4 py-3 cursor-pointer text-sm text-muted-foreground hover:text-foreground/80 hover:bg-muted/60 rounded-xl transition-colors">
          <span className="flex items-center gap-2">
            <span className="text-base">🔧</span>
            <span className="font-medium">其他辅助功能</span>
            <span className="text-xs text-muted-foreground/70">论文润色 · 修改复查 · 答辩准备 · 新建论文</span>
          </span>
          <span className="text-muted-foreground/50 group-open:rotate-180 transition-transform">▼</span>
        </summary>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-4 pb-4 border-t border-border pt-3">
          <button onClick={() => navigate('/editor/new')} className="bg-card rounded-lg border border-border p-3 text-left hover:shadow-sm hover:-translate-y-0.5 transition-all">
            <div className="text-xl mb-1">✍️</div>
            <div className="text-sm font-medium text-foreground">新建论文</div>
            <div className="text-xs text-muted-foreground/70">从零开始写一篇新论文</div>
          </button>
          <button onClick={() => navigate('/aigc')} className="bg-card rounded-lg border border-border p-3 text-left hover:shadow-sm hover:-translate-y-0.5 transition-all">
            <div className="text-xl mb-1">📝</div>
            <div className="text-sm font-medium text-foreground">论文润色</div>
            <div className="text-xs text-muted-foreground/70">提升语言表达</div>
          </button>
          <button onClick={() => navigate('/aux/revision-review')} className="bg-card rounded-lg border border-border p-3 text-left hover:shadow-sm hover:-translate-y-0.5 transition-all">
            <div className="text-xl mb-1">✅</div>
            <div className="text-sm font-medium text-foreground">改后复查</div>
            <div className="text-xs text-muted-foreground/70">对照意见判断修改是否达标</div>
          </button>
          <button onClick={() => navigate('/aux/defense-simulation')} className="bg-card rounded-lg border border-border p-3 text-left hover:shadow-sm hover:-translate-y-0.5 transition-all">
            <div className="text-xl mb-1">🎤</div>
            <div className="text-sm font-medium text-foreground">答辩模拟</div>
            <div className="text-xs text-muted-foreground/70">模拟答辩委员会提问</div>
          </button>
          <button onClick={() => navigate('/aux/format-check')} className="bg-card rounded-lg border border-border p-3 text-left hover:shadow-sm hover:-translate-y-0.5 transition-all">
            <div className="text-xl mb-1">📐</div>
            <div className="text-sm font-medium text-foreground">格式预检</div>
            <div className="text-xs text-muted-foreground/70">按期刊模板规范格式</div>
          </button>
          <button onClick={() => navigate('/aux/literature-review')} className="bg-card rounded-lg border border-border p-3 text-left hover:shadow-sm hover:-translate-y-0.5 transition-all">
            <div className="text-xl mb-1">📚</div>
            <div className="text-sm font-medium text-foreground">文献综述</div>
            <div className="text-xs text-muted-foreground/70">输入文献AI生成综述段落</div>
          </button>
          <button onClick={() => navigate('/aux/cn-to-en')} className="bg-card rounded-lg border border-border p-3 text-left hover:shadow-sm hover:-translate-y-0.5 transition-all">
            <div className="text-xl mb-1">🌐</div>
            <div className="text-sm font-medium text-foreground">中译英</div>
            <div className="text-xs text-muted-foreground/70">中文论文翻译为学术英文</div>
          </button>
          <div />
        </div>
      </details>
    </div>
  );
}
