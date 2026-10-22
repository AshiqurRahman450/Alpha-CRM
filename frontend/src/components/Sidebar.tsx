'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Building2,
  MessageSquare,
  FileCode2,
  Rocket,
  BarChart3,
  Settings,
  LogOut,
  ChevronRight,
  ShieldCheck,
  Bell,
  ClipboardCheck,
  X,
} from 'lucide-react';
import { getStoredUser, removeAuthToken } from '../lib/api';

const navItems = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'QC Site Report', href: '/qc', icon: ClipboardCheck, badge: 'New' },
  { name: 'Customers', href: '/customers', icon: Users },
  { name: 'Projects', href: '/projects', icon: Building2 },
  { name: 'WhatsApp Hub', href: '/whatsapp', icon: MessageSquare },
  { name: 'Templates', href: '/templates', icon: FileCode2 },
  { name: 'Pilot Mode (10)', href: '/pilot', icon: Rocket, badge: 'Active' },
  { name: 'Reports', href: '/reports', icon: BarChart3 },
  { name: 'Reminders', href: '/reminders', icon: Bell },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = React.useState<any>(null);
  const [isMobileOpen, setIsMobileOpen] = React.useState(false);

  React.useEffect(() => {
    setUser(getStoredUser());
  }, [pathname]);

  React.useEffect(() => {
    const handleToggle = () => setIsMobileOpen((prev) => !prev);
    const handleClose = () => setIsMobileOpen(false);

    window.addEventListener('toggle-mobile-sidebar', handleToggle);
    window.addEventListener('close-mobile-sidebar', handleClose);

    return () => {
      window.removeEventListener('toggle-mobile-sidebar', handleToggle);
      window.removeEventListener('close-mobile-sidebar', handleClose);
    };
  }, []);

  React.useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  const handleLogout = () => {
    removeAuthToken();
    router.push('/login');
  };

  if (pathname === '/login') return null;

  const sidebarContent = (
    <>
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="h-17 w-120 rounded-xl flex items-center justify-center p-1.5">
            <img src="/logo.png" alt="Alpha Elevators Logo" className="h-full w-full object-contain" />
          </div>
        </div>
      </div>

      {/* Pilot Pilot Tracker Callout */}
      <div className="mx-4 my-3 p-3 bg-gradient-to-r from-emerald-950/40 to-slate-900 border border-emerald-500/30 rounded-xl">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            10-Customer Pilot
          </span>
          <span className="text-[11px] text-slate-400 font-mono">Phase 1</span>
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Official Meta WhatsApp Cloud API group updates active.
        </p>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        {navItems
          .filter((item) => {
            if (user?.role === 'QC') {
              return ['QC Site Report', 'Customers', 'Projects'].includes(item.name);
            }
            if (user?.role === 'TECHNICAL_LEAD') {
              return ['Dashboard', 'Projects', 'Customers', 'QC Site Report', 'WhatsApp Hub'].includes(item.name);
            }
            if (user?.role === 'BDM' || user?.role === 'ACCOUNTANT') {
              return ['Dashboard', 'Customers', 'Projects'].includes(item.name);
            }
            return true;
          })
          .map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all group ${
                isActive
                  ? 'bg-sky-600 text-white shadow-md shadow-sky-900/50'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Icon
                  className={`w-4 h-4 transition-transform group-hover:scale-110 ${
                    isActive ? 'text-white' : 'text-slate-400 group-hover:text-sky-400'
                  }`}
                />
                <span>{item.name}</span>
              </div>
              {item.badge ? (
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-semibold px-2 py-0.5 rounded-full border border-emerald-500/30">
                  {item.badge}
                </span>
              ) : isActive ? (
                <ChevronRight className="w-3.5 h-3.5 text-white/80" />
              ) : null}
            </Link>
          );
        })}
      </nav>

      {/* User Footer */}
      <div className="p-3 border-t border-slate-800 bg-slate-900/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-sky-400 text-xs shrink-0">
              {user?.name ? user.name.charAt(0) : 'A'}
            </div>
            <div className="truncate">
              <div className="text-xs font-semibold text-white truncate">
                {user?.name || 'Administrator'}
              </div>
              <div className="text-[10px] text-sky-400 flex items-center gap-1 font-mono">
                <ShieldCheck className="w-3 h-3" />
                {user?.role === 'QC'
                  ? 'QC INSPECTOR'
                  : user?.role === 'TECHNICAL_LEAD'
                  ? 'TECHNICAL LEAD'
                  : (user?.role || 'ADMIN')}
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Log Out"
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden md:flex w-64 h-screen sticky top-0 bg-[#0A192F] text-slate-200 flex-col border-r border-slate-800 shrink-0">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm transition-opacity"
            onClick={() => setIsMobileOpen(false)}
          />
          <aside className="relative z-10 w-72 h-full bg-[#0A192F] text-slate-200 flex flex-col border-r border-slate-800 shadow-2xl animate-fade-in">
            <div className="absolute top-3.5 right-3 z-20">
              <button
                type="button"
                onClick={() => setIsMobileOpen(false)}
                className="p-1.5 rounded-lg bg-slate-800/80 text-slate-300 hover:text-white transition-colors"
                aria-label="Close Navigation Menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
