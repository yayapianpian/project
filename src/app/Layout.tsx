import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Menu, Monitor, Moon, Settings, Sun, X } from 'lucide-react';
import { NAV_ITEMS } from './nav';
import { applyTheme, getTheme, setTheme, type ThemeChoice } from './theme';

const THEME_NEXT: Record<ThemeChoice, ThemeChoice> = { system: 'light', light: 'dark', dark: 'system' };
const THEME_LABEL: Record<ThemeChoice, string> = { system: '跟隨系統', light: '淺色', dark: '深色' };

function ThemeToggle() {
  const [theme, setT] = useState<ThemeChoice>(getTheme);
  useEffect(() => {
    applyTheme(theme);
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);
  const Icon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;
  return (
    <button
      className="btn btn-ghost !px-2.5"
      onClick={() => {
        const next = THEME_NEXT[theme];
        setTheme(next);
        setT(next);
      }}
      title={`主題：${THEME_LABEL[theme]}（點擊切換）`}
      aria-label={`切換主題，目前為${THEME_LABEL[theme]}`}
    >
      <Icon size={16} />
      <span className="hidden sm:inline">{THEME_LABEL[theme]}</span>
    </button>
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-0.5" aria-label="主要功能">
      {NAV_ITEMS.map(({ path, label, icon: Icon }) => (
        <NavLink
          key={path}
          to={path}
          end={path === '/'}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
              isActive ? 'bg-accent-soft font-medium text-accent' : 'text-muted hover:bg-surface-2 hover:text-ink'
            }`
          }
        >
          <Icon size={17} />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2 px-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-sm font-bold text-accent-ink">DA</div>
      <div className="leading-tight">
        <div className="text-sm font-semibold">Data Analyst 180</div>
        <div className="text-xs text-muted">數據分析師轉職訓練</div>
      </div>
    </div>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const [drawer, setDrawer] = useState(false);
  const location = useLocation();
  useEffect(() => setDrawer(false), [location.pathname]);

  return (
    <div className="min-h-screen lg:flex">
      {/* 桌面版側邊欄 */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-5 overflow-y-auto border-r border-line bg-surface py-5 lg:flex">
        <Brand />
        <div className="px-2"><NavList /></div>
        <div className="mt-auto px-2">
          <NavLink to="/settings" className={({ isActive }) => `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-surface-2'}`}>
            <Settings size={17} /> 設定與備份
          </NavLink>
        </div>
      </aside>

      {/* 手機版抽屜 */}
      {drawer && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setDrawer(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <aside className="absolute left-0 top-0 flex h-full w-72 max-w-[85vw] flex-col gap-5 overflow-y-auto bg-surface py-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pr-3">
              <Brand />
              <button className="btn btn-ghost !p-1.5" onClick={() => setDrawer(false)} aria-label="關閉選單"><X size={18} /></button>
            </div>
            <div className="px-2"><NavList onNavigate={() => setDrawer(false)} /></div>
            <div className="mt-auto px-2">
              <NavLink to="/settings" className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted"><Settings size={17} /> 設定與備份</NavLink>
            </div>
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-line bg-surface/90 px-4 py-2.5 backdrop-blur">
          <button className="btn btn-ghost !p-2 lg:hidden" onClick={() => setDrawer(true)} aria-label="開啟選單"><Menu size={18} /></button>
          <div className="text-sm font-medium lg:hidden">Data Analyst 180</div>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <NavLink to="/settings" className="btn btn-ghost !px-2.5" aria-label="設定與備份"><Settings size={16} /><span className="hidden sm:inline">設定</span></NavLink>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 sm:px-6 sm:py-6">{children}</main>
      </div>
    </div>
  );
}
