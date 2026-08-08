'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Settings,
  Users,
  CreditCard,
  Music,
  Shield,
  Loader2,
  AlertTriangle,
  CheckCircle,
  X,
  Search,
  Plus,
  RefreshCw,
  Ban,
  UserCheck,
  ChevronRight,
  TrendingUp,
  DollarSign,
  Layers,
  ArrowUpRight,
  ArrowDownLeft,
  Copy,
  Trash2,
  Terminal,
  Table,
  Sliders,
  ShieldAlert,
  Zap,
  Eye,
  EyeOff,
  Key,
  Info
} from 'lucide-react';

type TabType = 'overview' | 'settings' | 'users' | 'billing' | 'songs';

interface Config {
  google_client_id: string;
  google_client_secret: string;
  suno_cookie: string;
  suno_token: string;
  gemini_api_key: string;
  storage_type: string;
  storage_path: string;
  r2_account_id: string;
  r2_access_key_id: string;
  r2_secret_access_key: string;
  r2_bucket_name: string;
  r2_public_domain: string;
  deposit_account_name: string;
  deposit_account_number: string;
  deposit_bank: string;
  vnd_exchange_rate: string;
  credits_per_1000_vnd: string;
  credits_per_1_usd: string;
  paypal_client_id: string;
  paypal_client_secret: string;
  paypal_mode: string;
  sepay_api_key: string;
  credits_per_song: string;
  enable_reference_file: string;
  enable_suno_connect: string;
  enable_copyright_fallback_only: string;
  enable_audio_bypass_engine: string;
  audio_sample_rate: string;
  audio_channels: string;
  audio_peak_dbfs: string;
  audio_loudness_lufs: string;
  audio_crest_factor: string;
  audio_cutoff_khz: string;
  audio_lr_correlation: string;
  audio_side_mid_ratio: string;
  audio_vocal_retention: string;
  audio_pitch_speed_shift: string;
  audio_clean_id3: string;
  remix_styles: string;
}

interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  credits: number;
  totalEarned: number;
  totalSpent: number;
  isActive: boolean;
  role: string;
  storagePath: string | null;
  storageLimit: number;
  createdAt: string;
  _count: {
    songs: number;
  };
}

interface Transaction {
  id: string;
  userId: string;
  type: string;
  amount: number;
  balance: number;
  note: string | null;
  vndAmount: number | null;
  createdAt: string;
  user: {
    email: string;
    name: string | null;
  };
}

interface Song {
  id: string;
  userEmail: string;
  userName: string;
  prompt: string;
  lyrics: string;
  title: string;
  style: string;
  mode: string;
  outputType: string;
  vocalGender: string;
  status: string;
  createdAt: string;
  creditsCost: number;
  error?: string;
  taskId?: string;
  sunoModel: string;
}

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  // API Data States
  const [configs, setConfigs] = useState<Config | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Search & Filter States
  const [userQuery, setUserQuery] = useState('');
  const [songQuery, setSongQuery] = useState('');
  const [errorLogQuery, setErrorLogQuery] = useState('');
  const [errorViewMode, setErrorViewMode] = useState<'table' | 'terminal'>('terminal');

  // Modals & Action States
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [creditAdjustment, setCreditAdjustment] = useState<number>(0);
  const [userRoleUpdate, setUserRoleUpdate] = useState<string>('user');
  const [showUserModal, setShowUserModal] = useState(false);

  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositUserId, setDepositUserId] = useState('');
  const [depositAmount, setDepositAmount] = useState<number>(100);
  const [depositVnd, setDepositVnd] = useState<number>(100000);
  const [depositNote, setDepositNote] = useState('');

  const [selectedSong, setSelectedSong] = useState<Song | null>(null);

  // User Bulk Selection & Deletion states
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [deletingUsers, setDeletingUsers] = useState(false);

  // Suno balance state
  const [sunoBalance, setSunoBalance] = useState<number | null>(null);
  const [sunoBalanceLoading, setSunoBalanceLoading] = useState<boolean>(false);

  // Cookie info state
  const [cookieInfo, setCookieInfo] = useState<any>(null);
  const [cookieEditing, setCookieEditing] = useState(false);
  const [refreshingCookie, setRefreshingCookie] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  const fetchSunoBalance = async () => {
    setSunoBalanceLoading(true);
    try {
      const res = await fetch('/api/admin/suno-balance');
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSunoBalance(data.totalCreditsLeft);
    } catch (err) {
      console.error('Lỗi lấy số dư Suno:', err);
      setSunoBalance(null);
    } finally {
      setSunoBalanceLoading(false);
    }
  };

  const fetchCookieInfo = async () => {
    try {
      const res = await fetch('/api/admin/cookie-info');
      const data = await res.json();
      if (!data.error) setCookieInfo(data);
    } catch { }
  };

  const handleDeleteSongErrorLog = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm('Bạn có chắc muốn xóa nhật ký lỗi này?')) return;
    try {
      const res = await fetch(`/api/admin/songs?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        setSongs(prev => prev.filter(s => s.id !== id));
        if (selectedSong?.id === id) setSelectedSong(null);
      } else {
        alert(data.error || 'Lỗi khi xóa log');
      }
    } catch (err) {
      console.error('Delete song error log error:', err);
    }
  };

  const handleClearAllErrorLogs = async () => {
    if (!confirm('Bạn có chắc muốn XÓA TẤT CẢ nhật ký lỗi hệ thống? Hành động này không thể hoàn tác.')) return;
    try {
      const res = await fetch('/api/admin/songs?clearAll=true', { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        setSongs(prev => prev.filter(s => s.status !== 'failed' && !s.error));
        setSelectedSong(null);
        alert('Đã xóa sạch tất cả Nhật Ký Lỗi!');
      } else {
        alert(data.error || 'Lỗi khi xóa tất cả logs');
      }
    } catch (err) {
      console.error('Clear all error logs error:', err);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      // Fetch system configs
      const configRes = await fetch('/api/admin/config');
      const configData = await configRes.json();
      if (configData.error) throw new Error(configData.error);
      setConfigs(configData.configs);

      // Fetch users
      const usersRes = await fetch('/api/admin/users');
      const usersData = await usersRes.json();
      if (usersData.error) throw new Error(usersData.error);
      setUsers(usersData.users);

      // Fetch transactions
      const txRes = await fetch('/api/admin/transactions');
      const txData = await txRes.json();
      if (txData.error) throw new Error(txData.error);
      setTransactions(txData.transactions);

      // Fetch songs
      const songsRes = await fetch('/api/admin/songs');
      const songsData = await songsRes.json();
      if (songsData.error) throw new Error(songsData.error);
      setSongs(songsData.songs);

      // Fetch Suno balance
      fetchSunoBalance();
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi tải dữ liệu admin.');
    } finally {
      setLoading(false);
    }
  };

  const isSystemAdmin = session?.user?.role === 'admin' || session?.user?.email?.toLowerCase().trim() === 'karaokestudio2026@gmail.com';

  useEffect(() => {
    if (status === 'authenticated' && isSystemAdmin) {
      fetchData();
    }
  }, [status, session, isSystemAdmin]);

  if (status === 'loading' || (status === 'authenticated' && loading && users.length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
        <Loader2 className="h-10 w-10 text-[var(--accent)] animate-spin mb-4" />
        <p className="text-sm font-semibold tracking-wide uppercase opacity-75">Đang tải trang quản trị...</p>
      </div>
    );
  }

  if (status === 'authenticated' && !isSystemAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--bg-base)] text-center p-6">
        <div className="bg-rose-500/10 border border-rose-500/20 p-8 rounded-2xl max-w-md shadow-2xl">
          <AlertTriangle className="h-16 w-16 text-rose-500 mx-auto mb-4 animate-bounce" />
          <h1 className="text-xl font-extrabold text-[var(--text-primary)] mb-2">Access Denied</h1>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-6">
            Bạn không có quyền truy cập trang quản trị hệ thống. Tài khoản của bạn cần có quyền Admin để tiếp tục.
          </p>
          <button
            onClick={() => router.push('/')}
            className="px-5 py-2.5 bg-[var(--accent)] text-white dark:text-black font-extrabold text-xs uppercase tracking-wider rounded-xl hover:shadow-lg hover:shadow-[var(--accent)]/20 transition-all cursor-pointer"
          >
            Quay lại trang chủ
          </button>
        </div>
      </div>
    );
  }

  if (!session) return null;

  // Handle configuration update
  const handleSaveConfigs = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!configs) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configs })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSuccessMsg('Cấu hình hệ thống đã được cập nhật thành công!');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi cập nhật cấu hình.');
    }
  };

  // Handle user details update
  const handleUpdateUser = async () => {
    if (!selectedUser) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUser.id,
          isActive: selectedUser.isActive,
          role: selectedUser.role === 'admin' ? 'admin' : userRoleUpdate,
          creditsChange: creditAdjustment !== 0 ? creditAdjustment : undefined,
          storagePath: selectedUser.storagePath,
          storageLimit: selectedUser.storageLimit
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSuccessMsg(`Đã cập nhật thông tin cho user ${selectedUser.email}`);
      setShowUserModal(false);
      setCreditAdjustment(0);
      fetchData();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi cập nhật user.');
    }
  };

  // Handle manual deposit creation
  const handleCreateDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch('/api/admin/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: depositUserId,
          amount: depositAmount,
          vndAmount: depositVnd,
          note: depositNote
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSuccessMsg('Đã cộng tiền nạp thành công!');
      setShowDepositModal(false);
      setDepositUserId('');
      setDepositAmount(100);
      setDepositVnd(100000);
      setDepositNote('');
      fetchData();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi nạp tiền.');
    }
  };

  // Filtered Lists
  const filteredUsers = users.filter(u =>
    u.email.toLowerCase().includes(userQuery.toLowerCase()) ||
    (u.name && u.name.toLowerCase().includes(userQuery.toLowerCase()))
  );

  const filteredSongs = songs.filter(s =>
    s.title.toLowerCase().includes(songQuery.toLowerCase()) ||
    s.userEmail.toLowerCase().includes(songQuery.toLowerCase()) ||
    s.status.toLowerCase().includes(songQuery.toLowerCase())
  );

  // User Selection Handlers (Excludes Admin accounts from bulk selection)
  const toggleSelectAllUsers = () => {
    const selectableUsers = filteredUsers.filter(u => u.role !== 'admin');
    const selectableIds = selectableUsers.map(u => u.id);
    const allSelected = selectableIds.length > 0 && selectableIds.every(id => selectedUserIds.includes(id));
    if (allSelected) {
      setSelectedUserIds(prev => prev.filter(id => !selectableIds.includes(id)));
    } else {
      const combined = Array.from(new Set([...selectedUserIds, ...selectableIds]));
      setSelectedUserIds(combined);
    }
  };

  const toggleSelectUser = (id: string, role: string) => {
    if (role === 'admin') return;
    setSelectedUserIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleDeleteUsers = async (idsToDelete?: string[]) => {
    const targetIds = idsToDelete || selectedUserIds;
    if (targetIds.length === 0) return;

    setDeletingUsers(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: targetIds })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setSuccessMsg(data.message || `Đã xóa ${targetIds.length} tài khoản thành công!`);
      setSelectedUserIds(prev => prev.filter(id => !targetIds.includes(id)));
      setShowDeleteConfirmModal(false);
      fetchData();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi xóa tài khoản.');
    } finally {
      setDeletingUsers(false);
    }
  };

  // Overall Statistics calculations (Excludes Admin accounts from financial & usage metrics)
  const regularUsers = users.filter(u => u.role !== 'admin');
  const adminUserIds = new Set(users.filter(u => u.role === 'admin').map(u => u.id));

  const totalCreditsEarned = regularUsers.reduce((acc, u) => acc + u.totalEarned, 0);
  const totalCreditsSpent = regularUsers.reduce((acc, u) => acc + u.totalSpent, 0);
  const totalSongsGenerated = songs.length;
  const failedSongsGenerated = songs.filter(s => s.status === 'failed').length;
  const totalDepositedVnd = transactions
    .filter(t => t.type === 'deposit' && !adminUserIds.has(t.userId))
    .reduce((acc, t) => acc + (t.vndAmount || 0), 0);
  const totalDepositedCredits = transactions
    .filter(t => t.type === 'deposit' && !adminUserIds.has(t.userId) && !t.note?.includes('đăng ký'))
    .reduce((acc, t) => acc + t.amount, 0);

  return (
    <div className="flex h-screen bg-[var(--bg-base)] text-[var(--text-primary)] font-sans overflow-hidden">
      {/* ── SIDEBAR NAV ── */}
      <div className="w-[260px] shrink-0 border-r border-[var(--border)] bg-[var(--bg-card)]/90 backdrop-blur-md flex flex-col justify-between py-6">
        <div className="space-y-6">
          {/* Logo brand */}
          <div className="px-6 flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-[var(--accent)] to-teal-400 flex items-center justify-center shadow-lg shadow-[var(--accent)]/20 animate-pulse">
              <Shield className="h-5 w-5 text-white dark:text-black" />
            </div>
            <div>
              <h2 className="text-xs font-black tracking-wider uppercase text-transparent bg-clip-text bg-gradient-to-r from-[var(--text-primary)] to-[var(--text-secondary)]">NHẠC AI ADMIN</h2>
              <span className="text-[9px] font-black text-[var(--accent)] uppercase tracking-widest block -mt-0.5">Console Panel</span>
            </div>
          </div>

          {/* Nav Items */}
          <nav className="px-3 space-y-1.5">
            {[
              { id: 'overview', label: 'Tổng Quan', icon: LayoutDashboard },
              { id: 'settings', label: 'Cấu Hình Hệ Thống', icon: Settings },
              { id: 'users', label: 'Quản Lý User', icon: Users },
              { id: 'billing', label: 'Lịch Sử Nạp Tiền', icon: CreditCard },
              { id: 'songs', label: 'Lịch Sử Sinh Nhạc', icon: Music }
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-[var(--accent-dim)] to-transparent text-[var(--accent)] border-l-4 border-[var(--accent)] shadow-[inset_4px_0_12px_rgba(20,184,166,0.06)]'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]/30 hover:text-[var(--text-primary)] hover:translate-x-1'
                  }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-115'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* User context footer */}
        <div className="px-3">
          <div className="bg-[var(--bg-secondary)]/50 border border-[var(--border)] rounded-2xl p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-[var(--accent)] to-emerald-400 flex items-center justify-center text-xs font-black text-white dark:text-black shadow-inner shadow-white/20">
              A
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold truncate text-[var(--text-primary)]">Admin Console</p>
              <p className="text-[9px] truncate text-[var(--text-muted)] font-mono">{session.user.email}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── MAIN VIEWPORT ── */}
      <div className="flex-1 flex flex-col min-w-0 bg-[var(--bg-base)] overflow-y-auto custom-scrollbar">
        {/* Header toolbar */}
        <header className="h-[70px] border-b border-[var(--border)] bg-[var(--bg-card)]/50 backdrop-blur-md px-8 flex items-center justify-between shrink-0 sticky top-0 z-40">
          <div className="flex items-center gap-3">
            {activeTab === 'overview' && <LayoutDashboard className="h-5 w-5 text-[var(--accent)]" />}
            {activeTab === 'settings' && <Settings className="h-5 w-5 text-[var(--accent)]" />}
            {activeTab === 'users' && <Users className="h-5 w-5 text-[var(--accent)]" />}
            {activeTab === 'billing' && <CreditCard className="h-5 w-5 text-[var(--accent)]" />}
            {activeTab === 'songs' && <Music className="h-5 w-5 text-[var(--accent)]" />}
            
            <h1 className="text-sm font-black tracking-tight text-[var(--text-primary)] uppercase">
              {activeTab === 'overview' ? 'Bảng tổng quan thống kê' : 
               activeTab === 'settings' ? 'Cấu hình hệ thống chung' : 
               activeTab === 'users' ? 'Quản lý tài khoản' : 
               activeTab === 'billing' ? 'Hóa đơn & giao dịch' : 'Theo dõi sinh nhạc'}
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={fetchData}
              className="p-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-muted)] hover:rotate-180 transition-all duration-300 flex items-center justify-center cursor-pointer shadow-sm"
              title="Tải lại dữ liệu"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Global Notification Banner */}
        {errorMsg && (
          <div className="mx-8 mt-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-bold flex items-center gap-2.5 animate-fade-in shrink-0">
            <AlertTriangle className="h-4.5 w-4.5 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="mx-8 mt-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center gap-2.5 animate-fade-in shrink-0">
            <CheckCircle className="h-4.5 w-4.5 shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* ── VIEW ROUTER ── */}
        <main className="p-8 flex-1 min-h-0">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-8 animate-fade-in">
              {/* Stat Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                  { label: 'Tổng doanh thu', value: `${totalDepositedVnd.toLocaleString('vi-VN')} VNĐ`, icon: DollarSign, color: 'text-emerald-400', bg: 'border-emerald-500/15 bg-emerald-500/5 hover:border-emerald-500/30' },
                  { label: 'Bài hát đã sinh', value: totalSongsGenerated, icon: Music, color: 'text-pink-400', bg: 'border-pink-500/15 bg-pink-500/5 hover:border-pink-500/30' },
                  { label: 'Bài hát thất bại', value: failedSongsGenerated, icon: AlertTriangle, color: 'text-rose-400', bg: 'border-rose-500/15 bg-rose-500/5 hover:border-rose-500/30' },
                  { label: 'Tổng user hoạt động', value: users.length, icon: Users, color: 'text-[var(--accent)]', bg: 'border-[var(--accent)]/15 bg-[var(--accent-dim)]/40 hover:border-[var(--accent)]/30' }
                ].map((stat, i) => {
                  const Icon = stat.icon;
                  return (
                    <div key={i} className={`p-6 rounded-2xl border ${stat.bg} flex items-center justify-between shadow-xl transition-all duration-300 hover:-translate-y-1 group`}>
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)]">{stat.label}</p>
                        <h3 className="text-xl font-black tracking-tight text-[var(--text-primary)]">{stat.value}</h3>
                      </div>
                      <div className={`p-3.5 rounded-xl bg-black/30 border border-white/5 ${stat.color} transition-transform duration-300 group-hover:scale-110`}>
                        <Icon className="h-5 w-5" />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Extra Stats summary row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] space-y-5 shadow-lg">
                  <h4 className="text-xs font-black uppercase tracking-wider text-[var(--text-secondary)] border-b border-[var(--border)] pb-2 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-[var(--accent)]" /> Thống Kê Tín Dụng (Credits)
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)]">
                      <p className="text-[10px] text-[var(--text-muted)] font-black uppercase mb-1">Lifetime Tặng / Nạp</p>
                      <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono">+{totalCreditsEarned} cr</span>
                    </div>
                    <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)]">
                      <p className="text-[10px] text-[var(--text-muted)] font-black uppercase mb-1">Tổng người dùng nạp</p>
                      <span className="text-lg font-black text-teal-600 dark:text-teal-400 font-mono">+{totalDepositedCredits} cr</span>
                    </div>
                    <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)]">
                      <p className="text-[10px] text-[var(--text-muted)] font-black uppercase mb-1">Lifetime Đã Chi Tiêu</p>
                      <span className="text-lg font-black text-rose-600 dark:text-rose-400 font-mono">-{totalCreditsSpent} cr</span>
                    </div>
                    <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)]">
                      <p className="text-[10px] text-[var(--text-muted)] font-black uppercase mb-1">Số dư tài khoản Suno</p>
                      <span className="text-lg font-black text-sky-600 dark:text-sky-400 font-mono">
                        {sunoBalanceLoading ? (
                          <span className="text-xs font-normal animate-pulse text-[var(--text-muted)]">Đang tải...</span>
                        ) : sunoBalance !== null ? (
                          `${sunoBalance.toLocaleString('vi-VN')} cr`
                        ) : (
                          <span className="text-xs font-normal text-rose-500">Lỗi lấy số dư</span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] flex flex-col justify-between shadow-lg">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-[var(--text-secondary)] border-b border-[var(--border)] pb-2 flex items-center gap-2 mb-3.5">
                      <Shield className="h-4 w-4 text-[var(--accent)]" /> Thông tin trạng thái hệ thống
                    </h4>
                    <div className="space-y-3.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[var(--text-secondary)] font-bold">Kết Nối Database:</span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[9px] font-black uppercase flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" /> Online
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[var(--text-secondary)] font-bold">Cấu hình S3/Local:</span>
                        <span className="px-2 py-0.5 rounded-full bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border)] text-[9px] font-black uppercase">
                          {configs?.storage_type === 'r2' ? 'Cloudflare R2' : configs?.storage_type === 's3' ? 'Amazon S3' : 'Local Storage'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3 mt-5">
                    <button
                      onClick={() => setActiveTab('settings')}
                      className="w-full py-2.5 bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] border border-[var(--border)] rounded-xl text-xs font-bold text-[var(--text-primary)] hover:border-[var(--text-secondary)] transition-all cursor-pointer text-center"
                    >
                      Đi tới cấu hình chi tiết
                    </button>
                  </div>
                </div>
              </div>

              {/* ── BẢNG & TERMINAL NHẬT KÝ LỖI HỆ THỐNG THỰC TẾ (HIỂN THỊ TẤT CẢ LỖI) ── */}
              <div className="p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] space-y-4 shadow-xl">
                <div className="flex items-center justify-between border-b border-[var(--border)] pb-3 flex-wrap gap-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4.5 w-4.5 text-rose-500 animate-pulse" /> 
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider text-rose-400">
                        Nhật Ký Lỗi Hệ Thống Thực Tế (System Error Tracing Logs)
                      </h4>
                      <p className="text-[10px] text-[var(--text-muted)] font-medium">Hiển thị tất cả lỗi phát sinh thực tế khi người dùng thao tác tạo nhạc trên hệ thống</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* View Mode Switcher: Table vs Terminal */}
                    <div className="flex items-center bg-zinc-950 p-1 rounded-xl border border-zinc-800">
                      <button
                        type="button"
                        onClick={() => setErrorViewMode('terminal')}
                        className={`px-3 py-1 rounded-lg text-[10px] font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                          errorViewMode === 'terminal'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        <Terminal className="h-3 w-3" /> Terminal
                      </button>
                      <button
                        type="button"
                        onClick={() => setErrorViewMode('table')}
                        className={`px-3 py-1 rounded-lg text-[10px] font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                          errorViewMode === 'table'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        <Table className="h-3 w-3" /> Dạng Bảng
                      </button>
                    </div>

                    {/* Search box for Error Logs */}
                    <div className="relative w-64 md:w-72">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-rose-400/70" />
                      <input
                        type="text"
                        value={errorLogQuery}
                        onChange={(e) => setErrorLogQuery(e.target.value)}
                        placeholder="Lọc lỗi theo email, tên bài hát, mã 402/401..."
                        className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-zinc-950/80 border border-rose-500/30 text-xs text-rose-300 placeholder-rose-500/50 outline-none focus:border-rose-500 transition-all font-mono"
                      />
                    </div>

                    <span className="px-3 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/25 text-[10px] font-black uppercase shrink-0">
                      {songs.filter(s => s.status === 'failed' || !!s.error).length} Tổng Lỗi
                    </span>
                  </div>
                </div>

                {/* VIEW MODE 1: TERMINAL CONSOLE LOG (Hiển thị đồng bộ dạng Terminal Server) */}
                {errorViewMode === 'terminal' && (
                  <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 font-mono text-xs text-zinc-300 max-h-[550px] overflow-y-auto custom-scrollbar space-y-2.5 select-text shadow-2xl">
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5 mb-3 text-[10px] text-zinc-500 font-bold uppercase select-none flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-rose-500 inline-block animate-pulse" />
                        <span className="h-2.5 w-2.5 rounded-full bg-amber-500 inline-block" />
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 inline-block" />
                        <span className="ml-2 font-mono text-zinc-400">console://system-error-logs.terminal</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const failedList = songs.filter((song) => {
                              const isError = song.status === 'failed' || (song.error && song.error.trim().length > 0);
                              if (!isError) return false;
                              if (!errorLogQuery.trim()) return true;
                              const q = errorLogQuery.toLowerCase();
                              return (
                                (song.userName || '').toLowerCase().includes(q) ||
                                (song.userEmail || '').toLowerCase().includes(q) ||
                                (song.title || '').toLowerCase().includes(q) ||
                                (song.error || '').toLowerCase().includes(q)
                              );
                            });
                            const textLogs = failedList.map(song => 
                              `[${new Date(song.createdAt).toLocaleString('vi-VN')}] [ERROR] [USER: ${song.userEmail} (${song.userName || 'User'})] [TRACK: ${song.title || 'Mây Của Anh'} | MODEL: ${song.sunoModel || 'v3.5'}] -> ${song.error || 'Lỗi kết nối từ phía máy chủ / Phiên kết nối hết hạn'}`
                            ).join('\n');
                            navigator.clipboard.writeText(textLogs);
                            alert('Đã sao chép toàn bộ Terminal Error Logs!');
                          }}
                          className="px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer border border-zinc-700 transition-all"
                        >
                          <Copy className="h-3 w-3 text-sky-400" /> Sao chép tất cả Logs
                        </button>
                        <button
                          type="button"
                          onClick={handleClearAllErrorLogs}
                          className="px-2.5 py-1 rounded bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 hover:text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer border border-rose-500/30 transition-all"
                        >
                          <Trash2 className="h-3 w-3 text-rose-400" /> Xóa tất cả Logs
                        </button>
                      </div>
                    </div>

                    {songs
                      .filter((song) => {
                        const isError = song.status === 'failed' || (song.error && song.error.trim().length > 0);
                        if (!isError) return false;
                        if (!errorLogQuery.trim()) return true;
                        const q = errorLogQuery.toLowerCase();
                        return (
                          (song.userName || '').toLowerCase().includes(q) ||
                          (song.userEmail || '').toLowerCase().includes(q) ||
                          (song.title || '').toLowerCase().includes(q) ||
                          (song.error || '').toLowerCase().includes(q) ||
                          (song.sunoModel || '').toLowerCase().includes(q) ||
                          (song.taskId || '').toLowerCase().includes(q)
                        );
                      })
                      .map((song) => {
                        const errorText = song.error || 'Lỗi kết nối từ phía máy chủ / Phiên kết nối hết hạn';
                        const is422 = errorText.includes('422') || errorText.includes('token_validation_failed') || errorText.includes('Browser Token');
                        const is402 = errorText.includes('402') || errorText.includes('credit');
                        const is401 = errorText.includes('401') || errorText.includes('unauthorized');

                        let badgeColor = 'bg-rose-500/15 text-rose-400 border-rose-500/30';
                        let badgeText = '[ERROR]';
                        if (is422) {
                          badgeColor = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
                          badgeText = '[ERROR 422: TOKEN FAULT]';
                        } else if (is402) {
                          badgeColor = 'bg-purple-500/20 text-purple-300 border-purple-500/40';
                          badgeText = '[ERROR 402: NO CREDITS]';
                        } else if (is401) {
                          badgeColor = 'bg-red-500/20 text-red-300 border-red-500/50';
                          badgeText = '[ERROR 401: AUTH EXPIRED]';
                        }

                        return (
                          <div
                            key={song.id}
                            onClick={() => setSelectedSong(song)}
                            className="leading-relaxed hover:bg-white/5 p-2.5 rounded-xl transition-all group flex items-start gap-2.5 border border-transparent hover:border-zinc-800 cursor-pointer"
                          >
                            <div className="flex-1 font-mono text-[11px] leading-relaxed break-words">
                              <span className="text-zinc-500">[{new Date(song.createdAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })}]</span>{' '}
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-black border inline-block ${badgeColor}`}>{badgeText}</span>{' '}
                              <span className="text-sky-400 font-semibold">[USER: {song.userEmail} ({song.userName || 'User'})]</span>{' '}
                              <span className="text-amber-300 font-bold">[TRACK: "{song.title || 'Mây Của Anh'}" ({song.sunoModel || 'v3.5'})]</span>{' '}
                              <span className="text-rose-300 font-semibold block sm:inline mt-1 sm:mt-0">➔ {errorText}</span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0 select-none">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedSong(song);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 border border-rose-500/30 text-rose-300 text-[10px] font-bold transition-all cursor-pointer shadow-sm flex items-center gap-1"
                              >
                                Chi Tiết
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleDeleteSongErrorLog(song.id, e)}
                                className="p-1.5 rounded-lg bg-zinc-900 hover:bg-rose-950/80 hover:text-rose-400 text-zinc-400 border border-zinc-800 transition-all cursor-pointer"
                                title="Xóa nhật ký lỗi này"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}

                    {songs.filter(s => s.status === 'failed' || !!s.error).length === 0 && (
                      <div className="p-6 text-center text-emerald-400 font-mono text-xs">
                        [SYSTEM OK] Không có lỗi sinh nhạc nào phát sinh trên hệ thống.
                      </div>
                    )}
                  </div>
                )}

                {/* VIEW MODE 2: TABLE CONTAINER (Hiển thị dạng Bảng) */}
                {errorViewMode === 'table' && (
                  <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-zinc-950/40 max-h-[550px] overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0 z-10 bg-zinc-950 border-b border-[var(--border)]">
                        <tr className="text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)]">
                          <th className="p-3.5">Thời Gian Chi Tiết</th>
                          <th className="p-3.5">Tài Khoản Người Dùng</th>
                          <th className="p-3.5">Bài Hát / Mô Hình</th>
                          <th className="p-3.5">Chi Tiết Lỗi Thực Tế (Raw Error Log)</th>
                          <th className="p-3.5 text-center">Thao Tác</th>
                        </tr>
                      </thead>
                      <tbody className="text-xs font-semibold divide-y divide-[var(--border)]">
                        {songs
                          .filter((song) => {
                            const isError = song.status === 'failed' || (song.error && song.error.trim().length > 0);
                            if (!isError) return false;
                            if (!errorLogQuery.trim()) return true;
                            const q = errorLogQuery.toLowerCase();
                            return (
                              (song.userName || '').toLowerCase().includes(q) ||
                              (song.userEmail || '').toLowerCase().includes(q) ||
                              (song.title || '').toLowerCase().includes(q) ||
                              (song.error || '').toLowerCase().includes(q) ||
                              (song.sunoModel || '').toLowerCase().includes(q) ||
                              (song.taskId || '').toLowerCase().includes(q)
                            );
                          })
                          .map((song) => (
                            <tr key={song.id} className="hover:bg-rose-500/5 transition-all">
                              <td className="p-3.5 text-[10px] text-[var(--text-muted)] font-mono whitespace-nowrap">
                                {new Date(song.createdAt).toLocaleString('vi-VN', {
                                  hour: '2-digit', minute: '2-digit', second: '2-digit',
                                  day: '2-digit', month: '2-digit', year: 'numeric'
                                })}
                              </td>
                              <td className="p-3.5">
                                <p className="text-xs font-bold text-[var(--text-primary)]">{song.userName || 'User'}</p>
                                <p className="text-[10px] text-[var(--text-secondary)] font-mono">{song.userEmail}</p>
                              </td>
                              <td className="p-3.5">
                                <p className="text-xs font-bold text-[var(--text-primary)]">{song.title || 'Không tên'}</p>
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 uppercase font-mono">
                                  {song.sunoModel ? song.sunoModel.replace('chirp-', '') : 'v3.5'}
                                </span>
                              </td>
                              <td className="p-3.5 max-w-md">
                                <div className="p-2 rounded bg-zinc-950 border border-rose-500/20 text-rose-400 font-mono text-[10px] truncate" title={song.error || 'Lỗi kết nối từ phía máy chủ / Phiên kết nối hết hạn'}>
                                  {song.error || 'Lỗi kết nối từ phía máy chủ / Phiên kết nối hết hạn'}
                                </div>
                              </td>
                              <td className="p-3.5 text-center">
                                <button
                                  onClick={() => setSelectedSong(song)}
                                  className="px-3 py-1 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 text-[10px] font-extrabold rounded-lg transition-all cursor-pointer whitespace-nowrap"
                                >
                                  Chi Tiết Lỗi
                                </button>
                              </td>
                            </tr>
                          ))}
                        {songs.filter(s => s.status === 'failed' || !!s.error).length === 0 && (
                          <tr>
                            <td colSpan={5} className="p-6 text-center text-emerald-400 text-xs">
                              <CheckCircle className="h-4 w-4 inline-block mr-1.5" /> Hệ thống hoạt động hoàn hảo, không có lỗi sinh nhạc nào.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: SYSTEM SETTINGS */}
          {activeTab === 'settings' && configs && (
            <form onSubmit={handleSaveConfigs} className="space-y-8 animate-fade-in max-w-4xl">
              {/* Google login configuration */}
              <div className="p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] space-y-4 shadow-lg">
                <h3 className="text-xs font-black uppercase tracking-wider text-[var(--text-secondary)] border-b border-[var(--border)] pb-2 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-[var(--accent)]" /> Cấu hình Google Login (OAuth)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-[var(--text-secondary)]">GOOGLE CLIENT ID</label>
                    <input
                      type="text"
                      value={configs.google_client_id}
                      onChange={(e) => setConfigs({ ...configs, google_client_id: e.target.value })}
                      placeholder="Nhập Google Client ID..."
                      className="w-full p-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:border-[var(--accent)] outline-none placeholder-[var(--text-muted)] focus:ring-1 focus:ring-[var(--accent)]/20 transition-all font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-[var(--text-secondary)]">GOOGLE CLIENT SECRET</label>
                    <input
                      type="password"
                      value={configs.google_client_secret}
                      onChange={(e) => setConfigs({ ...configs, google_client_secret: e.target.value })}
                      placeholder="Nhập Google Client Secret..."
                      className="w-full p-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:border-[var(--accent)] outline-none placeholder-[var(--text-muted)] focus:ring-1 focus:ring-[var(--accent)]/20 transition-all font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Suno & Gemini system connection details */}
              <div className="p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] space-y-4 shadow-lg">
                <h3 className="text-xs font-black uppercase tracking-wider text-[var(--text-secondary)] border-b border-[var(--border)] pb-2 flex items-center gap-2">
                  <Music className="h-4 w-4 text-pink-400" /> Cấu hình hệ thống Suno & Google Gemini AI
                </h3>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-[var(--text-secondary)]">
                      GOOGLE GEMINI API KEYS (Hỗ trợ nhập nhiều Key phân tách bằng dấu phẩy hoặc xuống dòng để xoay tua Round-Robin tránh Rate-Limit 429)
                    </label>
                    <textarea
                      rows={2}
                      value={configs.gemini_api_key || ''}
                      onChange={(e) => setConfigs({ ...configs, gemini_api_key: e.target.value })}
                      placeholder="AIzaSyA..., AIzaSyB... (Nhập nhiều key phân tách bằng phẩy hoặc xuống dòng)"
                      className="w-full p-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:border-[var(--accent)] outline-none placeholder-[var(--text-muted)] focus:ring-1 focus:ring-[var(--accent)]/20 transition-all font-mono custom-scrollbar resize-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-[var(--text-secondary)]">SUNO COOKIE (Dùng làm tài khoản chung nếu user không liên kết cookie riêng)</label>
                      <div className="flex items-center gap-1.5">
                        {/* Nút Auto-Refresh Cookie qua Playwright CDP */}
                        <button
                          type="button"
                          disabled={refreshingCookie}
                          onClick={async () => {
                            setRefreshingCookie(true);
                            setCookieInfo(null);
                            try {
                              const res = await fetch('/api/admin/refresh-cookie', { method: 'POST' });
                              const data = await res.json();
                              if (data.success) {
                                alert(`✅ Refresh cookie thành công!\n${data.message}\nhasClient: ${data.hasClient}, hasSession: ${data.hasSession}`);
                                fetchCookieInfo();
                              } else {
                                alert(`❌ Lỗi refresh cookie:\n${data.message || data.error}`);
                              }
                            } catch (e: any) {
                              alert('❌ Lỗi kết nối: ' + e.message);
                            } finally {
                              setRefreshingCookie(false);
                            }
                          }}
                          className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-all font-semibold disabled:opacity-50 disabled:cursor-wait"
                        >
                          <RefreshCw className={`h-3 w-3 ${refreshingCookie ? 'animate-spin' : ''}`} />
                          {refreshingCookie ? 'Đang refresh...' : 'Auto-Refresh'}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setCookieEditing(!cookieEditing); if (!cookieEditing) fetchCookieInfo(); }}
                          className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)]/20 transition-all font-semibold"
                        >
                          <Info className="h-3 w-3" />
                          {cookieEditing ? 'Xem thông tin' : 'Cập nhật cookie'}
                        </button>
                      </div>
                    </div>

                    {/* Cookie Info Panel */}
                    {!cookieEditing && (
                      <div
                        className="w-full p-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] space-y-2 cursor-pointer hover:border-[var(--accent)]/40 transition-all"
                        onClick={() => { fetchCookieInfo(); }}
                      >
                        {cookieInfo === null ? (
                          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                            <RefreshCw className="h-3 w-3" />
                            <span>Click để xem thông tin cookie hiện tại...</span>
                          </div>
                        ) : cookieInfo.info?.isSet ? (
                          <div className="space-y-1.5">
                            <div className="flex flex-wrap gap-2">
                              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                cookieInfo.source === 'database' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'
                              }`}>
                                <Key className="h-2.5 w-2.5" />
                                {cookieInfo.source === 'database' ? 'Database' : 'ENV'}
                              </span>
                              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                cookieInfo.info.hasClient && cookieInfo.info.clientOk ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                              }`}>
                                {cookieInfo.info.hasClient && cookieInfo.info.clientOk ? <CheckCircle className="h-2.5 w-2.5" /> : <AlertTriangle className="h-2.5 w-2.5" />}
                                __client {cookieInfo.info.clientOk ? 'hợp lệ' : cookieInfo.info.hasClient ? 'hết hạn' : 'thiếu'}
                              </span>
                              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                cookieInfo.info.hasSession && cookieInfo.info.sessionOk ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                              }`}>
                                {cookieInfo.info.sessionOk ? <CheckCircle className="h-2.5 w-2.5" /> : <AlertTriangle className="h-2.5 w-2.5" />}
                                __session {cookieInfo.info.sessionOk ? 'hợp lệ' : 'hết hạn/thiếu'}
                              </span>
                              {/* Proxy Status Badge */}
                              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                cookieInfo.proxy?.enabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-orange-500/20 text-orange-400'
                              }`}>
                                {cookieInfo.proxy?.enabled ? <CheckCircle className="h-2.5 w-2.5" /> : <AlertTriangle className="h-2.5 w-2.5" />}
                                {cookieInfo.proxy?.enabled ? `🌐 Proxy ON` : '⚠️ No Proxy'}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-[10px] text-[var(--text-muted)] font-mono">
                              <div>📏 Độ dài: <span className="text-[var(--text-primary)] font-bold">{cookieInfo.info.totalLength.toLocaleString()} ký tự</span></div>
                              <div>🔑 __client: <span className="text-[var(--text-primary)]">{cookieInfo.info.clientLen} ký tự</span></div>
                              {cookieInfo.info.clientId && (
                                <div className="col-span-2">🆔 Client ID: <span className="text-blue-400">{cookieInfo.info.clientId}</span></div>
                              )}
                              {cookieInfo.info.clientExpiry && (
                                <div className="col-span-2">⏳ __client expire: <span className={cookieInfo.info.clientOk ? 'text-green-400' : 'text-red-400'}>
                                  {new Date(cookieInfo.info.clientExpiry).toLocaleDateString('vi-VN', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                                </span></div>
                              )}
                              {cookieInfo.info.sessionExpiry && (
                                <div className="col-span-2">⏳ __session expire: <span className={cookieInfo.info.sessionOk ? 'text-green-400' : 'text-red-400'}>
                                  {new Date(cookieInfo.info.sessionExpiry).toLocaleDateString('vi-VN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                </span></div>
                              )}
                              {cookieInfo.info.sessionId && (
                                <div>🎫 sessionid: <span className="text-[var(--text-primary)]">{cookieInfo.info.sessionId}</span></div>
                              )}
                              {cookieInfo.info.deviceId && (
                                <div className="col-span-2">📱 Device ID: <span className="text-[var(--text-primary)]">{cookieInfo.info.deviceId}</span></div>
                              )}
                              {cookieInfo.proxy && (
                                <div className="col-span-2">
                                  🌐 Proxy: <span className={cookieInfo.proxy.enabled ? 'text-emerald-400' : 'text-orange-400'}>
                                    {cookieInfo.proxy.enabled ? cookieInfo.proxy.display : 'Không có — dùng Direct IP (dễ bị Turnstile block)'}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-xs text-red-400">
                            <AlertTriangle className="h-3 w-3" />
                            <span>Chưa cấu hình Suno Cookie</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Cookie Edit Textarea */}
                    {cookieEditing && (
                      <div className="space-y-2">
                        <textarea
                          rows={4}
                          value={configs.suno_cookie === '••••••••' ? '' : configs.suno_cookie}
                          onChange={(e) => setConfigs({ ...configs, suno_cookie: e.target.value })}
                          placeholder="Dán toàn bộ Cookie string từ suno.com (bao gồm __client=...)\n\nHướng dẫn: Mở suno.com/create → DevTools (F12) → Network → Chọn request → Copy toàn bộ Cookie header"
                          className="w-full p-3 rounded-xl bg-[var(--bg-input)] border border-[var(--accent)]/40 text-xs text-[var(--text-primary)] focus:border-[var(--accent)] outline-none placeholder-[var(--text-muted)] font-mono resize-none focus:ring-1 focus:ring-[var(--accent)]/20 transition-all"
                        />
                        <div className="flex items-center gap-2 text-[10px] text-[var(--text-muted)]">
                          <Info className="h-3 w-3 shrink-0" />
                          <span>Cookie phải chứa <code className="text-pink-400">__client=...</code> để Clerk auth hoạt động. Sau khi lưu, số dư Suno sẽ hiển thị đúng.</span>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-[var(--text-secondary)]">BROWSER TOKEN (Kasada Token từ payload generate)</label>
                    <textarea
                      rows={2}
                      value={configs.suno_token}
                      onChange={(e) => setConfigs({ ...configs, suno_token: e.target.value })}
                      placeholder="Dán mã JWT token..."
                      className="w-full p-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:border-[var(--accent)] outline-none placeholder-[var(--text-muted)] font-mono resize-none focus:ring-1 focus:ring-[var(--accent)]/20 transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* User storage space & Song cost settings */}
              <div className="p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] space-y-4 shadow-lg">
                <h3 className="text-xs font-black uppercase tracking-wider text-[var(--text-secondary)] border-b border-[var(--border)] pb-2 flex items-center gap-2">
                  <Layers className="h-4 w-4 text-[var(--accent)]" /> Cấu hình lưu trữ & chi phí tạo nhạc
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-[var(--text-secondary)]">LOẠI LƯU TRỮ HỆ THỐNG</label>
                    <select
                      value={configs.storage_type}
                      onChange={(e) => setConfigs({ ...configs, storage_type: e.target.value })}
                      className="w-full p-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:border-[var(--accent)] outline-none focus:ring-1 focus:ring-[var(--accent)]/20 transition-all"
                    >
                      <option value="local">Lưu trữ Local Server (Mặc định)</option>
                      <option value="s3">Lưu trữ Amazon S3 Cloud</option>
                      <option value="r2">Lưu trữ Cloudflare R2 Cloud</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-[var(--text-secondary)]">ĐƯỜNG DẪN THƯ MỤC LƯU TRỮ (HOẶC S3 BUCKET)</label>
                    <input
                      type="text"
                      value={configs.storage_path}
                      onChange={(e) => setConfigs({ ...configs, storage_path: e.target.value })}
                      placeholder="./uploads"
                      className="w-full p-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:border-[var(--accent)] outline-none focus:ring-1 focus:ring-[var(--accent)]/20 transition-all font-mono"
                    />
                  </div>

                  {configs.storage_type === 'r2' && (
                    <>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-[var(--text-secondary)]">CLOUDFLARE ACCOUNT ID</label>
                        <input
                          type="text"
                          value={configs.r2_account_id || ''}
                          onChange={(e) => setConfigs({ ...configs, r2_account_id: e.target.value })}
                          placeholder="Nhập Cloudflare Account ID..."
                          className="w-full p-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:border-[var(--accent)] outline-none focus:ring-1 focus:ring-[var(--accent)]/20 transition-all font-mono"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-[var(--text-secondary)]">CLOUDFLARE R2 ACCESS KEY ID</label>
                        <input
                          type="text"
                          value={configs.r2_access_key_id || ''}
                          onChange={(e) => setConfigs({ ...configs, r2_access_key_id: e.target.value })}
                          placeholder="Nhập R2 Access Key ID..."
                          className="w-full p-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:border-[var(--accent)] outline-none focus:ring-1 focus:ring-[var(--accent)]/20 transition-all font-mono"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-[var(--text-secondary)]">CLOUDFLARE R2 SECRET ACCESS KEY</label>
                        <input
                          type="password"
                          value={configs.r2_secret_access_key || ''}
                          onChange={(e) => setConfigs({ ...configs, r2_secret_access_key: e.target.value })}
                          placeholder="Nhập R2 Secret Access Key..."
                          className="w-full p-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:border-[var(--accent)] outline-none focus:ring-1 focus:ring-[var(--accent)]/20 transition-all font-mono"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-[var(--text-secondary)]">CLOUDFLARE R2 BUCKET NAME</label>
                        <input
                          type="text"
                          value={configs.r2_bucket_name || ''}
                          onChange={(e) => setConfigs({ ...configs, r2_bucket_name: e.target.value })}
                          placeholder="Nhập tên R2 Bucket..."
                          className="w-full p-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:border-[var(--accent)] outline-none focus:ring-1 focus:ring-[var(--accent)]/20 transition-all font-mono"
                        />
                      </div>
                      <div className="space-y-1.5 md:col-span-2">
                        <label className="text-[11px] font-bold text-[var(--text-secondary)]">CLOUDFLARE R2 PUBLIC CDN DOMAIN (Hoặc Custom Domain để truy cập bài hát)</label>
                        <input
                          type="text"
                          value={configs.r2_public_domain || ''}
                          onChange={(e) => setConfigs({ ...configs, r2_public_domain: e.target.value })}
                          placeholder="Ví dụ: https://pub-xxxxxx.r2.dev hoặc https://music-cdn.domain.com"
                          className="w-full p-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:border-[var(--accent)] outline-none focus:ring-1 focus:ring-[var(--accent)]/20 transition-all font-mono"
                        />
                      </div>
                    </>
                  )}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-[var(--text-secondary)]">CREDITS KHẤU TRỪ MỖI BÀI HÁT TẠO RA</label>
                    <input
                      type="number"
                      value={configs.credits_per_song}
                      onChange={(e) => setConfigs({ ...configs, credits_per_song: e.target.value })}
                      placeholder="10"
                      className="w-full p-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:border-[var(--accent)] outline-none focus:ring-1 focus:ring-[var(--accent)]/20 transition-all font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-[var(--text-secondary)]">SỐ CREDITS NHẬN ĐƯỢC MỖI 1.000 VNĐ</label>
                    <input
                      type="number"
                      value={configs.credits_per_1000_vnd || '1'}
                      onChange={(e) => setConfigs({ ...configs, credits_per_1000_vnd: e.target.value })}
                      placeholder="1"
                      className="w-full p-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:border-[var(--accent)] outline-none focus:ring-1 focus:ring-[var(--accent)]/20 transition-all font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-[var(--text-secondary)]">SỐ CREDITS NHẬN ĐƯỢC MỖI 1 USD</label>
                    <input
                      type="number"
                      value={configs.credits_per_1_usd || '25'}
                      onChange={(e) => setConfigs({ ...configs, credits_per_1_usd: e.target.value })}
                      placeholder="25"
                      className="w-full p-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:border-[var(--accent)] outline-none focus:ring-1 focus:ring-[var(--accent)]/20 transition-all font-mono"
                    />
                  </div>

                  <div className="space-y-1.5 md:col-span-2 p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] flex items-center justify-between gap-4 mt-2 select-none">
                    <div className="space-y-0.5">
                      <span className="text-xs font-black text-[var(--text-primary)] uppercase block">Tính năng Reference File</span>
                      <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">
                        Tắt/bật tính năng tải lên Audio hoặc Ảnh tham chiếu (Reference File) ở cột bên trái màn hình chính.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                      <input
                        type="checkbox"
                        checked={configs.enable_reference_file === 'true'}
                        onChange={(e) => setConfigs({ ...configs, enable_reference_file: e.target.checked ? 'true' : 'false' })}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-[var(--bg-hover)] peer-focus:outline-none rounded-full peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[var(--text-secondary)] after:border-none after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--accent)] peer-checked:after:bg-white"></div>
                    </label>
                  </div>

                  <div className="space-y-1.5 md:col-span-2 p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] flex items-center justify-between gap-4 mt-2 select-none">
                    <div className="space-y-0.5">
                      <span className="text-xs font-black text-[var(--text-primary)] uppercase block">Tính năng Kết Nối Tài Khoản</span>
                      <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">
                        Tắt/bật tính năng Kết Nối Tài Khoản Suno cá nhân của người dùng. Khi tắt, tính năng này sẽ bị ẩn đối với tất cả người dùng.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                      <input
                        type="checkbox"
                        checked={configs.enable_suno_connect === 'true'}
                        onChange={(e) => setConfigs({ ...configs, enable_suno_connect: e.target.checked ? 'true' : 'false' })}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-[var(--bg-hover)] peer-focus:outline-none rounded-full peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[var(--text-secondary)] after:border-none after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--accent)] peer-checked:after:bg-white"></div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Deposit bank qr code info */}
              <div className="p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] space-y-4 shadow-lg">
                <h3 className="text-xs font-black uppercase tracking-wider text-[var(--text-secondary)] border-b border-[var(--border)] pb-2 flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-emerald-400" /> Cấu hình thanh toán SePay (VNĐ - chuyển khoản QR)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-[var(--text-secondary)]">NGÂN HÀNG NHẬN TIỀN</label>
                    <select
                      value={configs.deposit_bank}
                      onChange={(e) => setConfigs({ ...configs, deposit_bank: e.target.value })}
                      className="w-full p-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:border-[var(--accent)] outline-none focus:ring-1 focus:ring-[var(--accent)]/20 transition-all font-mono"
                    >
                      <option value="">-- Chọn ngân hàng --</option>
                      <option value="MB">MB Bank (Quân Đội)</option>
                      <option value="VCB">Vietcombank (VCB)</option>
                      <option value="TCB">Techcombank (TCB)</option>
                      <option value="ACB">ACB Bank</option>
                      <option value="BIDV">BIDV</option>
                      <option value="VTB">VietinBank (CTG)</option>
                      <option value="Agribank">Agribank</option>
                      <option value="VPB">VPBank</option>
                      <option value="TPB">TPBank</option>
                      <option value="STB">Sacombank (STB)</option>
                      <option value="HDB">HDBank</option>
                      <option value="VIB">VIB Bank</option>
                      <option value="SCB">SCB</option>
                      <option value="OCB">OCB</option>
                      <option value="MSB">MSB</option>
                      <option value="SHB">SHB</option>
                      <option value="EIB">Eximbank</option>
                      <option value="NCB">NCB</option>
                      <option value="NVB">NamABank</option>
                      <option value="SEAB">SeABank</option>
                      <option value="BAB">BacABank</option>
                      <option value="PGB">PGBank</option>
                    </select>
                    <p className="text-[10px] text-amber-400/90 flex items-start gap-1 leading-relaxed">
                      ⚠️ Chọn đúng ngân hàng — mã này dùng để tạo QR chuyển khoản.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-[var(--text-secondary)]">SỐ TÀI KHOẢN NHẬN TIỀN</label>
                    <input
                      type="text"
                      value={configs.deposit_account_number}
                      onChange={(e) => setConfigs({ ...configs, deposit_account_number: e.target.value })}
                      placeholder="0123456789"
                      className="w-full p-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:border-[var(--accent)] outline-none focus:ring-1 focus:ring-[var(--accent)]/20 transition-all font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-[var(--text-secondary)]">TÊN CHỦ TÀI KHOẢN</label>
                    <input
                      type="text"
                      value={configs.deposit_account_name}
                      onChange={(e) => setConfigs({ ...configs, deposit_account_name: e.target.value })}
                      placeholder="NGUYEN VAN A"
                      className="w-full p-3 rounded-xl bg-[var(--bg-input)] border border border-[var(--border)] text-xs text-[var(--text-primary)] focus:border-[var(--accent)] outline-none focus:ring-1 focus:ring-[var(--accent)]/20 transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-[var(--text-secondary)]">SEPAY API KEY (Dùng cho kiểm tra lịch sử giao dịch tự động)</label>
                    <input
                      type="password"
                      value={configs.sepay_api_key || ''}
                      onChange={(e) => setConfigs({ ...configs, sepay_api_key: e.target.value })}
                      placeholder="Mã API Key từ sepay.vn..."
                      className="w-full p-3 rounded-xl bg-[var(--bg-input)] border border border-[var(--border)] text-xs text-[var(--text-primary)] focus:border-[var(--accent)] outline-none focus:ring-1 focus:ring-[var(--accent)]/20 transition-all font-mono"
                    />
                  </div>

                  {/* Preview QR Code */}
                  {configs.deposit_bank && configs.deposit_account_number && (
                    <div className="md:col-span-2 p-4 rounded-xl bg-[var(--bg-secondary)] border border-emerald-500/20 flex items-center gap-5">
                      <div className="w-24 h-24 bg-white rounded-lg p-1 border border-slate-200 shrink-0 overflow-hidden">
                        <img
                          src={`https://qr.sepay.vn/img?acc=${configs.deposit_account_number}&bank=${configs.deposit_bank}&amount=50000&des=PREVIEW&template=compact`}
                          alt="QR Preview"
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="14" fill="%23ef4444">Lỗi QR</text></svg>';
                          }}
                        />
                      </div>
                      <div className="space-y-1 text-xs">
                        <p className="font-bold text-emerald-400 text-[11px] uppercase">✓ Preview QR (50.000 VNĐ mẫu)</p>
                        <p className="text-[var(--text-secondary)]">Ngân hàng: <strong className="text-[var(--text-primary)]">{configs.deposit_bank}</strong></p>
                        <p className="text-[var(--text-secondary)]">Tài khoản: <strong className="text-[var(--text-primary)] font-mono">{configs.deposit_account_number}</strong></p>
                        {configs.deposit_account_name && (
                          <p className="text-[var(--text-secondary)]">Chủ TK: <strong className="text-[var(--text-primary)]">{configs.deposit_account_name}</strong></p>
                        )}
                        <p className="text-[10px] text-amber-400/80">Nếu QR hiển thị đúng → cấu hình hợp lệ.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* PayPal Configurations */}
              <div className="p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] space-y-4 shadow-lg">
                <h3 className="text-xs font-black uppercase tracking-wider text-[var(--text-secondary)] border-b border-[var(--border)] pb-2 flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-blue-500" /> Cấu hình thanh toán PayPal (Quốc tế - USD)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-[var(--text-secondary)]">PAYPAL CLIENT ID</label>
                    <input
                      type="text"
                      value={configs.paypal_client_id || ''}
                      onChange={(e) => setConfigs({ ...configs, paypal_client_id: e.target.value })}
                      placeholder="sandbox hoặc Live Client ID..."
                      className="w-full p-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:border-[var(--accent)] outline-none focus:ring-1 focus:ring-[var(--accent)]/20 transition-all font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-[var(--text-secondary)]">PAYPAL CLIENT SECRET</label>
                    <input
                      type="password"
                      value={configs.paypal_client_secret || ''}
                      onChange={(e) => setConfigs({ ...configs, paypal_client_secret: e.target.value })}
                      placeholder="PayPal Secret Key..."
                      className="w-full p-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:border-[var(--accent)] outline-none focus:ring-1 focus:ring-[var(--accent)]/20 transition-all font-mono"
                    />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-[11px] font-bold text-[var(--text-secondary)]">MÔI TRƯỜNG THANH TOÁN (MODE)</label>
                    <select
                      value={configs.paypal_mode || 'sandbox'}
                      onChange={(e) => setConfigs({ ...configs, paypal_mode: e.target.value })}
                      className="w-full p-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:border-[var(--accent)] outline-none focus:ring-1 focus:ring-[var(--accent)]/20 transition-all cursor-pointer"
                    >
                      <option value="sandbox">Thử nghiệm (Sandbox)</option>
                      <option value="live">Thực tế (Live / Production)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* ── BẢNG CẤU HÌNH CHỈ SỐ KỸ THUẬT VÀ TINH CHỈNH ĐỘ CHÊNH LỆCH ÂM THANH ── */}
              <div className="p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] space-y-5 shadow-lg">
                <div className="border-b border-[var(--border)] pb-3 flex items-center justify-between gap-4 flex-wrap">
                  <h3 className="text-xs font-black uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-2">
                    <Sliders className="h-4 w-4 text-[var(--accent)]" /> Bảng Cấu Hình Chỉ Số Kỹ Thuật & Tinh Chỉnh Độ Chênh Lệch File Âm Thanh (Audio Bypass Engine)
                  </h3>
                  <div className="flex items-center gap-3 select-none">
                    <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border ${
                      configs.enable_audio_bypass_engine !== 'false'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                    }`}>
                      {configs.enable_audio_bypass_engine !== 'false' ? 'ĐANG BẬT' : 'ĐÃ TẮT'}
                    </span>
                    <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                      <input
                        type="checkbox"
                        checked={configs.enable_audio_bypass_engine !== 'false'}
                        onChange={(e) => setConfigs({ ...configs, enable_audio_bypass_engine: e.target.checked ? 'true' : 'false' })}
                        className="sr-only peer"
                      />
                      <div className="w-10 h-6 bg-[var(--bg-hover)] peer-focus:outline-none rounded-full peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[var(--text-secondary)] after:border-none after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--accent)] peer-checked:after:bg-white"></div>
                    </label>
                  </div>
                </div>

                <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                  Cấu hình các chỉ số kỹ thuật mục tiêu và độ chênh lệch mặc định khi hệ thống tự động biến đổi file âm thanh tham chiếu (Reference Audio) để lách bản quyền và tự động tải lên Suno.
                </p>

                {/* ── TOGGLE SWITCH: COPYRIGHT FALLBACK WORKFLOW ONLY ── */}
                <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 flex items-center justify-between gap-4 select-none">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="h-4.5 w-4.5 text-amber-400 shrink-0 animate-pulse" />
                      <span className="text-xs font-black text-amber-400 uppercase tracking-wider">
                        Chỉ sử dụng tính năng COPYRIGHT FALLBACK WORKFLOW (Phân Tích Sâu & Tạo Prompt Chi Tiết)
                      </span>
                    </div>
                    <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">
                      Khi BẬT, hệ thống sẽ <strong>chỉ sử dụng tính năng COPYRIGHT FALLBACK WORKFLOW</strong> — tự động phân tích âm thanh sâu (Acoustic Analysis) để bóc tách Style Prompt chi tiết, BPM, Key, dynamics và cấu trúc bài hát mà <strong>KHÔNG gửi file âm thanh thô lên máy chủ kiểm duyệt Suno</strong>, đảm bảo 100% không bị chặn bản quyền.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                    <input
                      type="checkbox"
                      checked={configs.enable_copyright_fallback_only === 'true'}
                      onChange={(e) => setConfigs({ ...configs, enable_copyright_fallback_only: e.target.checked ? 'true' : 'false' })}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-6 bg-[var(--bg-hover)] peer-focus:outline-none rounded-full peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[var(--text-secondary)] after:border-none after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500 peer-checked:after:bg-white"></div>
                  </label>
                </div>

                {/* Technical Indicators Table */}
                <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]/60">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-[var(--border)] bg-[var(--bg-hover)]/40 text-[10px] font-black uppercase text-[var(--text-muted)]">
                        <th className="p-3">Chỉ số kỹ thuật</th>
                        <th className="p-3">Mô tả tác động kỹ thuật</th>
                        <th className="p-3 text-right">Giá trị cấu hình mục tiêu</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)] font-mono text-[11px]">
                      {/* Row 1: Sample Rate */}
                      <tr className="hover:bg-[var(--bg-hover)]/20">
                        <td className="p-3 font-bold text-[var(--text-primary)] font-sans">Sample Rate (kHz)</td>
                        <td className="p-3 text-[var(--text-muted)] font-sans">Tần số lấy mẫu âm thanh mục tiêu</td>
                        <td className="p-3 text-right">
                          <select
                            value={configs.audio_sample_rate || '48000'}
                            onChange={(e) => setConfigs({ ...configs, audio_sample_rate: e.target.value })}
                            className="p-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-xs text-[var(--text-primary)] font-mono outline-none focus:border-[var(--accent)]"
                          >
                            <option value="48000">48 kHz (Mặc định chuẩn)</option>
                            <option value="46000">46 kHz (High Fidelity / Broadcast)</option>
                            <option value="44100">44.1 kHz (CD Quality)</option>
                            <option value="32000">32 kHz (Compressed)</option>
                          </select>
                        </td>
                      </tr>

                      {/* Row 2: Channel Format */}
                      <tr className="hover:bg-[var(--bg-hover)]/20">
                        <td className="p-3 font-bold text-[var(--text-primary)] font-sans">Định dạng Kênh (Channels)</td>
                        <td className="p-3 text-[var(--text-muted)] font-sans">Kênh phát stereo độc lập 2 loa (không dùng Joint Stereo)</td>
                        <td className="p-3 text-right">
                          <select
                            value={configs.audio_channels || 'stereo'}
                            onChange={(e) => setConfigs({ ...configs, audio_channels: e.target.value })}
                            className="p-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-xs text-[var(--text-primary)] font-mono outline-none focus:border-[var(--accent)]"
                          >
                            <option value="stereo">Discrete Stereo (Mặc định)</option>
                            <option value="joint">Joint Stereo</option>
                          </select>
                        </td>
                      </tr>

                      {/* Row 3: Peak Level Ceiling */}
                      <tr className="hover:bg-[var(--bg-hover)]/20">
                        <td className="p-3 font-bold text-[var(--text-primary)] font-sans">Peak Level (dBFS)</td>
                        <td className="p-3 text-[var(--text-muted)] font-sans">Giới hạn biên độ đỉnh tối đa (0 clipping samples)</td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-3">
                            <input
                              type="range"
                              min="-3.0"
                              max="0.0"
                              step="0.01"
                              value={configs.audio_peak_dbfs || '-0.79'}
                              onChange={(e) => setConfigs({ ...configs, audio_peak_dbfs: e.target.value })}
                              className="w-36 accent-[var(--accent)] cursor-pointer h-1.5 bg-[var(--bg-hover)] rounded-lg"
                            />
                            <input
                              type="text"
                              value={configs.audio_peak_dbfs || '-0.79'}
                              onChange={(e) => setConfigs({ ...configs, audio_peak_dbfs: e.target.value })}
                              className="w-20 p-1.5 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-xs text-[var(--text-primary)] font-mono outline-none focus:border-[var(--accent)] text-center font-bold"
                              placeholder="-0.79"
                            />
                          </div>
                        </td>
                      </tr>

                      {/* Row 4: Integrated Loudness */}
                      <tr className="hover:bg-[var(--bg-hover)]/20">
                        <td className="p-3 font-bold text-[var(--text-primary)] font-sans">Integrated Loudness (LUFS)</td>
                        <td className="p-3 text-[var(--text-muted)] font-sans">Độ to tích hợp tổng thể (Integrated LUFS)</td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-3">
                            <input
                              type="range"
                              min="-24.0"
                              max="-6.0"
                              step="0.1"
                              value={configs.audio_loudness_lufs || '-15.9'}
                              onChange={(e) => setConfigs({ ...configs, audio_loudness_lufs: e.target.value })}
                              className="w-36 accent-[var(--accent)] cursor-pointer h-1.5 bg-[var(--bg-hover)] rounded-lg"
                            />
                            <input
                              type="text"
                              value={configs.audio_loudness_lufs || '-15.9'}
                              onChange={(e) => setConfigs({ ...configs, audio_loudness_lufs: e.target.value })}
                              className="w-20 p-1.5 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-xs text-[var(--text-primary)] font-mono outline-none focus:border-[var(--accent)] text-center font-bold"
                              placeholder="-15.9"
                            />
                          </div>
                        </td>
                      </tr>

                      {/* Row 5: Crest Factor */}
                      <tr className="hover:bg-[var(--bg-hover)]/20">
                        <td className="p-3 font-bold text-[var(--text-primary)] font-sans">Crest Factor (dB)</td>
                        <td className="p-3 text-[var(--text-muted)] font-sans">Tỷ lệ biên độ đỉnh so với RMS power (Peak-to-RMS)</td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-3">
                            <input
                              type="range"
                              min="6.0"
                              max="24.0"
                              step="0.1"
                              value={configs.audio_crest_factor || '18.0'}
                              onChange={(e) => setConfigs({ ...configs, audio_crest_factor: e.target.value })}
                              className="w-36 accent-[var(--accent)] cursor-pointer h-1.5 bg-[var(--bg-hover)] rounded-lg"
                            />
                            <input
                              type="text"
                              value={configs.audio_crest_factor || '18.0'}
                              onChange={(e) => setConfigs({ ...configs, audio_crest_factor: e.target.value })}
                              className="w-20 p-1.5 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-xs text-[var(--text-primary)] font-mono outline-none focus:border-[var(--accent)] text-center font-bold"
                              placeholder="18.0"
                            />
                          </div>
                        </td>
                      </tr>

                      {/* Row 6: Low-Pass Filter Cutoff */}
                      <tr className="hover:bg-[var(--bg-hover)]/20">
                        <td className="p-3 font-bold text-[var(--text-primary)] font-sans">Lọc Tần Số Cao (Low-Pass Filter)</td>
                        <td className="p-3 text-[var(--text-muted)] font-sans">Tần số cắt cao (kHz) & 99.94% energy rolloff ~11.4kHz</td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-3">
                            <input
                              type="range"
                              min="8.0"
                              max="20.0"
                              step="0.1"
                              value={configs.audio_cutoff_khz || '16.0'}
                              onChange={(e) => setConfigs({ ...configs, audio_cutoff_khz: e.target.value })}
                              className="w-36 accent-[var(--accent)] cursor-pointer h-1.5 bg-[var(--bg-hover)] rounded-lg"
                            />
                            <input
                              type="text"
                              value={configs.audio_cutoff_khz || '16.0'}
                              onChange={(e) => setConfigs({ ...configs, audio_cutoff_khz: e.target.value })}
                              className="w-20 p-1.5 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-xs text-[var(--text-primary)] font-mono outline-none focus:border-[var(--accent)] text-center font-bold"
                              placeholder="16.0"
                            />
                          </div>
                        </td>
                      </tr>

                      {/* Row 7: L/R Correlation */}
                      <tr className="hover:bg-[var(--bg-hover)]/20">
                        <td className="p-3 font-bold text-[var(--text-primary)] font-sans">L/R Correlation</td>
                        <td className="p-3 text-[var(--text-muted)] font-sans">Hệ số tương quan không gian 2 loa Left / Right</td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-3">
                            <input
                              type="range"
                              min="0.50"
                              max="1.00"
                              step="0.01"
                              value={configs.audio_lr_correlation || '0.82'}
                              onChange={(e) => setConfigs({ ...configs, audio_lr_correlation: e.target.value })}
                              className="w-36 accent-[var(--accent)] cursor-pointer h-1.5 bg-[var(--bg-hover)] rounded-lg"
                            />
                            <input
                              type="text"
                              value={configs.audio_lr_correlation || '0.82'}
                              onChange={(e) => setConfigs({ ...configs, audio_lr_correlation: e.target.value })}
                              className="w-20 p-1.5 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-xs text-[var(--text-primary)] font-mono outline-none focus:border-[var(--accent)] text-center font-bold"
                              placeholder="0.82"
                            />
                          </div>
                        </td>
                      </tr>

                      {/* Row 8: Side/Mid Energy Ratio */}
                      <tr className="hover:bg-[var(--bg-hover)]/20">
                        <td className="p-3 font-bold text-[var(--text-primary)] font-sans">Side/Mid Energy Ratio</td>
                        <td className="p-3 text-[var(--text-muted)] font-sans">Tỷ lệ năng lượng kênh Side so với kênh Mid</td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-3">
                            <input
                              type="range"
                              min="0.020"
                              max="0.300"
                              step="0.001"
                              value={configs.audio_side_mid_ratio || '0.099'}
                              onChange={(e) => setConfigs({ ...configs, audio_side_mid_ratio: e.target.value })}
                              className="w-36 accent-[var(--accent)] cursor-pointer h-1.5 bg-[var(--bg-hover)] rounded-lg"
                            />
                            <input
                              type="text"
                              value={configs.audio_side_mid_ratio || '0.099'}
                              onChange={(e) => setConfigs({ ...configs, audio_side_mid_ratio: e.target.value })}
                              className="w-20 p-1.5 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-xs text-[var(--text-primary)] font-mono outline-none focus:border-[var(--accent)] text-center font-bold"
                              placeholder="0.099"
                            />
                          </div>
                        </td>
                      </tr>

                      {/* Row 9: Vocal Retention */}
                      <tr className="hover:bg-[var(--bg-hover)]/20">
                        <td className="p-3 font-bold text-[var(--text-primary)] font-sans">Bảo Tồn Giọng Hát (%)</td>
                        <td className="p-3 text-[var(--text-muted)] font-sans">Tỷ lệ phần trăm giữ nguyên giọng hát ca sĩ gốc</td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-3">
                            <input
                              type="range"
                              min="50"
                              max="100"
                              step="1"
                              value={configs.audio_vocal_retention || '90'}
                              onChange={(e) => setConfigs({ ...configs, audio_vocal_retention: e.target.value })}
                              className="w-36 accent-[var(--accent)] cursor-pointer h-1.5 bg-[var(--bg-hover)] rounded-lg"
                            />
                            <input
                              type="text"
                              value={configs.audio_vocal_retention || '90'}
                              onChange={(e) => setConfigs({ ...configs, audio_vocal_retention: e.target.value })}
                              className="w-20 p-1.5 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-xs text-[var(--text-primary)] font-mono outline-none focus:border-[var(--accent)] text-center font-bold"
                              placeholder="90"
                            />
                          </div>
                        </td>
                      </tr>

                      {/* Row 10: Pitch & Speed Shift Warping */}
                      <tr className="hover:bg-[var(--bg-hover)]/20">
                        <td className="p-3 font-bold text-[var(--text-primary)] font-sans">Pitch & Speed Shift Warping (%)</td>
                        <td className="p-3 text-[var(--text-muted)] font-sans">Tỉ lệ biến đổi Pitch (+1.2st) & Tempo Chromagram</td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-3">
                            <input
                              type="range"
                              min="0.0"
                              max="15.0"
                              step="0.1"
                              value={configs.audio_pitch_speed_shift || '4.5'}
                              onChange={(e) => setConfigs({ ...configs, audio_pitch_speed_shift: e.target.value })}
                              className="w-36 accent-[var(--accent)] cursor-pointer h-1.5 bg-[var(--bg-hover)] rounded-lg"
                            />
                            <input
                              type="text"
                              value={configs.audio_pitch_speed_shift || '4.5'}
                              onChange={(e) => setConfigs({ ...configs, audio_pitch_speed_shift: e.target.value })}
                              className="w-20 p-1.5 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-xs text-[var(--text-primary)] font-mono outline-none focus:border-[var(--accent)] text-center font-bold"
                              placeholder="4.5"
                            />
                          </div>
                        </td>
                      </tr>

                      {/* Row 11: ID3 Metadata Cleaning */}
                      <tr className="hover:bg-[var(--bg-hover)]/20">
                        <td className="p-3 font-bold text-[var(--text-primary)] font-sans">Làm Sạch Metadata (ID3 Strip)</td>
                        <td className="p-3 text-[var(--text-muted)] font-sans">Tự động xóa sạch toàn bộ nhãn ID3 & container tags</td>
                        <td className="p-3 text-right">
                          <select
                            value={configs.audio_clean_id3 || 'true'}
                            onChange={(e) => setConfigs({ ...configs, audio_clean_id3: e.target.value })}
                            className="p-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-xs text-[var(--text-primary)] font-mono outline-none focus:border-[var(--accent)]"
                          >
                            <option value="true">Bật (Làm sạch 100%)</option>
                            <option value="false">Tắt</option>
                          </select>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Remix Styles Management Section */}
              <div className="p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] space-y-4 shadow-lg">
                <h3 className="text-xs font-black uppercase tracking-wider text-[var(--text-secondary)] border-b border-[var(--border)] pb-2 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Music className="h-4 w-4 text-[var(--accent)]" /> Cấu hình các gói Remix (Tạo nhạc Remix)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        const currentStyles = JSON.parse(configs.remix_styles || '[]');
                        const newStyle = {
                          id: `remix_${Date.now()}`,
                          name: `Remix Mới ${currentStyles.length + 1}`,
                          prompt: 'Vinahouse remix Vietnam, 140 BPM, young Southern Vietnamese {gender} vocal...'
                        };
                        setConfigs({
                          ...configs,
                          remix_styles: JSON.stringify([...currentStyles, newStyle])
                        });
                      } catch (e) {
                        console.error('Error adding remix style:', e);
                      }
                    }}
                    className="px-3 py-1.5 text-[10px] font-bold rounded-lg bg-[var(--accent)] text-white dark:text-black hover:opacity-90 transition-all cursor-pointer border-none flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" /> Thêm Remix Style
                  </button>
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto custom-scrollbar pr-1.5">
                  {(() => {
                    let styles = [];
                    try {
                      styles = JSON.parse(configs.remix_styles || '[]');
                    } catch (e) {
                      styles = [];
                    }

                    if (styles.length === 0) {
                      return (
                        <div className="col-span-2 text-center py-6 text-xs text-[var(--text-muted)] italic">
                          Chưa cấu hình Remix Style nào. Vui lòng bấm nút Thêm để bắt đầu.
                        </div>
                      );
                    }

                    return styles.map((style: any, idx: number) => (
                      <div key={style.id} className="p-4.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] space-y-3 relative group">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1 space-y-1">
                            <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase">Tên gói Remix</label>
                            <input
                              type="text"
                              value={style.name}
                              onChange={(e) => {
                                const updated = [...styles];
                                updated[idx] = { ...updated[idx], name: e.target.value };
                                setConfigs({ ...configs, remix_styles: JSON.stringify(updated) });
                              }}
                              className="w-full p-2.5 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:border-[var(--accent)] outline-none transition-all font-semibold"
                              placeholder="e.g. Vinahouse Remix"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const updated = styles.filter((s: any) => s.id !== style.id);
                              setConfigs({ ...configs, remix_styles: JSON.stringify(updated) });
                            }}
                            className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all self-end border-none cursor-pointer"
                            title="Xóa Remix Style"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase flex items-center justify-between">
                            <span>Prompt cấu hình</span>
                            <span className="text-[9px] text-[var(--text-muted)] lowercase italic normal-case">Sử dụng {"{gender}"} thay vocal (male/female)</span>
                          </label>
                          <textarea
                            value={style.prompt}
                            onChange={(e) => {
                              const updated = [...styles];
                              updated[idx] = { ...updated[idx], prompt: e.target.value };
                              setConfigs({ ...configs, remix_styles: JSON.stringify(updated) });
                            }}
                            className="w-full h-24 p-2.5 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:border-[var(--accent)] outline-none resize-none transition-all font-mono custom-scrollbar leading-normal"
                            placeholder="Prompt..."
                          />
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>

              {/* Submit Save Button */}
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="px-6 py-3 bg-gradient-to-r from-[var(--accent)] to-teal-400 text-white dark:text-black font-black text-xs uppercase tracking-wider rounded-xl hover:shadow-lg hover:shadow-[var(--accent)]/25 transition-all duration-300 cursor-pointer active:scale-95 border-none"
                >
                  Lưu cấu hình hệ thống
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: USER MANAGEMENT */}
          {activeTab === 'users' && (
            <div className="space-y-6 animate-fade-in">
              {/* Toolbar */}
              <div className="flex items-center justify-between gap-4 flex-wrap bg-[var(--bg-card)] p-4 rounded-2xl border border-[var(--border)] shadow-md">
                <div className="relative max-w-md w-full">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-secondary)]" />
                  <input
                    type="text"
                    value={userQuery}
                    onChange={(e) => setUserQuery(e.target.value)}
                    placeholder="Tìm kiếm user theo email hoặc tên..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:border-[var(--accent)] outline-none placeholder-[var(--text-muted)] focus:ring-1 focus:ring-[var(--accent)]/20 transition-all"
                  />
                </div>
                <div className="flex items-center gap-3">
                  {selectedUserIds.length > 0 && (
                    <button
                      onClick={() => setShowDeleteConfirmModal(true)}
                      className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase tracking-wider rounded-xl hover:shadow-md hover:shadow-rose-600/20 transition-all flex items-center gap-1.5 cursor-pointer border-none animate-fade-in"
                    >
                      <Trash2 className="h-4 w-4 text-inherit" /> Xóa ({selectedUserIds.length}) tài khoản
                    </button>
                  )}
                  <button
                    onClick={() => setShowDepositModal(true)}
                    className="px-4 py-2.5 bg-gradient-to-r from-[var(--accent)] to-teal-400 text-white dark:text-black font-black text-xs uppercase tracking-wider rounded-xl hover:shadow-md hover:shadow-[var(--accent)]/15 transition-all flex items-center gap-1.5 cursor-pointer border-none"
                  >
                    <Plus className="h-4 w-4 text-inherit" /> Cộng tiền thủ công
                  </button>
                </div>
              </div>

              {/* Users Table */}
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)]/90 backdrop-blur-md overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[var(--border)] bg-[var(--bg-secondary)]/50 text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)] select-none">
                        <th className="p-4.5 text-center w-10">
                          {(() => {
                            const selectableUsers = filteredUsers.filter(u => u.role !== 'admin');
                            const isAllChecked = selectableUsers.length > 0 && selectableUsers.every(u => selectedUserIds.includes(u.id));
                            return (
                              <input
                                type="checkbox"
                                checked={isAllChecked}
                                disabled={selectableUsers.length === 0}
                                onChange={toggleSelectAllUsers}
                                className="h-4 w-4 rounded border-[var(--border)] text-[var(--accent)] focus:ring-0 cursor-pointer accent-[var(--accent)] disabled:opacity-30 disabled:cursor-not-allowed"
                                title={selectableUsers.length === 0 ? "Không có tài khoản user thường để chọn" : "Chọn tất cả user thường"}
                              />
                            );
                          })()}
                        </th>
                        <th className="p-4.5">Người dùng</th>
                        <th className="p-4.5">Quyền</th>
                        <th className="p-4.5">Trạng thái</th>
                        <th className="p-4.5 text-right">Số dư ví</th>
                        <th className="p-4.5 text-right">Đã nạp</th>
                        <th className="p-4.5 text-right">Đã dùng</th>
                        <th className="p-4.5 text-right">Tổng bài</th>
                        <th className="p-4.5 text-center">Giới hạn Storage</th>
                        <th className="p-4.5">Ngày tạo</th>
                        <th className="p-4.5 text-center">Hành động</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs font-semibold divide-y divide-[var(--border)]">
                      {filteredUsers.map((user) => {
                        const isSelected = selectedUserIds.includes(user.id);
                        const isAdmin = user.role === 'admin';
                        return (
                          <tr key={user.id} className={`transition-all duration-150 ${isSelected ? 'bg-[var(--accent-dim)]/20' : 'hover:bg-[var(--bg-hover)]/30'}`}>
                            <td className="p-4 text-center">
                              {isAdmin ? (
                                <span className="text-[11px] select-none opacity-40" title="Tài khoản Admin được bảo vệ, không thể xóa">🔒</span>
                              ) : (
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleSelectUser(user.id, user.role)}
                                  className="h-4 w-4 rounded border-[var(--border)] text-[var(--accent)] focus:ring-0 cursor-pointer accent-[var(--accent)]"
                                />
                              )}
                            </td>
                            <td className="p-4 flex items-center gap-3">
                              <div className="h-8.5 w-8.5 rounded-full bg-[var(--accent-dim)] border border-[var(--accent)]/15 flex items-center justify-center font-bold text-[var(--accent)] uppercase overflow-hidden shrink-0">
                                {user.avatarUrl ? (
                                  <img src={user.avatarUrl} alt="avatar" className="h-full w-full object-cover" />
                                ) : (
                                  user.email[0]
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="text-[var(--text-primary)] text-xs font-bold truncate">{user.name || 'Người dùng mới'}</p>
                                <p className="text-[10px] text-[var(--text-secondary)] font-mono truncate">{user.email}</p>
                              </div>
                            </td>
                            <td className="p-4">
                              <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase border ${
                                user.role === 'admin'
                                  ? 'bg-amber-500/10 border-amber-500/25 text-amber-600 dark:text-amber-400'
                                  : 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400'
                              }`}>
                                {user.role}
                              </span>
                            </td>
                            <td className="p-4">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase flex items-center gap-1.5 w-fit ${
                                user.isActive
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                              }`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${user.isActive ? 'bg-emerald-500 dark:bg-emerald-400 animate-pulse' : 'bg-rose-500 dark:bg-rose-400'}`} />
                                {user.isActive ? 'Hoạt động' : 'Bị khóa'}
                              </span>
                            </td>
                            <td className="p-4 text-right font-mono text-emerald-600 dark:text-emerald-400 font-bold">{user.credits} cr</td>
                            <td className="p-4 text-right font-mono text-[var(--text-primary)] font-bold">+{user.totalEarned}</td>
                            <td className="p-4 text-right font-mono text-[var(--text-secondary)]">-{user.totalSpent}</td>
                            <td className="p-4 text-right font-mono text-[var(--text-primary)] font-bold">{user._count.songs}</td>
                            <td className="p-4 text-center font-mono text-[10px]">
                              <span className="text-[var(--text-secondary)] font-bold">
                                {user.storagePath ? 'Custom' : 'Mặc định'}
                              </span>
                              <span className="text-[var(--text-muted)]">
                                {` (${user._count.songs}/${!user.storageLimit || user.storageLimit >= 999999 ? '∞' : user.storageLimit})`}
                              </span>
                            </td>
                            <td className="p-4 text-[10px] text-[var(--text-muted)] font-mono">
                              {new Date(user.createdAt).toLocaleDateString('vi-VN')}
                            </td>
                            <td className="p-4 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => {
                                    setSelectedUser(user);
                                    setUserRoleUpdate(user.role);
                                    setCreditAdjustment(0);
                                    setShowUserModal(true);
                                  }}
                                  className="px-3 py-1.5 border border-[var(--border)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] hover:border-[var(--accent)] hover:text-[var(--accent)] text-[10px] font-bold rounded-lg transition-all cursor-pointer shadow-sm"
                                >
                                  Chỉnh sửa
                                </button>
                                {!isAdmin && (
                                  <button
                                    onClick={() => {
                                      setSelectedUserIds([user.id]);
                                      setShowDeleteConfirmModal(true);
                                    }}
                                    className="p-1.5 border border-rose-500/20 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 text-[10px] font-bold rounded-lg transition-all cursor-pointer shadow-sm"
                                    title="Xóa tài khoản này"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {filteredUsers.length === 0 && (
                        <tr>
                          <td colSpan={11} className="p-8 text-center text-[var(--text-muted)]">
                            Không tìm thấy tài khoản nào phù hợp.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: BILLING & DEPOSITS */}
          {activeTab === 'billing' && (
            <div className="space-y-6 animate-fade-in">
              {/* Transactions Table */}
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)]/90 backdrop-blur-md overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[var(--border)] bg-[var(--bg-secondary)]/50 text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)] select-none">
                        <th className="p-4.5">ID Giao Dịch</th>
                        <th className="p-4.5">Người dùng</th>
                        <th className="p-4.5">Loại</th>
                        <th className="p-4.5 text-right">Tín dụng (Credits)</th>
                        <th className="p-4.5 text-right">Số tiền VNĐ</th>
                        <th className="p-4.5 text-right">Số dư mới</th>
                        <th className="p-4.5">Ghi chú</th>
                        <th className="p-4.5">Thời gian</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs font-semibold divide-y divide-[var(--border)]">
                      {transactions.map((tx) => (
                        <tr key={tx.id} className="hover:bg-[var(--bg-hover)]/30 transition-all duration-150">
                          <td className="p-4 font-mono text-[10px] text-[var(--text-muted)]">{tx.id}</td>
                          <td className="p-4">
                            <p className="text-[var(--text-primary)] text-xs font-bold">{tx.user?.name || 'User'}</p>
                            <p className="text-[10px] text-[var(--text-secondary)] font-mono">{tx.user?.email}</p>
                          </td>
                          <td className="p-4">
                            <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase flex items-center gap-1 w-fit ${
                              tx.type === 'deposit'
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                : tx.type === 'refund'
                                ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                            }`}>
                            {tx.type === 'deposit'
                              ? <ArrowUpRight className="h-3 w-3 shrink-0" />
                              : tx.type === 'refund'
                              ? <ArrowUpRight className="h-3 w-3 shrink-0" />
                              : <ArrowDownLeft className="h-3 w-3 shrink-0" />}
                            {tx.type === 'deposit' ? 'Nạp tiền' : tx.type === 'refund' ? 'Hoàn trả' : 'Trừ tiền'}
                            </span>
                          </td>
                          <td className={`p-4 text-right font-mono font-bold ${
                            tx.type === 'deposit'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : tx.type === 'refund'
                              ? 'text-blue-600 dark:text-blue-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}>
                            {tx.type === 'debit' ? '-' : '+'}{tx.amount} cr
                          </td>
                          <td className="p-4 text-right font-mono text-[var(--text-secondary)] font-bold">
                            {tx.vndAmount ? `${tx.vndAmount.toLocaleString('vi-VN')} VNĐ` : '—'}
                          </td>
                          <td className="p-4 text-right font-mono text-[var(--text-primary)] font-bold">{tx.balance} cr</td>
                          <td className="p-4 text-[var(--text-secondary)] max-w-xs truncate" title={tx.note || ''}>
                            {tx.note || '—'}
                          </td>
                          <td className="p-4 text-[10px] text-[var(--text-muted)] font-mono">
                            {new Date(tx.createdAt).toLocaleString('vi-VN')}
                          </td>
                        </tr>
                      ))}
                      {transactions.length === 0 && (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-[var(--text-muted)]">
                            Chưa có giao dịch thanh toán nào được thực hiện.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: SONG LOGS & ERROR TRACING */}
          {activeTab === 'songs' && (
            <div className="space-y-6 animate-fade-in">
              {/* Search Toolbar */}
              <div className="flex items-center justify-between gap-4 flex-wrap bg-[var(--bg-card)] p-4 rounded-2xl border border-[var(--border)] shadow-md">
                <div className="relative max-w-md w-full">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-secondary)]" />
                  <input
                    type="text"
                    value={songQuery}
                    onChange={(e) => setSongQuery(e.target.value)}
                    placeholder="Tìm bài hát theo tiêu đề, email người tạo hoặc trạng thái..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:border-[var(--accent)] outline-none placeholder-[var(--text-muted)] focus:ring-1 focus:ring-[var(--accent)]/20 transition-all"
                  />
                </div>
              </div>

              {/* Songs Table */}
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)]/90 backdrop-blur-md overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[var(--border)] bg-[var(--bg-secondary)]/50 text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)] select-none">
                        <th className="p-4.5">Tiêu đề bài hát</th>
                        <th className="p-4.5">Người tạo</th>
                        <th className="p-4.5">Model</th>
                        <th className="p-4.5">Trạng thái</th>
                        <th className="p-4.5 text-right">Chi phí</th>
                        <th className="p-4.5">Task ID</th>
                        <th className="p-4.5">Thời gian</th>
                        <th className="p-4.5 text-center">Báo lỗi</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs font-semibold divide-y divide-[var(--border)]">
                      {filteredSongs.map((song) => (
                        <tr key={song.id} className="hover:bg-[var(--bg-hover)]/30 transition-all duration-150">
                          <td className="p-4">
                            <p className="text-[var(--text-primary)] text-xs font-bold">{song.title || 'Không tên'}</p>
                            <p className="text-[10px] text-[var(--text-secondary)] max-w-xs truncate">{song.style || 'Pop/Ballad'}</p>
                          </td>
                          <td className="p-4 font-mono text-[11px] text-[var(--text-secondary)]">{song.userEmail}</td>
                          <td className="p-4">
                            <span className="px-2 py-0.5 rounded bg-[var(--bg-secondary)] text-[9px] font-black uppercase border border-[var(--border)] text-[var(--text-secondary)] font-mono">
                              {song.sunoModel ? song.sunoModel.replace('chirp-', '') : 'v3.5'}
                            </span>
                          </td>
                          <td className="p-4">
                            <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase border ${
                              song.status === 'completed'
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25'
                                : song.status === 'failed'
                                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25'
                                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25'
                            }`}>
                              {song.status}
                            </span>
                          </td>
                          <td className="p-4 text-right font-mono font-bold text-[var(--text-secondary)]">-{song.creditsCost} cr</td>
                          <td className="p-4 font-mono text-[10px] text-[var(--text-muted)]">{song.taskId || '—'}</td>
                          <td className="p-4 text-[10px] text-[var(--text-muted)] font-mono">
                            {new Date(song.createdAt).toLocaleString('vi-VN')}
                          </td>
                          <td className="p-4 text-center">
                            {song.status === 'failed' && song.error ? (
                              <button
                                onClick={() => setSelectedSong(song)}
                                className="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 text-[10px] font-bold rounded-lg transition-all cursor-pointer"
                              >
                                Xem lỗi
                              </button>
                            ) : (
                              <span className="text-[10px] text-[var(--text-muted)] font-bold">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {filteredSongs.length === 0 && (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-[var(--text-muted)]">
                            Không tìm thấy bài hát nào phù hợp.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ── MODALS BLOCK ── */}
      
      {/* 1. Edit User Modal */}
      {showUserModal && selectedUser && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] w-full max-w-md rounded-2xl overflow-hidden shadow-2xl animate-scale-up">
            <div className="p-6 border-b border-[var(--border)] flex justify-between items-center bg-[var(--bg-secondary)]/30">
              <h3 className="text-sm font-black uppercase text-[var(--text-primary)] tracking-wider">Chỉnh sửa tài khoản</h3>
              <button onClick={() => setShowUserModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer bg-transparent border-none">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Account summary */}
              <div className="p-3 bg-[var(--bg-secondary)]/40 rounded-xl border border-[var(--border)]">
                <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-wider mb-1">Tài khoản</p>
                <p className="text-xs font-bold text-[var(--text-primary)]">{selectedUser.name || 'Người dùng mới'}</p>
                <p className="text-[10px] font-mono text-[var(--text-secondary)]">{selectedUser.email}</p>
              </div>

              {/* Toggle isActive status */}
              <div className="flex items-center justify-between p-1">
                <label className="text-xs font-bold text-[var(--text-secondary)]">Trạng thái tài khoản</label>
                <button
                  type="button"
                  disabled={selectedUser.role === 'admin' || selectedUser.email.toLowerCase().trim() === 'karaokestudio2026@gmail.com'}
                  onClick={() => setSelectedUser({ ...selectedUser, isActive: !selectedUser.isActive })}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black border transition-all ${
                    selectedUser.role === 'admin' || selectedUser.email.toLowerCase().trim() === 'karaokestudio2026@gmail.com'
                      ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-600 dark:text-emerald-400 opacity-60 cursor-not-allowed'
                      : selectedUser.isActive
                      ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-600 dark:text-emerald-400 cursor-pointer'
                      : 'bg-rose-500/10 border-rose-500/25 text-rose-600 dark:text-rose-400 cursor-pointer'
                  }`}
                  title={selectedUser.role === 'admin' ? "Tài khoản Admin cố định không thể khóa" : "Bật/Tắt trạng thái"}
                >
                  {selectedUser.isActive ? 'ĐANG HOẠT ĐỘNG' : 'ĐÃ BỊ KHÓA'}
                </button>
              </div>

              {/* Set Role */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[var(--text-secondary)] flex items-center justify-between">
                  <span>Vai trò (Role)</span>
                  {(selectedUser.role === 'admin' || selectedUser.email.toLowerCase().trim() === 'karaokestudio2026@gmail.com') && (
                    <span className="text-[10px] text-amber-500 font-bold">🔒 Tài khoản Admin cố định</span>
                  )}
                </label>
                <select
                  value={userRoleUpdate}
                  onChange={(e) => setUserRoleUpdate(e.target.value)}
                  disabled={selectedUser.role === 'admin' || selectedUser.email.toLowerCase().trim() === 'karaokestudio2026@gmail.com'}
                  className="w-full p-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent)] disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <option value="user">User thường (Mặc định)</option>
                  <option value="admin">Admin quản trị hệ thống</option>
                </select>
              </div>

              {/* Custom Storage Path */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[var(--text-secondary)]">Đường dẫn lưu trữ riêng (Trống = dùng mặc định)</label>
                <input
                  type="text"
                  value={selectedUser.storagePath || ''}
                  onChange={(e) => setSelectedUser({ ...selectedUser, storagePath: e.target.value || null })}
                  placeholder="./uploads/custom-user"
                  className="w-full p-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent)] font-mono"
                />
              </div>

              {/* Custom Storage Limit */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[var(--text-secondary)]">Giới hạn số bài hát tối đa được tạo</label>
                <input
                  type="number"
                  value={selectedUser.storageLimit || 100}
                  onChange={(e) => setSelectedUser({ ...selectedUser, storageLimit: parseInt(e.target.value) || 100 })}
                  placeholder="100"
                  className="w-full p-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-xs text-[var(--text-primary)] outline-none font-mono focus:border-[var(--accent)]"
                />
              </div>

              {/* Adjust Credits balance */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[var(--text-secondary)]">Cộng / Trừ Credits (Ví dụ: +50 hoặc -30)</label>
                <input
                  type="number"
                  value={creditAdjustment}
                  onChange={(e) => setCreditAdjustment(parseInt(e.target.value) || 0)}
                  placeholder="0"
                  className="w-full p-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-xs text-[var(--text-primary)] outline-none font-mono focus:border-[var(--accent)]"
                />
                <div className="p-2 bg-[var(--bg-secondary)]/30 rounded-lg text-[9px] text-[var(--text-secondary)] font-semibold flex items-center justify-between">
                  <span>Số dư cũ: <strong className="text-[var(--text-primary)] font-mono">{selectedUser.credits} cr</strong></span>
                  <span>Số dư mới: <strong className="text-emerald-600 dark:text-emerald-400 font-mono">{selectedUser.credits + creditAdjustment} cr</strong></span>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-[var(--border)] flex justify-end gap-3 bg-[var(--bg-secondary)]/40">
              <button
                onClick={() => setShowUserModal(false)}
                className="px-4 py-2 border border-[var(--border)] rounded-xl text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer bg-transparent"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleUpdateUser}
                className="px-4 py-2 bg-gradient-to-r from-[var(--accent)] to-teal-400 text-white dark:text-black font-black text-xs uppercase tracking-wider rounded-xl hover:shadow-lg hover:shadow-[var(--accent)]/15 transition-all cursor-pointer border-none"
              >
                Xác nhận lưu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Manual Deposit Modal */}
      {showDepositModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreateDeposit} className="bg-[var(--bg-card)] border border-[var(--border)] w-full max-w-md rounded-2xl overflow-hidden shadow-2xl animate-scale-up">
            <div className="p-6 border-b border-[var(--border)] flex justify-between items-center bg-[var(--bg-secondary)]/30">
              <h3 className="text-sm font-black uppercase text-[var(--text-primary)] tracking-wider">Cộng tiền nạp thủ công</h3>
              <button type="button" onClick={() => setShowDepositModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer bg-transparent border-none">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* User Selector Dropdown */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[var(--text-secondary)]">Chọn tài khoản người dùng</label>
                <select
                  required
                  value={depositUserId}
                  onChange={(e) => setDepositUserId(e.target.value)}
                  className="w-full p-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                >
                  <option value="">-- Chọn tài khoản nhận --</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.email} ({u.name || 'User'} - {u.credits}cr)</option>
                  ))}
                </select>
              </div>

              {/* VNĐ amount */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[var(--text-secondary)]">Số tiền nạp (VNĐ)</label>
                <input
                  type="number"
                  required
                  value={depositVnd}
                  onChange={(e) => {
                    const vnd = parseInt(e.target.value) || 0;
                    setDepositVnd(vnd);
                    // auto calculate credits based on vnd_exchange_rate
                    const rate = configs ? parseInt(configs.vnd_exchange_rate) || 1000 : 1000;
                    setDepositAmount(Math.floor(vnd / rate));
                  }}
                  placeholder="100000"
                  className="w-full p-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-xs text-[var(--text-primary)] outline-none font-mono focus:border-[var(--accent)]"
                />
              </div>

              {/* Credits adjustment */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[var(--text-secondary)]">Credits cộng tương ứng (tự động tính)</label>
                <input
                  type="number"
                  required
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(parseInt(e.target.value) || 0)}
                  placeholder="100"
                  className="w-full p-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-xs text-[var(--text-primary)] outline-none font-mono focus:border-[var(--accent)]"
                />
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[var(--text-secondary)]">Ghi chú nạp tiền</label>
                <input
                  type="text"
                  value={depositNote}
                  onChange={(e) => setDepositNote(e.target.value)}
                  placeholder="e.g. Nạp tiền qua Vietcombank GD #9283"
                  className="w-full p-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                />
              </div>
            </div>
            <div className="p-6 border-t border-[var(--border)] flex justify-end gap-3 bg-[var(--bg-secondary)]/40">
              <button
                type="button"
                onClick={() => setShowDepositModal(false)}
                className="px-4 py-2 border border-[var(--border)] rounded-xl text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer bg-transparent"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-gradient-to-r from-[var(--accent)] to-teal-400 text-white dark:text-black font-black text-xs uppercase tracking-wider rounded-xl hover:shadow-lg hover:shadow-[var(--accent)]/15 transition-all cursor-pointer border-none"
              >
                Xác nhận cộng tiền
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 3. Detailed Song Error Disclose Modal */}
      {selectedSong && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] w-full max-w-3xl rounded-2xl overflow-hidden shadow-2xl animate-scale-up max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-5 border-b border-[var(--border)] flex justify-between items-center bg-zinc-950/60 shrink-0">
              <div className="flex items-center gap-2.5 text-rose-400">
                <AlertTriangle className="h-5 w-5 shrink-0 text-rose-500 animate-pulse" />
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-rose-400">
                    Chẩn Đoán Lỗi Hệ Thống Thực Tế (System Error Tracing)
                  </h3>
                  <p className="text-[10px] text-zinc-400 font-mono">Log Record ID: {selectedSong.id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedSong(null)}
                className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all cursor-pointer border border-zinc-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            {/* Modal Body */}
            <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1">
              {/* User Info Bar */}
              <div className="p-3.5 bg-rose-500/10 rounded-xl border border-rose-500/20 flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="text-[9px] font-black text-rose-400 uppercase tracking-wider mb-0.5">Tài khoản người dùng thực hiện</p>
                  <p className="text-xs font-black text-[var(--text-primary)]">{selectedSong.userName || 'User'}</p>
                  <p className="text-[11px] font-mono text-sky-400">{selectedSong.userEmail}</p>
                </div>
                <div className="text-right">
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-black uppercase inline-block">
                    ✓ Hoàn {selectedSong.creditsCost || 10} Credits OK
                  </span>
                  <p className="text-[10px] text-zinc-400 font-mono mt-1">
                    🕒 {new Date(selectedSong.createdAt).toLocaleString('vi-VN', { dateStyle: 'full', timeStyle: 'medium' })}
                  </p>
                </div>
              </div>

              {/* Song & Model Specs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-zinc-950/60 rounded-xl border border-zinc-800 text-xs">
                <div>
                  <p className="text-[9px] font-black text-zinc-400 uppercase tracking-wider mb-0.5">Tên bài hát / Title</p>
                  <p className="font-bold text-amber-300 truncate" title={selectedSong.title || 'Mây Của Anh'}>{selectedSong.title || 'Mây Của Anh'}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-zinc-400 uppercase tracking-wider mb-0.5">Mô hình AI / Task ID</p>
                  <p className="font-mono font-bold text-sky-400">{selectedSong.sunoModel || 'v3.5'}</p>
                  <p className="text-[10px] font-mono text-zinc-500 truncate" title={selectedSong.taskId || ''}>{selectedSong.taskId || '—'}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-zinc-400 uppercase tracking-wider mb-0.5">Chế độ / Style</p>
                  <p className="font-semibold text-zinc-300 truncate" title={selectedSong.style || ''}>{selectedSong.style || 'Pop/Ballad'}</p>
                </div>
              </div>

              {/* Parsed Solution Suggestion Card */}
              {(() => {
                const errText = selectedSong.error || '';
                const isTokenErr = errText.includes('token_validation_failed') || errText.includes('422') || errText.includes('Browser Token');
                const isCreditsErr = errText.includes('402') || errText.includes('credit') || errText.includes('insufficient');
                const isAuthErr = errText.includes('401') || errText.includes('unauthorized') || errText.includes('Cookie');

                return (
                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-2">
                    <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
                      <Zap className="h-4 w-4 shrink-0" />
                      <span>Chẩn đoán nguyên nhân & Solution Tip:</span>
                    </div>
                    {isTokenErr && (
                      <p className="text-xs text-amber-200 leading-relaxed">
                        👉 <strong>Nguyên nhân:</strong> Browser Token của Suno đã hết hạn hoặc bị Suno từ chối (HTTP 422).<br />
                        🛠 <strong>Giải pháp:</strong> Bật công tắc <strong>"COPYRIGHT FALLBACK WORKFLOW"</strong> trong trang Admin để hệ thống tự động bóc tách chỉ số âm thanh thực tế từ file audio và tạo Style Prompt chi tiết (&gt;900 ký tự) không lo lỗi token; HOẶC cập nhật Browser Token mới tại Settings.
                      </p>
                    )}
                    {isCreditsErr && (
                      <p className="text-xs text-amber-200 leading-relaxed">
                        👉 <strong>Nguyên nhân:</strong> Tài khoản người dùng hoặc tài khoản Suno không đủ Credits để khởi tạo bài hát (HTTP 402).<br />
                        🛠 <strong>Giải pháp:</strong> Nạp thêm Credits cho người dùng hoặc cập nhật gói tài khoản Suno mới.
                      </p>
                    )}
                    {isAuthErr && (
                      <p className="text-xs text-amber-200 leading-relaxed">
                        👉 <strong>Nguyên nhân:</strong> Phiên đăng nhập Suno Cookie đã hết hạn (HTTP 401).<br />
                        🛠 <strong>Giải pháp:</strong> Vào Suno.com đăng nhập lại và dán Cookie tươi vào cấu hình ứng dụng.
                      </p>
                    )}
                    {!isTokenErr && !isCreditsErr && !isAuthErr && (
                      <p className="text-xs text-amber-200 leading-relaxed">
                        👉 <strong>Nguyên nhân:</strong> Lỗi kết nối API máy chủ hoặc nhà cung cấp Suno phản hồi chậm.<br />
                        🛠 <strong>Giải pháp:</strong> Kiểm tra trạng thái máy chủ Suno hoặc thử lại sau ít phút.
                      </p>
                    )}
                  </div>
                );
              })()}

              {/* Raw Error Log Block */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black text-rose-400 uppercase tracking-wider">Mã Lỗi Kỹ Thuật Chi Tiết (Raw Technical Error Log)</p>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedSong.error) {
                        navigator.clipboard.writeText(selectedSong.error);
                        alert('Đã sao chép chi tiết mã lỗi!');
                      }
                    }}
                    className="px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-[10px] font-bold flex items-center gap-1 cursor-pointer border border-zinc-700 transition-all"
                  >
                    <Copy className="h-3 w-3 text-rose-400" /> Sao chép mã lỗi
                  </button>
                </div>
                <div className="p-4 rounded-xl bg-zinc-950 border border-rose-500/30 text-xs text-rose-300 font-mono leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto custom-scrollbar select-text shadow-inner">
                  {selectedSong.error || 'Lỗi không xác định hoặc không nhận được phản hồi từ server.'}
                </div>
              </div>

              {/* Prompt / Lyrics Preview */}
              {(selectedSong.prompt || selectedSong.lyrics) && (
                <div className="p-3.5 bg-zinc-950/60 rounded-xl border border-zinc-800 space-y-2">
                  <p className="text-[9px] font-black text-zinc-400 uppercase tracking-wider">Prompt / Lời bài hát gửi lên</p>
                  {selectedSong.prompt && (
                    <p className="text-xs text-zinc-300 font-mono bg-zinc-900/50 p-2.5 rounded border border-zinc-800/80 leading-relaxed max-h-24 overflow-y-auto custom-scrollbar">
                      {selectedSong.prompt}
                    </p>
                  )}
                  {selectedSong.lyrics && (
                    <p className="text-xs text-zinc-400 font-mono italic bg-zinc-900/30 p-2.5 rounded border border-zinc-800/50 leading-relaxed max-h-32 overflow-y-auto custom-scrollbar">
                      {selectedSong.lyrics}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[var(--border)] flex items-center justify-between bg-zinc-950/80 shrink-0 flex-wrap gap-3">
              <button
                type="button"
                onClick={() => handleDeleteSongErrorLog(selectedSong.id)}
                className="px-4 py-2 bg-rose-500/15 hover:bg-rose-500/30 border border-rose-500/30 rounded-xl text-xs font-bold text-rose-400 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" /> Xóa Nhật Ký Lỗi Này
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const fullInfo = `[ERROR TRACING LOG]\nID: ${selectedSong.id}\nUser: ${selectedSong.userEmail} (${selectedSong.userName || 'User'})\nTrack: ${selectedSong.title || 'Untitled'}\nModel: ${selectedSong.sunoModel || 'v3.5'}\nCreatedAt: ${selectedSong.createdAt}\nError: ${selectedSong.error || 'N/A'}`;
                    navigator.clipboard.writeText(fullInfo);
                    alert('Đã sao chép toàn bộ thông tin Tracing!');
                  }}
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-xl text-xs font-bold text-zinc-200 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Copy className="h-3.5 w-3.5 text-sky-400" /> Sao chép Full Log
                </button>
                <button
                  onClick={() => setSelectedSong(null)}
                  className="px-5 py-2 bg-[var(--accent)] text-white dark:text-black rounded-xl text-xs font-black uppercase tracking-wider hover:opacity-90 transition-all cursor-pointer border-none"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Delete Users Confirmation Modal */}
      {showDeleteConfirmModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] w-full max-w-md rounded-2xl overflow-hidden shadow-2xl animate-scale-up">
            <div className="p-6 border-b border-[var(--border)] flex justify-between items-center bg-rose-500/10">
              <div className="flex items-center gap-2.5 text-rose-500">
                <AlertTriangle className="h-5 w-5 shrink-0 animate-pulse" />
                <h3 className="text-sm font-black uppercase tracking-wider">Xác nhận xóa tài khoản</h3>
              </div>
              <button
                onClick={() => setShowDeleteConfirmModal(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer bg-transparent border-none"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <p className="text-xs text-[var(--text-primary)] leading-relaxed font-semibold">
                Bạn có chắc chắn muốn xóa <strong className="text-rose-500 font-extrabold">{selectedUserIds.length}</strong> tài khoản người dùng đã chọn không?
              </p>
              <div className="p-3 bg-rose-500/5 rounded-xl border border-rose-500/15 space-y-1">
                <p className="text-[10px] font-black text-rose-400 uppercase tracking-wider">Cảnh báo hành động:</p>
                <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                  Tất cả bài hát, lịch sử tạo nhạc và nhật ký nạp tiền liên quan đến các tài khoản này sẽ bị <strong className="text-rose-500">xóa vĩnh viễn</strong> khỏi cơ sở dữ liệu và không thể khôi phục.
                </p>
              </div>

              {/* List of emails to be deleted */}
              <div className="space-y-1">
                <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider">Danh sách tài khoản sẽ xóa ({selectedUserIds.length}):</p>
                <div className="max-h-36 overflow-y-auto custom-scrollbar p-2.5 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border)] text-xs font-mono space-y-1.5">
                  {users.filter(u => selectedUserIds.includes(u.id)).map(u => (
                    <div key={u.id} className="text-rose-400 font-bold truncate flex items-center justify-between border-b border-[var(--border)]/40 pb-1 last:border-none last:pb-0">
                      <span className="truncate">• {u.email}</span>
                      <span className="text-[9px] text-[var(--text-muted)] font-normal shrink-0 ml-2">{u.name || 'User'}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-[var(--border)] flex justify-end gap-3 bg-[var(--bg-secondary)]/40">
              <button
                type="button"
                onClick={() => setShowDeleteConfirmModal(false)}
                disabled={deletingUsers}
                className="px-4 py-2 border border-[var(--border)] rounded-xl text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer bg-transparent disabled:opacity-50"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => handleDeleteUsers()}
                disabled={deletingUsers}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase tracking-wider rounded-xl hover:shadow-lg hover:shadow-rose-600/20 transition-all cursor-pointer border-none flex items-center gap-2 disabled:opacity-50"
              >
                {deletingUsers ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Đang xóa...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" /> Xác nhận xóa vĩnh viễn
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
