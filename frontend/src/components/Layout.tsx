import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

export default function Layout({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
          <Link to="/" className="text-xl font-bold text-indigo-600">论文助手</Link>
          <div className="space-x-4">
            {token ? (
              <>
                <Link to="/dashboard" className="text-gray-700 hover:text-indigo-600">论文列表</Link>
                <button onClick={handleLogout} className="text-gray-700 hover:text-red-600">退出</button>
              </>
            ) : (
              <>
                <Link to="/login" className="text-gray-700 hover:text-indigo-600">登录</Link>
                <Link to="/register" className="text-gray-700 hover:text-indigo-600">注册</Link>
              </>
            )}
          </div>
        </div>
      </nav>
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
