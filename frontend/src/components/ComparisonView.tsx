import { useState } from 'react';
import { BarChart3, CheckCircle2, AlertCircle } from 'lucide-react';

interface ComparisonSegment {
  original: string;
  revised: string;
  status: 'unchanged' | 'modified' | 'added' | 'deleted';
  similarity: number;
}

interface ComparisonStats {
  original_chars: number;
  revised_chars: number;
  char_change: number;
  char_change_percent: number;
  total_segments: number;
  unchanged_segments: number;
  modified_segments: number;
  added_segments: number;
  deleted_segments: number;
  modification_rate: number;
}

interface ComparisonResult {
  original_length: number;
  revised_length: number;
  segments: ComparisonSegment[];
  stats: ComparisonStats;
}

interface ComparisonViewProps {
  comparison: ComparisonResult | null;
  originalText?: string;
  revisedText?: string;
}

type ViewMode = 'side-by-side' | 'unified' | 'stats';

const statusColors: Record<string, string> = {
  unchanged: 'border-border bg-white',
  modified: 'border-amber-300 bg-amber-50',
  added: 'border-emerald-300 bg-emerald-50',
  deleted: 'border-red-300 bg-red-50',
};

const statusLabels: Record<string, string> = {
  unchanged: '未修改',
  modified: '已修改',
  added: '新增',
  deleted: '删除',
};

export default function ComparisonView({ comparison, originalText, revisedText }: ComparisonViewProps) {
  const [mode, setMode] = useState<ViewMode>('side-by-side');

  if (!comparison) {
    if (!originalText || !revisedText) return null;
    // 没有对比数据时只显示原文和修改后文本
    return (
      <div className="space-y-4">
        <div>
          <h4 className="text-sm font-medium text-foreground/80 mb-2">原文</h4>
          <div className="bg-muted/60 rounded-lg p-4 border border-border text-sm text-foreground/90 whitespace-pre-wrap">
            {originalText}
          </div>
        </div>
        <div>
          <h4 className="text-sm font-medium text-foreground/80 mb-2">修改后</h4>
          <div className="bg-white rounded-lg p-4 border border-border text-sm text-foreground/90 whitespace-pre-wrap">
            {revisedText}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 模式切换 */}
      <div className="flex items-center gap-1.5">
        {(['side-by-side', 'unified', 'stats'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              mode === m
                ? 'bg-primary text-primary-foreground'
                : 'bg-white text-muted-foreground border border-border hover:bg-muted/60'
            }`}
          >
            {m === 'side-by-side' ? '📑 逐段对照' : m === 'unified' ? '📄 统一视图' : '📊 统计'}
          </button>
        ))}
      </div>

      {mode === 'stats' && <StatsPanel stats={comparison.stats} />}
      {mode === 'side-by-side' && <SideBySideView segments={comparison.segments} />}
      {mode === 'unified' && <UnifiedView segments={comparison.segments} />}
    </div>
  );
}

function StatsPanel({ stats }: { stats: ComparisonStats }) {
  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 size={16} className="text-indigo-500" />
        <h4 className="font-medium text-foreground/90 text-sm">修改统计</h4>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="原文字数" value={stats.original_chars} color="text-foreground/90" />
        <StatCard label="修改后字数" value={stats.revised_chars} color="text-primary" />
        <StatCard label="字数变化" value={`${stats.char_change > 0 ? '+' : ''}${stats.char_change}`} color={stats.char_change > 0 ? 'text-emerald-600' : 'text-amber-600'} />
        <StatCard label="修改率" value={`${stats.modification_rate}%`} color="text-amber-600" />
      </div>
      <div className="flex flex-wrap gap-3 mt-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <CheckCircle2 size={12} className="text-emerald-500" /> 未修改: {stats.unchanged_segments}
        </span>
        <span className="flex items-center gap-1">
          <CheckCircle2 size={12} className="text-amber-500" /> 已修改: {stats.modified_segments}
        </span>
        <span className="flex items-center gap-1">
          <CheckCircle2 size={12} className="text-emerald-500" /> 新增: {stats.added_segments}
        </span>
        <span className="flex items-center gap-1">
          <AlertCircle size={12} className="text-red-500" /> 删除: {stats.deleted_segments}
        </span>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="bg-muted/60 rounded-lg p-3 text-center">
      <div className={`text-lg font-bold ${color}`}>{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

function SideBySideView({ segments }: { segments: ComparisonSegment[] }) {
  return (
    <div className="space-y-2">
      {segments.map((seg, i) => (
        <div key={i} className={`rounded-lg border ${statusColors[seg.status]} overflow-hidden`}>
          <div className="flex items-center justify-between px-3 py-1 bg-muted/60 border-b border-border">
            <div className="flex items-center gap-1.5">
              <span className={`inline-block w-2 h-2 rounded-full ${seg.status === 'unchanged' ? 'bg-gray-400' : seg.status === 'modified' ? 'bg-amber-400' : seg.status === 'added' ? 'bg-emerald-400' : 'bg-red-400'}`} />
              <span className="text-xs text-muted-foreground">段落 {i + 1}</span>
            </div>
            <span className="text-xs text-muted-foreground/70">{statusLabels[seg.status]}</span>
          </div>
          <div className="grid grid-cols-2 divide-x divide-gray-200">
            <div className="p-3">
              <div className="text-xs text-muted-foreground/70 mb-1 font-medium">原文</div>
              <div className={`text-sm whitespace-pre-wrap ${seg.status === 'deleted' ? 'text-red-500 line-through' : 'text-foreground/90'}`}>
                {seg.original || <span className="text-gray-300 italic">（无）</span>}
              </div>
            </div>
            <div className="p-3">
              <div className="text-xs text-muted-foreground/70 mb-1 font-medium">修改后</div>
              <div className={`text-sm whitespace-pre-wrap ${seg.status === 'added' ? 'text-emerald-700' : seg.status === 'modified' ? 'text-amber-800' : 'text-foreground/90'}`}>
                {seg.revised || <span className="text-gray-300 italic">（已删除）</span>}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function UnifiedView({ segments }: { segments: ComparisonSegment[] }) {
  return (
    <div className="bg-card rounded-xl border border-border p-4 font-mono text-sm leading-relaxed">
      {segments.map((seg, i) => {
        if (seg.status === 'unchanged') {
          return (
            <div key={i} className="text-foreground/80 whitespace-pre-wrap">
              {seg.revised || seg.original}
            </div>
          );
        }
        if (seg.status === 'modified') {
          return (
            <div key={i} className="space-y-1">
              {seg.original && (
                <div className="bg-red-50 text-red-700 line-through px-2 py-1 rounded whitespace-pre-wrap">
                  <span className="text-xs font-mono text-red-400 mr-1">-</span>{seg.original}
                </div>
              )}
              {seg.revised && (
                <div className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded whitespace-pre-wrap">
                  <span className="text-xs font-mono text-emerald-400 mr-1">+</span>{seg.revised}
                </div>
              )}
            </div>
          );
        }
        if (seg.status === 'added') {
          return (
            <div key={i} className="bg-gradient-to-r from-emerald-50 to-transparent text-emerald-700 px-2 py-1 rounded whitespace-pre-wrap">
              <span className="text-xs font-mono text-emerald-400 mr-1">+</span>{seg.revised}
            </div>
          );
        }
        if (seg.status === 'deleted') {
          return (
            <div key={i} className="bg-red-50 text-red-500 line-through px-2 py-1 rounded whitespace-pre-wrap">
              <span className="text-xs font-mono text-red-400 mr-1">-</span>{seg.original}
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}
