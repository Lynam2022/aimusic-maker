'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { useTheme } from '@/context/ThemeContext';
import { useMusicStore } from '@/store/musicStore';
import {
  Music,
  Sun,
  Moon,
  LogOut,
  LogIn,
  Coins,
  Menu,
  X,
  Plus,
  History,
  Settings,
  ReceiptText,
  Sparkles
} from 'lucide-react';
import SunoConnectModal from './SunoConnectModal';
import BillingHistoryModal from './BillingHistoryModal';

export default function Navbar() {
  const { toggleTheme, isDark } = useTheme();
  const { data: session, status } = useSession();
  const { credits, setShowBillingModal, setShowAuthModal, setAuthModalTab, enableSunoConnect } = useMusicStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [sunoSettingsOpen, setSunoSettingsOpen] = useState(false);
  const [billingHistoryOpen, setBillingHistoryOpen] = useState(false);
  
  const [mounted, setMounted] = useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);

  const displayCredits = credits;

  return (
    <>
      <nav className="h-14 flex-shrink-0 flex items-center justify-between px-4 md:px-6 border-b border-[var(--border)] bg-[var(--bg-nav)] backdrop-blur-sm z-40 relative">
        
        {/* Left: Logo + Brand */}
        <div className="flex items-center gap-3">
          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>

          <Link href="/" className="flex items-center gap-2 group">
            <div className="h-7 w-7 rounded-lg bg-[var(--accent-dim)] border border-[var(--accent)]/30 flex items-center justify-center group-hover:bg-[var(--accent)]/20 transition-all">
              <Sparkles className="h-4 w-4 text-[var(--accent)]" />
            </div>
            <span className="font-black text-sm text-[var(--text-primary)] tracking-wide">
              AiMusic<span className="text-[var(--accent)]">Maker</span>
            </span>
          </Link>
        </div>

        {/* Right: credits + theme + user */}
        <div className="flex items-center gap-2">
          
          {/* Credits badge */}
          <button
            onClick={() => setShowBillingModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] hover:border-[var(--accent)]/40 hover:bg-[var(--accent-dim)] transition-all text-xs font-bold"
          >
            <Coins className={`h-3.5 w-3.5 ${displayCredits >= 10 ? 'text-[var(--accent)]' : 'text-rose-500'}`} />
            <span className={displayCredits >= 10 ? 'text-[var(--text-primary)]' : 'text-rose-400'}>
              {displayCredits}
            </span>
            <Plus className="h-3 w-3 text-[var(--accent)] opacity-60" />
          </button>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all border border-transparent hover:border-[var(--border)]"
            title={mounted ? (isDark ? 'Chuyển Light Mode' : 'Chuyển Dark Mode') : 'Thay đổi giao diện'}
          >
            {mounted && isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          {/* User Menu */}
          {status === 'loading' ? (
            <div className="h-8 w-8 rounded-full bg-[var(--bg-secondary)] animate-pulse border border-[var(--border)]" />
          ) : session ? (
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[var(--bg-hover)] transition-all"
              >
                <div className="h-7 w-7 rounded-full bg-gradient-to-br from-[var(--accent)] to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                  {session.user?.name?.[0]?.toUpperCase() ?? session.user?.email?.[0]?.toUpperCase() ?? 'U'}
                </div>
                <span className="text-xs font-semibold text-[var(--text-primary)] hidden sm:block max-w-[80px] truncate">
                  {session.user?.name || session.user?.email?.split('@')[0]}
                </span>
              </button>

              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 w-52 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl z-20 overflow-hidden animate-slide-down">
                    <div className="p-3 border-b border-[var(--border)]">
                      <p className="text-xs font-bold text-[var(--text-primary)] truncate">{session.user?.name || 'User'}</p>
                      <p className="text-[10px] text-[var(--text-secondary)] truncate mt-0.5">{session.user?.email}</p>
                    </div>
                    <div className="p-1.5 space-y-0.5">
                      {enableSunoConnect && (
                        <button
                          onClick={() => { setUserMenuOpen(false); setSunoSettingsOpen(true); }}
                          className="flex w-full items-center gap-2 px-3 py-2 rounded-lg text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all"
                        >
                          <Settings className="h-3.5 w-3.5" /> Kết Nối Tài Khoản
                        </button>
                      )}
                      <Link
                        href="/history"
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <History className="h-3.5 w-3.5" /> Lịch Sử Tạo Nhạc
                      </Link>
                      <button
                        onClick={() => { setUserMenuOpen(false); setBillingHistoryOpen(true); }}
                        className="flex w-full items-center gap-2 px-3 py-2 rounded-lg text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all"
                      >
                        <ReceiptText className="h-3.5 w-3.5" /> Lịch Sử Thanh Toán
                      </button>
                      <button
                        onClick={() => { setUserMenuOpen(false); signOut({ callbackUrl: '/login' }); }}
                        className="flex w-full items-center gap-2 px-3 py-2 rounded-lg text-xs text-rose-400 hover:bg-rose-950/20 hover:text-rose-300 transition-all"
                      >
                        <LogOut className="h-3.5 w-3.5" /> Đăng Xuất
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button
              onClick={() => {
                setAuthModalTab('login');
                setShowAuthModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white dark:text-black text-xs font-bold transition-all shadow-sm cursor-pointer"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>Đăng Nhập</span>
            </button>
          )}
        </div>
      </nav>

      {/* Mobile slide-out menu */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-30 flex">
          <div className="w-64 bg-[var(--bg-card)] border-r border-[var(--border)] flex flex-col shadow-2xl animate-slide-right">
            <div className="p-4 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[var(--accent)]" />
                <span className="font-black text-sm text-[var(--text-primary)]">AiMusic<span className="text-[var(--accent)]">Maker</span></span>
              </div>
            </div>

            {!session ? (
              <div className="p-4 border-t border-[var(--border)] mt-auto">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setAuthModalTab('login');
                    setShowAuthModal(true);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white dark:text-black text-xs font-bold transition-all cursor-pointer"
                >
                  <LogIn className="h-4 w-4" />
                  <span>Đăng Nhập</span>
                </button>
              </div>
            ) : (
              <div className="p-3 border-t border-[var(--border)] mt-auto flex flex-col gap-2">
                <div className="flex items-center gap-2 px-2 py-2">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[var(--accent)] to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                    {session.user?.name?.[0]?.toUpperCase() ?? 'U'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-[var(--text-primary)] truncate">{session.user?.name}</p>
                    <p className="text-[10px] text-[var(--text-secondary)] truncate">{session.user?.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    signOut({ callbackUrl: '/login' });
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-[var(--border)] hover:bg-rose-950/20 text-rose-400 hover:text-rose-300 text-xs font-bold transition-all cursor-pointer"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Đăng Xuất</span>
                </button>
              </div>
            )}
          </div>
          <div className="flex-1 bg-black/50" onClick={() => setMobileMenuOpen(false)} />
        </div>
      )}
      {/* Suno Connect Modal */}
      <SunoConnectModal open={sunoSettingsOpen} onClose={() => setSunoSettingsOpen(false)} />
      {/* Billing History Modal */}
      <BillingHistoryModal open={billingHistoryOpen} onClose={() => setBillingHistoryOpen(false)} />
    </>
  );
}
