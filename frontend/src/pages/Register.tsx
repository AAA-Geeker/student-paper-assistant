import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { register, login, sendCode } from '../api/auth';
import { useAuthStore } from '../stores/authStore';
import { Loader2, AlertCircle, Mail, Lock, CheckCircle2, Sparkles, Send, ShieldCheck } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const setToken = useAuthStore((s) => s.setToken);
  const navigate = useNavigate();

  const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  const handleSendCode = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!validEmail(email)) { setError('请输入正确的邮箱地址'); return; }
    setError('');
    setInfo('');
    setSending(true);
    try {
      const res = await sendCode({ email });
      setInfo(res.data.message || '验证码已发送，请查收邮箱');
      setCooldown(60);
      const timer = setInterval(() => {
        setCooldown((c) => {
          if (c <= 1) { clearInterval(timer); return 0; }
          return c - 1;
        });
      }, 1000);
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? '验证码发送失败，请稍后再试');
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validEmail(email)) { setError('请输入正确的邮箱地址'); return; }
    if (password.length < 6) { setError('密码至少 6 位'); return; }
    if (password !== confirmPassword) { setError('两次密码输入不一致'); return; }
    if (!code.trim()) { setError('请输入邮箱收到的验证码'); return; }
    setLoading(true);
    setError('');
    setInfo('');
    try {
      await register({ email, password, code });
      const res = await login({ email, password });
      setToken(res.data.access_token);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? (err?.message ?? '注册失败，请稍后重试'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 bg-glow" />
      <div className="absolute inset-0 bg-grid opacity-30 [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,black,transparent)]" />

      <div className="relative w-full max-w-md">
        <Card className="bg-card/80 backdrop-blur">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-fuchsia-500 text-white shadow-lg shadow-primary/20">
              <Sparkles size={22} />
            </div>
            <CardTitle className="text-2xl">创建账号</CardTitle>
            <CardDescription>
              注册即送 <strong className="text-primary">1000 点</strong>，免费体验全部功能
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 p-3 bg-destructive/10 border border-destructive/30 rounded-lg flex items-center gap-2 text-sm text-destructive">
                <AlertCircle size={16} className="shrink-0" />
                {error}
              </div>
            )}
            {info && (
              <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-center gap-2 text-sm text-emerald-600">
                <ShieldCheck size={16} className="shrink-0" />
                {info}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-foreground">邮箱地址</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" className="pl-9" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-foreground">密码</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="至少 6 位密码" className="pl-9" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-foreground">确认密码</label>
                <div className="relative">
                  <CheckCircle2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input type="password" required minLength={6} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="再次输入密码" className="pl-9" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-foreground">邮箱验证码</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <ShieldCheck size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input type="text" required value={code} onChange={(e) => setCode(e.target.value.trim())} placeholder="输入 6 位验证码" className="pl-9" />
                  </div>
                  <Button
                    type="button"
                    onClick={handleSendCode}
                    disabled={sending || cooldown > 0}
                    variant="outline"
                    className="shrink-0 gap-1.5"
                  >
                    {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                    {cooldown > 0 ? `${cooldown}s 后重发` : '发送验证码'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">验证码将发送到你填写的邮箱。若未收到，请检查垃圾箱（QQ/163 邮箱收信更稳定）</p>
              </div>

              <Button type="submit" disabled={loading} className="w-full">
                {loading && <Loader2 size={16} className="animate-spin" />}
                {loading ? '注册中...' : '创建账号，免费体验'}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-muted-foreground">
              已有账号？
              <Link to="/login" className="text-primary font-medium hover:underline ml-1">登录</Link>
            </div>

            <div className="mt-6 p-4 bg-accent/60 rounded-xl border border-accent">
              <p className="text-sm font-medium text-accent-foreground mb-2">注册即享：</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>赠送 1000 点免费额度</li>
                <li>降重 / 降 AIGC 改写</li>
                <li>投稿前审稿检查</li>
                <li>论文智能修改</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
