import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

export default function Home() {
  const token = useAuthStore((s) => s.token);
  return (
    <div className="text-center py-20">
      <h1 className="text-4xl font-bold mb-4">学生论文写作助手</h1>
      <p className="text-gray-600 mb-8">AI 辅助大纲生成、续写、润色与导出。</p>
      {token ? (
        <Link to="/dashboard" className="bg-indigo-600 text-white px-6 py-2 rounded hover:bg-indigo-700">进入工作台</Link>
      ) : (
        <Link to="/register" className="bg-indigo-600 text-white px-6 py-2 rounded hover:bg-indigo-700">立即开始</Link>
      )}
    </div>
  );
}
