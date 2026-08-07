'use client';

import React, { useEffect, useState } from 'react';
import { Music, ListMusic, FileText } from 'lucide-react';
import { useSession } from 'next-auth/react';
import Navbar from '@/components/Navbar';
import LeftPanel from '@/components/LeftPanel';
import CenterPanel from '@/components/CenterPanel';
import RightPanel from '@/components/RightPanel';
import BillingModal from '@/components/BillingModal';
import AuthModal from '@/components/AuthModal';
import { useMusicStore } from '@/store/musicStore';

export default function Home() {
  const { data: session, status } = useSession();
  const { loadSessionCredits, setHistory, setEnableReferenceFile, setEnableSunoConnect, setRemixStyles, mobileTab, setMobileTab, setLoadingHistory } = useMusicStore();

  // Load public system config
  useEffect(() => {
    fetch('/api/config/public')
      .then((res) => res.json())
      .then((data) => {
        if (data.enable_reference_file !== undefined) {
          setEnableReferenceFile(data.enable_reference_file);
        }
        if (data.enable_suno_connect !== undefined) {
          setEnableSunoConnect(data.enable_suno_connect);
        }
        if (data.remix_styles !== undefined) {
          try {
            const parsed = JSON.parse(data.remix_styles);
            if (Array.isArray(parsed)) {
              setRemixStyles(parsed);
            }
          } catch (e) {
            console.error('Lỗi phân tích cú pháp remix styles:', e);
          }
        }
      })
      .catch((err) => console.error('Lỗi tải cấu hình hệ thống:', err));
  }, [setEnableReferenceFile, setEnableSunoConnect, setRemixStyles]);

  // Sync user credits and load history when session loads
  useEffect(() => {
    if (status === 'loading') {
      return;
    }

    if (session?.user) {
      if (session.user.credits !== undefined) {
        loadSessionCredits(session.user.credits);
      }
      setLoadingHistory(true);
      // Fetch user's generation history from DB
      fetch('/api/music/history')
        .then((res) => res.json())
        .then((data) => {
          if (data.history) {
            setHistory(data.history);
          }
        })
        .catch((err) => console.error('Lỗi tải lịch sử tạo nhạc:', err))
        .finally(() => {
          setLoadingHistory(false);
        });
    } else {
      setHistory([]);
      setLoadingHistory(false);
    }
  }, [session, status, loadSessionCredits, setHistory, setLoadingHistory]);

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden bg-[var(--bg-base)]">
      {/* Universal header */}
      <Navbar />

      {/* Main 3-panel workspace */}
      <main className="flex-1 flex overflow-hidden app-layout" data-active-tab={mobileTab}>
        {/* Left config editor panel */}
        <div className="left-panel flex flex-col h-full">
          <LeftPanel />
        </div>

        {/* Center player/lyrics visualization workspace */}
        <div className="center-panel flex-1 flex flex-col h-full min-w-0">
          <CenterPanel />
        </div>

        {/* Right history logs panel (desktop only) */}
        <div className="right-panel-desktop flex flex-col h-full">
          <RightPanel />
        </div>
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <div className="md:hidden h-14 bg-[var(--bg-card)] border-t border-[var(--border)] flex items-center justify-around z-30 shrink-0">
        <button
          onClick={() => setMobileTab('create')}
          className={`flex-1 py-1.5 flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold transition-all cursor-pointer ${
            mobileTab === 'create' ? 'text-[var(--accent)] scale-105 font-extrabold' : 'text-[var(--text-secondary)]'
          }`}
        >
          <Music className="h-4.5 w-4.5" />
          <span>Tạo Nhạc</span>
        </button>
        <button
          onClick={() => setMobileTab('library')}
          className={`flex-1 py-1.5 flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold transition-all cursor-pointer ${
            mobileTab === 'library' ? 'text-[var(--accent)] scale-105 font-extrabold' : 'text-[var(--text-secondary)]'
          }`}
        >
          <ListMusic className="h-4.5 w-4.5" />
          <span>Thư Viện</span>
        </button>
        <button
          onClick={() => setMobileTab('details')}
          className={`flex-1 py-1.5 flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold transition-all cursor-pointer ${
            mobileTab === 'details' ? 'text-[var(--accent)] scale-105 font-extrabold' : 'text-[var(--text-secondary)]'
          }`}
        >
          <FileText className="h-4.5 w-4.5" />
          <span>Chi Tiết</span>
        </button>
      </div>

      {/* Simulation/Real deposit modal */}
      <BillingModal />

      {/* Login & Sign up popup modal */}
      <AuthModal />
    </div>
  );
}
