import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { register, login } from '../api/auth';
import { useAuthStore } from '../stores/authStore';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const setToken = useAuthStore((s) => s.setToken);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await register({ email, password });
      const res = await login({ email, password });
      setToken(res.data.access_token);
      navigate('/dashboard');
    } catch { setError('注册失败，邮箱可能已被使用'); }
  };

  return (
    <div className="max-w-md mx-auto bg-white p-6 rounded shadow">
      <h2 className="text-2xl font-bold mb-4">注册</h2>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="邮箱" className="w-full border p-2 rounded" />
        <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="密码" className="w-full border p-2 rounded" />
        <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700">注册</button>
      </form>
      <p className="mt-4 text-sm text-center">已有账号？ <Link to="/login" className="text-indigo-600">登录</Link></p>
    </div>
  );
}
