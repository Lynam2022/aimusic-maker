'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useMusicStore } from '@/store/musicStore';
import { parseSunoError } from '@/lib/suno-error';
import { compressAudioFile } from '@/lib/audioCompressor';

import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  Coins,
  Zap,
  Mic,
  Music4,
  AlertCircle,
  CheckCircle,
  Upload,
  X,
  Play,
  Pause,
  Trash2,
  RefreshCw,
  Sliders,
  Wand2
} from 'lucide-react';

const GENRE_TAGS = [
  'Pop', 'Ballad', 'Rock', 'Jazz', 'Classical', 'Electronic', 'R&B',
  'Hip-Hop', 'Country', 'Folk', 'Ambient', 'Cinematic', 'Lo-fi',
  'Metal', 'Reggae', 'Blues', 'Soul', 'Funk', 'Indie'
];

const LYRIC_STRUCTURES = ['Verse', 'Chorus', 'Bridge', 'Intro', 'Outro'];

const SUNO_MODELS = [
  { id: 'chirp-fenix', label: 'v5.5 (Pro)' },
];




export function generateTitleFromLyrics(lyrics: string): string {
  if (!lyrics) return 'Không tên';
  const lines = lyrics.split('\n').map(line => line.trim()).filter(Boolean);
  for (const line of lines) {
    const cleanLine = line.replace(/\[[^\]]+\]/g, '').trim();
    if (cleanLine.length > 2) {
      const words = cleanLine.split(/\s+/).slice(0, 5).join(' ');
      return words
        .toLowerCase()
        .replace(/(^|\s)\S/g, (l) => l.toUpperCase());
    }
  }
  return 'Khúc Ca Không Tên';
}

function SliderField({
  label,
  value,
  min = 0,
  max = 1,
  step = 0.1,
  onChange
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  const percentage = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <label className="text-xs font-semibold text-[var(--text-secondary)] tracking-wide">{label}</label>
        <span className="text-xs font-extrabold text-[var(--accent)] font-mono bg-[var(--accent-dim)]/40 px-2 py-0.5 rounded border border-[var(--accent)]/30 shadow-xs">
          {value.toFixed(1)}
        </span>
      </div>
      <div className="relative flex items-center py-1">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          style={{
            background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${percentage}%, var(--border) ${percentage}%, var(--border) 100%)`
          }}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer focus:outline-none border border-[var(--border)] shadow-inner transition-all"
        />
      </div>
    </div>
  );
}

export default function LeftPanel() {
  const {
    creationMode, setCreationMode,
    prompt, setPrompt,
    lyrics, setLyrics,
    songTitle, setSongTitle,
    musicStyle, setMusicStyle,
    outputType, setOutputType,
    vocalGender, setVocalGender,
    isAdvancedOpen, setIsAdvancedOpen,
    styleWeight, setStyleWeight,
    creativity, setCreativity,
    audioQuality, setAudioQuality,
    negativeTags, setNegativeTags,
    credits,
    setShowBillingModal,
    history,
    addHistoryItem,
    updateHistoryItemStatus,
    sunoModel,
    setSunoModel,
    enableReferenceFile,
    setShowAuthModal,
    setAuthModalTab,
    setMobileTab,
    remixStyles,
    selectedRemixStyleId,
    setSelectedRemixStyleId
  } = useMusicStore();

  const { data: session } = useSession();

  const pollingTaskIds = useRef<Set<string>>(new Set());

  const [isGenerating, setIsGenerating] = useState(false);
  const [showCustomModel, setShowCustomModel] = useState(false);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const modelDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target as Node)) {
        setModelDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const [isGeneratingLyrics, setIsGeneratingLyrics] = useState(false);
  const [bypassLyrics, setBypassLyrics] = useState(false);
  const [isGeneratingDescribePrompt, setIsGeneratingDescribePrompt] = useState(false);
  const [referenceAnalysis, setReferenceAnalysis] = useState<any>(null);
  const [showMixingSuggestions, setShowMixingSuggestions] = useState(false);
  const [activeMixingTab, setActiveMixingTab] = useState<'vocal' | 'drums' | 'bass' | 'melody'>('vocal');
  const [remixSubMode, setRemixSubMode] = useState<'preset' | 'custom'>('preset');

  // Load saved choices from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const savedSunoModel = localStorage.getItem('nhacai_sunoModel');
      if (savedSunoModel) setSunoModel(savedSunoModel);

      const savedCreationMode = localStorage.getItem('nhacai_creationMode');
      if (savedCreationMode === 'describe' || savedCreationMode === 'lyrics') {
        setCreationMode(savedCreationMode);
      }

      const savedSongTitle = localStorage.getItem('nhacai_songTitle');
      if (savedSongTitle) setSongTitle(savedSongTitle);

      const savedMusicStyle = localStorage.getItem('nhacai_musicStyle');
      if (savedMusicStyle) setMusicStyle(savedMusicStyle);

      const savedLyrics = localStorage.getItem('nhacai_lyrics');
      if (savedLyrics) setLyrics(savedLyrics);

      const savedBypassLyrics = localStorage.getItem('nhacai_bypassLyrics');
      if (savedBypassLyrics) setBypassLyrics(savedBypassLyrics === 'true');

      const savedPrompt = localStorage.getItem('nhacai_prompt');
      if (savedPrompt) setPrompt(savedPrompt);

      const savedOutputType = localStorage.getItem('nhacai_outputType');
      if (savedOutputType === 'vocal' || savedOutputType === 'instrumental') {
        setOutputType(savedOutputType);
      }

      const savedVocalGender = localStorage.getItem('nhacai_vocalGender');
      if (savedVocalGender === 'auto' || savedVocalGender === 'female' || savedVocalGender === 'male') {
        setVocalGender(savedVocalGender);
      }

      const savedStyleWeight = localStorage.getItem('nhacai_styleWeight');
      if (savedStyleWeight) setStyleWeight(parseFloat(savedStyleWeight));

      const savedCreativity = localStorage.getItem('nhacai_creativity');
      if (savedCreativity) setCreativity(parseFloat(savedCreativity));

      const savedAudioQuality = localStorage.getItem('nhacai_audioQuality');
      if (savedAudioQuality) setAudioQuality(parseFloat(savedAudioQuality));

      const savedNegativeTags = localStorage.getItem('nhacai_negativeTags');
      if (savedNegativeTags) setNegativeTags(savedNegativeTags);

      const savedShowCustomModel = localStorage.getItem('nhacai_showCustomModel');
      if (savedShowCustomModel) setShowCustomModel(savedShowCustomModel === 'true');
    } catch (e) {
      console.error('Error loading state from localStorage:', e);
    }
  }, []);

  // Save choices to localStorage when they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('nhacai_sunoModel', sunoModel);
    }
  }, [sunoModel]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('nhacai_creationMode', creationMode);
    }
  }, [creationMode]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('nhacai_songTitle', songTitle);
    }
  }, [songTitle]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('nhacai_musicStyle', musicStyle);
    }
  }, [musicStyle]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('nhacai_lyrics', lyrics);
    }
  }, [lyrics]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('nhacai_bypassLyrics', String(bypassLyrics));
    }
  }, [bypassLyrics]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('nhacai_prompt', prompt);
    }
  }, [prompt]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('nhacai_outputType', outputType);
    }
  }, [outputType]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('nhacai_vocalGender', vocalGender);
    }
  }, [vocalGender]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('nhacai_styleWeight', String(styleWeight));
    }
  }, [styleWeight]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('nhacai_creativity', String(creativity));
    }
  }, [creativity]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('nhacai_audioQuality', String(audioQuality));
    }
  }, [audioQuality]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('nhacai_negativeTags', negativeTags);
    }
  }, [negativeTags]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('nhacai_showCustomModel', String(showCustomModel));
    }
  }, [showCustomModel]);

  const [selectedMood, setSelectedMood] = useState<string>('');
  const [selectedTheme, setSelectedTheme] = useState<string>('');
  const [lyricsGenre, setLyricsGenre] = useState<string>('auto');
  const [songStructure, setSongStructure] = useState<'pop_ballad' | 'dance_edm' | 'free'>('free');
  const [referenceFile, setReferenceFile] = useState<{ data: string; name: string; type: string } | null>(null);
  const [referenceFileId, setReferenceFileId] = useState<string | null>(null);
  const [referenceFileType, setReferenceFileType] = useState<string | null>(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [notification, setNotification] = useState<{ type: 'error' | 'success' | 'warning'; title?: string; message: string } | null>(null);
  const [bypassPreset, setBypassPreset] = useState<'subtle' | 'transparent' | 'aggressive' | 'fidelity'>('transparent');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClearReferenceFile = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setRefAudioPlaying(false);
    setRefAudioTime(0);
    setRefAudioDuration(0);
    setReferenceFile(null);
    setReferenceFileId(null);
    setReferenceFileType(null);
    setRawSelectedFile(null);
    setUploadError(null);
    setReferenceAnalysis(null);
    setShowMixingSuggestions(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Reference Audio Player states
  const [refAudioPlaying, setRefAudioPlaying] = useState(false);
  const [refAudioTime, setRefAudioTime] = useState(0);
  const [refAudioDuration, setRefAudioDuration] = useState(0);
  const [referenceMode, setReferenceMode] = useState<'cover' | 'extend' | 'style'>('cover');
  const [refModeDropdownOpen, setRefModeDropdownOpen] = useState(false);
  const [realWaveform, setRealWaveform] = useState<number[] | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Fetch real Suno audio waveform data when referenceFileId exists
  useEffect(() => {
    if (referenceFileId) {
      fetch(`/api/music/waveform?clipId=${referenceFileId}`)
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data.waveform) && data.waveform.length > 0) {
            setRealWaveform(data.waveform);
          }
        })
        .catch(() => { });
    } else {
      setRealWaveform(null);
    }
  }, [referenceFileId]);

  // Initialize and clean up reference audio
  useEffect(() => {
    if (referenceFile && !referenceFile.type.startsWith('image/')) {
      const audio = new Audio(referenceFile.data);
      audioRef.current = audio;

      audio.onloadedmetadata = () => {
        setRefAudioDuration(audio.duration || 30);
      };
      audio.ontimeupdate = () => {
        setRefAudioTime(audio.currentTime);
      };
      audio.onended = () => {
        setRefAudioPlaying(false);
        setRefAudioTime(0);
      };
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setRefAudioPlaying(false);
      setRefAudioTime(0);
      setRefAudioDuration(0);
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [referenceFile]);

  // Safeguard: Force Write Lyrics mode if Remix is selected
  useEffect(() => {
    if (sunoModel === 'remix' && creationMode !== 'lyrics') {
      setCreationMode('lyrics');
    }
  }, [sunoModel, creationMode, setCreationMode]);

  // Auto-dismiss notifications (12s for warning, 5s for others)
  useEffect(() => {
    if (notification) {
      const delay = notification.type === 'warning' ? 12000 : 5000;
      const timer = setTimeout(() => {
        setNotification(null);
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const togglePlayRefAudio = () => {
    if (!audioRef.current) return;
    if (refAudioPlaying) {
      audioRef.current.pause();
      setRefAudioPlaying(false);
    } else {
      audioRef.current.play().catch(console.error);
      setRefAudioPlaying(true);
    }
  };

  const handleWaveformClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !refAudioDuration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = percentage * refAudioDuration;
    audioRef.current.currentTime = newTime;
    setRefAudioTime(newTime);
  };

  const formatTime = (time: number) => {
    if (isNaN(time) || !isFinite(time)) return '00:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const WAVEFORM_HEIGHTS = [
    5, 5, 8, 10, 12, 10, 15, 18, 20, 25,
    30, 35, 40, 45, 50, 55, 60, 65, 60, 55,
    50, 45, 40, 35, 20, 15, 10, 8, 5, 5,
    5, 8, 10, 15, 20, 25, 35, 45, 55, 65,
    70, 75, 80, 85, 90, 85, 95, 90, 85, 80,
    75, 70, 65, 60, 50, 40, 30, 20, 10, 5
  ];

  const [rawSelectedFile, setRawSelectedFile] = useState<File | null>(null);

  const handleProcessFile = (file: File) => {
    const fileNameLower = file.name.toLowerCase();
    const isAudioExt = /\.(mp3|wav|flac|m4a|ogg|webm)$/.test(fileNameLower);
    const isImageExt = /\.(jpg|jpeg|png|webp)$/.test(fileNameLower);

    const isAudio = file.type.startsWith('audio/') || isAudioExt;
    const isImage = file.type.startsWith('image/') || isImageExt;

    const maxSize = isAudio ? 50 * 1024 * 1024 : 10 * 1024 * 1024;

    let fileType = file.type;
    if (!fileType || fileType === 'application/octet-stream') {
      if (fileNameLower.endsWith('.mp3')) fileType = 'audio/mpeg';
      else if (fileNameLower.endsWith('.wav')) fileType = 'audio/wav';
      else if (fileNameLower.endsWith('.flac')) fileType = 'audio/flac';
      else if (fileNameLower.endsWith('.m4a')) fileType = 'audio/x-m4a';
      else if (fileNameLower.endsWith('.ogg')) fileType = 'audio/ogg';
      else if (fileNameLower.endsWith('.webm')) fileType = 'audio/webm';
      else if (fileNameLower.endsWith('.jpg') || fileNameLower.endsWith('.jpeg')) fileType = 'image/jpeg';
      else if (fileNameLower.endsWith('.png')) fileType = 'image/png';
      else if (fileNameLower.endsWith('.webp')) fileType = 'image/webp';
    }

    const validFormats = isAudio
      ? ['audio/mpeg', 'audio/mp3', 'audio/mpeg3', 'audio/x-mpeg-3', 'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/x-pn-wav', 'audio/flac', 'audio/x-flac', 'audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/ogg', 'application/ogg', 'audio/webm']
      : ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

    if (!isAudio && !isImage) {
      setNotification({ type: 'error', message: 'Chỉ chấp nhận file audio (MP3, WAV, FLAC, M4A, OGG) hoặc ảnh (JPG, PNG, WebP).' });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (!isAudioExt && !isImageExt && !validFormats.includes(fileType)) {
      const exts = isAudio ? 'MP3, WAV, FLAC, M4A, OGG' : 'JPG, PNG, WebP';
      setNotification({ type: 'error', message: `Định dạng ${isAudio ? 'audio' : 'ảnh'} không hợp lệ. Chấp nhận: ${exts}.` });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const processFileAndUpload = async () => {
      let finalFile = file;
      if (isAudio) {
        setNotification({ type: 'warning', message: 'Đang tự động xử lý lách bản quyền: 48kHz Stereo, Peak -0.79dBFS, Loudness -15.9 LUFS, L/R 0.82, làm sạch ID3 & tải lên Suno...' });
        finalFile = await compressAudioFile(file);
      }

      const reader = new FileReader();
      reader.onload = async () => {
        setRawSelectedFile(finalFile);
        setReferenceFile({ data: reader.result as string, name: finalFile.name, type: finalFile.type });
        setReferenceFileType(finalFile.type);
        setReferenceFileId(null);

        // Upload processed & compressed file
        await uploadSelectedReferenceFile(finalFile);
      };
      reader.onerror = () => {
        setNotification({ type: 'error', message: 'Không thể đọc file. Vui lòng thử lại.' });
      };
      reader.readAsDataURL(finalFile);
    };

    processFileAndUpload();
  };

  const uploadSelectedReferenceFile = async (fileParam?: File): Promise<string | null> => {
    let file = fileParam || rawSelectedFile;
    if (!file) return null;

    setIsUploadingFile(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('preset', bypassPreset);
      const res = await fetch('/api/music/upload-reference', {
        method: 'POST',
        body: formData
      });
      if (!res.ok) {
        if (res.status === 413) {
          throw new Error('File quá lớn (> 4.5MB). Vui lòng chọn file âm thanh nhỏ hơn 4.5 MB.');
        }
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Upload thất bại.');
      }
      const data = await res.json();

      // ── COPYRIGHT FALLBACK HANDLER ──────────────────────────────────────
      // When Suno blocks upload due to copyright, server returns copyrightBlocked=true
      // with analysis data + styleSuggestion instead of failing hard.
      if (data.copyrightBlocked) {
        setIsUploadingFile(false);
        setUploadError(null); // no error state

        // Auto-populate style fields from audio analysis (OVERWRITE previous style)
        if (data.styleSuggestion) {
          setMusicStyle(data.styleSuggestion);
        }

        // Apply analysis tags to lyrics (BPM/key) just like successful upload
        if (data.analysis) {
          const { bpm, key, dynamics } = data.analysis;
          const prefixParts = [];
          if (bpm) prefixParts.push(`[BPM: ${bpm}]`);
          if (key) prefixParts.push(`[Key: ${key}]`);
          let updatedLyrics = lyrics || '';
          if (prefixParts.length > 0) {
            const hasBpm = updatedLyrics.includes('[BPM:');
            const hasKey = updatedLyrics.includes('[Key:');
            if (!hasBpm && !hasKey) {
              updatedLyrics = prefixParts.join('\n') + '\n\n' + updatedLyrics;
            }
          }
          if (dynamics?.verse) {
            updatedLyrics = updatedLyrics.replace(/\[Verse(\s*\d*)\]/gi, (match) => {
              if (match.includes(':') || match.includes(',')) return match;
              return match.replace(/\]$/, `, ${dynamics.verse}]`);
            });
          }
          if (dynamics?.chorus) {
            updatedLyrics = updatedLyrics.replace(/\[Chorus(\s*\d*)\]/gi, (match) => {
              if (match.includes(':') || match.includes(',')) return match;
              return match.replace(/\]$/, `, ${dynamics.chorus}]`);
            });
          }
          setLyrics(updatedLyrics);
          setReferenceAnalysis(data.analysis);
        }

        setNotification({
          type: 'warning',
          title: '🔒 Bản quyền được bảo vệ',
          message: data.message || 'Bài hát có bản quyền. Đã tự động phân tích phong cách và điền vào style prompt để Suno tạo nhạc tương tự.'
        });

        // Clear the file selector since reference upload failed
        handleClearReferenceFile();
        return null;
      }
      // ── END COPYRIGHT FALLBACK ───────────────────────────────────────────

      if (data.referenceFileId) {
        setReferenceFileId(data.referenceFileId);
        setReferenceFileType(data.referenceFileType);
        setReferenceAnalysis(data.analysis || null);
        setUploadError(null);
        const isAudio = file.type.startsWith('audio/') || /\.(mp3|wav|flac|m4a|ogg|webm)$/i.test(file.name);
        if (isAudio) {
          // 🚀 Khi upload file nhạc MP3/Audio lên Suno thành công:
          // 1. Kích hoạt chế độ Reference Cover ('cover')
          // 2. Chuyển sang chế độ Viết Lời ('lyrics')
          // 3. Tự động nâng cấp Model sang v5.5 (chirp-fenix) nếu đang ở v3.5
          // 4. Gợi ý Tiêu đề Cover dựa trên tên file
          setReferenceMode('cover');
          setCreationMode('lyrics');
          if (sunoModel === 'chirp-v3-5') {
            setSunoModel('chirp-fenix');
          }
          if (!songTitle.trim() && file.name) {
            const cleanTitleName = file.name.replace(/\.(mp3|wav|flac|m4a|ogg|webm)$/i, '').trim();
            if (cleanTitleName) setSongTitle(`Cover - ${cleanTitleName}`);
          }
          if (data.styleSuggestion) {
            setMusicStyle(data.styleSuggestion);
          } else if (data.analysis) {
            const { bpm, register, vibrato_style, timbre, key, genre, genre_tags } = data.analysis;
            const genreStr = genre_tags && genre_tags.length > 0
              ? genre_tags.slice(0, 4).join(', ')
              : (genre || 'Pop');
            const detectedTags = [
              bpm ? `${Math.round(bpm)} BPM` : null,
              key ? `key of ${key}` : null,
              genreStr,
              register ? `${register} vocals` : null,
              timbre ? `${timbre} tone` : null,
              vibrato_style,
              'professional production'
            ].filter(Boolean).join(', ');
            if (detectedTags) {
              setMusicStyle(detectedTags);
            }
          }

          if (data.analysis) {
            const { bpm, key, dynamics } = data.analysis;
            const prefixParts = [];
            if (bpm) prefixParts.push(`[BPM: ${Math.round(bpm)}]`);
            if (key) prefixParts.push(`[Key: ${key}]`);

            let updatedLyrics = lyrics ? lyrics.trim() : '';

            // Nếu chưa có lời bài hát -> Tự động điền khung mẫu cấu trúc Cover bài hát chuẩn
            if (!updatedLyrics) {
              const bpmKeyHeader = prefixParts.length > 0 ? prefixParts.join('\n') + '\n\n' : '';
              const verseTag = dynamics?.verse ? `[Verse 1, ${dynamics.verse}]` : '[Verse 1]';
              const preChorusTag = dynamics?.pre_chorus ? `[Pre-Chorus, ${dynamics.pre_chorus}]` : '[Pre-Chorus]';
              const chorusTag = dynamics?.chorus ? `[Chorus, ${dynamics.chorus}]` : '[Chorus]';

              updatedLyrics = `${bpmKeyHeader}${verseTag}\n(Nhập lời bài hát cho đoạn 1...)\n\n${preChorusTag}\n(Nhập lời đoạn dạo...)\n\n${chorusTag}\n(Nhập lời điệp khúc cao trào...)\n\n[Verse 2]\n(Nhập lời bài hát cho đoạn 2...)\n\n${chorusTag}\n(Nhập lời điệp khúc...)\n\n[Outro]\n(Lời kết bài...)`;
            } else {
              // Đã có lời -> Tự động cập nhật tag BPM/Key ở đầu mà giữ nguyên nội dung bài hát
              if (prefixParts.length > 0) {
                const hasBpm = updatedLyrics.includes('[BPM:');
                const hasKey = updatedLyrics.includes('[Key:');
                if (!hasBpm && !hasKey) {
                  updatedLyrics = prefixParts.join('\n') + '\n\n' + updatedLyrics;
                }
              }
              if (dynamics?.verse) {
                updatedLyrics = updatedLyrics.replace(/\[Verse(\s*\d*)\]/gi, (match) => {
                  if (match.includes(':') || match.includes(',')) return match;
                  return match.replace(/\]$/, `, ${dynamics.verse}]`);
                });
              }
              if (dynamics?.chorus) {
                updatedLyrics = updatedLyrics.replace(/\[Chorus(\s*\d*)\]/gi, (match) => {
                  if (match.includes(':') || match.includes(',')) return match;
                  return match.replace(/\]$/, `, ${dynamics.chorus}]`);
                });
              }
            }
            setLyrics(updatedLyrics);
          }

          setNotification({
            type: 'success',
            title: 'Tải lên thành công',
            message: 'Bài hát đã được xử lý & upload lên Suno thành công.'
          });
        } else {
          setNotification({
            type: 'success',
            title: 'Tải lên thành công',
            message: 'Hình ảnh tham chiếu đã được tải lên thành công.'
          });
        }
        return data.referenceFileId;
      } else {
        throw new Error('Không nhận được ID từ server.');
      }
    } catch (err: any) {
      console.error(err);
      const errMsg = err.message || 'Không thể upload file tham chiếu.';
      setUploadError(errMsg);
      setNotification({
        type: 'error',
        title: 'Upload thất bại',
        message: errMsg
      });
      handleClearReferenceFile();
      return null;
    } finally {
      setIsUploadingFile(false);
    }
  };

  // Helper to check and enforce 1-click-per-day limit for Guest users on AI Generate buttons
  const checkGuestAiGenerateLimit = (): boolean => {
    if (session) return true; // Logged-in users have no limit

    const todayStr = new Date().toISOString().split('T')[0];
    let usageData = { date: todayStr, count: 0 };

    try {
      const stored = localStorage.getItem('guest_ai_gen_usage');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.date === todayStr) {
          usageData = parsed;
        }
      }
    } catch (e) { }

    if (usageData.count >= 1) {
      localStorage.setItem('auth_modal_notice', 'Bạn đã sử dụng hết 1 lượt AI Generate miễn phí trong ngày. Vui lòng Đăng ký hoặc Đăng nhập để dùng không giới hạn!');
      setAuthModalTab('register');
      setShowAuthModal(true);
      return false;
    }

    // Save 1-click usage for today
    try {
      localStorage.setItem('guest_ai_gen_usage', JSON.stringify({ date: todayStr, count: usageData.count + 1 }));
    } catch (e) { }

    return true;
  };

  const handleGenerateLyrics = async () => {
    if (!checkGuestAiGenerateLimit()) return;

    setIsGeneratingLyrics(true);
    try {
      const response = await fetch('/api/music/lyrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt || undefined,
          style: musicStyle || undefined,
          title: songTitle || undefined,
          mood: selectedMood || undefined,
          theme: selectedTheme || undefined,
          structure: songStructure,
          vocalGender,
          lyricsGenre: 'auto'
        })
      });

      if (!response.ok) throw new Error('Failed to generate lyrics');

      const data = await response.json();
      if (data.success) {
        if (data.lyrics) setLyrics(data.lyrics);
        if (data.title) setSongTitle(data.title);
        if (data.style) setMusicStyle(data.style);
      }
    } catch (err) {
      console.error(err);
      alert('Không thể tạo lời bài hát lúc này. Vui lòng thử lại.');
    } finally {
      setIsGeneratingLyrics(false);
    }
  };

  const handleGenerateDescribePrompt = async () => {
    if (!checkGuestAiGenerateLimit()) return;

    setIsGeneratingDescribePrompt(true);
    try {
      const response = await fetch('/api/music/lyrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt || undefined,
          mood: selectedMood || undefined,
          theme: selectedTheme || undefined,
          mode: 'describe',
          vocalGender
        })
      });

      if (!response.ok) throw new Error('Failed to generate description');

      const data = await response.json();
      if (data.success) {
        const generatedDesc = data.prompt || data.style || data.title || '';
        if (generatedDesc) {
          setPrompt(generatedDesc);
        }
        if (data.lyrics) {
          setLyrics(data.lyrics);
        }
        if (data.title) {
          setSongTitle(data.title);
        }
        if (data.style) {
          setMusicStyle(data.style);
        }
      }
    } catch (err) {
      console.error(err);
      alert('Không thể tạo mô tả bài hát lúc này. Vui lòng thử lại.');
    } finally {
      setIsGeneratingDescribePrompt(false);
    }
  };

  // Toggle genre tag in the musicStyle field
  const handleGenreTag = (tag: string) => {
    const current = musicStyle.split(',').map(s => s.trim()).filter(Boolean);
    if (current.includes(tag)) {
      setMusicStyle(current.filter(t => t !== tag).join(', '));
    } else {
      setMusicStyle([...current, tag].join(', '));
    }
  };

  const isTagActive = (tag: string) => {
    return musicStyle.split(',').map(s => s.trim()).includes(tag);
  };

  // Insert lyric structure tag
  const insertLyricStructure = (structure: string) => {
    const tag = `\n[${structure}]\n`;
    setLyrics(lyrics + tag);
  };

  const handleGenerate = async () => {
    if (!session) {
      localStorage.setItem('nhacai_pendingGenerate', 'true');
      setAuthModalTab('register');
      setShowAuthModal(true);
      return;
    }

    if (credits < 10) {
      setNotification({
        type: 'error',
        title: 'Tài khoản hết Credits',
        message: 'Tài khoản của bạn đã hết Credits. Vui lòng nạp thêm Credits để tiếp tục tạo nhạc.'
      });
      setShowBillingModal(true);
      return;
    }

    // Validation
    if (creationMode === 'describe' && !prompt.trim()) return;
    if (creationMode === 'lyrics') {
      if (remixSubMode === 'custom' && !musicStyle.trim()) return;
      if (!lyrics.trim()) return;
    }

    setIsGenerating(true);
    useMusicStore.setState((state) => ({ credits: Math.max(0, state.credits - 10) }));

    let activeRefId = referenceFileId;
    let activeRefType = referenceFileType;
    if (rawSelectedFile && !activeRefId) {
      const uploadedId = await uploadSelectedReferenceFile(rawSelectedFile);
      if (!uploadedId) {
        setIsGenerating(false);
        useMusicStore.setState((state) => ({ credits: state.credits + 10 }));
        return;
      }
      activeRefId = uploadedId;
      activeRefType = rawSelectedFile.type;
    }

    const uuid = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
      ? crypto.randomUUID()
      : Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const tempId = `item-${uuid}`;
    const finalTitle = creationMode === 'lyrics'
      ? (songTitle.trim() || generateTitleFromLyrics(lyrics))
      : undefined;

    const newItem = {
      id: tempId,
      prompt: (sunoModel === 'remix' && remixSubMode === 'preset')
        ? ''
        : (creationMode === 'describe' ? prompt : `${finalTitle} — ${musicStyle}`),
      lyrics: (creationMode === 'lyrics' && outputType !== 'instrumental') ? lyrics : undefined,
      title: finalTitle,
      style: creationMode === 'lyrics' ? ((sunoModel === 'remix' && remixSubMode === 'preset') ? 'Vinahouse Remix' : musicStyle) : undefined,
      mode: creationMode,
      outputType,
      vocalGender,
      status: 'queued' as const,
      createdAt: new Date().toLocaleDateString('vi-VN', { day: 'numeric', month: 'short', year: 'numeric' }),
      creditsCost: 10,
      tracks: [],
      sunoModel
    };

    addHistoryItem(newItem);
    setMobileTab('library');

    try {
      const response = await fetch('/api/music/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: creationMode === 'describe' ? prompt : undefined,
          lyrics: (creationMode === 'lyrics' && outputType !== 'instrumental') ? lyrics : undefined,
          bypassLyrics: creationMode === 'lyrics' ? bypassLyrics : false,
          mode: creationMode,
          outputType,
          vocalGender,
          style: musicStyle || undefined,
          title: finalTitle || undefined,
          styleWeight,
          creativity,
          audioQuality,
          negativeTags: negativeTags || undefined,
          sunoModel,
          referenceFile: activeRefId ? undefined : (referenceFile || undefined),
          referenceFileId: activeRefId || undefined,
          referenceFileType: activeRefType || undefined,
          referenceMode: activeRefId ? referenceMode : undefined,
          remixStyleId: (sunoModel === 'remix' && remixSubMode === 'preset') ? selectedRemixStyleId : undefined
        })
      });

      if (!response.ok) {
        let errMsg = 'Hệ thống hiện đang bận xử lý. Vui lòng thử lại sau ít phút.';
        try {
          const errData = await response.json();
          if (errData && errData.error) errMsg = errData.error;
        } catch { }

        useMusicStore.setState((state) => ({ credits: state.credits + 10 }));
        const parsed = parseSunoError(errMsg);


        updateHistoryItemStatus(tempId, 'failed', undefined, parsed.message);

        // Report error to DB so Admin System Error Logs table records 100% of user errors
        fetch('/api/music/report-error', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            songTitle: finalTitle || 'Mây Của Anh',
            musicStyle,
            errorMsg: errMsg,
            sunoModel
          })
        }).catch(() => { });

        setNotification({
          type: 'error',
          title: parsed.title,
          message: parsed.message
        });

        return;
      }

      const data = await response.json();
      updateHistoryItemStatus(tempId, 'processing', undefined, undefined, data.taskId, data.songId || undefined);
      pollStatus(data.songId || tempId, data.taskId);

      if (data.warning) {
        setNotification({ type: 'error', message: data.warning });
      }

    } catch (err: unknown) {
      console.error(err);
      useMusicStore.setState((state) => ({ credits: state.credits + 10 }));
      const rawMsg = err instanceof Error ? err.message : 'Tạo nhạc thất bại.';
      const parsed = parseSunoError(rawMsg);

      updateHistoryItemStatus(tempId, 'failed', undefined, parsed.message);

      // Report error to DB so Admin System Error Logs table records 100% of user errors
      fetch('/api/music/report-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          songTitle: finalTitle || 'Mây Của Anh',
          musicStyle,
          errorMsg: rawMsg,
          sunoModel
        })
      }).catch(() => { });

      setNotification({
        type: 'error',
        title: parsed.title,
        message: `${parsed.message} (Hệ thống đã hoàn trả lại 10 Credits).`
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const pollStatus = async (itemId: string, taskId: string) => {
    let attempts = 0;
    const maxAttempts = 60;
    const interval = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts) {
        clearInterval(interval);
        pollingTaskIds.current.delete(itemId);
        updateHistoryItemStatus(itemId, 'failed');
        return;
      }
      try {
        const res = await fetch(`/api/music/status?taskId=${taskId}&itemId=${itemId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.status === 'completed' && data.tracks) {
          clearInterval(interval);
          pollingTaskIds.current.delete(itemId);
          updateHistoryItemStatus(itemId, 'completed', data.tracks);
        } else if (data.status === 'processing' && data.tracks) {
          updateHistoryItemStatus(itemId, 'processing', data.tracks);
        } else if (data.status === 'failed') {
          clearInterval(interval);
          pollingTaskIds.current.delete(itemId);
          updateHistoryItemStatus(itemId, 'failed');
        }
      } catch {
        clearInterval(interval);
        pollingTaskIds.current.delete(itemId);
      }
    }, 5000);
  };

  // Resume status polling for any active or pending task loaded from session history
  useEffect(() => {
    history.forEach((item) => {
      if ((item.status === 'processing' || item.status === 'queued') && item.taskId) {
        if (!pollingTaskIds.current.has(item.id)) {
          pollingTaskIds.current.add(item.id);
          pollStatus(item.id, item.taskId);
        }
      }
    });
  }, [history]);

  // Auto-resume generation after user registers/logs in successfully
  useEffect(() => {
    if (session && localStorage.getItem('nhacai_pendingGenerate') === 'true') {
      localStorage.removeItem('nhacai_pendingGenerate');
      const timer = setTimeout(() => {
        handleGenerate();
      }, 800); // 800ms buffer to make sure store/session credits are fully synchronized
      return () => clearTimeout(timer);
    }
  }, [session]);

  // Validation checks
  const lyricsValid = creationMode === 'describe'
    ? prompt.trim().length > 0
    : (sunoModel === 'remix' || musicStyle.trim().length > 0) && (outputType === 'instrumental' || lyrics.trim().length > 0);

  const canGenerate = !isGenerating && !isUploadingFile && lyricsValid && (!session || credits >= 10);

  return (
    <div className="w-full md:w-[380px] h-full flex-shrink-0 flex flex-col bg-[var(--bg-card)] border-r border-[var(--border)] overflow-y-auto custom-scrollbar">

      {/* ── Fixed Centered Toast Notification Overlay ── */}
      {notification && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] max-w-md w-[92vw] md:w-auto shadow-2xl animate-scale-up pointer-events-auto">
          <div className={`flex items-start gap-3 p-4 rounded-2xl border backdrop-blur-xl bg-zinc-950/95 text-left shadow-2xl ${notification.type === 'error'
              ? 'border-rose-500/40 text-rose-300 shadow-rose-950/50'
              : notification.type === 'warning'
                ? 'border-amber-500/40 text-amber-300 shadow-amber-950/50'
                : 'border-emerald-500/40 text-emerald-300 shadow-emerald-950/50'
            }`}>
            {notification.type === 'error' ? (
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-rose-400" />
            ) : notification.type === 'warning' ? (
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-amber-400" />
            ) : (
              <CheckCircle className="h-5 w-5 shrink-0 mt-0.5 text-emerald-400" />
            )}
            <div className="flex-1 space-y-1 min-w-0 pr-2">
              {notification.title && (
                <p className="font-bold text-xs uppercase tracking-wider text-white">{notification.title}</p>
              )}
              <p className="text-xs opacity-90 leading-relaxed font-medium">{notification.message}</p>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="p-1 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors shrink-0 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col p-5 space-y-5 flex-1">

        {/* ── Suno Model Selector ── */}
        <div className="space-y-2" ref={modelDropdownRef}>
          <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Model & Remix</label>
          <div className="grid grid-cols-2 gap-2.5">
            {/* Left: Model Badge - fixed v5.5 Pro */}
            <div
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold shadow-sm ${sunoModel !== 'remix'
                  ? 'bg-[var(--bg-secondary)] border-[var(--accent)]/50 text-[var(--text-primary)] ring-1 ring-[var(--accent)]/20'
                  : 'bg-[var(--bg-secondary)] border-[var(--border)] text-[var(--text-secondary)]'
                }`}
              onClick={() => { setSunoModel('chirp-fenix'); setShowCustomModel(false); setModelDropdownOpen(false); }}
              style={{ cursor: 'default' }}
            >
              <Music4 className={`h-3.5 w-3.5 shrink-0 ${sunoModel !== 'remix' ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}`} />
              <span className="truncate">v5.5 (Pro)</span>
            </div>

            {/* Right: Remix Button */}
            <button
              type="button"
              onClick={() => {
                setSunoModel('remix');
                setCreationMode('lyrics');
                setShowCustomModel(false);
                setModelDropdownOpen(false);
              }}
              className={`w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-[0.99] ${sunoModel === 'remix'
                  ? 'bg-[var(--accent)] border-[var(--accent)] text-white dark:text-black shadow-md shadow-[var(--accent)]/10'
                  : 'bg-[var(--bg-secondary)] border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--text-muted)]'
                }`}
            >
              <Zap className="h-3.5 w-3.5" />
              <span>Tạo Nhạc Remix</span>
            </button>
          </div>
        </div>

        {/* ── Creation Mode ── */}
        {sunoModel !== 'remix' && (
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Creation Mode</label>
            <div className="grid grid-cols-2 p-1 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)]">
              {(['describe', 'lyrics'] as const).map((mode) => (
                <button
                  key={mode}
                  disabled={sunoModel === 'remix' && mode === 'describe'}
                  onClick={() => setCreationMode(mode)}
                  className={`py-2 text-xs font-bold rounded-lg transition-all capitalize ${creationMode === mode
                      ? 'bg-[var(--accent)] text-white dark:text-black shadow-md'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    } ${sunoModel === 'remix' && mode === 'describe' ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  {mode === 'describe' ? 'Describe' : 'Write Lyrics'}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── DESCRIBE MODE ── */}
        {creationMode === 'describe' && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Describe your music</label>
              <button
                type="button"
                onClick={handleGenerateDescribePrompt}
                disabled={isGeneratingDescribePrompt}
                className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--accent)] hover:text-[var(--accent-hover)] transition-all bg-[var(--accent-dim)] border border-[var(--accent)]/20 px-2.5 py-1 rounded-full active:scale-95 disabled:opacity-50"
              >
                {isGeneratingDescribePrompt ? (
                  <>
                    <span className="h-2.5 w-2.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3 w-3" />
                    AI Generate
                  </>
                )}
              </button>
            </div>
            <div className="relative">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value.slice(0, 2500))}
                onPaste={(e) => {
                  const pastedFile = e.clipboardData.files?.[0];
                  if (pastedFile) {
                    e.preventDefault();
                    handleProcessFile(pastedFile);
                  }
                }}
                placeholder="Ví dụ: A cheerful acoustic guitar song about a sunny morning walk..."
                className="w-full h-36 p-3 pr-10 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] text-sm text-[var(--text-primary)] outline-none resize-none placeholder-[var(--text-muted)] transition-all leading-relaxed custom-scrollbar"
              />
              {prompt && (
                <button
                  type="button"
                  onClick={() => setPrompt('')}
                  className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-muted)] hover:text-rose-500 hover:border-rose-500/30 hover:bg-rose-500/10 transition-all active:scale-[0.95] z-10 cursor-pointer shadow-sm"
                  title="Xóa mô tả"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
              <span className="absolute bottom-3 right-3 text-[10px] font-semibold text-[var(--text-muted)] pointer-events-none">
                {prompt.length}/2500
              </span>
            </div>


          </div>
        )}

        {/* ── WRITE LYRICS MODE ── */}
        {creationMode === 'lyrics' && (
          <div className="space-y-5 animate-fade-in">

            {/* 1️⃣ SONG TITLE SECTION */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">Song Title</label>
                <span className="text-[var(--text-muted)] text-[10px] font-medium">(Tùy chọn)</span>
              </div>
              <div className="relative">
                <input
                  type="text"
                  maxLength={80}
                  value={songTitle}
                  onChange={(e) => setSongTitle(e.target.value)}
                  placeholder="Ví dụ: Cơn Mưa Qua Phố"
                  className="w-full p-3 pr-10 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] text-sm text-[var(--text-primary)] outline-none placeholder-[var(--text-muted)] transition-all"
                />
                {songTitle && (
                  <button
                    type="button"
                    onClick={() => setSongTitle('')}
                    className="absolute top-1/2 -translate-y-1/2 right-2.5 p-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-muted)] hover:text-rose-500 hover:border-rose-500/30 hover:bg-rose-500/10 transition-all active:scale-[0.95] z-10 cursor-pointer shadow-sm"
                    title="Xóa tiêu đề"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <div className="flex justify-between items-center">
                {!songTitle.trim() && (
                  <span className="flex items-center gap-1 text-[10px] text-[var(--text-muted)] font-medium">
                    <Sparkles className="h-3 w-3 text-[var(--accent)]" /> Tự động tạo tiêu đề phù hợp với lyrics nếu bỏ trống
                  </span>
                )}
                <span className="ml-auto text-[10px] text-[var(--text-muted)] font-semibold">{songTitle.length}/80</span>
              </div>
            </div>

            {/* 2️⃣ MUSIC STYLE SECTION */}
            <div className="space-y-3 animate-fade-in">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] flex items-center gap-1.5">
                  {sunoModel === 'remix' && remixSubMode === 'preset' ? (
                    <>
                      <Zap className="h-3.5 w-3.5 text-[var(--accent)]" />
                      REMIX STYLE
                    </>
                  ) : (
                    <>
                      <Music4 className="h-3.5 w-3.5 text-[var(--accent)]" />
                      Music Style
                      <span className="text-[var(--accent)] text-xs font-bold">*</span>
                    </>
                  )}
                </label>

                {/* Style Mode Switcher (Visible ONLY in Remix Mode when sunoModel === 'remix') */}
                {sunoModel === 'remix' && (
                  <div className="flex items-center p-0.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] shadow-inner">
                    <button
                      type="button"
                      onClick={() => setRemixSubMode('custom')}
                      className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${remixSubMode === 'custom'
                        ? 'bg-[var(--accent-dim)] text-[var(--accent)] border border-[var(--accent)]/30 shadow-xs'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                        }`}
                    >
                      Tùy chọn
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRemixSubMode('preset');
                        if (!selectedRemixStyleId && (remixStyles.length > 0)) {
                          setSelectedRemixStyleId(remixStyles[0].id);
                        }
                      }}
                      className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all flex items-center gap-1 cursor-pointer ${remixSubMode === 'preset'
                        ? 'bg-[var(--accent)] text-white dark:text-black shadow-sm'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                        }`}
                    >
                      <Zap className="h-2.5 w-2.5" />
                      REMIX STYLE
                    </button>
                  </div>
                )}
              </div>

              {/* ⚡ REMIX STYLE CARD */}
              {sunoModel === 'remix' && remixSubMode === 'preset' ? (
                <div className="space-y-3 p-3.5 rounded-2xl bg-gradient-to-b from-[var(--accent-dim)]/20 via-[var(--bg-secondary)] to-[var(--bg-secondary)] border border-[var(--accent)]/40 shadow-lg animate-fade-in select-none">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[var(--accent)] uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5" />
                      CHỌN TÙY CHỌN REMIX STYLE
                    </span>
                  </div>

                  <div className="relative">
                    <select
                      value={selectedRemixStyleId || (remixStyles[0]?.id || 'remix_1')}
                      onChange={(e) => setSelectedRemixStyleId(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-[var(--accent)]/50 bg-[var(--bg-card)] text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 transition-all cursor-pointer shadow-md appearance-none"
                      style={{
                        backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%233b82f6' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='m6 8 4 4 4-4'/%3E%3C/svg%3E")`,
                        backgroundPosition: 'right 1rem center',
                        backgroundSize: '1.25rem',
                        backgroundRepeat: 'no-repeat',
                        paddingRight: '2.75rem'
                      }}
                    >
                      {(remixStyles.length > 0 ? remixStyles : [
                        { id: 'remix_1', name: 'Vinahouse Remix 1 (BASS NẢY CĂNG)' },
                        { id: 'remix_2', name: 'Remix 2 (Dance EDM Sôi Động)' }
                      ]).map((style) => (
                        <option key={style.id} value={style.id} className="bg-[var(--bg-card)] py-2 font-semibold">
                          ⚡ {style.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                /* 🎨 CUSTOM MUSIC STYLE TEXTAREA */
                <div className="space-y-2 animate-fade-in">
                  <div className="relative">
                    <textarea
                      maxLength={2500}
                      value={musicStyle}
                      onChange={(e) => setMusicStyle(e.target.value.replace(/\n/g, ' '))}
                      placeholder={sunoModel === 'remix' ? "Nhập prompt phong cách remix tùy chỉnh (Ví dụ: Vinahouse 140 BPM, energetic bass...)" : "e.g., orchestral, emotional, film score"}
                      className={`w-full ${musicStyle.length > 300 ? 'h-36' : 'h-24'} p-3 pr-10 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] text-xs leading-relaxed text-[var(--text-primary)] outline-none resize-y placeholder-[var(--text-muted)] transition-all font-mono custom-scrollbar`}
                    />
                    {musicStyle && (
                      <button
                        type="button"
                        onClick={() => setMusicStyle('')}
                        className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-muted)] hover:text-rose-500 hover:border-rose-500/30 hover:bg-rose-500/10 transition-all active:scale-[0.95] z-10 cursor-pointer shadow-sm"
                        title="Xóa phong cách"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Genre Tag Chips */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {GENRE_TAGS.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => handleGenreTag(tag)}
                        className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border transition-all duration-150 cursor-pointer ${isTagActive(tag)
                          ? 'bg-[var(--accent-dim)] border-[var(--accent)]/60 text-[var(--accent)]'
                          : 'bg-[var(--bg-secondary)] border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--text-muted)] hover:text-[var(--text-primary)]'
                          }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>

                  <div className="flex justify-between items-center">
                    {!musicStyle.trim() && (
                      <span className="flex items-center gap-1 text-[10px] text-amber-500 font-semibold">
                        <AlertCircle className="h-3 w-3" /> Vui lòng nhập hoặc chọn Music Style
                      </span>
                    )}
                    <span className="ml-auto text-[10px] text-[var(--text-muted)] font-semibold">{musicStyle.length}/2500</span>
                  </div>
                </div>
              )}
            </div>

            {/* 3️⃣ LYRICS SECTION */}
            {outputType !== 'instrumental' ? (
              <div className="space-y-2.5 animate-fade-in">
                <div className="flex items-center justify-between">
                  {/* LYRICS label */}
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] shrink-0">Lyrics</label>

                  {/* Top AI Generate compact button */}
                  <button
                    type="button"
                    onClick={handleGenerateLyrics}
                    disabled={isGeneratingLyrics}
                    className="flex items-center gap-1 text-[10px] font-bold text-[var(--accent)] bg-[var(--accent-dim)] border border-[var(--accent)]/25 hover:border-[var(--accent)]/50 px-2.5 py-1.5 rounded-lg transition-all active:scale-95 disabled:opacity-50 cursor-pointer shrink-0 whitespace-nowrap"
                    title="AI tạo lời bài hát"
                  >
                    {isGeneratingLyrics ? (
                      <span className="h-2.5 w-2.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Wand2 className="h-3 w-3" />
                    )}
                    <span>{isGeneratingLyrics ? 'Đang tạo...' : 'AI Generate'}</span>
                  </button>
                </div>

                <div className="relative">
                  <textarea
                    value={lyrics}
                    onChange={(e) => e.target.value.length <= 5000 && setLyrics(e.target.value)}
                    placeholder={'[Verse 1]\nYour lyrics here...\n\n[Chorus]\nChorus lyrics...'}
                    className="w-full h-48 p-3 pr-10 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] text-xs text-[var(--text-primary)] outline-none resize-none placeholder-[var(--text-muted)] transition-all leading-relaxed font-mono custom-scrollbar"
                  />
                  {lyrics && (
                    <button
                      type="button"
                      onClick={() => {
                        setLyrics('');
                        setSongTitle('');
                      }}
                      className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-muted)] hover:text-rose-500 hover:border-rose-500/30 hover:bg-rose-500/10 transition-all active:scale-[0.95] z-10 cursor-pointer shadow-sm"
                      title="Xóa lời"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <span className="absolute bottom-3 right-3 text-[10px] font-semibold text-[var(--text-muted)]">
                    {lyrics.length}/5000
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] text-center space-y-2 animate-fade-in">
                <Music4 className="h-6 w-6 mx-auto text-[var(--accent)] animate-pulse" />
                <p className="text-xs font-bold text-[var(--text-primary)]">Nhạc Không Lời (Instrumental)</p>
                <p className="text-[10px] text-[var(--text-muted)] leading-relaxed font-medium">
                  Trình nhập lời bài hát tạm ẩn vì bạn đã chọn xuất nhạc không lời.
                </p>
              </div>
            )}

          </div>
        )}

        {/* ── Bypass Copyright Filter ── */}
        {creationMode === 'lyrics' && (
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] gap-4 select-none animate-fade-in">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-[var(--text-primary)]">
                  {sunoModel === 'remix' ? 'Vượt Lọc Bản Quyền Lyrics' : 'Vượt Lọc Bản Quyền Lyrics / Prompt'}
                </span>
                <span className="text-[9px] bg-emerald-500/20 text-emerald-500 dark:text-emerald-400 font-extrabold px-1.5 py-0.5 rounded tracking-wide uppercase">Khuyên Dùng</span>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
              <input
                type="checkbox"
                checked={bypassLyrics}
                onChange={(e) => setBypassLyrics(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-[var(--bg-hover)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[var(--text-secondary)] after:border-none after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--accent)] peer-checked:after:bg-white"></div>
            </label>
          </div>
        )}

        {/* ── Output Type ── */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Output Type</label>
          <div className="grid grid-cols-2 p-1 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)]">
            <button
              onClick={() => setOutputType('vocal')}
              className={`py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${outputType === 'vocal' ? 'bg-[var(--accent)] text-white dark:text-black shadow-md font-bold' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
            >
              <Mic className="h-3.5 w-3.5" /> Vocal
            </button>
            <button
              onClick={() => setOutputType('instrumental')}
              className={`py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${outputType === 'instrumental' ? 'bg-[var(--accent)] text-white dark:text-black shadow-md font-bold' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
            >
              <Music4 className="h-3.5 w-3.5" /> Instrumental
            </button>
          </div>
        </div>

        {/* ── Vocal Gender (only for vocal) ── */}
        {outputType === 'vocal' && (
          <div className="space-y-2 animate-fade-in">
            <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Vocal Gender</label>
            <div className="grid grid-cols-3 p-1 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)]">
              {(['auto', 'female', 'male'] as const).map((gender) => (
                <button
                  key={gender}
                  onClick={() => setVocalGender(gender)}
                  className={`py-2 text-xs font-semibold capitalize rounded-lg transition-all ${vocalGender === gender ? 'bg-[var(--accent)] text-white dark:text-black shadow-md font-bold' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                >
                  {gender}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Reference Audio / Image Upload ── */}
        {enableReferenceFile && (
          <div className="space-y-3">


            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleProcessFile(file);
              }}
              className="hidden"
            />
            {isUploadingFile ? (
              <div className="flex items-center justify-between gap-3 p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] animate-pulse">
                <div className="flex items-center gap-3">
                  <span className="h-5 w-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin shrink-0" />
                  <div className="space-y-1">
                    <p className="text-xs text-[var(--text-primary)] font-bold">Processing audio bypass...</p>
                    <p className="text-[10px] text-[var(--text-muted)] font-semibold">Applying ffmpeg obfuscation & filtering</p>
                  </div>
                </div>
              </div>
            ) : (referenceFile && referenceFileId) ? (
              referenceFile.type.startsWith('image/') ? (
                // Simple Image Preview Card
                <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)]">
                  <div className="w-10 h-10 rounded-lg overflow-hidden relative bg-zinc-800 shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={referenceFile.data} alt="Reference Preview" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[var(--text-primary)] font-semibold truncate">{referenceFile.name}</p>
                    <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold font-mono mt-0.5">Hình ảnh</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearReferenceFile}
                    className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-rose-400 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                // Advanced Waveform Player Card
                <div className="w-full p-4 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border)] space-y-4 shadow-lg transition-all duration-300 hover:shadow-xl hover:border-white/10">
                  {/* Header row */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                      {referenceFileType?.startsWith('image/') ? 'Image' : 'Audio'}
                    </span>
                    <div className="flex items-center gap-2">
                      {/* Cover Mode Dropdown */}
                      <div className="relative">
                        {referenceFileType?.startsWith('image/') ? (
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--bg-hover)] border border-[var(--border)] text-xs font-semibold text-[var(--text-muted)] select-none">
                            Image Ref
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => setRefModeDropdownOpen(!refModeDropdownOpen)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--bg-hover)] border border-[var(--border)] hover:border-[var(--accent)]/40 hover:bg-[var(--accent-dim)] text-xs font-semibold text-[var(--text-primary)] transition-all cursor-pointer"
                            >
                              <RefreshCw className="h-3 w-3 text-[var(--accent)]" />
                              <span>
                                {referenceMode === 'cover'
                                  ? 'Cover'
                                  : referenceMode === 'extend'
                                    ? 'Extend'
                                    : 'Style Ref'}
                              </span>
                              <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${refModeDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {refModeDropdownOpen && (
                              <div className="absolute right-0 mt-1.5 w-32 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] shadow-xl z-20 py-1 overflow-hidden animate-slide-down">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReferenceMode('cover');
                                    setRefModeDropdownOpen(false);
                                  }}
                                  className={`w-full text-left px-3 py-2 text-xs font-medium transition-colors hover:bg-[var(--bg-hover)] ${referenceMode === 'cover' ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'}`}
                                >
                                  Cover
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReferenceMode('extend');
                                    setRefModeDropdownOpen(false);
                                  }}
                                  className={`w-full text-left px-3 py-2 text-xs font-medium transition-colors hover:bg-[var(--bg-hover)] ${referenceMode === 'extend' ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'}`}
                                >
                                  Extend
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReferenceMode('style');
                                    setRefModeDropdownOpen(false);
                                  }}
                                  className={`w-full text-left px-3 py-2 text-xs font-medium transition-colors hover:bg-[var(--bg-hover)] ${referenceMode === 'style' ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'}`}
                                >
                                  Style Ref
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      {/* Trash Button */}
                      <button
                        type="button"
                        onClick={handleClearReferenceFile}
                        className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-rose-400 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Details Row */}
                  <div className="flex items-center gap-3">
                    {/* Thumbnail / Cover Art */}
                    <div
                      onClick={togglePlayRefAudio}
                      className="relative w-12 h-12 rounded-xl overflow-hidden bg-gradient-to-br from-violet-600 via-indigo-600 to-rose-500 flex items-center justify-center group cursor-pointer shadow-md select-none shrink-0"
                    >
                      {/* Wave/Glow design */}
                      <div className="absolute inset-0 bg-black/35 group-hover:bg-black/50 transition-colors flex items-center justify-center">
                        {refAudioPlaying ? (
                          <Pause className="h-5 w-5 text-white fill-white" />
                        ) : (
                          <Play className="h-5 w-5 text-white fill-white translate-x-[1px]" />
                        )}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-[var(--text-primary)] font-bold truncate pr-1">{referenceFile.name}</p>
                      <p className="text-[10px] text-[var(--text-muted)] font-semibold mt-0.5">
                        {formatTime(refAudioTime)} / {formatTime(refAudioDuration)}
                      </p>
                    </div>
                  </div>

                  {/* Waveform Player */}
                  {(() => {
                    const waveformSource = (realWaveform && realWaveform.length > 0)
                      ? realWaveform
                      : WAVEFORM_HEIGHTS;
                    const maxVal = Math.max(...waveformSource, 1);
                    return (
                      <div
                        onClick={handleWaveformClick}
                        className="w-full p-2 py-3 rounded-xl bg-zinc-950/80 hover:bg-zinc-950 border border-[var(--border)] flex items-center justify-between gap-[2px] h-14 cursor-pointer select-none transition-all shadow-inner"
                      >
                        {waveformSource.map((val, idx) => {
                          const height = Math.max(10, Math.min(100, (val / maxVal) * 100));
                          const progress = refAudioDuration ? refAudioTime / refAudioDuration : 0;
                          const barPercentage = idx / waveformSource.length;
                          const isPlayed = barPercentage <= progress;
                          return (
                            <div
                              key={idx}
                              className={`w-[2.5px] rounded-full transition-all duration-150 ${isPlayed ? 'bg-gradient-to-t from-emerald-400 to-teal-300 shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 'bg-zinc-600/80 hover:bg-zinc-500'}`}
                              style={{ height: `${height}%` }}
                            />
                          );
                        })}
                      </div>
                    );
                  })()}

                  {/* Mixing & Mastering Suggestions Widget */}
                  {referenceAnalysis && referenceAnalysis.eq_suggestions && (
                    <div className="pt-2 border-t border-[var(--border)] space-y-3">
                      <button
                        type="button"
                        onClick={() => setShowMixingSuggestions(!showMixingSuggestions)}
                        className="flex w-full items-center justify-between py-1 text-[11px] font-bold text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors cursor-pointer outline-none"
                      >
                        <span className="flex items-center gap-1.5">
                          <Sliders className="w-3.5 h-3.5" />
                          Gợi ý Mixing & Mastering (EQ & Waveform Tuning)
                        </span>
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showMixingSuggestions ? 'rotate-180' : ''}`} />
                      </button>

                      {showMixingSuggestions && (
                        <div className="space-y-4 p-4 rounded-2xl bg-zinc-950 border border-zinc-800 text-zinc-100 shadow-2xl animate-slide-down text-xs">
                          {/* Visual EQ Curves Simulation */}
                          <div className="space-y-2">
                            <p className="text-[10px] font-extrabold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
                              Đồ thị Tần số gợi ý (Target EQ Curve)
                            </p>
                            <div className="grid grid-cols-5 gap-2 h-20 items-end bg-zinc-900/90 p-3 rounded-xl border border-zinc-800 relative overflow-hidden shadow-inner">
                              {/* Central axis line */}
                              <div className="absolute left-0 right-0 top-1/2 h-[1px] bg-zinc-700/50" />

                              {/* EQ Bars */}
                              {Object.entries(referenceAnalysis.eq_suggestions).map(([band, val]) => {
                                const suggestion = val as { gain: number; freq: string; action: string };
                                const gain = suggestion.gain || 0; // Float
                                const isBoost = gain > 0;
                                const isCut = gain < 0;
                                const heightPercentage = Math.abs(gain) * 12.5; // 4dB = 50%
                                return (
                                  <div key={band} className="flex flex-col items-center flex-1 h-full justify-center relative">
                                    <div className="flex-1 w-full flex flex-col justify-end relative h-full">
                                      <div
                                        className={`w-full rounded transition-all duration-300 ${isBoost ? 'bg-gradient-to-t from-emerald-500 via-teal-400 to-cyan-300 shadow-[0_0_10px_rgba(52,211,153,0.6)]' : isCut ? 'bg-gradient-to-b from-rose-500 to-pink-600 shadow-[0_0_10px_rgba(244,63,94,0.6)]' : 'bg-zinc-600'
                                          }`}
                                        style={{
                                          height: `${Math.max(6, heightPercentage)}%`,
                                          transform: isCut ? 'translateY(50%)' : isBoost ? 'translateY(-50%)' : 'none',
                                          opacity: gain === 0 ? 0.4 : 1
                                        }}
                                      />
                                    </div>
                                    <span className="text-[9px] text-zinc-300 font-mono font-bold mt-1.5 truncate w-full text-center tracking-tight">
                                      {band.replace('_', ' ')}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Instrument-Specific Mixing Suggestions */}
                          <div className="space-y-2.5">
                            <p className="text-[10px] font-extrabold text-purple-400 uppercase tracking-wider">Tinh chỉnh từng Nhạc cụ (Instrument mixing)</p>

                            {/* Tabs selector */}
                            <div className="flex bg-zinc-900 border border-zinc-800 p-1 rounded-xl gap-1">
                              {(['vocal', 'drums', 'bass', 'melody'] as const).map((tab) => (
                                <button
                                  key={tab}
                                  type="button"
                                  onClick={() => setActiveMixingTab(tab)}
                                  className={`flex-1 py-1.5 text-[11px] font-extrabold capitalize rounded-lg transition-all cursor-pointer ${activeMixingTab === tab ? 'bg-zinc-800 text-teal-300 border border-teal-500/30 shadow-md' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                                    }`}
                                >
                                  {tab === 'vocal' ? 'Vocal' : tab === 'drums' ? 'Trống' : tab === 'bass' ? 'Bass' : 'Melody'}
                                </button>
                              ))}
                            </div>

                            {/* Active Tab Content */}
                            {referenceAnalysis.instrument_mixing[activeMixingTab] && (
                              <div className="p-3.5 rounded-xl bg-zinc-900/90 border border-zinc-800 space-y-3 shadow-md animate-fade-in">
                                <div className="space-y-1.5">
                                  <span className="text-[10px] font-extrabold text-amber-300 uppercase tracking-wider flex items-center gap-1">
                                    🎛️ Cấu hình EQ khuyên dùng
                                  </span>
                                  <div className="p-2.5 rounded-lg bg-black/60 border border-amber-500/30 text-amber-200 font-mono text-[11px] leading-relaxed font-bold shadow-inner">
                                    {referenceAnalysis.instrument_mixing[activeMixingTab].eq}
                                  </div>
                                </div>
                                <div className="space-y-1.5">
                                  <span className="text-[10px] font-extrabold text-violet-300 uppercase tracking-wider flex items-center gap-1">
                                    🎚️ Thông số Dynamic/Compressor
                                  </span>
                                  <div className="p-2.5 rounded-lg bg-black/60 border border-violet-500/30 text-violet-200 font-mono text-[11px] leading-relaxed font-bold shadow-inner">
                                    {referenceAnalysis.instrument_mixing[activeMixingTab].comp}
                                  </div>
                                </div>
                                <div className="space-y-1.5">
                                  <span className="text-[10px] font-extrabold text-emerald-300 uppercase tracking-wider flex items-center gap-1">
                                    💡 Mẹo Mixing (Pro Tip)
                                  </span>
                                  <p className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-200 text-[11px] leading-relaxed font-medium italic">
                                    {referenceAnalysis.instrument_mixing[activeMixingTab].suggestion}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Mastering Recommendations */}
                          {referenceAnalysis.mastering && (
                            <div className="pt-3 border-t border-zinc-800 space-y-2.5">
                              <p className="text-[10px] font-extrabold text-teal-400 uppercase tracking-wider">Gợi ý hoàn âm đầu ra (Mastering recommendations)</p>
                              <div className="grid grid-cols-2 gap-2.5 text-[11px]">
                                <div className="p-3 rounded-xl bg-zinc-900/90 border border-rose-500/30 space-y-1.5 shadow-md">
                                  <span className="text-[10px] font-extrabold text-rose-300 uppercase tracking-wider block">Target Limiter / LUFS</span>
                                  <p className="text-[11px] text-zinc-100 font-bold leading-relaxed">{referenceAnalysis.mastering.limiter}</p>
                                </div>
                                <div className="p-3 rounded-xl bg-zinc-900/90 border border-teal-500/30 space-y-1.5 shadow-md">
                                  <span className="text-[10px] font-extrabold text-teal-300 uppercase tracking-wider block">Stereo Width / Pan</span>
                                  <p className="text-[11px] text-zinc-100 font-bold leading-relaxed">{referenceAnalysis.mastering.stereo_width}</p>
                                </div>
                              </div>
                              <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-cyan-200 text-[11px] leading-relaxed font-medium italic">
                                📌 {referenceAnalysis.mastering.style_recommendation}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Upload Action / Status Bar */}
                  <div className="flex items-center justify-between pt-2.5 border-t border-[var(--border)]">
                    <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      ✓ Đã xử lý &amp; upload Suno thành công (Chế độ Cover đã tự động kích hoạt)
                    </span>
                  </div>
                </div>
              )
            ) : (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-secondary)] hover:border-[var(--accent)]/40 hover:bg-[var(--accent-dim)] text-[var(--text-secondary)] hover:text-[var(--accent)] text-xs font-semibold transition-all cursor-pointer shadow-sm"
                >
                  <Upload className="h-4 w-4" />
                  Chọn Audio
                </button>
                <p className="text-[10px] text-[var(--text-muted)] text-center leading-normal px-1">
                  ⚡ Hỗ trợ MP3, WAV, FLAC, M4A. Tự động xử lý lách vân tay âm thanh, tối ưu dải tần cao (&gt;18kHz), chuẩn hóa LUFS/Peak &amp; tải lên Suno.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Advanced Settings ── */}
        <div className="border-t border-[var(--border)] pt-4">
          <button
            onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
            className="flex w-full items-center justify-between py-1 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <span>Advanced Settings</span>
            {isAdvancedOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>

          {isAdvancedOpen && (
            <div className="mt-4 space-y-4 animate-slide-down">
              <SliderField label="Style Weight" value={styleWeight} onChange={setStyleWeight} />
              <SliderField label="Creativity" value={creativity} onChange={setCreativity} />
              <SliderField label="Audio Quality" value={audioQuality} onChange={setAudioQuality} />

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-medium text-[var(--text-secondary)]">Negative Tags</label>
                  <span className="text-[10px] text-[var(--text-muted)] font-semibold">{negativeTags.length}/200</span>
                </div>
                <input
                  type="text"
                  maxLength={200}
                  value={negativeTags}
                  onChange={(e) => setNegativeTags(e.target.value)}
                  placeholder="e.g., noise, distortion, low quality"
                  className="w-full p-2.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] focus:border-[var(--accent)] text-xs text-[var(--text-primary)] outline-none placeholder-[var(--text-muted)] transition-all"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Sticky Footer: Credits + Generate ── */}
      <div className="mobile-credits-footer sticky bottom-0 bg-[var(--bg-card)] border-t border-[var(--border)] p-5 space-y-3">
        {/* Credits info */}
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1 text-[var(--text-secondary)]">
            <Coins className="h-3.5 w-3.5" /> Credits required: <strong className="text-[var(--text-primary)] ml-0.5">10</strong>
          </span>
          <span className="flex items-center gap-1 text-[var(--text-secondary)]">
            <Zap className="h-3.5 w-3.5 text-amber-500" /> Remaining:
            <strong className={`ml-0.5 ${credits >= 10 ? 'text-[var(--accent)]' : 'text-rose-500'}`}>{credits}</strong>
          </span>
        </div>
        <p className="text-[10px] text-[var(--text-muted)]">Generates up to 2 track variations per request.</p>

        {/* Button */}
        {session && credits < 10 ? (
          <button
            onClick={() => setShowBillingModal(true)}
            className="w-full py-3.5 bg-[var(--bg-hover)] hover:bg-[var(--bg-hover)]/80 text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-extrabold text-xs tracking-wider uppercase border border-[var(--border)] rounded-xl transition-all"
          >
            Get More Credits
          </button>
        ) : (
          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className={`w-full py-3.5 rounded-xl text-xs font-extrabold tracking-wider uppercase transition-all duration-200 shadow-lg active:scale-[0.98] ${canGenerate
                ? 'bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white dark:text-black shadow-[var(--accent)]/10'
                : 'bg-[var(--bg-hover)] text-[var(--text-muted)] border border-[var(--border)] cursor-not-allowed'
              }`}
          >
            {isGenerating ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-3 w-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Generating...
              </span>
            ) : 'Create Music'}
          </button>
        )}
      </div>
    </div>
  );
}

