import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import {
  Sparkles, ShieldCheck, FileEdit, ChevronRight, ArrowRight, Mail,
  CheckCircle, MessageSquareText, MessageSquareReply, Wand2,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';

const coreFeatures = [
  {
    icon: Sparkles,
    title: '降重 / 降 AIGC',
    subtitle: '查重和AI检测不通过？一键改写',
    desc: '把查重报告中标红的段落粘贴进来，一键改写，保留原意和专业术语。支持知网、维普、Turnitin、GPTZero 等检测平台。',
    gradient: 'from-rose-500 to-pink-500',
    hover: 'group-hover:border-rose-300',
    path: '/aigc',
    tags: ['知网/维普', 'Turnitin', 'GPTZero'],
  },
  {
    icon: ShieldCheck,
    title: '投稿前审查',
    subtitle: '模拟审稿人视角，提前发现致命问题',
    desc: '投稿前心里没底？让系统模拟 ACL、SCI、CSSCI 等期刊的审稿人，从结构、论证、实验、语言四个维度审查你的论文。',
    gradient: 'from-amber-500 to-orange-500',
    hover: 'group-hover:border-amber-300',
    path: '/review',
    tags: ['ACL/EMNLP', 'SCI/SSCI', '国内核心'],
  },
  {
    icon: FileEdit,
    title: '论文修改',
    subtitle: '收到导师意见不知如何下手？逐条改',
    desc: '把原文和导师的反馈意见粘贴进来，逐条解析每条意见，提供最小改动、标准改写、深度重构三种力度。',
    gradient: 'from-emerald-500 to-teal-500',
    hover: 'group-hover:border-emerald-300',
    path: '/revision',
    tags: ['导师意见', '审稿反馈', '逐条修改'],
  },
];

const roleEntries = [
  {
    icon: MessageSquareText,
    title: '导师批注修改',
    subtitle: '导入含批注的PDF或粘贴意见',
    desc: '导师在论文上写了批注？导入PDF自动解析批注，逐条生成修改方案和对比文档。',
    gradient: 'from-violet-500 to-purple-600',
    path: '/revision',
    scenario: 'advisor',
    tags: ['PDF导入', '批注解析', '逐条修改'],
  },
  {
    icon: MessageSquareReply,
    title: '审稿人修改',
    subtitle: '逐条回复 + Response Letter',
    desc: '收到审稿人评审意见？逐条生成回复、修改论文、输出 Response Letter 和修改对照表。',
    gradient: 'from-orange-500 to-red-500',
    path: '/revision',
    scenario: 'reviewer',
    tags: ['审稿回复', 'Response Letter', '对照表'],
  },
];

const steps = [
  { num: '1', title: '粘贴内容', desc: '把需要处理的论文段落、反馈意见复制粘贴进来' },
  { num: '2', title: 'AI 强约束工作流', desc: '系统执行多步骤去 AI 痕迹处理（解析→改写→质检），而非简单问答' },
  { num: '3', title: '逐句对比 + 导出', desc: '查看修改前后的逐句一一对应对比，可导出 Markdown / Word / PDF' },
];

export default function Home() {
  const token = useAuthStore((s) => s.token);

  return (
    <div className="relative overflow-x-hidden">
      {/* Hero —— 网格背景 + 顶部光晕 + 动效 */}
      <section className="relative py-20 sm:py-28 text-center overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-glow" />
        <div className="absolute inset-0 -z-10 bg-grid opacity-40 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,black,transparent)]" />

        <div className="animate-fade-up">
          <Badge variant="outline" className="gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium text-primary border-primary/30 bg-primary/5">
            <Wand2 size={13} /> 学生论文写作助手
          </Badge>
        </div>

        <div className="animate-fade-up mt-6" style={{ animationDelay: '0.1s' }}>
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-foreground leading-[1.1]">
            论文写作的三大痛点，
            <br />
            <span className="text-gradient">一个工具搞定</span>
          </h1>
        </div>

        <p className="animate-fade-up mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto" style={{ animationDelay: '0.2s' }}>
          降重降 AIGC · 投稿前审查 · 论文修改 + 导师批注处理 + 审稿人回复
          <br className="hidden sm:block" />
          —— 覆盖论文全流程，输出像人写的自然学术文本
        </p>

        <div className="animate-fade-up mt-8 flex items-center justify-center gap-4" style={{ animationDelay: '0.3s' }}>
          {token ? (
            <>
              <Button asChild size="lg" className="gap-2 rounded-xl px-8 text-base shadow-lg shadow-primary/20">
                <Link to="/dashboard">进入工作台 <ArrowRight size={18} /></Link>
              </Button>
            </>
          ) : (
            <>
              <Button asChild size="lg" className="gap-2 rounded-xl px-8 text-base shadow-lg shadow-primary/25">
                <Link to="/register">免费注册，送 1000 点 <ArrowRight size={18} /></Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="rounded-xl px-8 text-base">
                <Link to="/login">登录</Link>
              </Button>
            </>
          )}
        </div>

        <p className="animate-fade-up mt-5 text-sm text-muted-foreground/80" style={{ animationDelay: '0.4s' }}>
          无需信用卡 · 注册即送体验点数 · 用完按需充值
        </p>
      </section>

      {/* 三大核心 */}
      <section className="py-14 border-t">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold tracking-tight">你正在经历哪个阶段？</h2>
          <p className="text-muted-foreground mt-2">论文写作中最常遇到的三个问题，每个都有针对性的解决方案</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {coreFeatures.map((p) => {
            const Icon = p.icon;
            return (
              <Link
                key={p.title}
                to={token ? p.path : '/register'}
                className={`card-hover group relative overflow-hidden rounded-2xl border bg-card p-6 ${p.hover}`}
              >
                <div className={`absolute -top-8 -right-8 w-32 h-32 rounded-full bg-gradient-to-br ${p.gradient} opacity-10 blur-2xl transition-opacity group-hover:opacity-20`} />
                <div className={`relative w-12 h-12 rounded-xl bg-gradient-to-br ${p.gradient} text-white flex items-center justify-center mb-4 shadow-md`}>
                  <Icon size={24} />
                </div>
                <h3 className="relative text-lg font-bold mb-1">{p.title}</h3>
                <p className="relative text-sm font-medium text-muted-foreground mb-3">{p.subtitle}</p>
                <p className="relative text-sm text-muted-foreground leading-relaxed mb-4">{p.desc}</p>
                <div className="relative flex flex-wrap gap-1.5 mb-4">
                  {p.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="bg-muted/60 text-muted-foreground">{tag}</Badge>
                  ))}
                </div>
                <span className="relative inline-flex items-center gap-1 text-sm font-medium text-primary">
                  了解详情 <ChevronRight size={14} />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* 多角色场景入口 */}
      <section className="py-14 border-t">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold tracking-tight">按角色选择入口</h2>
          <p className="text-muted-foreground mt-2">根据你当前的角色和场景，选择最合适的入口</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-3xl mx-auto">
          {roleEntries.map((r) => {
            const Icon = r.icon;
            return (
              <Link
                key={r.path}
                to={token ? r.path : '/register'}
                state={token ? { scenario: r.scenario } : undefined}
                className="card-hover group relative overflow-hidden rounded-2xl border bg-card p-6"
              >
                <div className={`absolute -top-6 -right-6 w-28 h-28 rounded-full bg-gradient-to-br ${r.gradient} opacity-10 blur-xl`} />
                <div className="relative flex items-center gap-3 mb-3">
                  <div className={`p-2.5 rounded-xl bg-gradient-to-br ${r.gradient} text-white shadow-sm`}>
                    <Icon size={22} />
                  </div>
                  <div>
                    <h3 className="font-bold">{r.title}</h3>
                    <p className="text-xs text-muted-foreground">{r.subtitle}</p>
                  </div>
                </div>
                <p className="relative text-sm text-muted-foreground leading-relaxed mb-3">{r.desc}</p>
                <div className="relative flex flex-wrap gap-1.5">
                  {r.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="bg-muted/60 text-muted-foreground">{tag}</Badge>
                  ))}
                </div>
                <ChevronRight size={16} className="absolute bottom-4 right-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
              </Link>
            );
          })}
        </div>
      </section>

      {/* 工作流介绍 */}
      <section className="py-14 border-t">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold tracking-tight">三步完成，简单直接</h2>
          <p className="text-muted-foreground mt-2">不靠自由对话，而是经强约束、去 AI 痕迹的成品</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-3xl mx-auto">
          {steps.map((s) => (
            <div key={s.num} className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-fuchsia-500 text-white flex items-center justify-center mx-auto mb-4 text-xl font-bold shadow-lg shadow-primary/20">
                {s.num}
              </div>
              <h3 className="font-bold mb-1">{s.title}</h3>
              <p className="text-sm text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 注册转化 */}
      {!token && (
        <section className="py-16 border-t">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-indigo-600 to-fuchsia-600 p-8 sm:p-12 text-white text-center shadow-xl">
            <div className="absolute inset-0 bg-grid opacity-20" />
            <div className="relative">
              <h2 className="text-2xl sm:text-3xl font-bold mb-3">现在就试试</h2>
              <p className="text-indigo-100 mb-2 max-w-lg mx-auto">注册即送 <strong>1000 点</strong>，免费体验所有功能</p>
              <div className="flex flex-wrap justify-center gap-4 mb-6 text-sm text-indigo-100">
                {['降重 / 降 AIGC', '投稿前审查', '论文修改', '导师批注', '审稿回复'].map((t) => (
                  <span key={t} className="flex items-center gap-1"><CheckCircle size={14} /> {t}</span>
                ))}
              </div>
              <Button asChild className="gap-2 bg-white text-primary hover:bg-white/95 rounded-xl px-8 py-3 text-base font-bold shadow-lg">
                <Link to="/register"><Mail size={18} /> 邮箱注册，立即开始</Link>
              </Button>
              <p className="text-indigo-200 text-xs mt-3">无需手机号，邮箱即可注册</p>
            </div>
          </div>
        </section>
      )}

      <footer className="border-t py-8 text-center text-sm text-muted-foreground/70">
        学生论文写作助手 — 覆盖论文写作全流程：降重 · 审稿 · 修改 · 批注处理 · 审稿回复
      </footer>
    </div>
  );
}
