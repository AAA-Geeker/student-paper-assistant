import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { Sparkles, ShieldCheck, FileEdit, ChevronRight, ArrowRight, Mail, CheckCircle } from 'lucide-react';

const painPoints = [
  {
    icon: Sparkles,
    title: '降重 / 降 AIGC',
    subtitle: '论文查重太高或AIGC检测亮红灯？',
    desc: '把查重报告中标红的段落粘贴进来，AI 一键改写，保留原意和专业术语。支持知网、维普、Turnitin、GPTZero 等检测平台的降重和降 AIGC 需求。',
    bg: 'bg-rose-50',
    iconBg: 'bg-rose-100 text-rose-600',
    border: 'border-rose-200',
    path: '/aigc',
    tags: ['知网/维普', 'Turnitin', 'GPTZero'],
  },
  {
    icon: ShieldCheck,
    title: '投稿前审查',
    subtitle: '模拟审稿人视角，提前发现致命问题',
    desc: '投稿前心里没底？让 AI 模拟 ACL、SCI、CSSCI 等期刊的审稿人，从结构、论证、实验、语言四个维度审查你的论文，生成优先级修改清单。',
    bg: 'bg-amber-50',
    iconBg: 'bg-amber-100 text-amber-600',
    border: 'border-amber-200',
    path: '/register',
    tags: ['ACL/EMNLP', 'SCI/SSCI', '国内核心'],
  },
  {
    icon: FileEdit,
    title: '论文修改',
    subtitle: '收到导师修改意见不知如何下手？',
    desc: '把原文和导师的反馈意见粘贴进来，AI 逐条解析每条意见，提供最小改动、标准改写、深度重构三种方案，帮你逐条落实修改。',
    bg: 'bg-emerald-50',
    iconBg: 'bg-emerald-100 text-emerald-600',
    border: 'border-emerald-200',
    path: '/register',
    tags: ['导师意见', '审稿反馈', '逐条修改'],
  },
];

const steps = [
  { num: '1', title: '粘贴内容', desc: '把需要处理的论文段落、反馈意见复制粘贴进来' },
  { num: '2', title: '选择设置', desc: '选择处理目标（降重/审稿/修改风格），AI 自动预估费用' },
  { num: '3', title: '确认执行', desc: '确认后 AI 处理，几秒钟内获得结果，不满意可以重来' },
];

export default function Home() {
  const token = useAuthStore((s) => s.token);

  return (
    <div>
      {/* ─── Hero 区 ─── */}
      <section className="text-center py-16 sm:py-24">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-sm font-medium mb-6">
          <Sparkles size={14} /> 学生论文写作助手
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4 leading-tight">
          论文写作的三大痛点，
          <br />
          <span className="text-indigo-600">一个工具搞定</span>
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-8">
          降重降AIGC · 投稿前审查 · 论文修改 —— 直击论文写作最痛苦、最耗时的三个阶段
        </p>
        <div className="flex items-center justify-center gap-4">
          {token ? (
            <Link
              to="/dashboard"
              className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-medium hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 flex items-center gap-2"
            >
              进入工作台 <ArrowRight size={18} />
            </Link>
          ) : (
            <>
              <Link
                to="/register"
                className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-medium hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 flex items-center gap-2"
              >
                免费注册，送 1000 点 <ArrowRight size={18} />
              </Link>
              <Link
                to="/login"
                className="px-8 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                登录
              </Link>
            </>
          )}
        </div>
        <p className="text-sm text-gray-400 mt-4">无需信用卡 · 注册即送体验点数 · 用完按需充值</p>
      </section>

      {/* ─── 三大痛点卡片 ─── */}
      <section className="py-12 border-t border-gray-100">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">你正在经历哪个阶段？</h2>
          <p className="text-gray-500">论文写作中最常遇到的三个问题，每个都有针对性的解决方案</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {painPoints.map((p) => {
            const Icon = p.icon;
            return (
              <div
                key={p.title}
                className={`rounded-2xl border-2 ${p.border} ${p.bg} p-6 hover:shadow-lg transition-all hover:-translate-y-0.5`}
              >
                <div className={`w-12 h-12 rounded-xl ${p.iconBg} flex items-center justify-center mb-4`}>
                  <Icon size={24} />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">{p.title}</h3>
                <p className="text-sm font-medium text-gray-700 mb-3">{p.subtitle}</p>
                <p className="text-sm text-gray-600 leading-relaxed mb-4">{p.desc}</p>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {p.tags.map((tag) => (
                    <span key={tag} className="text-xs px-2 py-0.5 bg-white/70 rounded-full text-gray-600">
                      {tag}
                    </span>
                  ))}
                </div>
                <Link
                  to={token ? p.path : '/register'}
                  className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-800"
                >
                  了解详情 <ChevronRight size={14} />
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      {/* ─── 使用流程 ─── */}
      <section className="py-12 border-t border-gray-100">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">三步完成，简单直接</h2>
          <p className="text-gray-500">不需要学习成本，粘贴 → 选择 → 确认，三秒上手</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-3xl mx-auto">
          {steps.map((s) => (
            <div key={s.num} className="text-center">
              <div className="w-14 h-14 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                {s.num}
              </div>
              <h3 className="font-bold text-gray-900 mb-1">{s.title}</h3>
              <p className="text-sm text-gray-500">{s.desc}</p>
            </div>
          ))}
        </div>
        {/* 流程连线（仅桌面可见） */}
        <div className="hidden sm:block max-w-xl mx-auto -mt-52 mb-16">
          <svg viewBox="0 0 500 60" className="w-full opacity-20">
            <line x1="80" y1="30" x2="420" y2="30" stroke="#6366F1" strokeWidth="2" strokeDasharray="6 4" />
          </svg>
        </div>
      </section>

      {/* ─── 注册转化区 ─── */}
      {!token && (
        <section className="py-16 border-t border-gray-100">
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-3xl p-8 sm:p-12 text-white text-center shadow-xl">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">现在就试试</h2>
            <p className="text-indigo-100 mb-2 max-w-lg mx-auto">
              注册即送 <strong>1000 点</strong>，免费体验三大核心功能
            </p>
            <div className="flex flex-wrap justify-center gap-4 mb-6 text-sm text-indigo-200">
              <span className="flex items-center gap-1"><CheckCircle size={14} /> 降重 / 降 AIGC</span>
              <span className="flex items-center gap-1"><CheckCircle size={14} /> 投稿前审查</span>
              <span className="flex items-center gap-1"><CheckCircle size={14} /> 论文修改</span>
            </div>
            <Link
              to="/register"
              className="inline-flex items-center gap-2 bg-white text-indigo-700 px-8 py-3 rounded-xl font-bold hover:bg-indigo-50 transition-colors shadow-lg"
            >
              <Mail size={18} /> 邮箱注册，立即开始
            </Link>
            <p className="text-indigo-200 text-xs mt-3">无需手机号，邮箱即可注册</p>
          </div>
        </section>
      )}

      {/* ─── 页脚 ─── */}
      <footer className="border-t border-gray-100 py-8 text-center text-sm text-gray-400">
        学生论文写作助手 — 让 AI 帮你搞定论文中最痛苦的部分
      </footer>
    </div>
  );
}
