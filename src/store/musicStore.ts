import { create } from 'zustand';

export interface Track {
  id: string;
  title: string;
  url: string;
  coverUrl: string;
  duration: number;
  style?: string;
  lyrics?: string;
  sourceName?: string;
  videoUrl?: string;
}

export interface HistoryItem {
  id: string;
  prompt: string;
  lyrics?: string;
  title?: string;
  style?: string;
  mode: 'describe' | 'lyrics';
  outputType: 'vocal' | 'instrumental';
  vocalGender: 'auto' | 'female' | 'male';
  status: 'queued' | 'processing' | 'completed' | 'failed';
  tracks: Track[];
  createdAt: string;
  creditsCost: number;
  error?: string;
  sunoModel?: string;
  taskId?: string;
}

interface MusicStore {
  // Form state
  creationMode: 'describe' | 'lyrics';
  prompt: string;
  lyrics: string;
  songTitle: string;
  musicStyle: string;
  outputType: 'vocal' | 'instrumental';
  vocalGender: 'auto' | 'female' | 'male';
  isAdvancedOpen: boolean;
  // Advanced settings
  styleWeight: number;
  creativity: number;
  audioQuality: number;
  negativeTags: string;

  // Suno model version (preset or custom)
  sunoModel: string;

  // Credits
  credits: number;
  showBillingModal: boolean;

  // Auth Modal State
  showAuthModal: boolean;
  setShowAuthModal: (show: boolean) => void;
  authModalTab: 'login' | 'register';
  setAuthModalTab: (tab: 'login' | 'register') => void;

  // Feature Toggles
  enableReferenceFile: boolean;
  setEnableReferenceFile: (enabled: boolean) => void;
  enableSunoConnect: boolean;
  setEnableSunoConnect: (enabled: boolean) => void;
  remixStyles: Array<{ id: string, name: string, prompt: string }>;
  setRemixStyles: (styles: Array<{ id: string, name: string, prompt: string }>) => void;
  selectedRemixStyleId: string;
  setSelectedRemixStyleId: (id: string) => void;

  // History
  history: HistoryItem[];
  activeItemId: string | null;
  loadingHistory: boolean;
  setLoadingHistory: (loading: boolean) => void;

  // Player
  activeTrackId: string | null;
  isPlaying: boolean;

  // Setters
  setCreationMode: (mode: 'describe' | 'lyrics') => void;
  setPrompt: (prompt: string) => void;
  setLyrics: (lyrics: string) => void;
  setSongTitle: (title: string) => void;
  setMusicStyle: (style: string) => void;
  setOutputType: (type: 'vocal' | 'instrumental') => void;
  setVocalGender: (gender: 'auto' | 'female' | 'male') => void;
  setIsAdvancedOpen: (open: boolean) => void;
  setSunoModel: (model: string) => void;

  setStyleWeight: (v: number) => void;
  setCreativity: (v: number) => void;
  setAudioQuality: (v: number) => void;
  setNegativeTags: (v: string) => void;

  setCredits: (credits: number) => void;
  addCredits: (amount: number) => void;
  setShowBillingModal: (show: boolean) => void;

  setHistory: (history: HistoryItem[]) => void;
  addHistoryItem: (item: HistoryItem) => void;
  updateHistoryItemStatus: (id: string, status: HistoryItem['status'], tracks?: Track[], error?: string, taskId?: string, newId?: string) => void;
  updateTrackDuration: (trackId: string, duration: number) => void;
  deleteHistoryItem: (id: string) => void;
  clearHistory: () => void;
  setActiveItemId: (id: string | null) => void;

  setActiveTrackId: (id: string | null) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  loadSessionCredits: (credits: number) => void;
  mobileTab: 'create' | 'library' | 'details';
  setMobileTab: (tab: 'create' | 'library' | 'details') => void;
}


export const useMusicStore = create<MusicStore>((set) => ({
  creationMode: 'describe',
  prompt: '',
  lyrics: '',
  songTitle: '',
  musicStyle: '',
  outputType: 'vocal',
  vocalGender: 'auto',
  isAdvancedOpen: false,
  sunoModel: 'chirp-fenix',

  styleWeight: 0.5,
  creativity: 0.3,
  audioQuality: 0.5,
  negativeTags: '',

  credits: 20,
  showBillingModal: false,

  showAuthModal: false,
  authModalTab: 'login',

  enableReferenceFile: true,
  enableSunoConnect: true,
  remixStyles: [],
  selectedRemixStyleId: '',

  history: [],
  activeItemId: null,
  loadingHistory: true,
  activeTrackId: null,
  isPlaying: false,
  mobileTab: 'create',

  setCreationMode: (creationMode) => set({ creationMode }),
  setPrompt: (prompt) => set({ prompt }),
  setLyrics: (lyrics) => set({ lyrics }),
  setSongTitle: (songTitle) => set({ songTitle }),
  setMusicStyle: (musicStyle) => set({ musicStyle }),
  setOutputType: (outputType) => set({ outputType }),
  setVocalGender: (vocalGender) => set({ vocalGender }),
  setIsAdvancedOpen: (isAdvancedOpen) => set({ isAdvancedOpen }),
  setSunoModel: (sunoModel) => set({ sunoModel }),

  setStyleWeight: (styleWeight) => set({ styleWeight }),
  setCreativity: (creativity) => set({ creativity }),
  setAudioQuality: (audioQuality) => set({ audioQuality }),
  setNegativeTags: (negativeTags) => set({ negativeTags }),

  setCredits: (credits) => set({ credits }),
  addCredits: (amount) => set((state) => ({ credits: state.credits + amount })),
  setShowBillingModal: (showBillingModal) => set({ showBillingModal }),
  setShowAuthModal: (showAuthModal) => set({ showAuthModal }),
  setAuthModalTab: (authModalTab) => set({ authModalTab }),
  setEnableReferenceFile: (enableReferenceFile) => set({ enableReferenceFile }),
  setEnableSunoConnect: (enableSunoConnect) => set({ enableSunoConnect }),
  setRemixStyles: (remixStyles) => {
    set({ remixStyles });
    if (remixStyles.length > 0) {
      set((state) => {
        const isValid = remixStyles.some((s) => s.id === state.selectedRemixStyleId);
        return { selectedRemixStyleId: isValid ? state.selectedRemixStyleId : remixStyles[0].id };
      });
    }
  },
  setSelectedRemixStyleId: (selectedRemixStyleId) => set({ selectedRemixStyleId }),
  setLoadingHistory: (loadingHistory) => set({ loadingHistory }),

  setHistory: (history) => set({ history }),
  addHistoryItem: (item) => set((state) => ({
    history: [item, ...state.history],
    activeItemId: item.id
  })),
  updateHistoryItemStatus: (id, status, tracks, error, taskId, newId) => set((state) => ({
    history: state.history.map(item =>
      item.id === id
        ? {
            ...item,
            id: newId || item.id,
            status,
            ...(tracks ? { tracks } : {}),
            ...(error !== undefined ? { error } : {}),
            ...(taskId !== undefined ? { taskId } : {})
          }
        : item
    ),
    activeItemId: state.activeItemId === id ? (newId || id) : state.activeItemId
  })),
  deleteHistoryItem: (id) => {
    fetch(`/api/music/history?id=${id}`, { method: 'DELETE' })
      .catch((err) => console.error('Error deleting song:', err));
    set((state) => {
      const newHistory = state.history.filter(item => item.id !== id);
      const newActiveId = state.activeItemId === id 
        ? (newHistory[0]?.id ?? null) 
        : state.activeItemId;
      return {
        history: newHistory,
        activeItemId: newActiveId
      };
    });
  },
  updateTrackDuration: (trackId, duration) => set((state) => {
    const updatedHistory = state.history.map(item => {
      const hasTrack = item.tracks?.some(t => t.id === trackId);
      if (!hasTrack) return item;

      const updatedTracks = item.tracks.map(t =>
        t.id === trackId ? { ...t, duration } : t
      );

      // Async save to database
      fetch('/api/music/history', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ songId: item.id, tracks: updatedTracks })
      }).catch((err) => console.error('Error updating duration:', err));

      return {
        ...item,
        tracks: updatedTracks
      };
    });

    return { history: updatedHistory };
  }),
  clearHistory: () => set({ history: [], activeItemId: null, activeTrackId: null, isPlaying: false }),
  setActiveItemId: (activeItemId) => set({ activeItemId }),

  setActiveTrackId: (activeTrackId) => set({ activeTrackId }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  loadSessionCredits: (credits: number) => set({ credits }),
  setMobileTab: (mobileTab) => set({ mobileTab })
}));

