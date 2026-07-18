import { useState } from 'react';
import { FileDown, Loader2 } from 'lucide-react';

interface ExportButtonsProps {
  content: string;
  title?: string;
  filename?: string;
}

export default function ExportButtons({ content, title = '论文助手-导出结果' }: ExportButtonsProps) {
  const [exporting, setExporting] = useState<string | null>(null);

  const handleExport = async (fmt: 'md' | 'docx' | 'pdf') => {
    setExporting(fmt);
    try {
      const resp = await fetch('/api/core/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ content, title, format: fmt }),
      });
      if (!resp.ok) throw new Error('导出失败');
      const blob = await resp.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ext = fmt === 'md' ? 'md' : fmt === 'docx' ? 'docx' : 'pdf';
      a.download = `${title}.${ext}`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      // 备选：前端直接导出文本
      if (fmt === 'md') {
        const blob = new Blob([content], { type: 'text/markdown' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title}.md`;
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        alert('导出失败，请检查网络或重新登录');
      }
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-400 mr-1">下载：</span>
      {(['md', 'docx', 'pdf'] as const).map((fmt) => (
        <button
          key={fmt}
          onClick={() => handleExport(fmt)}
          disabled={exporting !== null}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all disabled:opacity-50"
        >
          {exporting === fmt ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <FileDown size={12} />
          )}
          {fmt === 'md' ? 'Markdown' : fmt === 'docx' ? 'Word' : 'PDF'}
        </button>
      ))}
    </div>
  );
}
