'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { WSProvider, useWS } from '@/lib/ws';
import {
  LayoutDashboard, Server, Bell, BarChart2, LogOut,
  Network, Wifi, WifiOff, Menu, X, Radio,
} from 'lucide-react';
import clsx from 'clsx';

const NAV = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/dashboard/devices', icon: Server, label: 'Devices' },
  { href: '/dashboard/alerts', icon: Bell, label: 'Alerts' },
  { href: '/dashboard/metrics', icon: BarChart2, label: 'Metrics' },
  { href: '/dashboard/agent', icon: Radio, label: 'Agent Events' },
];

function WSIndicator() {
  const { connected } = useWS();
  return (
    <div className={clsx('flex items-center gap-1.5 text-xs', connected ? 'text-green-400' : 'text-gray-500')}>
      {connected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
      <span>{connected ? 'Live' : 'Offline'}</span>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('nms_token');
    if (!token) { router.replace('/'); return; }
    const u = localStorage.getItem('nms_user');
    if (u) setUser(JSON.parse(u));
  }, [router]);

  function logout() {
    localStorage.clear();
    router.push('/');
  }

  return (
    <WSProvider>
      <div className="flex h-screen overflow-hidden bg-gray-950">
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-20 bg-black/60 md:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Sidebar */}
        <aside className={clsx(
          'fixed md:static inset-y-0 left-0 z-30 w-64 flex flex-col bg-gray-900 border-r border-gray-800 transition-transform duration-200',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}>
          {/* Logo */}
          <div className="flex items-center gap-3 px-5 py-5 border-b border-gray-800">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
              <Network className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-bold text-white text-sm">NetPulse NMS</div>
              <div className="text-gray-500 text-xs">v2.0</div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="ml-auto md:hidden text-gray-400">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {NAV.map(({ href, icon: Icon, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setSidebarOpen(false)}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                  pathname === href
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800',
                )}
              >
                <Icon className="w-4.5 h-4.5 w-[18px] h-[18px]" />
                {label}
              </Link>
            ))}
          </nav>

          {/* Footer */}
          <div className="px-4 py-4 border-t border-gray-800 space-y-3">
            <WSIndicator />
            {user && (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-700 flex items-center justify-center text-xs font-bold uppercase flex-shrink-0">
                  {user.username[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate">{user.username}</div>
                  <div className="text-xs text-gray-500 capitalize">{user.role}</div>
                </div>
                <button onClick={logout} className="text-gray-400 hover:text-red-400 transition" title="Logout">
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* Main */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top bar (mobile) */}
          <header className="md:hidden flex items-center gap-3 px-4 py-3 bg-gray-900 border-b border-gray-800">
            <button onClick={() => setSidebarOpen(true)} className="text-gray-400">
              <Menu className="w-5 h-5" />
            </button>
            <span className="font-semibold text-white">NetPulse NMS</span>
          </header>

          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            {children}
          </main>
        </div>
      </div>
    </WSProvider>
  );
}
