import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getPaper, updatePaper, exportPaper, createPaper } from '../api/papers';
import { generateOutline, continueWriting, polish, generateAbstract } from '../api/ai';
import SkillPanel from '../components/SkillPanel';
import TokenCostIndicator from '../components/TokenCostIndicator';

const TEMPLATES = [
  {
    icon: '📋', title: '写一篇论文大纲', desc: '让 AI 根据题目生成三级大纲 + 每节写作要点',
    action: 'outline', prompt: '为一篇计算机科学领域的论文生成详细大纲',
  },
  {
    icon: '📝', title: '写一段摘要', desc: '根据论文内容，AI 自动生成结构化的学术摘要',
    action: 'abstract', prompt: '',
  },
  {
    icon: '📄', title: '起草一个章节', desc: '告诉 AI 要写什么，从 Introduction 到 Conclusion',
    action: 'continue', prompt: '请根据论文大纲起草该章节的详细内容，保持学术风格',
  },
  {
    icon: '✏️', title: '润色一段文字', desc: '把写好的段落贴进来，AI 提升表达和学术性',
    action: 'polish', prompt: '学术',
  },
];

export default function Editor() {
  const { id } = useParams<{ id: string }>();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [outline, setOutline] = useState('');
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiModel, setAiModel] = useState('deepseek');
  const [isNew, setIsNew] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!id || id === 'new') return;
    setIsNew(false);
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
    setAiLoading(true);
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

        {/* ─── 新建论文空状态引导 ─── */}
        {isNew && !content && (
          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 rounded-xl p-6 space-y-5">
            <div className="text-center">
              <div className="text-4xl mb-2">📄</div>
              <h3 className="text-lg font-bold text-gray-900">开始写你的论文</h3>
              <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
                这是一个在线论文编辑器，支持 Markdown 语法。你可以直接在这里写，也可以用右侧的 AI 助手快速生成内容。
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {TEMPLATES.map((t) => (
                <button
                  key={t.action}
                  onClick={async () => {
                    setIsNew(false);
                    // 自动创建论文记录并跳转到新ID
                    try {
                      const res = await createPaper({ title: '我的论文' });
                      const newId = res.data.id;
                      // 把当前 URL 换成 /editor/{newId}
                      window.history.replaceState(null, '', `/editor/${newId}`);
                      // 从 url param 重新加载 paper 数据
                      setContent(''); // 清除后等 handleAi 填充
                      if (t.action === 'outline') { setTitle('我的论文'); }
                      // 保存引用以便后续修改
                      (window as any).__paperId = newId;
                      handleAi(t.action as any);
                    } catch {
                      // fallback: 直接使用 AI
                      if (t.action === 'outline') { setTitle('我的论文'); }
                      handleAi(t.action as any);
                    }
                  }}
                  className="bg-white rounded-xl border border-gray-200 p-3 text-left hover:shadow-md hover:-translate-y-0.5 transition-all"
                >
                  <div className="text-2xl mb-1">{t.icon}</div>
                  <div className="text-sm font-semibold text-gray-900">{t.title}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{t.desc}</div>
                </button>
              ))}
            </div>
            <div className="text-center">
              <button
                onClick={() => setIsNew(false)}
                className="text-sm text-indigo-600 hover:text-indigo-800 hover:underline"
              >
                或者，从空白开始手动写 →
              </button>
            </div>
          </div>
        )}

        {/* 编辑/预览切换（新建空状态时不显示） */}
        {(!isNew || content) && (
        <>
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
      </>)}
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
