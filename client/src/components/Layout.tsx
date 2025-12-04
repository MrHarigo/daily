import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const { logout, user } = useAuthStore();

  const navItems = [
    { path: '/', label: 'Today', icon: '◉' },
    { path: '/stats', label: 'Stats', icon: '◈' },
    { path: '/settings', label: 'Settings', icon: '⚙' },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-surface-800/80 backdrop-blur-xl border-b border-surface-600">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2">
              <span className="text-2xl font-bold text-accent">Daily</span>
            </Link>
            <nav className="hidden sm:flex items-center gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    location.pathname === item.path
                      ? 'bg-accent/10 text-accent'
                      : 'text-gray-400 hover:text-white hover:bg-surface-700'
                  }`}
                >
                  <span className="mr-2">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500 font-mono hidden sm:block">
              {user?.username}
            </span>
            <button
              onClick={logout}
              className="btn btn-ghost text-sm"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Nav */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-surface-800/95 backdrop-blur-xl border-t border-surface-600 z-50">
        <div className="flex justify-around py-2">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center py-2 px-4 rounded-lg transition-all ${
                location.pathname === item.path
                  ? 'text-accent'
                  : 'text-gray-500'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-xs mt-1">{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8 pb-24 sm:pb-8">
        {children}
      </main>
    </div>
  );
}

