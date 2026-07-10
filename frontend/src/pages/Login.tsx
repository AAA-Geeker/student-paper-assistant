import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { login } from '../api/auth';
import { useAuthStore } from '../stores/authStore';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const setToken = useAuthStore((s) => s.setToken);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await login({ email, password });
      setToken(res.data.access_token);
      navigate('/dashboard');
    } catch { setError('登录失败，请检查邮箱和密码'); }
  };

  return (
    <div className="max-w-md mx-auto bg-white p-6 rounded shadow">
      <h2 className="text-2xl font-bold mb-4">登录</h2>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="邮箱" className="w-full border p-2 rounded" />
        <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="密码" className="w-full border p-2 rounded" />
        <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700">登录</button>
      </form>
      <p className="mt-4 text-sm text-center">还没有账号？ <Link to="/register" className="text-indigo-600">注册</Link></p>
    </div>
  );
}
