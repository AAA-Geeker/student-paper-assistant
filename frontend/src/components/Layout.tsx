import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useEffect, useState } from 'react';
import { getProfile } from '../api/core';
import { Menu, X, Sparkles, ShieldCheck, FileEdit, Coins, LogOut, LayoutDashboard } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Moon, Sun } from 'lucide-react';
import { useThemeStore } from '../stores/themeStore';
import { cn } from '../lib/utils';

export default function Layout({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const location = useLocation();
  const [credits, setCredits] = useState<number | null>(null);
  const [, setPlan] = useState('free');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggle);

  useEffect(() => {
    if (token) {
      getProfile().then((res) => {
        setCredits(res.data.credits);
        setPlan(res.data.subscription_plan);
      }).catch(() => {
        logout();
        navigate('/login');
      });
    }
  }, [token, location.pathname]);

  const handleLogout = () => {
    if (window.confirm('确定要退出登录吗？')) {
      logout();
      navigate('/login');
    }
  };

  const isLoggedIn = !!token;
  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';
  const isLandingPage = location.pathname === '/';

  const coreNavLinks = [
    { path: '/aigc', label: '降重 / 降AIGC', icon: Sparkles },
    { path: '/review', label: '投稿审查', icon: ShieldCheck },
    { path: '/revision', label: '论文修改', icon: FileEdit },
  ];

  const brand = (
    <Link to={isLoggedIn ? '/dashboard' : '/'} className="flex items-center gap-2 font-bold text-lg tracking-tight text-foreground">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-fuchsia-500 text-white text-base">🎓</span>
      <span>论文助手</span>
    </Link>
  );

  return (
    <div className="min-h-screen bg-background pb-16 sm:pb-0">
      {/* ─── 顶部导航 ─── */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-6xl mx-auto px-4 h-16 flex justify-between items-center gap-4">
          {brand}

          {/* 桌面端 */}
          <nav className="hidden sm:flex items-center gap-1">
            {isLoggedIn && (
              <>
                {coreNavLinks.map((link) => (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors",
                      location.pathname === link.path
                        ? "bg-accent text-accent-foreground font-medium"
                        : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                    )}
                  >
                    <link.icon size={15} />
                    {link.label}
                  </Link>
                ))}
              </>
            )}
          </nav>

          <div className="flex items-center gap-2">
            {/* 主题切换 */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'}
              className="text-muted-foreground hover:text-foreground"
            >
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </Button>
            {isLoggedIn ? (
              <>
                <Link to="/credits">
                  <Badge variant="secondary" className="gap-1.5 rounded-full px-3 py-1 text-sm font-medium text-primary">
                    <Coins size={13} />
                    {credits !== null ? `${credits.toFixed(0)} 点` : '...'}
                  </Badge>
                </Link>
                <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                  <Link to="/dashboard"><LayoutDashboard size={15} /> 工作台</Link>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="hidden sm:inline-flex text-muted-foreground hover:text-destructive"
                  onClick={handleLogout}
                >
                  <LogOut size={15} /> 退出
                </Button>
              </>
            ) : (
              !isAuthPage && !isLandingPage && (
                <>
                  <Button asChild variant="ghost" size="sm"><Link to="/login">登录</Link></Button>
                  <Button asChild size="sm"><Link to="/register">注册</Link></Button>
                </>
              )
            )}
            {/* 移动端菜单按钮 */}
            {isLoggedIn && (
              <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="sm:hidden p-1 text-muted-foreground">
                {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            )}
          </div>
        </div>

        {/* 移动端下拉 */}
        {mobileMenuOpen && (
          <div className="sm:hidden border-t bg-background px-4 py-3 space-y-1 text-sm">
            {isLoggedIn ? (
              <>
                <Link to="/dashboard" className="block py-2 text-foreground" onClick={() => setMobileMenuOpen(false)}>工作台</Link>
                <Link to="/aigc" className="block py-2 text-foreground" onClick={() => setMobileMenuOpen(false)}>降重 / 降 AIGC</Link>
                <Link to="/review" className="block py-2 text-foreground" onClick={() => setMobileMenuOpen(false)}>投稿前审查</Link>
                <Link to="/revision" className="block py-2 text-foreground" onClick={() => setMobileMenuOpen(false)}>论文修改</Link>
                <Link to="/credits" className="block py-2 text-foreground" onClick={() => setMobileMenuOpen(false)}>我的资产</Link>
                <div className="pt-1 mt-1 border-t">
                  <button onClick={() => { setMobileMenuOpen(false); handleLogout(); }} className="block py-2 text-destructive w-full text-left">
                    退出登录
                  </button>
                </div>
              </>
            ) : (
              <>
                <Link to="/login" className="block py-2 text-foreground" onClick={() => setMobileMenuOpen(false)}>登录</Link>
                <Link to="/register" className="block py-2 font-medium text-primary" onClick={() => setMobileMenuOpen(false)}>注册</Link>
              </>
            )}
          </div>
        )}
      </header>

      {/* 主体内容 */}
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>

      {/* ─── 移动端底部导航 ─── */}
      {isLoggedIn && (
        <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-background border-t z-50 flex justify-around py-2 px-2">
          <MobileNavItem icon="🏠" label="工作台" path="/dashboard" current={location.pathname} />
          <MobileNavItem icon="✨" label="降重" path="/aigc" current={location.pathname} />
          <MobileNavItem icon="🛡️" label="审稿" path="/review" current={location.pathname} />
          <MobileNavItem icon="📝" label="修改" path="/revision" current={location.pathname} />
          <MobileNavItem icon="💎" label="资产" path="/credits" current={location.pathname} />
        </div>
      )}
    </div>
  );
}

function MobileNavItem({ icon, label, path, current }: { icon: string; label: string; path: string; current: string }) {
  const isActive = current === path;
  return (
    <Link
      to={path}
      className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg text-xs transition-colors ${
        isActive ? 'text-primary font-medium' : 'text-muted-foreground'
      }`}
    >
      <span className="text-lg">{icon}</span>
      <span>{label}</span>
    </Link>
  );
}
