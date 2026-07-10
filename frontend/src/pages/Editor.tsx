import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getPaper, updatePaper, exportPaper } from '../api/papers';
import { generateOutline, continueWriting, polish, generateAbstract } from '../api/ai';
import SkillPanel from '../components/SkillPanel';
import TokenCostIndicator from '../components/TokenCostIndicator';

export default function Editor() {
  const { id } = useParams<{ id: string }>();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [outline, setOutline] = useState('');
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiModel, setAiModel] = useState('deepseek');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!id) return;
    getPaper(Number(id)).then((res) => {
      setTitle(res.data.title);
      setContent(res.data.content);
      setOutline(res.data.outline);
    });
  }, [id]);

  const save = async () => {
    if (!id) return;
    await updatePaper(Number(id), { title, content, outline });
    alert('已保存');
  };

  // 键盘快捷键 Ctrl+S 保存
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [title, content, outline]);

  const insertAtCursor = (text: string) => {
    const el = textareaRef.current; if (!el) return;
    const start = el.selectionStart, end = el.selectionEnd;
    const next = content.slice(0, start) + text + content.slice(end);
    setContent(next);
    setTimeout(() => { el.setSelectionRange(start + text.length, start + text.length); el.focus(); }, 0);
  };

  const selectedText = () => {
    const el = textareaRef.current;
    return el ? content.slice(el.selectionStart, el.selectionEnd) : '';
  };

  // 旧版快速 AI 按钮（保留兼容）
  const handleAi = async (type: 'outline' | 'continue' | 'polish' | 'abstract') => {
    if (!id) return; setAiLoading(true);
    try {
      let res;
      if (type === 'outline') res = await generateOutline(title, aiPrompt, aiModel);
      else if (type === 'continue') res = await continueWriting(content, aiPrompt, aiModel);
      else if (type === 'polish') res = await polish(selectedText() || content, aiPrompt || '学术', aiModel);
      else res = await generateAbstract(content, aiModel);
      const result = res.data.result as string;
      if (type === 'outline') setOutline(result);
      else insertAtCursor(result);
    } finally { setAiLoading(false); }
  };

  // Skill 执行结果回调
  const handleSkillResult = (output: string, newOutline?: string) => {
    if (newOutline) {
      setOutline(newOutline);
    }
    if (output && output !== newOutline) {
      insertAtCursor(output);
    }
    save();
  };

  const handleExport = async (fmt: string) => {
    if (!id) return;
    const res = await exportPaper(Number(id), fmt);
    const blob = new Blob([res.data]);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}.${fmt === 'docx' ? 'docx' : fmt === 'pdf' ? 'pdf' : 'md'}`;
    a.click(); window.URL.revokeObjectURL(url);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      {/* 主编辑区 */}
      <div className="lg:col-span-3 space-y-4">
        <div className="flex items-center gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="论文标题"
            className="flex-1 text-xl font-bold border p-2 rounded"
          />
          <button
            onClick={save}
            className="bg-indigo-600 text-white px-4 py-2 rounded text-sm hover:bg-indigo-700 whitespace-nowrap"
          >
            保存
          </button>
        </div>

        {/* 编辑/预览切换 */}
        <div className="flex gap-2 border-b pb-2">
          <button
            onClick={() => setActiveTab('edit')}
            className={`px-3 py-1 text-sm rounded-t ${activeTab === 'edit' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            编辑
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            className={`px-3 py-1 text-sm rounded-t ${activeTab === 'preview' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            预览
          </button>
          <span className="ml-auto text-xs text-gray-400 self-center">Ctrl+S 保存</span>
        </div>

        {activeTab === 'edit' ? (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full h-[55vh] border p-3 rounded font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
            placeholder="在此输入 Markdown 内容...&#10;&#10;支持 Markdown 语法：&#10;# 一级标题&#10;## 二级标题&#10;**加粗** *斜体* &#10;- 列表&#10;> 引用"
          />
        ) : (
          <div className="prose max-w-none bg-white p-6 border rounded h-[55vh] overflow-auto">
            {content ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            ) : (
              <p className="text-gray-400 italic">暂无内容，切换到"编辑"开始写作</p>
            )}
          </div>
        )}

        {/* 大纲区 */}
        <div className="bg-white p-4 border rounded">
          <h3 className="font-bold mb-2 text-gray-700">📋 论文大纲</h3>
          <textarea
            value={outline}
            onChange={(e) => setOutline(e.target.value)}
            className="w-full h-28 border p-2 rounded text-sm font-mono resize-none"
            placeholder="论文大纲...&#10;1 引言&#10;  1.1 研究背景&#10;  1.2 研究问题&#10;2 相关工作&#10;..."
          />
        </div>

        {/* 快捷 AI 工具栏 */}
        <div className="bg-gray-50 p-3 rounded border flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 font-medium">快捷 AI：</span>
          <select
            value={aiModel}
            onChange={e => setAiModel(e.target.value)}
            className="text-xs border rounded px-1.5 py-1 bg-white"
          >
            <option value="deepseek">DeepSeek (省钱)</option>
            <option value="gpt-4o-mini">GPT-4o-mini (标准)</option>
            <option value="gpt-4o">GPT-4o (高级)</option>
          </select>
          <input
            value={aiPrompt}
            onChange={e => setAiPrompt(e.target.value)}
            className="flex-1 border p-1.5 rounded text-xs bg-white"
            placeholder="提示词..."
          />
          <button
            disabled={aiLoading}
            onClick={() => handleAi('outline')}
            className="bg-white hover:bg-gray-100 border px-2 py-1 rounded text-xs disabled:opacity-50"
          >
            📋 大纲
          </button>
          <button
            disabled={aiLoading}
            onClick={() => handleAi('continue')}
            className="bg-white hover:bg-gray-100 border px-2 py-1 rounded text-xs disabled:opacity-50"
          >
            ✍️ 续写
          </button>
          <button
            disabled={aiLoading}
            onClick={() => handleAi('polish')}
            className="bg-white hover:bg-gray-100 border px-2 py-1 rounded text-xs disabled:opacity-50"
          >
            ✨ 润色
          </button>
          <button
            disabled={aiLoading}
            onClick={() => handleAi('abstract')}
            className="bg-white hover:bg-gray-100 border px-2 py-1 rounded text-xs disabled:opacity-50"
          >
            📝 摘要
          </button>
          {aiLoading && <span className="text-xs text-indigo-600 animate-pulse">AI 思考中...</span>}
        </div>
      </div>

      {/* 右侧面板 */}
      <div className="space-y-4">
        {/* Skill 工作流面板（新版核心功能） */}
        <SkillPanel
          title={title}
          content={content}
          outline={outline}
          onResult={handleSkillResult}
        />

        {/* 导出 */}
        <div className="bg-white p-4 rounded shadow">
          <h3 className="font-bold mb-2 text-gray-700">📥 导出</h3>
          <div className="space-y-1.5">
            <button onClick={() => handleExport('md')} className="w-full bg-gray-50 hover:bg-gray-100 p-2 rounded text-sm text-left border">
              📄 Markdown (.md)
            </button>
            <button onClick={() => handleExport('docx')} className="w-full bg-gray-50 hover:bg-gray-100 p-2 rounded text-sm text-left border">
              📝 Word (.docx)
            </button>
            <button onClick={() => handleExport('pdf')} className="w-full bg-gray-50 hover:bg-gray-100 p-2 rounded text-sm text-left border">
              📕 PDF (.pdf)
            </button>
          </div>
        </div>

        {/* Token 成本指示器 */}
        <TokenCostIndicator />
      </div>
    </div>
  );
}
