import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listPapers, deletePaper, Paper } from '../api/papers';
import { FileText, Trash2 } from 'lucide-react';

export default function Dashboard() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [title, setTitle] = useState('');

  const load = async () => { const res = await listPapers(); setPapers(res.data); };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!title.trim()) return;
    await import('../api/papers').then((m) => m.createPaper({ title }));
    setTitle(''); load();
  };

  const remove = async (id: number) => {
    if (!confirm('确定删除？')) return;
    await deletePaper(id); load();
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">我的论文</h2>
      <div className="flex gap-2 mb-6">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="输入论文标题" className="flex-1 border p-2 rounded" />
        <button onClick={create} className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700">新建</button>
      </div>
      <div className="space-y-3">
        {papers.map((p) => (
          <div key={p.id} className="bg-white p-4 rounded shadow flex justify-between items-center">
            <Link to={`/editor/${p.id}`} className="flex items-center gap-2 text-indigo-600 font-medium hover:underline">
              <FileText size={18} /> {p.title}
            </Link>
            <button onClick={() => remove(p.id)} className="text-gray-400 hover:text-red-600"><Trash2 size={18} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
