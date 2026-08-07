'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Loader2, ExternalLink, Music } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
}

function SunoConnectModalInner({ onClose }: { onClose: () => void }) {
  const [cookie, setCookie] = useState('');
  const [browserToken, setBrowserToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [connected, setConnected] = useState(false);
  const [connectedEmail, setConnectedEmail] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/user/suno-cookie');
        if (res.ok) {
          const data = await res.json();
          setConnected(data.connected);
          setConnectedEmail(data.email || '');
        }
      } catch {}
    };
    fetchStatus();
  }, []);

  const handleSave = async () => {
    if (!cookie.trim()) return;
    setSaving(true);
    setStatus('idle');
    try {
      const res = await fetch('/api/user/suno-cookie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookie: cookie.trim(), browserToken: browserToken.trim() || undefined }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus('saved');
        setMessage(data.message || 'Đã lưu cookie thành công.');
        setConnected(true);
        setConnectedEmail(data.email || '');
        if (textareaRef.current) textareaRef.current.value = '';
      } else {
        setStatus('error');
        setMessage(data.error || 'Lưu thất bại.');
      }
    } catch {
      setStatus('error');
      setMessage('Lỗi kết nối server.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/user/suno-cookie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookie: '' }),
      });
      if (res.ok) {
        setConnected(false);
        setConnectedEmail('');
        setStatus('saved');
        setMessage('Đã ngắt kết nối tài khoản.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl animate-scale-up overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-[var(--accent-dim)] border border-[var(--accent)]/30 flex items-center justify-center">
              <Music className="h-4 w-4 text-[var(--accent)]" />
            </div>
            <div>
              <h2 className="text-sm font-black text-[var(--text-primary)]">Kết Nối Tài Khoản</h2>
              <p className="text-[10px] text-[var(--text-secondary)]">Dùng tài khoản cá nhân để tạo nhạc</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition-all">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Connected status */}
          {connected && (
            <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-900/40 flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-bold text-emerald-400">Đã kết nối</p>
                <p className="text-[10px] text-emerald-400/70 mt-0.5">
                  {connectedEmail ? `Tài khoản: ${connectedEmail}` : 'Cookie đã được lưu'}
                </p>
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="p-4 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border)] space-y-3 shadow-inner">
            <div className="flex items-center gap-2 border-b border-[var(--border)] pb-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent-dim)] text-[10px] font-black text-[var(--accent)]">
                i
              </span>
              <p className="text-[11px] font-black text-[var(--text-primary)] uppercase tracking-wider">
                Hướng dẫn lấy Cookie + Token
              </p>
            </div>
            
            <ol className="text-xs text-[var(--text-secondary)] leading-relaxed space-y-2.5 list-none pl-1">
              <li className="flex items-start gap-2.5">
                <span className="flex-shrink-0 flex h-4 w-4 items-center justify-center rounded bg-[var(--border)] text-[9px] font-bold text-[var(--text-primary)] mt-0.5">
                  1
                </span>
                <span>
                  Truy cập trang <a href="https://suno.com" target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline font-bold">suno.com</a> và đăng nhập tài khoản của bạn.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="flex-shrink-0 flex h-4 w-4 items-center justify-center rounded bg-[var(--border)] text-[9px] font-bold text-[var(--text-primary)] mt-0.5">
                  2
                </span>
                <span>
                  Nhấn phím <kbd className="px-1.5 py-0.5 text-[9px] font-mono bg-[var(--bg-input)] border border-[var(--border)] rounded shadow text-[var(--text-primary)] font-bold">F12</kbd> (hoặc chuột phải chọn Inspect) &rarr; chọn tab <strong className="text-[var(--text-primary)] font-bold">Network</strong>.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="flex-shrink-0 flex h-4 w-4 items-center justify-center rounded bg-[var(--border)] text-[9px] font-bold text-[var(--text-primary)] mt-0.5">
                  3
                </span>
                <span>
                  Bấm <strong className="text-[var(--text-primary)] font-bold">Create</strong> tạo nhạc hoặc thực hiện hành động bất kỳ để kích hoạt request.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="flex-shrink-0 flex h-4 w-4 items-center justify-center rounded bg-[var(--border)] text-[9px] font-bold text-[var(--text-primary)] mt-0.5">
                  4
                </span>
                <span>
                  Tìm request có tên <code className="px-1.5 py-0.5 font-mono text-[10px] bg-[var(--bg-input)] border border-[var(--border)] rounded text-[var(--accent)] font-semibold break-all">studio-api.prod.suno.com/api/generate</code>.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="flex-shrink-0 flex h-4 w-4 items-center justify-center rounded bg-[var(--border)] text-[9px] font-bold text-[var(--text-primary)] mt-0.5">
                  5
                </span>
                <span>
                  <strong className="text-[var(--text-primary)] font-bold">Lấy Cookie:</strong> Vào tab <strong className="text-[var(--text-primary)] font-bold">Application</strong> &rarr; <strong className="text-[var(--text-primary)] font-bold">Cookies</strong> &rarr; <code className="text-[var(--accent)] font-mono">suno.com</code> &rarr; copy toàn bộ giá trị của Cookie.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="flex-shrink-0 flex h-4 w-4 items-center justify-center rounded bg-[var(--border)] text-[9px] font-bold text-[var(--text-primary)] mt-0.5">
                  6
                </span>
                <span>
                  <strong className="text-[var(--text-primary)] font-bold">Lấy Browser Token:</strong> Nhấp vào request generate ở bước 4 &rarr; chọn tab <strong className="text-[var(--text-primary)] font-bold">Payload</strong> &rarr; copy giá trị của trường <code className="px-1.5 py-0.5 font-mono bg-[var(--bg-input)] border border-[var(--border)] rounded text-[var(--accent)] font-bold">token</code>.
                </span>
              </li>
            </ol>
          </div>

          {/* Cookie input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Cookie Tài Khoản</label>
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={cookie}
                onChange={(e) => setCookie(e.target.value)}
                placeholder="Paste toàn bộ cookie string vào đây..."
                className="w-full h-24 p-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] text-[10px] text-[var(--text-primary)] outline-none resize-none placeholder-[var(--text-muted)] transition-all font-mono leading-relaxed"
              />
            </div>
          </div>

          {/* Browser Token input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Browser Token</label>
            <input
              type="text"
              value={browserToken}
              onChange={(e) => setBrowserToken(e.target.value)}
              placeholder="Paste browser token từ Payload tab (tùy chọn, nhưng nên có)..."
              className="w-full p-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] text-[10px] text-[var(--text-primary)] outline-none placeholder-[var(--text-muted)] transition-all font-mono"
            />
            <p className="text-[9px] text-[var(--text-muted)]">
              Lấy từ F12 -&gt; Network -&gt; Request -&gt; Payload -&gt; field &quot;token&quot;
            </p>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="https://suno.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[10px] font-bold text-[var(--accent)] hover:underline"
            >
              <ExternalLink className="h-3 w-3" /> Mở Trang Chủ
            </a>
          </div>

          {/* Status message */}
          {message && (
            <div className={`p-2.5 rounded-lg text-[10px] font-semibold flex items-center gap-1.5 ${
              status === 'saved'
                ? 'bg-emerald-950/20 border border-emerald-900/40 text-emerald-400'
                : 'bg-rose-950/20 border border-rose-900/40 text-rose-400'
            }`}>
              {status === 'saved' ? <CheckCircle className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
              {message}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving || !cookie.trim()}
              className="flex-1 py-2.5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:bg-[var(--bg-hover)] disabled:text-[var(--text-muted)] text-white dark:text-black font-extrabold text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {saving ? 'Đang lưu...' : 'Lưu Cookie'}
            </button>
            {connected && (
              <button
                onClick={handleRemove}
                disabled={saving}
                className="px-4 py-2.5 rounded-xl border border-rose-900/40 text-rose-400 hover:bg-rose-950/20 font-bold text-xs transition-all"
              >
                Ngắt
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SunoConnectModal({ open, onClose }: Props) {
  const [openKey, setOpenKey] = useState(0);

  useEffect(() => {
    if (open) setOpenKey((k) => k + 1); // eslint-disable-line react-hooks/set-state-in-effect
  }, [open]);

  if (!open) return null;

  return <SunoConnectModalInner key={openKey} onClose={onClose} />;
}
