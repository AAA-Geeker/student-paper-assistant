import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useEffect, useState } from 'react';
import { getProfile } from '../api/core';
import { Menu, X, Sparkles, ShieldCheck, FileEdit, Coins, Home, ChevronDown } from 'lucide-react';

export default function Layout({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const location = useLocation();
  const [credits, setCredits] = useState<number | null>(null);
  const [, setPlan] = useState('free');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
    { path: '/aigc', label: '降重', icon: Sparkles },
    { path: '/review', label: '审稿', icon: ShieldCheck },
    { path: '/revision', label: '修改', icon: FileEdit },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-16 sm:pb-0">
      {/* ─── Desktop 导航 ─── */}
      <nav className="bg-white shadow-sm border-b sticky top-0 z-50 hidden sm:block">
        <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
          <Link to={isLoggedIn ? '/dashboard' : '/'} className="text-xl font-bold text-indigo-600 flex items-center gap-2">
            <span>🎓</span> 论文助手
          </Link>
          <div className="flex items-center gap-3">
            {isLoggedIn ? (
              <>
                {/* 核心功能快捷入口 */}
                {coreNavLinks.map((link) => (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      location.pathname === link.path
                        ? 'bg-indigo-50 text-indigo-700 font-medium'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <link.icon size={15} />
                    {link.label}
                  </Link>
                ))}

                <div className="w-px h-5 bg-gray-200 hidden sm:block" />

                {/* 资产入口 */}
                <Link
                  to="/credits"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    location.pathname === '/credits'
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                  }`}
                >
                  <span>💎</span>
                  <span className="hidden sm:inline">{credits !== null ? `${credits.toFixed(0)} 点` : '...'}</span>
                </Link>

                <Link
                  to="/dashboard"
                  className={`text-sm transition-colors ${
                    location.pathname === '/dashboard' ? 'text-indigo-600 font-medium' : 'text-gray-700 hover:text-indigo-600'
                  } hidden sm:inline`}
                >
                  工作台
                </Link>

                {/* 退出 */}
                <button
                  onClick={handleLogout}
                  className="text-sm text-gray-500 hover:text-red-600 transition-colors ml-1"
                >
                  退出
                </button>
              </>
            ) : (
              !isAuthPage && !isLandingPage && (
                <>
                  <Link to="/login" className="text-gray-700 hover:text-indigo-600 text-sm">登录</Link>
                  <Link to="/register" className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-indigo-700 transition-colors">注册</Link>
                </>
              )
            )}
          </div>
        </div>
      </nav>

      {/* ─── 移动端导航 ─── */}
      <nav className="sm:hidden bg-white shadow-sm border-b sticky top-0 z-50">
        <div className="px-4 py-3 flex justify-between items-center">
          <Link to={isLoggedIn ? '/dashboard' : '/'} className="text-lg font-bold text-indigo-600 flex items-center gap-1.5">
            <span>🎓</span> 论文助手
          </Link>
          <div className="flex items-center gap-2">
            {isLoggedIn && credits !== null && (
              <Link to="/credits" className="flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded-full">
                <Coins size={12} /> {credits.toFixed(0)}
              </Link>
            )}
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-1 text-gray-600">
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
        {/* 移动端下拉菜单 */}
        {mobileMenuOpen && (
          <div className="border-t bg-white px-4 py-3 space-y-2 text-sm">
            {isLoggedIn ? (
              <>
                <Link to="/dashboard" className="block py-1.5 text-gray-700" onClick={() => setMobileMenuOpen(false)}>🏠 工作台</Link>
                <Link to="/aigc" className="block py-1.5 text-gray-700" onClick={() => setMobileMenuOpen(false)}>✨ 降重 / 降 AIGC</Link>
                <Link to="/review" className="block py-1.5 text-gray-700" onClick={() => setMobileMenuOpen(false)}>🛡️ 投稿前审查</Link>
                <Link to="/revision" className="block py-1.5 text-gray-700" onClick={() => setMobileMenuOpen(false)}>📝 论文修改</Link>
                <Link to="/credits" className="block py-1.5 text-gray-700" onClick={() => setMobileMenuOpen(false)}>💎 我的资产</Link>
                <hr className="my-1" />
                <button onClick={() => { setMobileMenuOpen(false); handleLogout(); }} className="block py-1.5 text-red-600 w-full text-left">退出登录</button>
              </>
            ) : (
              <>
                <Link to="/login" className="block py-1.5 text-gray-700" onClick={() => setMobileMenuOpen(false)}>登录</Link>
                <Link to="/register" className="block py-1.5 font-medium text-indigo-600" onClick={() => setMobileMenuOpen(false)}>注册</Link>
              </>
            )}
          </div>
        )}
      </nav>

      {/* 主体内容 */}
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>

      {/* ─── 移动端底部导航栏 ─── */}
      {isLoggedIn && (
        <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t z-50 flex justify-around py-2 px-2">
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
        isActive ? 'text-indigo-600 font-medium' : 'text-gray-500'
      }`}
    >
      <span className="text-lg">{icon}</span>
      <span>{label}</span>
    </Link>
  );
}
