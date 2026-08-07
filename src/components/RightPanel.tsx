'use client';

import React, { useState, useEffect } from 'react';
import { useMusicStore, HistoryItem } from '@/store/musicStore';
import { parseSunoError } from '@/lib/suno-error';
import {
  Music,
  Trash2,
  Loader2,
  AlertCircle,
  CheckCircle,
  X,
  Play,
  ThumbsUp,
  MessageSquare,
  Share2,
  Music2,
  Copy,
  ChevronDown,
  ChevronUp,
  Sparkles
} from 'lucide-react';

// Helper to clean obfuscation artifacts if original lyrics missing
function getCleanLyrics(lyrics?: string, rawLyrics?: string): string {
  if (rawLyrics && rawLyrics.trim()) {
    return rawLyrics;
  }
  if (!lyrics) return '';

  const reverseHomoglyphs: Record<string, string> = {
    '\u0430': 'a', '\u0435': 'e', '\u043e': 'o', '\u0440': 'p',
    '\u0410': 'A', '\u0415': 'E', '\u041e': 'O', '\u0420': 'P',
    '\u0441': 'c', '\u0443': 'y', '\u0421': 'C', '\u0423': 'Y',
    '\u0456': 'i', '\u0455': 's', '\u0445': 'x'
  };

  return lyrics
    .split('\n')
    .map(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        return line;
      }
      let restored = line.replace(/_/g, ' ');
      return restored.split('').map(c => reverseHomoglyphs[c] || c).join('');
    })
    .join('\n');
}

export default function RightPanel() {
  const {
    history,
    activeItemId,
    activeTrackId,
    setActiveItemId,
    setActiveTrackId,
    clearHistory,
    deleteHistoryItem,
    setCreationMode,
    setPrompt,
    setLyrics,
    setSongTitle,
    setMusicStyle
  } = useMusicStore();

  const [trigger, setTrigger] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [isStyleExpanded, setIsStyleExpanded] = useState(false);

  // Reset collapse when activeTrackId changes
  useEffect(() => {
    setIsStyleExpanded(false);
  }, [activeTrackId]);

  // Set isMounted to true on client-side mount
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Sync likes and play counts between components reactively
  useEffect(() => {
    const handleUpdate = () => setTrigger((t) => t + 1);
    window.addEventListener('likes-updated', handleUpdate);
    window.addEventListener('plays-updated', handleUpdate);
    return () => {
      window.removeEventListener('likes-updated', handleUpdate);
      window.removeEventListener('plays-updated', handleUpdate);
    };
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  const isLiked = (id: string) => {
    if (!isMounted || typeof window === 'undefined') return false;
    return localStorage.getItem(`liked_${id}`) === 'true';
  };

  const getLikeCount = (id: string) => {
    if (!isMounted || typeof window === 'undefined') return 0;
    const base = isLiked(id) ? 1 : 0;
    const mock = parseInt(localStorage.getItem(`likes_count_${id}`) || '0', 10);
    return base + mock;
  };

  const getPlayCount = (id: string) => {
    if (!isMounted || typeof window === 'undefined') return 0;
    return parseInt(localStorage.getItem(`plays_${id}`) || '0', 10);
  };

  const handleToggleLike = (id: string) => {
    const active = isLiked(id);
    localStorage.setItem(`liked_${id}`, active ? 'false' : 'true');
    if (!active) {
      const currentMock = parseInt(localStorage.getItem(`likes_count_${id}`) || '0', 10);
      localStorage.setItem(`likes_count_${id}`, String(currentMock + 1));
    } else {
      const currentMock = parseInt(localStorage.getItem(`likes_count_${id}`) || '0', 10);
      localStorage.setItem(`likes_count_${id}`, String(Math.max(0, currentMock - 1)));
    }
    window.dispatchEvent(new Event('likes-updated'));
  };

  const safeCopyToClipboard = async (text: string): Promise<boolean> => {
    if (typeof window === 'undefined') return false;
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (err) {
        console.warn('Failed to copy via navigator.clipboard:', err);
      }
    }
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.top = '0';
      textarea.style.left = '0';
      textarea.style.width = '2em';
      textarea.style.height = '2em';
      textarea.style.padding = '0';
      textarea.style.border = 'none';
      textarea.style.outline = 'none';
      textarea.style.boxShadow = 'none';
      textarea.style.background = 'transparent';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textarea);
      return !!successful;
    } catch (err) {
      console.error('Fallback copy failed:', err);
      return false;
    }
  };

  const handleShare = (track: any) => {
    if (typeof window === 'undefined') return;
    const shareUrl = track.url || window.location.href;
    safeCopyToClipboard(shareUrl).then((success) => {
      if (success) {
        showToast('Đã copy liên kết bài hát!');
      } else {
        showToast('Không thể copy liên kết.');
      }
    });
  };

  const copyText = (text: string, label: string) => {
    safeCopyToClipboard(text).then((success) => {
      if (success) {
        showToast(`Đã copy ${label}!`);
      } else {
        showToast(`Không thể copy ${label}.`);
      }
    });
  };

  const handleRemix = (track: any, parentItem: any) => {
    const mode = parentItem?.mode || 'describe';
    setCreationMode(mode);
    if (mode === 'lyrics') {
      const rawLyrics = parentItem?.lyrics || getCleanLyrics(track.lyrics);
      setLyrics(rawLyrics || '');
      setMusicStyle(track.style || parentItem?.style || '');
      setSongTitle(track.title ? `${track.title} (Remix)` : 'Remix');
    } else {
      setPrompt(parentItem?.prompt || '');
    }
    showToast('Đã tải thông số vào bảng cấu hình!');
  };

  // Resolve active structures
  const activeItem = history.find((item) => item.id === activeItemId);
  // Find playing track globally in history so changing activeItem doesn't interrupt detail view or playback
  const activePlayingItem = history.find((item) =>
    item.tracks?.some((t) => t.id === activeTrackId)
  ) ?? null;
  const activeTrack = activePlayingItem?.tracks.find((t) => t.id === activeTrackId) ?? null;

  // Resolve Style (English tags)
  const resolvedStyle = activeTrack?.style || activePlayingItem?.style ||
    (activePlayingItem?.prompt && /BPM|vocal|ballad|pop|rock|strings|piano/i.test(activePlayingItem.prompt) ? activePlayingItem.prompt : '') ||
    'bright modern pop ballad, 82 BPM, warm acoustic piano, uplifting strings, romantic sweet vocal';

  // Resolve Lyrics (Must be actual lyrics, not style tags)
  const rawLyrics = activePlayingItem?.lyrics || activeTrack?.lyrics || '';
  const SECTION_HEADER_RE = /\[(Verse|Chorus|Bridge|Intro|Outro|Pre-Chorus|Hook|Drop|Build|Breakdown|Solo|Lời|Điệp)[^\]]*\]/i;
  const isStyleTagText = /^\s*(?:bright|modern|pop|ballad|rock|rap|jazz|acoustic|82\s*BPM|male\s*vocal|female\s*vocal|full\s*length)[^\[\]\n]*$/i.test(rawLyrics.trim()) ||
    (rawLyrics.includes('BPM') && rawLyrics.includes('vocal') && !SECTION_HEADER_RE.test(rawLyrics));

  const displayLyrics = isStyleTagText ? '' : (getCleanLyrics(rawLyrics) || '');

  // ── RENDER 1: TRACK DETAILED INSPECTOR (Suno Style) ──
  if (activeTrackId && activeTrack) {
    return (
      <div className="w-full md:w-[320px] h-full flex-shrink-0 flex flex-col bg-[var(--bg-card)] border-l border-[var(--border)] p-5 overflow-y-auto custom-scrollbar relative animate-fade-in gap-5">
        
        {/* Toast notification overlay (Hiển thị giữa màn hình) */}
        {toast && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 bg-zinc-950/95 backdrop-blur-xl border border-zinc-800 text-[var(--accent)] font-bold px-5 py-2.5 rounded-2xl text-xs shadow-2xl z-[9999] animate-scale-up pointer-events-none flex items-center gap-2 border-emerald-500/20 text-emerald-400">
            <span>{toast}</span>
          </div>
        )}

        {/* Header Drawer Control */}
        <div className="flex items-center justify-between pb-1 shrink-0">
          <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Detail Inspector</span>
          <button
            onClick={() => setActiveTrackId(null)}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Large Cover Art */}
        <div className="relative w-full aspect-square rounded-2xl overflow-hidden border border-[var(--border)] bg-zinc-950/80 shrink-0 shadow-lg group">
          <img
            src={activeTrack.coverUrl || (activeTrack.id ? `https://cdn1.suno.ai/image_${activeTrack.id}.png` : '')}
            alt={activeTrack.title}
            onError={(e) => {
              const target = e.currentTarget;
              if (target.src.startsWith('data:image')) return;
              const fallbackUrl = activeTrack.id ? `https://cdn1.suno.ai/image_${activeTrack.id}.png` : '';
              const unsplashFallback = 'https://images.unsplash.com/photo-1614680376593-902f74fa0d41?q=80&w=120&auto=format&fit=crop';
              if (fallbackUrl && target.src !== fallbackUrl && target.src !== unsplashFallback) {
                target.src = fallbackUrl;
              } else if (target.src === fallbackUrl) {
                target.src = unsplashFallback;
              } else {
                target.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
              }
            }}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        </div>

        {/* Statistics Dashboard Bar */}
        <div className="grid grid-cols-4 py-2 border-y border-[var(--border)] text-xs text-[var(--text-secondary)] font-semibold shrink-0 bg-[var(--bg-secondary)]/30 rounded-xl px-2">
          <div className="flex flex-col items-center gap-0.5 justify-center border-r border-[var(--border)]">
            <span className="text-[9px] text-[var(--text-muted)] uppercase font-bold tracking-wider flex items-center gap-0.5"><Play className="h-2.5 w-2.5" /> Plays</span>
            <span className="text-xs text-[var(--text-primary)] font-mono font-bold">{getPlayCount(activeTrack.id)}</span>
          </div>
          <button
            onClick={() => handleToggleLike(activeTrack.id)}
            className="flex flex-col items-center gap-0.5 justify-center border-r border-[var(--border)] hover:text-pink-500 transition-colors"
          >
            <span className="text-[9px] text-[var(--text-muted)] uppercase font-bold tracking-wider flex items-center gap-0.5"><ThumbsUp className="h-2.5 w-2.5" /> Likes</span>
            <span className={`text-xs font-mono font-bold ${isLiked(activeTrack.id) ? 'text-pink-500' : 'text-[var(--text-primary)]'}`}>
              {getLikeCount(activeTrack.id)}
            </span>
          </button>
          <div className="flex flex-col items-center gap-0.5 justify-center border-r border-[var(--border)]">
            <span className="text-[9px] text-[var(--text-muted)] uppercase font-bold tracking-wider flex items-center gap-0.5"><MessageSquare className="h-2.5 w-2.5" /> Comments</span>
            <span className="text-xs text-[var(--text-primary)] font-mono font-bold">0</span>
          </div>
          <button
            onClick={() => handleShare(activeTrack)}
            className="flex flex-col items-center gap-0.5 justify-center hover:text-[var(--accent)] transition-colors"
          >
            <span className="text-[9px] text-[var(--text-muted)] uppercase font-bold tracking-wider flex items-center gap-0.5"><Share2 className="h-2.5 w-2.5" /> Share</span>
            <span className="text-[10px] text-[var(--text-primary)] font-extrabold uppercase tracking-wide">Link</span>
          </button>
        </div>

        {/* Title details */}
        <div className="space-y-1 shrink-0">
          <h2 className="text-base font-extrabold text-[var(--text-primary)] tracking-tight leading-snug break-words">
            {activeTrack.title}
          </h2>
          <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            Model: {activePlayingItem?.sunoModel?.replace('chirp-', '') || 'v5.5'}
          </p>
        </div>

        {/* Remix/Edit Action Button */}
        {activePlayingItem?.sunoModel?.toLowerCase() !== 'remix' && (
          <button
            onClick={() => handleRemix(activeTrack, activePlayingItem)}
            className="w-full py-3 bg-[var(--bg-input)] hover:bg-[var(--accent-dim)] border border-[var(--border)] hover:border-[var(--accent)]/30 text-xs font-extrabold tracking-wider uppercase rounded-xl transition-all text-[var(--text-primary)] hover:text-[var(--accent)] flex items-center justify-center gap-2 shadow-md active:scale-[0.98] shrink-0"
          >
            <Music2 className="h-4 w-4" />
            Remix / Edit
          </button>
        )}

        {/* Styles/Tags Description Box */}
        {activePlayingItem?.sunoModel !== 'remix' && (
          <div className="space-y-2 shrink-0">
            <div className="flex justify-between items-center text-[10px] font-extrabold text-[var(--text-secondary)] uppercase tracking-wider">
              <span>Styles</span>
              <button
                onClick={() => copyText(resolvedStyle, 'styles')}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                title="Copy Styles"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className={`text-xs text-[var(--text-secondary)] font-semibold leading-relaxed break-words ${isStyleExpanded ? '' : 'line-clamp-3'}`}>
              {resolvedStyle}
            </div>
            <button 
              onClick={() => setIsStyleExpanded(!isStyleExpanded)}
              className="text-[10px] font-bold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors flex items-center gap-1 cursor-pointer mt-1"
            >
              <span>{isStyleExpanded ? 'Show Less' : 'Show More'}</span>
              {isStyleExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          </div>
        )}

        {/* Lyrics with Chords card */}
        <div className="space-y-2 shrink-0">
          <div className="flex justify-between items-center text-[10px] font-extrabold text-[var(--text-secondary)] uppercase tracking-wider shrink-0">
            <span>Lyrics / Chords</span>
            <button
              onClick={() => copyText(displayLyrics || '', 'lyrics')}
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              title="Copy Lyrics"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="font-mono text-[11px] text-[var(--text-primary)] leading-loose whitespace-pre-wrap select-text selection:bg-[var(--accent-dim)]">
            {displayLyrics || 'Không có lời bài hát (Instrumental).'}
          </div>
        </div>

      </div>
    );
  }

  // ── RENDER 2: ORIGINAL GENERATIONS HISTORY LIST ──
  const handleItemClick = (item: HistoryItem) => {
    setActiveItemId(item.id);
    if (item.status === 'completed' && item.tracks.length > 0) {
      setActiveTrackId(item.tracks[0].id);
    } else {
      setActiveTrackId(null);
    }
  };

  return (
    <div className="w-full md:w-[280px] h-full flex-shrink-0 flex flex-col bg-[var(--bg-card)] border-l border-[var(--border)] p-4 overflow-y-auto custom-scrollbar">
      
      {/* Toast overlay (Hiển thị giữa màn hình) */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 bg-zinc-950/95 backdrop-blur-xl border border-zinc-800 text-[var(--accent)] font-bold px-5 py-2.5 rounded-2xl text-xs shadow-2xl z-[9999] animate-scale-up pointer-events-none flex items-center gap-2 border-emerald-500/20 text-emerald-400">
          <span>{toast}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-[var(--border)] mb-4">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-bold text-[var(--text-primary)]">History</span>
          <span className="text-xs bg-[var(--bg-hover)] text-[var(--text-secondary)] px-2 py-0.5 rounded-full font-bold">
            {history.length}
          </span>
        </div>
        
        {history.length > 0 && (
          <button
            onClick={clearHistory}
            className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-rose-400 transition-colors font-medium cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear
          </button>
        )}
      </div>

      {/* List */}
      <div className="flex-1 space-y-2 overflow-y-auto pr-1 custom-scrollbar">
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center text-[var(--text-muted)]">
            <Music className="h-8 w-8 mb-2 opacity-35" />
            <p className="text-xs">Chưa có bài hát nào được tạo</p>
          </div>
        ) : (
          history.map((item) => {
            const isActive = activeItemId === item.id;
            
            // Get title display
            const displayTitle = item.tracks[0]?.title || item.title || item.prompt.substring(0, 18) || 'Không tên';

            return (
              <div
                key={item.id}
                onClick={() => handleItemClick(item)}
                className={`flex gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200 border text-left relative overflow-hidden group ${
                  isActive
                    ? 'bg-[var(--bg-hover)] border-[var(--accent)]/50 shadow-lg shadow-[var(--accent)]/5'
                    : 'bg-[var(--bg-secondary)] border-[var(--border)] hover:bg-[var(--bg-hover)]/30 hover:border-[var(--border-focus)]/30'
                }`}
              >
                {/* Active indicator bar */}
                {isActive && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-[var(--accent)]"></div>
                )}

                {/* Delete Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteHistoryItem(item.id);
                  }}
                  className="absolute top-2 right-2 p-1 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-rose-500/10 text-[var(--text-muted)] hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all duration-150 z-10"
                  title="Xóa"
                >
                  <X className="h-3 w-3" />
                </button>

                {/* Thumbnail / Status icon */}
                <div className={`h-10 w-10 flex-shrink-0 rounded-lg flex items-center justify-center overflow-hidden bg-[var(--bg-hover)] border border-[var(--border)] ${
                  isActive ? 'border-[var(--accent)]/30' : ''
                }`}>
                  {item.status === 'completed' && item.tracks[0] ? (
                    <img 
                      src={item.tracks[0].coverUrl || `https://cdn1.suno.ai/image_${item.tracks[0].id}.png`} 
                      alt="cover" 
                      onError={(e) => {
                        const target = e.currentTarget;
                        if (target.src.startsWith('data:image')) return;
                        const fallbackUrl = `https://cdn1.suno.ai/image_${item.tracks[0].id}.png`;
                        const unsplashFallback = 'https://images.unsplash.com/photo-1614680376593-902f74fa0d41?q=80&w=120&auto=format&fit=crop';
                        if (target.src !== fallbackUrl && target.src !== unsplashFallback) {
                          target.src = fallbackUrl;
                        } else if (target.src === fallbackUrl) {
                          target.src = unsplashFallback;
                        } else {
                          target.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
                        }
                      }}
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : item.status === 'processing' || item.status === 'queued' ? (
                    <Loader2 className="h-5 w-5 text-[var(--accent)] animate-spin" />
                  ) : item.status === 'failed' ? (
                    <AlertCircle className="h-5 w-5 text-rose-500" />
                  ) : (
                    <Music className="h-5 w-5 text-[var(--text-muted)]" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <div className="flex items-center justify-between gap-1">
                    <h4 className={`text-xs font-bold truncate ${
                      isActive ? 'text-[var(--accent)] font-extrabold' : 'text-[var(--text-primary)]'
                    }`}>
                      {displayTitle}
                    </h4>
                    
                    {/* Tiny status indicator */}
                    {item.status === 'completed' && (
                      <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    )}
                  </div>
                  
                  <p className="text-[10px] text-[var(--text-muted)] truncate mt-1">
                    {item.status === 'completed' 
                      ? `${item.tracks.length} tracks - ${item.createdAt}`
                      : item.status === 'processing'
                      ? 'Đang xử lý...'
                      : item.status === 'queued'
                      ? 'Đang chờ...'
                      : item.error ? parseSunoError(item.error).message : 'Lỗi tạo nhạc'}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
