'use client';

import React, { useRef, useState, useEffect } from 'react';
import { useMusicStore } from '@/store/musicStore';
import { parseSunoError } from '@/lib/suno-error';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Download,
  Video,
  Music,
  Sparkles,
  RefreshCw,
  Clock,
  ListMusic,
  SkipBack,
  SkipForward,
  Search,
  SlidersHorizontal,
  ChevronDown,
  ThumbsUp,
  ThumbsDown,
  Share2,
  MoreHorizontal,
  Trash2,
  FileText,
  List,
  Loader2,
  Check,
  X,
  AlertCircle
} from 'lucide-react';

const QUICK_TAGS = ['Pop', 'Jazz', 'Cinematic', 'Lo-fi', 'Rock', 'Acoustic', 'EDM'];

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

export default function CenterPanel() {
  const {
    history,
    activeItemId,
    activeTrackId,
    isPlaying,
    loadingHistory,
    setActiveItemId,
    setActiveTrackId,
    setIsPlaying,
    setPrompt,
    setCreationMode,
    setLyrics,
    setSongTitle,
    setMusicStyle,
    deleteHistoryItem,
    updateTrackDuration,
    setMobileTab
  } = useMusicStore();

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const restoreTimeRef = useRef<number | null>(null);
  const resolvedTrackIds = useRef<Set<string>>(new Set());
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string>('');

  // Load saved volume setting from localStorage on mount (Default MAX volume 1.0)
  useEffect(() => {
    try {
      const savedVol = localStorage.getItem('muza_player_volume') || localStorage.getItem('lydian_player_volume');
      if (savedVol !== null) {
        const parsed = parseFloat(savedVol);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
          setVolume(parsed);
          return;
        }
      }
      setVolume(1.0);
    } catch (e) {
      setVolume(1.0);
    }
  }, []);

  const handleVolumeChange = (val: number) => {
    setVolume(val);
    setIsMuted(false);
    try {
      localStorage.setItem('muza_player_volume', val.toString());
    } catch (e) {}
  };

  // Toolbar States
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'vocal' | 'instrumental' | 'lyrics'>('all');
  const [sortType, setSortType] = useState<'newest' | 'oldest' | 'duration'>('newest');
  const [activePill, setActivePill] = useState<'all' | 'liked' | 'public' | 'uploads'>('all');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);

  const [trigger, setTrigger] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [listenedTrackIds, setListenedTrackIds] = useState<Set<string>>(new Set());
  
  interface DownloadState {
    id: string;
    title: string;
    type: 'mp3' | 'wav' | 'mp4';
    status: 'preparing' | 'generating' | 'downloading' | 'completed' | 'failed';
    progress: number;
  }
  const [activeDownload, setActiveDownload] = useState<DownloadState | null>(null);

  const markAsListened = (trackId: string) => {
    setListenedTrackIds((prev) => {
      if (prev.has(trackId)) return prev;
      const next = new Set(prev);
      next.add(trackId);
      if (typeof window !== 'undefined') {
        localStorage.setItem('listened_tracks', JSON.stringify(Array.from(next)));
      }
      return next;
    });
  };

  // Set isMounted to true on client-side mount
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Simulated progress for video generation (MP4 rendering stage)
  useEffect(() => {
    if (!activeDownload || activeDownload.status !== 'generating') return;

    let progressVal = 0;
    const interval = setInterval(() => {
      progressVal += Math.random() * 3 + 1.5;
      if (progressVal > 95) {
        progressVal = 95;
        clearInterval(interval);
      }
      setActiveDownload((prev) => {
        if (prev && prev.status === 'generating') {
          return { ...prev, progress: Math.floor(progressVal) };
        }
        return prev;
      });
    }, 800);

    return () => clearInterval(interval);
  }, [activeDownload?.status]);

  // Sync state between sibling components (RightPanel & CenterPanel)
  useEffect(() => {
    const handleUpdate = () => setTrigger((t) => t + 1);
    window.addEventListener('likes-updated', handleUpdate);
    window.addEventListener('plays-updated', handleUpdate);
    return () => {
      window.removeEventListener('likes-updated', handleUpdate);
      window.removeEventListener('plays-updated', handleUpdate);
    };
  }, []);

  // Resolve active structures
  const activeItem = history.find((item) => item.id === activeItemId);
  // Find playing track globally in history so changing activeItem doesn't interrupt playback
  const activePlayingItem = history.find((item) =>
    item.tracks?.some((t) => t.id === activeTrackId)
  ) ?? null;
  const activeTrack = activePlayingItem?.tracks.find((t) => t.id === activeTrackId) ?? null;
  const trackIndex = activePlayingItem?.tracks.findIndex((t) => t.id === activeTrackId) ?? 0;

  useEffect(() => {
    if (activeTrack) {
      setCurrentAudioUrl(activeTrack.url);
    } else {
      setCurrentAudioUrl('');
    }
  }, [activeTrack?.id, activeTrack?.url]);

  // Handle dropdown auto-close
  useEffect(() => {
    const handleClose = () => setActiveDropdownId(null);
    window.addEventListener('click', handleClose);
    return () => window.removeEventListener('click', handleClose);
  }, []);

  useEffect(() => {
    // Only set initial track if activeTrackId is not set yet
    if (activeItem?.status === 'completed' && activeItem.tracks.length > 0) {
      if (!activeTrackId) {
        setActiveTrackId(activeItem.tracks[0].id);
      }
    }
  }, [activeItemId]); // eslint-disable-line

  // Play/pause
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying && activeTrack) {
      audio.play().catch(() => setIsPlaying(false));
    } else {
      audio.pause();
    }
  }, [isPlaying, activeTrackId]); // eslint-disable-line

  // Increments play count reactively
  useEffect(() => {
    if (isPlaying && activeTrackId) {
      const count = parseInt(localStorage.getItem(`plays_${activeTrackId}`) || '0', 10);
      localStorage.setItem(`plays_${activeTrackId}`, String(count + 1));
      window.dispatchEvent(new Event('plays-updated'));
    }
  }, [isPlaying, activeTrackId]);

  // Volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Sync duration with activeTrack.duration if it's updated in the store,
  // BUT prioritize real audio element duration if available.
  useEffect(() => {
    const audioDur = audioRef.current?.duration;
    if (audioDur && !isNaN(audioDur) && audioDur > 0) {
      setDuration(audioDur);
      return;
    }
    if (activeTrack && activeTrack.duration && activeTrack.duration > 0 && activeTrack.duration !== 120) {
      setDuration(activeTrack.duration);
    }
  }, [activeTrack?.id, activeTrack?.duration]);

  // Reload audio and restore playback time when track transitions from 'processing' to 'completed'
  const prevStatusRef = useRef<string | null>(null);
  useEffect(() => {
    if (activePlayingItem) {
      const currentStatus = activePlayingItem.status;
      const prevStatus = prevStatusRef.current;
      prevStatusRef.current = currentStatus;

      if (prevStatus === 'processing' && currentStatus === 'completed' && audioRef.current) {
        restoreTimeRef.current = audioRef.current.currentTime;
        audioRef.current.load();
      }
    } else {
      prevStatusRef.current = null;
    }
  }, [activePlayingItem?.status, activePlayingItem]);

  const handlePlayPause = () => setIsPlaying(!isPlaying);


  const formatTime = (t: number) => {
    if (!t || isNaN(t) || !isFinite(t)) return '0:00';
    return `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  };

  const seekPercent = (duration && duration > 0) ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
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

  const copyText = (text: string, label: string) => {
    safeCopyToClipboard(text).then((success) => {
      if (success) {
        showToast(`Đã copy ${label}!`);
      } else {
        showToast(`Không thể copy ${label}.`);
      }
    });
  };

  const handleQuickTag = (tag: string) => {
    setCreationMode('describe');
    setPrompt(`A dynamic ${tag.toLowerCase()} track with modern rhythms, atmospheric chords, and catchy melodies.`);
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

  const handleDislike = (id: string) => {
    const disliked = localStorage.getItem(`disliked_${id}`) === 'true';
    localStorage.setItem(`disliked_${id}`, disliked ? 'false' : 'true');
    showToast(disliked ? 'Đã bỏ không thích!' : 'Đã không thích bài hát');
    window.dispatchEvent(new Event('likes-updated'));
  };

  const handleShare = (row: any) => {
    if (typeof window === 'undefined') return;
    const shareUrl = row.url || window.location.href;
    safeCopyToClipboard(shareUrl).then((success) => {
      if (success) {
        showToast('Đã copy liên kết bài hát!');
      } else {
        showToast('Không thể copy liên kết bài hát.');
      }
    });
  };

  const handleRemix = (row: any) => {
    const mode = row.mode || 'describe';
    setCreationMode(mode);
    if (mode === 'lyrics') {
      const rawLyrics = row.parentItem?.lyrics || getCleanLyrics(row.lyrics);
      setLyrics(rawLyrics || '');
      setMusicStyle(row.style || '');
      setSongTitle(row.title ? `${row.title} (Remix)` : 'Remix');
    } else {
      setPrompt(row.prompt || '');
    }
    showToast('Đã tải thông số vào bảng cấu hình!');
  };

  const handleDownload = async (url: string, filename: string, type: 'mp3' | 'wav' | 'mp4', id: string) => {
    if (activeDownload && activeDownload.status !== 'completed' && activeDownload.status !== 'failed') {
      showToast('Đang có tiến trình tải khác đang chạy!');
      return;
    }

    const downloadStateId = `${id}-${type}`;
    setActiveDownload({
      id: downloadStateId,
      title: filename,
      type,
      status: 'preparing',
      progress: 0,
    });

    const encodedUrl = encodeURIComponent(url);
    const encodedName = encodeURIComponent(filename);
    const downloadApiUrl = `/api/music/download?url=${encodedUrl}&name=${encodedName}&format=${type}`;

    try {
      if (type === 'mp4' || type === 'wav') {
        setActiveDownload(prev => prev ? { ...prev, status: 'generating' } : null);
      } else {
        setActiveDownload(prev => prev ? { ...prev, status: 'downloading' } : null);
      }

      const response = await fetch(downloadApiUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const contentType = response.headers.get('content-type') || '';
      
      setActiveDownload(prev => prev ? { ...prev, status: 'downloading' } : null);
      
      const contentLengthHeader = response.headers.get('content-length');
      const contentLength = contentLengthHeader ? parseInt(contentLengthHeader, 10) : 0;
      
      if (!response.body) {
        throw new Error('Response body is not readable');
      }

      const reader = response.body.getReader();
      let receivedLength = 0;
      const chunks: Uint8Array[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        receivedLength += value.length;

        if (contentLength > 0) {
          const progress = Math.floor((receivedLength / contentLength) * 100);
          setActiveDownload(prev => prev ? { ...prev, progress } : null);
        }
      }

      const blobType = type === 'mp4' ? 'video/mp4' : (type === 'wav' ? 'audio/wav' : 'audio/mpeg');
      const blob = new Blob(chunks as any, { type: contentType || blobType });
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      
      let finalFilename = filename.replace(/[/\\?%*:|"<>]/g, '-').trim() || 'nhacai-file';
      const extension = `.${type}`;
      if (!finalFilename.toLowerCase().endsWith(extension)) {
        finalFilename = finalFilename.replace(/\.(mp3|mp4|wav)$/i, '') + extension;
      }
      a.download = finalFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);

      setActiveDownload(prev => prev ? { ...prev, status: 'completed', progress: 100 } : null);
      showToast(`Đã tải xong: ${finalFilename}`);
      
      setTimeout(() => {
        setActiveDownload(current => current?.id === downloadStateId ? null : current);
      }, 3000);

    } catch (err) {
      console.error('[Download] JS Fetch failed, falling back to direct browser navigation:', err);
      setActiveDownload(prev => prev ? { ...prev, status: 'failed' } : null);
      
      window.open(downloadApiUrl, '_blank');
      
      setTimeout(() => {
        setActiveDownload(current => current?.id === downloadStateId ? null : current);
      }, 4000);
    }
  };

  // Compile flat rows from history
  const flatRows = history.reduce<any[]>((acc, item) => {
    if (item.status === 'completed' || (item.status === 'processing' && item.tracks && item.tracks.length > 0)) {
      const tracks = item.tracks || [];
      tracks.forEach((track, idx) => {
        const fallbackVideoUrl = track.videoUrl || (track.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(track.id)
          ? `https://cdn1.suno.ai/${track.id}.mp4`
          : '');

        acc.push({
          type: 'track',
          id: track.id,
          itemId: item.id,
          title: track.title || item.title || 'Không tên',
          style: track.style || item.style || '',
          duration: track.duration || 0,
          url: track.url || '',
          coverUrl: track.coverUrl || '',
          status: item.status,
          mode: item.mode || 'describe',
          lyrics: item.lyrics || getCleanLyrics(track.lyrics) || '',
          model: item.sunoModel || 'v5.5',
          prompt: item.prompt || '',
          createdAt: item.createdAt,
          videoUrl: fallbackVideoUrl,
          trackObj: track,
          parentItem: item
        });
      });
    } else if (item.status === 'failed') {
      acc.push({
        type: 'failed',
        id: item.id,
        itemId: item.id,
        title: item.title || 'Lỗi tạo nhạc',
        style: item.style || item.prompt || '',
        status: 'failed',
        error: item.error || 'Lỗi tạo nhạc',
        mode: item.mode || 'describe',
        model: item.sunoModel || 'v5.5',
        prompt: item.prompt || '',
        createdAt: item.createdAt,
        parentItem: item
      });
    } else {
      // queued or processing
      acc.push({
        type: 'loading',
        id: item.id,
        itemId: item.id,
        title: item.title || 'Đang tạo nhạc...',
        style: item.style || item.prompt || '',
        status: item.status,
        mode: item.mode || 'describe',
        model: item.sunoModel || 'v5.5',
        prompt: item.prompt || '',
        createdAt: item.createdAt,
        parentItem: item
      });
    }
    return acc;
  }, []);

  // Resolve durations for completed tracks in the background
  useEffect(() => {
    const tracksToResolve = flatRows.filter(
      (row) =>
        row.type === 'track' &&
        row.url &&
        (row.duration === 120 || row.duration === 0) &&
        !resolvedTrackIds.current.has(row.id)
    );

    tracksToResolve.forEach((track) => {
      resolvedTrackIds.current.add(track.id);
      const audio = new Audio(track.url);
      audio.preload = 'metadata';
      audio.onloadedmetadata = () => {
        const rawDur = audio.duration;
        if (rawDur && !isNaN(rawDur) && rawDur > 0) {
          const newDur = Math.floor(rawDur);
          if (newDur !== track.duration) {
            updateTrackDuration(track.id, newDur);
          }
        }
        audio.src = '';
        audio.load();
      };
      audio.onerror = () => {
        audio.src = '';
        audio.load();
      };
    });
  }, [flatRows, updateTrackDuration]);

  // Load and initialize listened tracks
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('listened_tracks');
        let currentSet = new Set<string>();
        if (stored) {
          currentSet = new Set(JSON.parse(stored));
        }

        const hasInitialized = localStorage.getItem('has_initialized_listened');
        if (!hasInitialized && flatRows.length > 0) {
          flatRows.forEach(row => {
            if (row.type === 'track') {
              currentSet.add(row.id);
            }
          });
          localStorage.setItem('listened_tracks', JSON.stringify(Array.from(currentSet)));
          localStorage.setItem('has_initialized_listened', 'true');
        }
        
        setListenedTrackIds(currentSet);
      } catch (err) {
        console.error('Error loading/initializing listened tracks:', err);
      }
    }
  }, [flatRows.length]);

  // Filter and Sort flat rows
  let filteredRows = flatRows.filter((row) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      row.title.toLowerCase().includes(q) ||
      row.style.toLowerCase().includes(q) ||
      row.prompt.toLowerCase().includes(q)
    );
  });

  // Pill Filters
  if (activePill === 'liked') {
    filteredRows = filteredRows.filter((row) => row.type === 'track' && isLiked(row.id));
  } else if (activePill === 'uploads') {
    filteredRows = filteredRows.filter((row) => row.type === 'track' && row.parentItem?.referenceFile);
  }

  // Type Filters
  if (filterType === 'vocal') {
    filteredRows = filteredRows.filter((row) => row.type === 'track' && row.parentItem?.outputType === 'vocal');
  } else if (filterType === 'instrumental') {
    filteredRows = filteredRows.filter((row) => row.type === 'track' && row.parentItem?.outputType === 'instrumental');
  } else if (filterType === 'lyrics') {
    filteredRows = filteredRows.filter((row) => row.mode === 'lyrics');
  }

  // Sorting
  if (sortType === 'oldest') {
    filteredRows = [...filteredRows].reverse();
  } else if (sortType === 'duration') {
    filteredRows = [...filteredRows].sort((a, b) => (b.duration || 0) - (a.duration || 0));
  }

  const currentFilteredIndex = filteredRows.findIndex((row) => row.type === 'track' && row.id === activeTrackId);
  const hasNextTrack = currentFilteredIndex !== -1 && filteredRows.slice(currentFilteredIndex + 1).some((row) => row.type === 'track');
  const hasPrevTrack = currentFilteredIndex !== -1 && filteredRows.slice(0, currentFilteredIndex).some((row) => row.type === 'track');

  const handleSkip = (dir: 'prev' | 'next') => {
    if (currentFilteredIndex === -1) return;

    if (dir === 'next') {
      const nextTrackRow = filteredRows.slice(currentFilteredIndex + 1).find((row) => row.type === 'track');
      if (nextTrackRow) {
        markAsListened(nextTrackRow.id);
        setActiveTrackId(nextTrackRow.id);
        setActiveItemId(nextTrackRow.itemId);
        setIsPlaying(true);
      } else {
        setIsPlaying(false);
        setCurrentTime(0);
      }
    } else {
      const prevTrackRow = [...filteredRows.slice(0, currentFilteredIndex)].reverse().find((row) => row.type === 'track');
      if (prevTrackRow) {
        markAsListened(prevTrackRow.id);
        setActiveTrackId(prevTrackRow.id);
        setActiveItemId(prevTrackRow.itemId);
        setIsPlaying(true);
      } else {
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          setCurrentTime(0);
        }
      }
    }
  };

  const handleRowClick = (row: any) => {
    setActiveItemId(row.itemId);
    if (row.type === 'track') {
      markAsListened(row.id);
      if (activeTrackId === row.id) {
        setIsPlaying(!isPlaying);
      } else {
        setActiveTrackId(row.id);
        setIsPlaying(true);
      }
    }
  };

  const activeFilterCount = (filterType !== 'all' ? 1 : 0) + (activePill !== 'all' ? 1 : 0) + (searchQuery ? 1 : 0);

  return (
    <div className="flex-1 flex flex-col bg-[var(--bg-base)] overflow-hidden relative">

      {/* Toast notification overlay (Hiển thị giữa màn hình) */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 bg-zinc-950/95 backdrop-blur-xl border border-zinc-800 text-[var(--accent)] font-bold px-5 py-2.5 rounded-2xl text-xs shadow-2xl z-[9999] animate-scale-up pointer-events-none flex items-center gap-2 border-emerald-500/20 text-emerald-400">
          <span>{toast}</span>
        </div>
      )}

      {activeTrack && (
        <audio
          ref={audioRef}
          src={currentAudioUrl || undefined}
          onTimeUpdate={() => {
            if (audioRef.current) {
              const cur = audioRef.current.currentTime || 0;
              setCurrentTime(cur);
              const dur = audioRef.current.duration;
              if (dur && !isNaN(dur) && dur > 0 && Math.abs(dur - duration) > 0.5) {
                setDuration(dur);
              }
            }
          }}
          onDurationChange={() => {
            const rawDuration = audioRef.current?.duration ?? 0;
            if (rawDuration && !isNaN(rawDuration) && rawDuration > 0) {
              setDuration(rawDuration);
              const newDuration = Math.floor(rawDuration);
              if (activeTrack && Math.abs((activeTrack.duration || 0) - newDuration) > 1) {
                updateTrackDuration(activeTrack.id, newDuration);
              }
            }
          }}
          onLoadedMetadata={() => {
            const rawDuration = audioRef.current?.duration ?? 0;
            const newDuration = rawDuration > 0 ? Math.floor(rawDuration) : 0;
            setDuration(rawDuration);
            if (activeTrack && newDuration > 0 && Math.abs((activeTrack.duration || 0) - newDuration) > 1) {
              updateTrackDuration(activeTrack.id, newDuration);
            }
            if (restoreTimeRef.current !== null && audioRef.current) {
              try {
                audioRef.current.currentTime = restoreTimeRef.current;
              } catch (e) {
                console.warn('[Audio] early seek failed in onLoadedMetadata:', e);
              }
            }
          }}
          onCanPlay={() => {
            if (audioRef.current) {
              if (restoreTimeRef.current !== null) {
                try {
                  const targetTime = restoreTimeRef.current;
                  audioRef.current.currentTime = targetTime;
                  restoreTimeRef.current = null;
                } catch (e) {
                  console.error('[Audio] seek failed in onCanPlay:', e);
                }
              }
              if (isPlaying) {
                audioRef.current.play().catch(console.error);
              }
            }
          }}
          onError={(e) => {
            const isFallbackUrl = activeTrack?.id && currentAudioUrl === `https://cdn1.suno.ai/${activeTrack.id}.mp3`;
            if (isFallbackUrl) {
              console.error('[AudioPlayer] Both local source and Suno CDN fallback failed to load:', e);
              setIsPlaying(false);
            } else if (activeTrack?.id) {
              const fallbackUrl = `https://cdn1.suno.ai/${activeTrack.id}.mp3`;
              console.warn('[AudioPlayer] Local audio source failed (404/403). Attempting fallback to Suno CDN:', fallbackUrl);
              restoreTimeRef.current = audioRef.current?.currentTime || currentTime || null;
              setCurrentAudioUrl(fallbackUrl);
            } else {
              setIsPlaying(false);
            }
          }}
        />
      )}

      {/* ── Toolbar (Suno Style) ── */}
      <div className="center-panel-content flex-1 flex flex-col min-h-0">
        <div className="p-3 md:p-5 pb-3 md:pb-4 border-b border-[var(--border)] space-y-3 md:space-y-4 shrink-0 select-none">
        {/* Breadcrumb path */}
        <div className="hidden md:flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)]">
          <span>Workspaces</span>
          <span className="text-[var(--text-muted)] font-normal">/</span>
          <span className="text-[var(--text-primary)]">My Workspace</span>
        </div>

        {/* Action Row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search, Filters, Sort, Layout */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            {/* Search Bar */}
            <div className="relative flex-1 md:flex-initial">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-muted)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search"
                className="pl-9 pr-4 py-2 w-full md:w-48 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent)]/50 placeholder-[var(--text-muted)] transition-all font-medium"
              />
            </div>

            {/* Filters Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsFilterOpen(!isFilterOpen);
                  setIsSortOpen(false);
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] hover:border-[var(--text-secondary)] text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span>Filters {activeFilterCount > 0 && `(${activeFilterCount})`}</span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0" />
              </button>
              {isFilterOpen && (
                <div className="absolute left-0 mt-1.5 w-40 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] shadow-xl z-30 py-1.5 overflow-hidden animate-slide-down">
                  {[
                    { id: 'all', label: 'Tất cả' },
                    { id: 'vocal', label: 'Nhạc Vocal' },
                    { id: 'instrumental', label: 'Nhạc Instrumental' },
                    { id: 'lyrics', label: 'Chế độ Lyrics' }
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => {
                        setFilterType(f.id as any);
                        setIsFilterOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs font-bold transition-colors hover:bg-[var(--bg-hover)] ${
                        filterType === f.id ? 'text-[var(--accent)] bg-[var(--accent-dim)]' : 'text-[var(--text-secondary)]'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Sort Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsSortOpen(!isSortOpen);
                  setIsFilterOpen(false);
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] hover:border-[var(--text-secondary)] text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
              >
                <span>{sortType === 'newest' ? 'Newest' : sortType === 'oldest' ? 'Oldest' : 'Duration'}</span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0" />
              </button>
              {isSortOpen && (
                <div className="absolute left-0 mt-1.5 w-32 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] shadow-xl z-30 py-1.5 overflow-hidden animate-slide-down">
                  {[
                    { id: 'newest', label: 'Mới nhất' },
                    { id: 'oldest', label: 'Cũ nhất' },
                    { id: 'duration', label: 'Độ dài' }
                  ].map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setSortType(s.id as any);
                        setIsSortOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs font-bold transition-colors hover:bg-[var(--bg-hover)] ${
                        sortType === s.id ? 'text-[var(--accent)] bg-[var(--accent-dim)]' : 'text-[var(--text-secondary)]'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Layout selector */}
            <button
              type="button"
              className="hidden md:flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-xs font-semibold text-[var(--text-secondary)] transition-all"
            >
              <List className="h-3.5 w-3.5" />
              <span>List</span>
            </button>
          </div>

          {/* Pills Group & Pagination */}
          <div className="flex items-center justify-between w-full md:w-auto gap-3">
            <div className="flex items-center gap-1 bg-[var(--bg-input)] p-0.5 rounded-lg border border-[var(--border)]">
              {([
                { id: 'all', label: 'All' },
                { id: 'liked', label: 'Liked' },
                { id: 'public', label: 'Public' },
                { id: 'uploads', label: 'Uploads' }
              ] as const).map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setActivePill(pill.id)}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                    activePill === pill.id
                      ? 'bg-[var(--bg-hover)] text-[var(--text-primary)] shadow-sm'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 text-xs font-bold text-[var(--text-secondary)]">
              <button type="button" className="p-1 rounded bg-[var(--bg-input)] border border-[var(--border)] opacity-30 cursor-not-allowed">&lt;</button>
              <span className="px-2.5 py-0.5 bg-[var(--bg-hover)] rounded border border-[var(--border)] text-[var(--text-primary)]">1</span>
              <button type="button" className="p-1 rounded bg-[var(--bg-input)] border border-[var(--border)] opacity-30 cursor-not-allowed">&gt;</button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Scrollable Track List ── */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 md:p-5 space-y-2">
        {loadingHistory ? (
          /* Premium loading skeleton state */
          <div className="flex-1 flex flex-col items-center justify-center py-24 text-center space-y-4">
            <Loader2 className="h-7 w-7 animate-spin text-[var(--accent)]" />
            <p className="text-xs text-[var(--text-secondary)] font-bold tracking-wide animate-pulse">
              Đang tải thư viện nhạc của bạn...
            </p>
          </div>
        ) : history.length === 0 ? (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
            <div className="flex flex-col items-center max-w-md space-y-6">
              <div className="relative h-24 w-24 rounded-3xl bg-[var(--accent-dim)] border border-[var(--accent)]/25 flex items-center justify-center shadow-2xl shadow-[var(--accent)]/5">
                <div className="absolute inset-0 rounded-3xl bg-[var(--accent)]/5 blur-2xl" />
                <Music className="h-12 w-12 text-[var(--accent)] animate-pulse relative z-10" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-extrabold text-[var(--text-primary)] tracking-tight">AI Music Generator</h2>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                  Tạo nhạc nguyên bản bằng trí tuệ nhân tạo. Hãy tả phong cách nhạc hoặc tự viết lời bài hát của riêng bạn.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {QUICK_TAGS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleQuickTag(tag)}
                    className="text-xs bg-[var(--bg-card)] border border-[var(--border)] hover:border-[var(--accent)]/50 hover:bg-[var(--accent-dim)] text-[var(--text-secondary)] hover:text-[var(--accent)] px-3 py-1.5 rounded-full transition-all font-semibold"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : filteredRows.length === 0 ? (
          /* No search results */
          <div className="flex flex-col items-center justify-center py-20 text-center text-[var(--text-muted)]">
            <Music className="h-12 w-12 mb-3 opacity-25" />
            <p className="text-sm font-semibold">Không tìm thấy bản nhạc nào phù hợp</p>
          </div>
        ) : (
          /* Tracks list render */
          filteredRows.map((row) => {
            const isPlayingTrack = row.type === 'track' && activeTrackId === row.id;
            const isSelectedRow = row.type === 'track'
              ? activeTrackId === row.id
              : activeItemId === row.id;
            const isCurrentPlaying = isPlayingTrack && isPlaying;
            const isUnlistened = row.type === 'track' && !listenedTrackIds.has(row.id);
            return (
              <div
                key={row.id}
                onClick={() => handleRowClick(row)}
                className={`flex items-center gap-4 p-3 pr-12 md:pr-3 md:group-hover:pr-32 rounded-xl cursor-pointer border transition-all duration-200 group relative select-none ${
                  isPlayingTrack
                    ? 'bg-[var(--bg-hover)] border-[var(--accent)]/50 shadow-md'
                    : isSelectedRow
                    ? 'bg-[var(--bg-hover)]/40 border-[var(--border-focus)]/50 shadow-sm'
                    : 'bg-[var(--bg-card)] border-[var(--border)] hover:bg-[var(--bg-hover)]/30 hover:border-[var(--border-focus)]/30'
                }`}
              >
                {/* Unlistened Indicator Dot */}
                <div className="flex items-center justify-center w-2 shrink-0">
                  {isUnlistened && (
                    <div className="w-2 h-2 rounded-full bg-pink-500 shadow-[0_0_8px_rgba(236,72,153,0.8)] animate-pulse" />
                  )}
                </div>

                {/* Cover Art Image */}
                <div className="relative h-14 w-14 rounded-lg overflow-hidden flex-shrink-0 bg-[var(--bg-secondary)] border border-[var(--border)] shadow-sm">
                  {row.type === 'track' ? (
                    <>
                      <img
                        src={row.coverUrl || `https://cdn1.suno.ai/image_${row.id}.png`}
                        alt="cover"
                        onError={(e) => {
                          const target = e.currentTarget;
                          if (target.src.startsWith('data:image')) return;
                          const sunoFallback = `https://cdn1.suno.ai/image_${row.id}.png`;
                          const unsplashFallback = 'https://images.unsplash.com/photo-1614680376593-902f74fa0d41?q=80&w=120&auto=format&fit=crop';
                          if (target.src !== sunoFallback && target.src !== unsplashFallback) {
                            target.src = sunoFallback;
                          } else if (target.src === sunoFallback) {
                            target.src = unsplashFallback;
                          } else {
                            target.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
                          }
                        }}
                        className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      {/* Play/pause hover overlay */}
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        {isCurrentPlaying ? (
                          <Pause className="h-5 w-5 text-white fill-white" />
                        ) : (
                          <Play className="h-5 w-5 text-white fill-white translate-x-[1px]" />
                        )}
                      </div>
                      {/* Equalizer animation */}
                      {isCurrentPlaying && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <div className="flex items-end gap-0.5 h-4">
                            {[...Array(4)].map((_, i) => (
                              <div
                                key={i}
                                className="w-[3px] bg-[var(--accent)] rounded-full animate-audio-bar"
                                style={{ animationDelay: `${i * 0.15}s` }}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                      {/* Duration stamp overlay */}
                      {!isCurrentPlaying && (
                        <div className="absolute bottom-1 right-1 bg-black/75 px-1 py-0.5 rounded text-[8px] font-mono text-white font-bold leading-none select-none">
                          {formatTime(row.duration)}
                        </div>
                      )}
                      {/* Status indicator for rendering playable tracks */}
                      {row.status === 'processing' && !isCurrentPlaying && (
                        <div className="absolute inset-0 bg-black/55 flex items-center justify-center">
                          <Loader2 className="h-4 w-4 text-[var(--accent)] animate-spin" />
                        </div>
                      )}
                    </>
                  ) : row.status === 'failed' ? (
                    <div className="w-full h-full flex items-center justify-center text-rose-500 bg-rose-500/10">
                      <AlertCircle className="h-5 w-5" />
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[var(--accent)] bg-[var(--accent-dim)]">
                      <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                  )}
                </div>

                {/* Track Details */}
                <div className="flex-1 min-w-0 pr-24">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className={`text-xs font-bold truncate ${isPlayingTrack ? 'text-[var(--accent)] font-extrabold' : 'text-[var(--text-primary)]'}`}>
                      {row.title}
                    </h4>
                    {/* Model Version Tag */}
                    <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded-md uppercase border ${
                      row.model.toLowerCase() === 'remix'
                        ? 'bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border-indigo-500/20'
                        : row.model.toLowerCase().includes('v5') || row.model.toLowerCase().includes('v4.5') || row.model.toLowerCase().includes('fenix')
                        ? 'bg-pink-500/10 dark:bg-pink-500/20 text-pink-600 dark:text-pink-400 border-pink-500/20'
                        : 'bg-zinc-500/10 dark:bg-zinc-500/20 text-zinc-600 dark:text-zinc-400 border-zinc-500/20'
                    }`}>
                      {row.model.replace('chirp-', '')}
                    </span>
                  </div>

                  {row.type === 'track' && (row.prompt || row.style) && (
                    row.model.toLowerCase().includes('v5') ||
                    row.model.toLowerCase().includes('v4.5') ||
                    row.model.toLowerCase().includes('fenix')
                  ) && (
                    <p className="text-[10px] text-[var(--text-secondary)] line-clamp-1 mb-1" title={row.prompt || row.style}>
                      {row.prompt || row.style}
                    </p>
                  )}

                  {/* Actions row: Likes, Dislikes, Share */}
                  {row.type === 'track' && (
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleLike(row.id);
                        }}
                        className={`flex items-center gap-1 text-[10px] font-bold transition-colors ${
                          isLiked(row.id)
                            ? 'text-pink-500'
                            : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        <ThumbsUp className="h-3 w-3" />
                        <span>{getLikeCount(row.id)}</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDislike(row.id);
                        }}
                        className="text-[var(--text-muted)] hover:text-rose-400 transition-colors"
                      >
                        <ThumbsDown className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleShare(row);
                        }}
                        className="text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
                        title="Share link"
                      >
                        <Share2 className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Remix Button & Dropdown Actions (Hover States) */}
                {row.type === 'track' && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity z-10">
                    {row.model.toLowerCase() !== 'remix' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemix(row);
                        }}
                        className="hidden md:flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--accent-dim)] border border-[var(--border)] hover:border-[var(--accent)]/30 text-[10px] font-extrabold text-[var(--text-primary)] hover:text-[var(--accent)] transition-all cursor-pointer shadow-sm uppercase tracking-wider"
                      >
                        <RefreshCw className="h-3 w-3 animate-pulse" />
                        Remix
                      </button>
                    )}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveDropdownId(activeDropdownId === row.id ? null : row.id);
                        }}
                        className="p-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </button>

                      {/* Menu Dropdown list */}
                      {activeDropdownId === row.id && (
                        <div className="absolute right-0 mt-1.5 w-36 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] shadow-2xl z-30 py-1 overflow-hidden animate-slide-down text-left">
                          <button
                            type="button"
                            className="w-full text-left px-3 py-2 text-[10px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors flex items-center gap-2 cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveDropdownId(null);
                              handleDownload(row.url || '', row.title || 'song', 'mp3', row.id);
                            }}
                          >
                            <Download className="h-3 w-3" />
                            Tải về MP3
                          </button>
                          <button
                            type="button"
                            className="w-full text-left px-3 py-2 text-[10px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors flex items-center gap-2 cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveDropdownId(null);
                              handleDownload(row.url || '', row.title || 'song', 'wav', row.id);
                            }}
                          >
                            <Download className="h-3 w-3 text-sky-400" />
                            Tải về Lossless (WAV)
                          </button>
                          {row.videoUrl && (
                            <button
                              type="button"
                              className="w-full text-left px-3 py-2 text-[10px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors flex items-center gap-2 cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveDropdownId(null);
                                handleDownload(row.videoUrl, row.title || 'video', 'mp4', row.id);
                              }}
                            >
                              <Video className="h-3 w-3 text-pink-400" />
                              Tải về Video
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              copyText(row.lyrics || '', 'lyrics');
                              setActiveDropdownId(null);
                            }}
                            className="w-full text-left px-3 py-2 text-[10px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors flex items-center gap-2"
                          >
                            <FileText className="h-3 w-3" />
                            Copy Lyrics
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteHistoryItem(row.itemId);
                              setActiveDropdownId(null);
                            }}
                            className="w-full text-left px-3 py-2 text-[10px] font-bold text-rose-400 hover:text-rose-300 hover:bg-[var(--bg-hover)] transition-colors flex items-center gap-2 border-t border-[var(--border)]"
                          >
                            <Trash2 className="h-3 w-3" />
                            Xóa bản nhạc
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Loading / Failed single actions */}
                {row.type === 'failed' && (() => {
                  const cleanMsg = parseSunoError(row.error || '').message;
                  return (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 z-10 flex items-center gap-3">
                      <span className="text-[10px] text-rose-400 font-semibold max-w-[220px] truncate" title={cleanMsg}>
                        {cleanMsg}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteHistoryItem(row.itemId);
                        }}
                        className="p-1.5 rounded-lg hover:bg-rose-500/10 text-rose-400 transition-colors cursor-pointer"
                        title="Xóa"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })()}

                {row.type === 'loading' && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 z-10 text-[10px] text-[var(--text-muted)] font-semibold uppercase tracking-wider">
                    {row.status === 'queued' ? 'Queued' : 'Rendering'}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      </div>

      {/* ── Persistent Player Bar ── */}
      {activeTrack && (
        <div
          style={{ '--seek-percent': `${seekPercent}%` } as React.CSSProperties}
          className="player-bar bg-[var(--bg-card)] border-t border-[var(--border)] px-6 py-3 flex items-center gap-4 shrink-0 z-20"
        >

          {/* Track thumbnail + info */}
          <div
            onClick={() => {
              if (window.innerWidth <= 768) {
                setMobileTab('details');
              }
            }}
            className="player-bar-info flex items-center gap-3 w-52 min-w-0 flex-shrink-0 cursor-pointer md:cursor-default"
          >
            <div className="h-10 w-10 rounded-lg overflow-hidden bg-[var(--bg-hover)] border border-[var(--border)] shrink-0">
              <img
                src={activeTrack.coverUrl || (activeTrack.id ? `https://cdn1.suno.ai/image_${activeTrack.id}.png` : '')}
                alt="cover"
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
                className="h-full w-full object-cover"
              />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-[var(--text-primary)] truncate">{activeTrack.title}</p>
              <p className="text-[10px] text-[var(--text-muted)] truncate">{activeTrack.sourceName || activeTrack.style || 'Pop Ballad nhẹ nhàng, sâu lắng'}</p>
            </div>
          </div>

          {/* Controls + progress */}
          <div className="player-bar-controls flex-1 flex flex-col items-center gap-2 min-w-0">
            {/* Buttons row */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleSkip('prev')}
                disabled={!hasPrevTrack}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-30 transition-colors cursor-pointer"
              >
                <SkipBack className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handlePlayPause}
                className="h-9 w-9 rounded-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white dark:text-black flex items-center justify-center transition-all active:scale-95 shadow-md shadow-[var(--accent)]/10 cursor-pointer"
              >
                {isPlaying
                  ? <Pause className="h-4 w-4 fill-current" />
                  : <Play className="h-4 w-4 fill-current translate-x-0.5" />}
              </button>
              <button
                type="button"
                onClick={() => handleSkip('next')}
                disabled={!hasNextTrack}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-30 transition-colors cursor-pointer"
              >
                <SkipForward className="h-4 w-4" />
              </button>
            </div>

            {/* Seek slider row */}
            <div className="flex items-center gap-2.5 w-full max-w-lg text-[10px] text-[var(--text-muted)] font-mono select-none">
              <span className="shrink-0 min-w-[36px] text-right">{formatTime(currentTime)}</span>
              <div className="relative flex-1 h-1 group-hover:h-1.5 bg-[var(--bg-hover)] rounded-full cursor-pointer overflow-visible group transition-all">
                <div
                  className="absolute left-0 top-0 bottom-0 bg-[var(--accent)] rounded-full transition-all"
                  style={{ width: `${seekPercent}%` }}
                />
                <div
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 bg-white border border-slate-200 dark:border-slate-700 shadow-md rounded-full transition-all pointer-events-none group-hover:scale-125"
                  style={{ left: `${seekPercent}%` }}
                />
                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  value={currentTime}
                  onChange={(e) => {
                    const t = Number(e.target.value);
                    if (audioRef.current) audioRef.current.currentTime = t;
                    setCurrentTime(t);
                  }}
                  className="absolute inset-0 w-full opacity-0 cursor-pointer z-10"
                />
              </div>
              <span className="shrink-0 min-w-[36px]">{formatTime(duration)}</span>
            </div>
          </div>

          {/* Volume + Actions */}
          <div className="player-bar-volume flex items-center gap-3 w-48 justify-end flex-shrink-0">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsMuted(!isMuted)}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                title={isMuted ? "Bật tiếng" : "Tắt tiếng"}
              >
                {isMuted || volume === 0 ? <VolumeX className="h-4 w-4 text-rose-400" /> : <Volume2 className="h-4 w-4" />}
              </button>
              {(() => {
                const volPct = Math.round((isMuted ? 0 : volume) * 100);
                return (
                  <div className="relative w-20 h-1 bg-[var(--bg-hover)] rounded-full cursor-pointer overflow-visible group">
                    <div
                      className="absolute left-0 top-0 bottom-0 bg-[var(--accent)] rounded-full transition-all"
                      style={{ width: `${volPct}%` }}
                    />
                    <div
                      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 bg-white border border-slate-200 dark:border-slate-700 shadow-md rounded-full transition-all pointer-events-none group-hover:scale-125"
                      style={{ left: `${volPct}%` }}
                    />
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.02}
                      value={isMuted ? 0 : volume}
                      onChange={(e) => handleVolumeChange(Number(e.target.value))}
                      className="absolute inset-0 w-full opacity-0 cursor-pointer z-10"
                      title={`Âm lượng: ${volPct}%`}
                    />
                  </div>
                );
              })()}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-1.5 border-l border-[var(--border)]/60 pl-3">
              <button
                type="button"
                onClick={() => handleDownload(activeTrack.url || '', activeTrack.title || 'song', 'mp3', activeTrack.id)}
                className="p-1.5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)]/30 hover:bg-[var(--bg-hover)] transition-all cursor-pointer shadow-sm"
                title="Tải MP3"
              >
                <Download className="h-4 w-4" />
              </button>
              {(() => {
                const videoUrl = activeTrack.videoUrl || (activeTrack.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(activeTrack.id)
                  ? `https://cdn1.suno.ai/${activeTrack.id}.mp4`
                  : '');
                return videoUrl ? (
                  <button
                    type="button"
                    onClick={() => handleDownload(videoUrl, activeTrack.title || 'video', 'mp4', activeTrack.id)}
                    className="p-1.5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)]/30 hover:bg-[var(--bg-hover)] transition-all cursor-pointer shadow-sm"
                    title="Tải MP4 Video"
                  >
                    <Video className="h-4 w-4" />
                  </button>
                ) : null;
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ── Active Download Manager Widget ── */}
      {activeDownload && (
        <>
          <style>{`
            @keyframes download-shimmer {
              0% { background-position: 200% 0; }
              100% { background-position: -200% 0; }
            }
            .animate-download-shimmer {
              background: linear-gradient(90deg, #ec4899 25%, #a855f7 50%, #ec4899 75%);
              background-size: 200% auto;
              animation: download-shimmer 1.5s linear infinite;
            }
            .download-progress-transition {
              transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            }
          `}</style>
          
          <div className="fixed bottom-24 right-6 w-80 bg-zinc-950/95 border border-zinc-800 rounded-xl p-4 shadow-2xl z-50 animate-slide-in select-none">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-pink-400 shrink-0">
                {activeDownload.status === 'completed' ? (
                  <Check className="h-5 w-5 text-emerald-400" />
                ) : activeDownload.status === 'failed' ? (
                  <AlertCircle className="h-5 w-5 text-rose-400" />
                ) : activeDownload.status === 'generating' ? (
                  <Sparkles className="h-5 w-5 text-pink-400 animate-pulse" />
                ) : (
                  <Loader2 className="h-5 w-5 animate-spin text-pink-500" />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[12px] font-black text-white truncate max-w-[170px]" title={activeDownload.title}>
                    {activeDownload.title}
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveDownload(null)}
                    className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                
                <p className="text-[10px] text-zinc-400 mt-0.5">
                  {activeDownload.type === 'mp4' ? 'Tải về tệp Video (MP4)' : (activeDownload.type === 'wav' ? 'Tải về tệp Lossless (WAV)' : 'Tải về tệp Nhạc (MP3)')}
                </p>
                
                <div className="mt-3">
                  <div className="flex items-center justify-between text-[10px] font-bold mb-1.5">
                    <span className={
                      activeDownload.status === 'completed' ? 'text-emerald-400 font-black' :
                      activeDownload.status === 'failed' ? 'text-rose-400 font-black' :
                      activeDownload.status === 'generating' ? 'text-pink-300 font-extrabold' :
                      activeDownload.status === 'downloading' ? 'text-amber-300 font-extrabold' :
                      'text-zinc-300'
                    }>
                      {activeDownload.status === 'preparing' && 'Đang chuẩn bị kết nối...'}
                      {activeDownload.status === 'generating' && (activeDownload.type === 'wav' ? 'Đang chuyển đổi tệp WAV...' : 'Đang dựng video...')}
                      {activeDownload.status === 'downloading' && 'Đang tải về máy...'}
                      {activeDownload.status === 'completed' && 'Hoàn thành tải về!'}
                      {activeDownload.status === 'failed' && 'Lỗi. Đang tải dự phòng trực tiếp...'}
                    </span>
                    {(activeDownload.status === 'downloading' || activeDownload.status === 'generating') && (
                      <span className={activeDownload.status === 'generating' ? "text-pink-300 font-mono font-black" : "text-amber-300 font-mono font-black"}>
                        {activeDownload.progress}%
                      </span>
                    )}
                    {activeDownload.status === 'completed' && (
                      <span className="text-emerald-400 font-mono font-black">100%</span>
                    )}
                  </div>
                  
                  {/* Progress bar container */}
                  <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden border border-zinc-900">
                    <div
                      className={`h-full download-progress-transition ${
                        activeDownload.status === 'completed' ? 'bg-emerald-400' :
                        activeDownload.status === 'failed' ? 'bg-rose-400' :
                        activeDownload.status === 'generating' ? 'animate-download-shimmer' :
                        'bg-pink-500'
                      }`}
                      style={{
                        width: `${activeDownload.progress || (activeDownload.status === 'preparing' ? 5 : 0)}%`
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
