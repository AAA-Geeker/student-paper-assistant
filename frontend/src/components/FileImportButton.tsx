import { useRef, useState } from 'react';
import { Upload, FileText, X, Loader2, AlertCircle } from 'lucide-react';
import { extractText } from '../api/core';

interface FileImportButtonProps {
  /** 提取成功后回调（传入纯文本，调用方负责 setText 等） */
  onText: (text: string) => void;
  /** 可选：附加提示文案 */
  hint?: string;
}

/**
 * 通用"导入 Word/PDF"按钮：选择文件 → 调用后端 /core/extract-text 提取纯文本 → 回调给调用方。
 * 三个核心功能页（降重/审查/修改）共用，统一交互与错误提示。
 */
export default function FileImportButton({ onText, hint }: FileImportButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setLoading(true);
    setError('');
    setFileName(file.name);
    try {
      const res = await extractText(file);
      onText(res.data.text);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.message ?? '文件导入失败，请重试');
      setFileName('');
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="mb-2">
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,.doc,.txt,.md"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      {fileName && !error ? (
        <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
          <FileText size={15} className="shrink-0" />
          <span className="flex-1 truncate">{fileName} 已导入</span>
          <button
            type="button"
            onClick={() => { setFileName(''); setError(''); }}
            className="text-emerald-500 hover:text-emerald-700"
            aria-label="清除导入"
          >
            <X size={15} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 text-sm font-medium hover:bg-indigo-100 disabled:opacity-50 transition-colors"
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
          {loading ? '导入中…' : '导入 Word/PDF'}
        </button>
      )}
      {error && (
        <div className="mt-2 flex items-start gap-1.5 text-xs text-red-600">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {!fileName && hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}
