import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  Play,
  Pause,
  Undo,
  Redo,
  RotateCcw,
  Languages,
  Eraser,
  Sparkles,
  Trash2,
  Loader2,
  Settings,
  SkipBack,
  SkipForward,
  FastForward,
  Gauge,
  FileText,
  Eye,
  EyeOff,
  Type as StyleIcon,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  Info,
  Clock,
  HardDrive,
  FileVideo,
  Music,
  Download,
  Cpu,
  MessageSquare,
  ChevronDown,
  Check,
  BookOpen,
} from "lucide-react";
import { FileUploader } from "./components/FileUploader";
import { SubtitleView } from "./components/SubtitleView";
import { Timeline } from "./components/Timeline";
import { SettingsModal } from "./components/SettingsModal";
import { SubtitleStyleModal } from "./components/SubtitleStyleModal";
import { TranscriptionRulesModal } from "./components/TranscriptionRulesModal";
import { AppState, SubtitleItem, AppSettings, SubtitleStyle } from "./types";
import { Tooltip } from "./components/ui/Tooltip";
import { transcribeVideo, translateSubtitles } from "./services/geminiService";
import { extractAudio } from "./services/audioService";
import { parseSRT, parseVTT } from "./services/subtitleParser";
import { translations } from "./i18n";
import { getTranscriptionRules } from "./services/transcriptionRulesService";

const DEFAULT_SUBTITLE_STYLE: SubtitleStyle = {
  fontSize: 20,
  letterSpacing: 0,
  lineHeight: 1.2,
  textColor: "#ffffff",
  backgroundColor: "#ffffff",
  backgroundOpacity: 0.15,
  backgroundBorderRadius: 12,
  backgroundPaddingX: 20,
  backgroundPaddingY: 10,
  shadowColor: "rgba(0,0,0,0.2)",
  shadowBlur: 12,
  strokeColor: "#000000",
  strokeWidth: 0,
  verticalPosition: 85,
  fontFamily: "'Nunito', sans-serif",
  fontWeight: "900",
  fontStyle: "normal",
  textDecoration: "none",
};

import { SYSTEM_PROMPTS, AI_MODELS } from "./constants";
import { Toaster, toast } from "sonner";

export const DEFAULT_SETTINGS: AppSettings = {
  apiKeys: [],
  activeKeyId: null,
  language: "vi",
  theme: "dark",
  subtitleStyle: DEFAULT_SUBTITLE_STYLE,
  showOriginal: true,
  showTranslated: true,
  isSubtitleVisible: true,
  extractionModel: "gemini-2.5-flash",
  translationModel: "gemini-2.5-flash",
  selectedPromptId: "general",
  customPrompts: [],
  transcriptionPrompt: SYSTEM_PROMPTS[0].content,
  customModels: [],
};

// --- History Hook for Undo/Redo ---
function useSubtitleHistory(initialSubtitles: SubtitleItem[]) {
  const [historyState, setHistoryState] = useState({
    history: [initialSubtitles],
    index: 0
  });

  const stateRef = useRef(historyState);
  useEffect(() => {
    stateRef.current = historyState;
  }, [historyState]);

  const push = useCallback((newSubs: SubtitleItem[]) => {
    setHistoryState(prev => {
      const nextHistory = prev.history.slice(0, prev.index + 1);
      // Only push if different content
      if (JSON.stringify(nextHistory[nextHistory.length - 1]) === JSON.stringify(newSubs)) return prev;
      return {
        history: [...nextHistory, newSubs],
        index: prev.index + 1
      };
    });
  }, []);

  const undo = useCallback(() => {
    if (stateRef.current.index > 0) {
      const newIndex = stateRef.current.index - 1;
      const subs = stateRef.current.history[newIndex];
      setHistoryState(prev => ({ ...prev, index: newIndex }));
      return subs;
    }
    return null;
  }, []);

  const redo = useCallback(() => {
    if (stateRef.current.index < stateRef.current.history.length - 1) {
      const newIndex = stateRef.current.index + 1;
      const subs = stateRef.current.history[newIndex];
      setHistoryState(prev => ({ ...prev, index: newIndex }));
      return subs;
    }
    return null;
  }, []);

  const reset = useCallback((subs: SubtitleItem[]) => {
    setHistoryState({
      history: [subs],
      index: 0
    });
  }, []);

  return { 
    push, undo, redo, reset, 
    canUndo: historyState.index > 0, 
    canRedo: historyState.index < historyState.history.length - 1 
  };
}

export default function App() {
  const [state, setState] = useState<AppState>(() => {
    const saved = localStorage.getItem("zhiyu_settings");
    let settings = DEFAULT_SETTINGS;
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Migration: Remap deprecated model IDs
        const modelMigration: Record<string, string> = {
          "gemini-1.5-pro":         "gemini-2.5-pro",
          "gemini-1.5-flash":       "gemini-2.5-flash",
          "gemini-1.5-flash-8b":    "gemini-2.5-flash-lite",
          "gemini-2.0-flash-exp":   "gemini-2.5-flash",
          "gemini-2.0-flash":       "gemini-2.5-flash",
          "gemini-2.0-flash-lite":  "gemini-2.5-flash-lite",
        };
        if (modelMigration[parsed.extractionModel]) parsed.extractionModel = modelMigration[parsed.extractionModel];
        if (modelMigration[parsed.translationModel]) parsed.translationModel = modelMigration[parsed.translationModel];

        // Migration: Remap old prompt IDs to new IDs matching su-translate-main
        const promptMigration: Record<string, string> = {
          "speech-recognition": "general",
          "game-recognition":   "gaming",
          "hardsub-extraction": "extract-text",
          "combined-subtitle":  "combined-subtitles",
          "lyrics-extraction":  "focus-lyrics",
          "video-description":  "describe-video",
          "speaker-recognition":"diarize-speakers",
          "direct-translation": "translate-directly",
        };
        if (promptMigration[parsed.selectedPromptId]) {
          parsed.selectedPromptId = promptMigration[parsed.selectedPromptId];
        }

        settings = { ...DEFAULT_SETTINGS, ...parsed };
      } catch (e) {
        console.error("Failed to parse settings");
      }    }
    return {
      videoUrl: null,
      videoFile: null,
      subtitles: [],
      status: "idle",
      settings,
    };
  });

  const { push, undo, redo, reset: resetHistory, canUndo, canRedo } = useSubtitleHistory(state.subtitles);
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem("zhiyu_volume");
    return saved !== null ? parseFloat(saved) : 1;
  });
  const [isMuted, setIsMuted] = useState(() => {
    return localStorage.getItem("zhiyu_muted") === "true";
  });
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSubtitleStyleOpen, setIsSubtitleStyleOpen] = useState(false);
  const [isTranscriptionRulesOpen, setIsTranscriptionRulesOpen] = useState(false);
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const langMenuRef = useRef<HTMLDivElement>(null);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [isPromptDropdownOpen, setIsPromptDropdownOpen] = useState(false);
  const [dropdownDirection, setDropdownDirection] = useState<"up" | "down">("up");
  const modelBtnRef = useRef<HTMLButtonElement>(null);
  const promptBtnRef = useRef<HTMLButtonElement>(null);

  const toggleModelDropdown = () => {
    if (!isModelDropdownOpen && modelBtnRef.current) {
      const rect = modelBtnRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      // Prefer down unless there's clearly no room and there's more room above
      setDropdownDirection(spaceBelow > 300 ? "down" : rect.top > spaceBelow ? "up" : "down");
    }
    setIsModelDropdownOpen(!isModelDropdownOpen);
  };

  const togglePromptDropdown = () => {
    if (!isPromptDropdownOpen && promptBtnRef.current) {
      const rect = promptBtnRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      // Prefer down unless there's clearly no room and there's more room above
      setDropdownDirection(spaceBelow > 300 ? "down" : rect.top > spaceBelow ? "up" : "down");
    }
    setIsPromptDropdownOpen(!isPromptDropdownOpen);
  };
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const skipTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isLangMenuOpen && langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) {
        setIsLangMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isLangMenuOpen]);

  const t = translations[state.settings.language];

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch((err) => {
        console.error(
          `Error attempting to enable full-screen mode: ${err.message}`,
        );
      });
    } else {
      document.exitFullscreen();
    }
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 1500);
    }
  };

  useEffect(() => {
    if (!isPlaying) {
      setShowControls(true);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    } else {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 1500);
    }
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [isPlaying]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA" ||
        (document.activeElement as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        if (videoRef.current) {
          if (videoRef.current.paused) videoRef.current.play();
          else videoRef.current.pause();
        }
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        skip(-5);
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        skip(5);
      } else if ((e.code === "Delete" || e.code === "Backspace") && selectedSubId) {
        // Only delete if not focused on input
        handleDeleteSubtitle(selectedSubId);
      } else if ((e.ctrlKey || e.metaKey) && e.code === "KeyZ") {
        e.preventDefault();
        const prevSubs = undo();
        if (prevSubs) {
          setState(s => ({ ...s, subtitles: prevSubs }));
        }
      } else if ((e.ctrlKey || e.metaKey) && e.code === "KeyY") {
        e.preventDefault();
        const nextSubs = redo();
        if (nextSubs) {
          setState(s => ({ ...s, subtitles: nextSubs }));
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [videoDuration]);

  const togglePlay = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!videoRef.current) return;
    if (videoRef.current.paused) videoRef.current.play();
    else videoRef.current.pause();
  };

  useEffect(() => {
    localStorage.setItem("zhiyu_settings", JSON.stringify(state.settings));
    document.documentElement.classList.add("dark");
  }, [state.settings]);

  // Static favicon — chữ Z gradient xanh tím
  useEffect(() => {
    const SIZE = 32;
    const canvas = document.createElement("canvas");
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext("2d")!;
    const cx = SIZE / 2;
    const cy = SIZE / 2;
    const r = SIZE / 2 - 1;

    const grad = ctx.createLinearGradient(0, 0, SIZE, SIZE);
    grad.addColorStop(0, "#2563eb");
    grad.addColorStop(0.5, "#6366f1");
    grad.addColorStop(1, "#7c3aed");
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 18px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Z", cx, cy + 1);

    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = canvas.toDataURL("image/png");
  }, []);

  // Braille spinner trong tab title — 10fps khi đang xử lý
  useEffect(() => {
    const APP_NAME = "ZhiYu Subtitle";
    const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
    const isAnimated = ["processing", "transcribing", "translating"].includes(state.status);

    if (!isAnimated) {
      document.title = APP_NAME;
      return;
    }

    let frameIndex = 0;
    const interval = setInterval(() => {
      frameIndex = (frameIndex + 1) % FRAMES.length;
      document.title = `${FRAMES[frameIndex]} ${APP_NAME}`;
    }, 100); // 10fps

    return () => {
      clearInterval(interval);
      document.title = APP_NAME;
    };
  }, [state.status]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackSpeed;
      videoRef.current.volume = isMuted ? 0 : volume;
    }
  }, [playbackSpeed, volume, isMuted]);

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    localStorage.setItem("zhiyu_muted", String(newMuted));
  };

  const handleFileSelect = (file: File) => {
    const url = URL.createObjectURL(file);
    const isAudio = file.type.startsWith('audio/') || 
                    file.name.toLowerCase().endsWith('.mp3') || 
                    file.name.toLowerCase().endsWith('.wav') || 
                    file.name.toLowerCase().endsWith('.m4a');

    setState((prev) => ({
      ...prev,
      videoFile: file,
      videoUrl: url,
      status: isAudio ? "audio_extracted" : "idle",
      subtitles: [],
      error: undefined,
    }));
    toast.success(`${t.title}: Tải tệp thành công`, {
      description: isAudio ? `${file.name} (Audio)` : file.name,
    });
    if (isAudio) {
      toast.info("Tệp âm thanh được nhận diện: Bạn có thể bắt đầu chuyển âm ngay.");
    }
  };

  const handleUpdateSubtitle = React.useCallback((id: string, updates: Partial<SubtitleItem>) => {
    const newSubtitles = state.subtitles.map(sub => 
      sub.id === id ? { ...sub, ...updates } : sub
    );
    setState(prev => ({ ...prev, subtitles: newSubtitles }));
    push(newSubtitles);
  }, [state.subtitles, push]);

  const handleDeleteSubtitle = React.useCallback((id: string) => {
    const newSubtitles = state.subtitles.filter(sub => sub.id !== id);
    setState(prev => ({ ...prev, subtitles: newSubtitles }));
    push(newSubtitles);
    setSelectedSubId(null);
    toast.info("Đã xoá dòng phụ đề");
  }, [state.subtitles, push]);

  const handleAddSubtitle = React.useCallback((time: number) => {
    const newSub: SubtitleItem = {
      id: Math.random().toString(36).substr(2, 9),
      startTime: time,
      endTime: time + 3, 
      chinese: "",
      vietnamese: ""
    };
    
    const nextSub = state.subtitles.find(s => s.startTime > time);
    if (nextSub) {
      newSub.endTime = Math.min(time + 3, nextSub.startTime);
    }

    const newSubtitles = [...state.subtitles, newSub].sort((a, b) => a.startTime - b.startTime);
    setState(prev => ({ ...prev, subtitles: newSubtitles }));
    push(newSubtitles);
    toast.success("Đã thêm dòng phụ đề mới");
  }, [state.subtitles, push]);

  const handleSplitSubtitle = React.useCallback((id: string, time: number) => {
    const subIndex = state.subtitles.findIndex(s => s.id === id);
    if (subIndex === -1) return;
    
    const sub = state.subtitles[subIndex];
    if (time <= sub.startTime + 0.1 || time >= sub.endTime - 0.1) return;
    
    const sub1: SubtitleItem = { ...sub, endTime: time };
    const sub2: SubtitleItem = {
      ...sub,
      id: Math.random().toString(36).substr(2, 9),
      startTime: time,
    };
    
    const newSubtitles = [...state.subtitles];
    newSubtitles.splice(subIndex, 1, sub1, sub2);
    setState(prev => ({ ...prev, subtitles: newSubtitles }));
    push(newSubtitles);
    toast.success("Đã tách dòng phụ đề");
  }, [state.subtitles, push]);

  const handleMergeSubtitle = React.useCallback((id: string) => {
    const subIndex = state.subtitles.findIndex(s => s.id === id);
    if (subIndex === -1 || subIndex === state.subtitles.length - 1) return;
    
    const sub = state.subtitles[subIndex];
    const nextSub = state.subtitles[subIndex + 1];
    
    const merged: SubtitleItem = {
      ...sub,
      endTime: nextSub.endTime,
      chinese: [sub.chinese, nextSub.chinese].filter(Boolean).join(" "),
      vietnamese: [sub.vietnamese, nextSub.vietnamese].filter(Boolean).join(" ")
    };
    
    const newSubtitles = [...state.subtitles];
    newSubtitles.splice(subIndex, 2, merged);
    setState(prev => ({ ...prev, subtitles: newSubtitles }));
    push(newSubtitles);
    toast.success("Đã gộp phụ đề");
  }, [state.subtitles, push]);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1];
        resolve(base64);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const [isErrorDetailOpen, setIsErrorDetailOpen] = useState(false);
  const [errorDetail, setErrorDetail] = useState<any>(null);

  const getVietnameseErrorMessage = (err: any) => {
    const msg = err.message || JSON.stringify(err);
    if (msg.includes("404") || msg.includes("NOT_FOUND")) {
      return "Không tìm thấy mô hình AI hoặc tài nguyên (Lỗi 404). Vui lòng kiểm tra lại cài đặt Model ID.";
    }
    if (msg.includes("429") || msg.includes("quota")) {
      return "Hết hạn mức sử dụng (Lỗi 429). Vui lòng thử lại sau hoặc đổi API Key khác.";
    }
    if (msg.includes("403") || msg.includes("permission")) {
      return "Lỗi xác thực hoặc không có quyền (Lỗi 403). Kiểm tra lại API Key.";
    }
    if (msg.includes("API key not valid")) {
      return "API Key không hợp lệ. Vui lòng cập nhật key chính xác.";
    }
    if (msg.includes("Safety") || msg.includes("HARM_CATEGORY")) {
      return "Nội dung bị chặn do vi phạm chính sách an toàn của AI.";
    }
    if (msg.includes("NetworkError") || msg.includes("fetch")) {
      return "Lỗi kết nối mạng. Vui lòng kiểm tra internet.";
    }
    return "Đã xảy ra lỗi không xác định. Nhấn 'Xem chi tiết' để biết thêm.";
  };

  const handleKeyError = (id: string, error: any) => {
    setState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        apiKeys: prev.settings.apiKeys.map((k) =>
          k.id === id
            ? { ...k, status: "error" as const, errorCount: k.errorCount + 1 }
            : k,
        ),
      },
    }));
    console.warn(`API Key ${id} failed:`, error.message);
  };

  // Reset errorCount về 0 sau khi key dùng thành công
  const handleKeySuccess = (id: string) => {
    setState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        apiKeys: prev.settings.apiKeys.map((k) =>
          k.id === id && k.errorCount > 0
            ? { ...k, status: "active" as const, errorCount: 0 }
            : k,
        ),
      },
    }));
  };

  const handleStartTranscription = async () => {
    if (!state.videoFile) return;
    try {
      setState((prev) => ({
        ...prev,
        status: "transcribing",
        error: undefined,
      }));

      // Check if file is potentially too large for browser memory (OOM risk)
      if (state.videoFile.size > 200 * 1024 * 1024) {
        toast.warning("Tệp tin rất lớn. Quá trình xử lý có thể mất nhiều thời gian hoặc gây quá tải trình duyệt. Nên trích xuất âm thanh trước để tối ưu.");
      }

      const base64 = await fileToBase64(state.videoFile);
      
      // Simulate progress for transcription as it's a black box for now
      let prog = 0;
      const interval = setInterval(() => {
        // More frequent, smaller increments for smoother "real-time" feel
        const increment = Math.random() * (prog < 50 ? 2 : prog < 80 ? 0.5 : 0.1);
        prog = Math.min(98, prog + increment);
        setProgress(prog);
      }, 300);

      try {
        const res = await transcribeVideo(
          base64,
          state.videoFile.type,
          state.settings.apiKeys,
          state.settings.activeKeyId,
          state.settings.extractionModel,
          state.settings.transcriptionPrompt,
          handleKeyError,
          handleKeySuccess,
        );
        clearInterval(interval);
        setProgress(100);
        
        setState((prev) => ({ ...prev, subtitles: res, status: "completed" }));
        resetHistory(res);
        toast.success("Trích xuất phụ đề thành công", {
          description: `Tìm thấy ${res.length} đoạn hội thoại.`,
        });
      } catch (err) {
        clearInterval(interval);
        throw err;
      }
    } catch (err: any) {
      console.error("Transcription error:", err);
      const vnMappedError = getVietnameseErrorMessage(err);
      setState((prev) => ({
        ...prev,
        status: "error",
        error: vnMappedError,
      }));
      setErrorDetail(err);
      toast.error("Trích xuất phụ đề thất bại", {
        description: vnMappedError,
        action: {
          label: "Xem chi tiết",
          onClick: () => setIsErrorDetailOpen(true)
        },
        duration: 8000
      });
    }
  };

  const handleTranslate = async () => {
    if (state.subtitles.length === 0) return;
    try {
      setState((prev) => ({ ...prev, status: "translating" }));
      setProgress(0);
      
      // Batch translation — 50 items/batch để giữ context tốt hơn và giảm số request
      const batchSize = 50;
      const totalBatches = Math.ceil(state.subtitles.length / batchSize);
      let currentSubtitles = [...state.subtitles];
      
      for (let i = 0; i < totalBatches; i++) {
        const start = i * batchSize;
        const end = Math.min(start + batchSize, currentSubtitles.length);
        const batch = currentSubtitles.slice(start, end);
        
        const translatedBatch = await translateSubtitles(
          batch,
          state.settings.apiKeys,
          state.settings.activeKeyId,
          state.settings.translationModel,
          handleKeyError,
          handleKeySuccess,
        );
        
        // Update current version
        currentSubtitles = [
          ...currentSubtitles.slice(0, start),
          ...translatedBatch,
          ...currentSubtitles.slice(end)
        ];
        
        const currentProgress = Math.round(((i + 1) / totalBatches) * 100);
        setProgress(currentProgress);
        setState((prev) => ({ ...prev, subtitles: currentSubtitles }));
      }
      
      setState((prev) => ({
        ...prev,
        status: "completed",
      }));
      push(currentSubtitles);
      toast.success("Dịch phụ đề thành công");
    } catch (err: any) {
      const vnMappedError = getVietnameseErrorMessage(err);
      setState((prev) => ({
        ...prev,
        status: "error",
        error: vnMappedError,
      }));
      setErrorDetail(err);
      toast.error("Dịch phụ đề thất bại", {
        description: vnMappedError,
        action: {
          label: "Xem chi tiết",
          onClick: () => setIsErrorDetailOpen(true)
        },
        duration: 8000
      });
    }
  };

  const reset = () => {
    if (state.videoUrl) URL.revokeObjectURL(state.videoUrl);
    setState((prev) => ({
      ...prev,
      videoUrl: null,
      videoFile: null,
      subtitles: [],
      status: "idle",
    }));
    setCurrentTime(0);
    setVideoDuration(0);
    setPlaybackSpeed(1);
    toast.info("Đã đặt lại ứng dụng");
  };

  const handleExtractAudio = async () => {
    if (!state.videoFile) return;
    const isAudio = state.videoFile.type.startsWith('audio/') || 
                    state.videoFile.name.toLowerCase().endsWith('.mp3') || 
                    state.videoFile.name.toLowerCase().endsWith('.wav') || 
                    state.videoFile.name.toLowerCase().endsWith('.m4a');
    
    if (isAudio) {
      setState((prev) => ({ ...prev, status: "audio_extracted" }));
      toast.success("Sẵn sàng trích xuất", { description: "Tệp này đã là định dạng âm thanh." });
      return;
    }

    let interval: any;
    try {
      setState((prev) => ({ ...prev, status: "processing", error: undefined }));
      setProgress(0);
      
      // Simulate progress for extraction
      let prog = 0;
      interval = setInterval(() => {
        prog = Math.min(99, prog + (Math.random() * 15));
        setProgress(prog);
      }, 400);

      const audioBlob = await extractAudio(state.videoFile);
      clearInterval(interval);
      setProgress(100);
      const originalName = state.videoFile.name;
      const baseName = originalName.substring(0, originalName.lastIndexOf(".")) || originalName;
      const audioFileName = `${baseName}.mp3`;

      setState((prev) => ({
        ...prev,
        status: "audio_extracted",
        videoFile: new File([audioBlob], audioFileName, {
          type: "audio/mp3",
          lastModified: Date.now(),
        }),
      }));
      toast.success("Trích xuất âm thanh thành công", {
        description: "Đã chuyển đổi video thành âm thanh để tối ưu dung lượng.",
      });
    } catch (err: any) {
      if (interval) clearInterval(interval);
      console.error("Extraction error:", err);
      setState((prev) => ({
        ...prev,
        status: "error",
        error: err.message || "Extraction failed",
      }));
      toast.error("Trích xuất thất bại", {
        description: "Không thể trích xuất âm thanh. Trình duyệt của bạn có thể không hỗ trợ codec của video này.",
      });
    }
  };

  const skip = (seconds: number) => {
    if (videoRef.current) {
      const isConsecutive = skipTimeoutRef.current !== null;
      // If consecutive skip within 500ms, use 10s instead of 5s
      const skipAmount = isConsecutive ? (seconds > 0 ? 10 : -10) : seconds;

      const duration = videoRef.current.duration || videoDuration;
      videoRef.current.currentTime = Math.max(
        0,
        Math.min(duration, videoRef.current.currentTime + skipAmount),
      );

      // Reset skip timeout
      if (skipTimeoutRef.current) clearTimeout(skipTimeoutRef.current);
      skipTimeoutRef.current = setTimeout(() => {
        skipTimeoutRef.current = null;
      }, 500);
    }
  };

  const toggleSpeed = () => {
    const speeds = [1, 1.5, 2];
    const nextIndex = (speeds.indexOf(playbackSpeed) + 1) % speeds.length;
    setPlaybackSpeed(speeds[nextIndex]);
  };

  const handleSubtitleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      let subs: SubtitleItem[] = [];

      if (file.name.toLowerCase().endsWith(".srt")) {
        subs = parseSRT(text);
      } else if (file.name.toLowerCase().endsWith(".vtt")) {
        subs = parseVTT(text);
      }

      if (subs.length > 0) {
        setState((prev) => ({ ...prev, subtitles: subs, status: "completed" }));
        toast.success("Tải phụ đề thành công", {
          description: `Đã nhập ${subs.length} đoạn phụ đề từ tệp ${file.name}`,
        });
      }
    };
    reader.readAsText(file);
    // Reset input
    e.target.value = "";
  };

  const onSeek = React.useCallback((t: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = t;
      setCurrentTime(t);
    }
  }, []);

  const activeSub = useMemo(() => 
    state.subtitles.find(
      (s) => currentTime >= s.startTime && currentTime <= s.endTime,
    ),
    [state.subtitles, currentTime]
  );

  // We use the event handlers on the video tag directly for better reliability
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed, state.videoUrl]);

  return (
    <div
      className="min-h-screen flex flex-col transition-colors duration-300 bg-zinc-950 text-zinc-100"
    >
      {/* Header */}
      <header
        className="header-border-flow h-16 border-b flex items-center justify-between px-6 md:px-10 shrink-0 z-50 backdrop-blur-xl transition-all duration-300 bg-zinc-950/80 border-zinc-800 shadow-xl shadow-black/20 relative"
      >
        {/* Subtle glass shine animation */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div 
            animate={{ x: ["-100%", "200%"] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", repeatDelay: 3 }}
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent skew-x-[-20deg]"
          />
        </div>

        <div className="flex items-center gap-4 relative">
          {/* Logo Glow */}
          <div className="absolute -inset-4 bg-blue-500/10 blur-2xl rounded-full opacity-50" />
          
          <div className="relative group">
            {/* Rotating border decoration */}
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
              className="absolute -inset-1 border border-dashed border-blue-400/30 rounded-2xl"
            />
            
            <motion.div 
              whileHover={{ scale: 1.05, rotate: 8 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="w-10 h-10 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/30 cursor-pointer relative overflow-hidden z-10"
            >
              <motion.div 
                animate={{ 
                  opacity: [0, 1, 0],
                  scale: [0.8, 1.2, 0.8]
                }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent pointer-events-none"
              />
              <Sparkles className="w-5 h-5 text-white z-10" />
            </motion.div>
          </div>

          <div className="hidden sm:block relative z-10">
            <div className="flex items-center gap-2 mb-0.5">
              <motion.h1 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ opacity: { duration: 0.5 }, x: { duration: 0.5 } }}
                className="title-rainbow font-black text-xl leading-tight tracking-tighter"
              >
                {t.title}
              </motion.h1>
              
              {/* Status Badge */}
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-zinc-900/50 border border-zinc-800 text-[8px] font-black text-zinc-500 tracking-widest uppercase">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                </span>
                AI LIVE
              </div>
            </div>
            
            <motion.p 
              initial={{ opacity: 0, x: -10 }}
              animate={{ 
                opacity: 1, 
                x: 0,
                backgroundPosition: ["100% 50%", "0% 50%", "100% 50%"],
              }}
              transition={{ 
                delay: 0.1,
                opacity: { duration: 0.5 },
                x: { duration: 0.5 },
                backgroundPosition: { duration: 12, repeat: Infinity, ease: "linear" }
              }}
              className="text-[9px] uppercase font-black tracking-[0.4em] bg-gradient-to-r from-zinc-500 via-zinc-400 to-zinc-600 bg-[size:200%_auto] bg-clip-text text-transparent"
            >
              {t.subtitle}
            </motion.p>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-4">
          <div className="relative" ref={langMenuRef}>
            <button
              onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-xs font-bold uppercase tracking-wider border relative z-50 outline-none ${
                isLangMenuOpen ? "bg-zinc-800 border-zinc-700 text-white shadow-xl shadow-black/40" : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white"
              }`}
            >
              <Languages className="w-4 h-4" />
              <span className="hidden sm:inline">
                {state.settings.language}
              </span>
            </button>

            <AnimatePresence>
              {isLangMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95, x: "-50%" }}
                  animate={{ opacity: 1, y: 0, scale: 1, x: "-50%" }}
                  exit={{ opacity: 0, y: 10, scale: 0.95, x: "-50%" }}
                  className="absolute top-[calc(100%+8px)] left-1/2 w-48 rounded-xl shadow-2xl border z-[60] overflow-hidden backdrop-blur-xl bg-zinc-900/95 border-zinc-800"
                >
                  <div className="p-1 space-y-0.5">
                    {(["en", "vi", "zh", "ja", "ko"] as const).map((lang) => (
                        <button
                          key={lang}
                          onClick={() => {
                            setState((prev) => ({
                              ...prev,
                              settings: { ...prev.settings, language: lang },
                            }));
                            setIsLangMenuOpen(false);
                          }}
                          className={`w-full text-left px-4 py-2.5 text-[11px] font-bold transition-all rounded-lg
                            ${
                              state.settings.language === lang
                                ? "bg-blue-600 text-white"
                                : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                            }
                          `}
                        >
                          {lang === "en"
                            ? "English (Tiếng Anh)"
                            : lang === "vi"
                              ? "Tiếng Việt"
                              : lang === "zh"
                                ? "中文 (Tiếng Trung)"
                                : lang === "ja"
                                  ? "日本語 (Tiếng Nhật)"
                                  : "한국어 (Tiếng Hàn)"}
                        </button>
                      ))}
                    </div>
                  </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 rounded-lg transition-all text-zinc-400 hover:text-white hover:bg-zinc-800"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center">
        <div className="w-full max-w-[80vw] px-4 py-8 space-y-8">
          {/* Section 1: Upload */}
          {!state.videoUrl && (
            <section className="animate-in fade-in slide-in-from-bottom-4 duration-700">
              <FileUploader
                onFileSelect={handleFileSelect}
                isLoading={state.status.includes("ing")}
                language={state.settings.language}
              />
            </section>
          )}

          {state.videoUrl && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Section 2: Player */}
              <section className="space-y-4">
                <motion.div
                  layout
                  ref={containerRef}
                  onMouseMove={handleMouseMove}
                  onClick={togglePlay}
                  className={`aspect-video overflow-hidden shadow-2xl relative border group
                    bg-black border-zinc-800
                    ${isFullscreen ? "fixed inset-0 z-[200] rounded-none border-0" : "rounded-3xl"}
                    ${!showControls && isPlaying ? "cursor-none" : "cursor-pointer"}
                  `}
                  transition={{ type: "spring", stiffness: 300, damping: 35 }}
                >
                  {/* Dynamic Progress Bar (Top) */}
                  <AnimatePresence>
                    {state.status.includes("ing") && (
                      <motion.div 
                        initial={{ opacity: 0, scaleY: 0 }}
                        animate={{ opacity: 1, scaleY: 1 }}
                        exit={{ opacity: 0, scaleY: 0 }}
                        className="absolute top-0 left-0 right-0 h-1.5 z-[150] overflow-hidden bg-white/5"
                      >
                        <motion.div 
                          className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"
                          animate={{ width: `${progress}%` }}
                          transition={{ type: "spring", stiffness: 50, damping: 20 }}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <motion.video
                    layout
                    ref={videoRef}
                    src={state.videoUrl}
                    className="w-full h-full object-contain"
                    playsInline
                    onClick={togglePlay}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onTimeUpdate={(e) =>
                      setCurrentTime(e.currentTarget.currentTime)
                    }
                    onLoadedMetadata={(e) =>
                      setVideoDuration(e.currentTarget.duration)
                    }
                    onVolumeChange={(e) => {
                      const vol = e.currentTarget.volume;
                      const muted = e.currentTarget.muted;
                      setVolume(vol);
                      setIsMuted(muted);
                      localStorage.setItem("zhiyu_volume", String(vol));
                      localStorage.setItem("zhiyu_muted", String(muted));
                    }}
                  />

                  {/* Top Right Controls: Subtitles */}
                  <div
                    className={`absolute top-4 right-4 z-20 flex flex-col gap-2 transition-opacity duration-300 ${showControls ? "opacity-100" : "opacity-0 pointer-events-none"}`}
                  >
                    <div className="flex items-center bg-black/60 rounded-xl p-1 backdrop-blur-xl border border-white/10 shadow-2xl gap-1">
                      <Tooltip content={t.showOriginal}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setState((prev) => ({
                              ...prev,
                              settings: { ...prev.settings, showOriginal: !prev.settings.showOriginal },
                            }));
                          }}
                          className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all ${state.settings.showOriginal ? "bg-white/20 text-white" : "text-white/30 hover:text-white"}`}
                        >
                          {t.showOriginal}
                        </button>
                      </Tooltip>
                      <Tooltip content={t.showTranslated}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setState((prev) => ({
                              ...prev,
                              settings: { ...prev.settings, showTranslated: !prev.settings.showTranslated },
                            }));
                          }}
                          className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all ${state.settings.showTranslated ? "bg-white/20 text-white" : "text-white/30 hover:text-white"}`}
                        >
                          {t.showTranslated}
                        </button>
                      </Tooltip>
                      <div className="w-px h-4 bg-white/10 mx-0.5" />
                      <Tooltip content="Tùy chỉnh kiểu phụ đề">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsSubtitleStyleOpen(true);
                          }}
                          className="px-2.5 py-1.5 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                        >
                          <StyleIcon className="w-3.5 h-3.5" />
                        </button>
                      </Tooltip>
                    </div>
                  </div>

                  {/* Subtitle Overlay */}
                  {state.settings.isSubtitleVisible && activeSub && (() => {
                    const showOrig = state.settings.showOriginal;
                    const showTrans = state.settings.showTranslated && !!activeSub.vietnamese;
                    const bothActive = showOrig && showTrans;

                    // Dòng trên: gốc (trắng) khi cả 2 bật, hoặc dòng duy nhất khi chỉ 1 bật
                    const topText = showOrig ? activeSub.chinese : (showTrans ? activeSub.vietnamese : null);
                    // Dòng dưới: dịch (xanh) chỉ khi cả 2 bật
                    const bottomText = bothActive ? activeSub.vietnamese : null;

                    if (!topText) return null;

                    const bgStyle = state.settings.subtitleStyle.backgroundOpacity > 0 ? {
                      backgroundColor: `rgba(${parseInt(state.settings.subtitleStyle.backgroundColor.slice(1,3),16)}, ${parseInt(state.settings.subtitleStyle.backgroundColor.slice(3,5),16)}, ${parseInt(state.settings.subtitleStyle.backgroundColor.slice(5,7),16)}, ${state.settings.subtitleStyle.backgroundOpacity})`,
                      borderRadius: `${state.settings.subtitleStyle.backgroundBorderRadius}px`,
                      padding: `${state.settings.subtitleStyle.backgroundPaddingY}px ${state.settings.subtitleStyle.backgroundPaddingX}px`,
                    } : {};
                    const bgClass = state.settings.subtitleStyle.backgroundOpacity > 0
                      ? "backdrop-blur-lg [backdrop-filter:blur(8px)_saturate(180%)] text-center shadow-2xl border border-white/20 flex items-center justify-center"
                      : "text-center";

                    const baseTextStyle = {
                      letterSpacing: `${state.settings.subtitleStyle.letterSpacing}px`,
                      lineHeight: 1,
                      fontFamily: state.settings.subtitleStyle.fontFamily,
                      fontWeight: state.settings.subtitleStyle.fontWeight,
                      fontStyle: state.settings.subtitleStyle.fontStyle,
                      textDecoration: state.settings.subtitleStyle.textDecoration,
                      textShadow: `0 0 ${state.settings.subtitleStyle.shadowBlur}px ${state.settings.subtitleStyle.shadowColor}`,
                      paintOrder: "stroke fill" as const,
                      whiteSpace: "nowrap" as const,
                    };

                    return (
                      <div
                        className="absolute left-0 right-0 px-8 pointer-events-none flex flex-col items-center gap-2 z-10"
                        style={{
                          top: `${state.settings.subtitleStyle.verticalPosition}%`,
                          transform: "translateY(-50%)",
                        }}
                      >
                        <AnimatePresence mode="popLayout" initial={false}>
                          {/* Dòng trên — luôn trắng */}
                          <motion.div
                            key={`top-${activeSub.id}`}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.1, ease: "linear" }}
                            style={bgStyle}
                            className={bgClass}
                          >
                            <p
                              style={{
                                ...baseTextStyle,
                                fontSize: `${state.settings.subtitleStyle.fontSize}px`,
                                color: state.settings.subtitleStyle.textColor,
                                WebkitTextStroke: `${state.settings.subtitleStyle.strokeWidth}px ${state.settings.subtitleStyle.strokeColor}`,
                                whiteSpace: 'pre-wrap',
                              }}
                              className="font-bold tracking-wide"
                            >
                              {topText}
                            </p>
                          </motion.div>

                          {/* Dòng dưới — xanh, chỉ hiện khi cả 2 bật */}
                          {bottomText && (
                            <motion.div
                              key={`bottom-${activeSub.id}`}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.1, ease: "linear" }}
                              style={bgStyle}
                              className={bgClass}
                            >
                              <p
                                style={{
                                  ...baseTextStyle,
                                  fontSize: `${state.settings.subtitleStyle.fontSize * 0.8}px`,
                                  color: '#60a5fa',
                                  fontStyle: baseTextStyle.fontStyle === 'normal' ? 'italic' : baseTextStyle.fontStyle,
                                  WebkitTextStroke: `${state.settings.subtitleStyle.strokeWidth * 0.8}px ${state.settings.subtitleStyle.strokeColor}`,
                                  whiteSpace: 'pre-wrap',
                                }}
                                className="font-medium tracking-wide"
                              >
                                {bottomText}
                              </p>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })()}

                  {/* Internal Player Controls */}
                  <div
                    onClick={togglePlay}
                    className={`absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent transition-opacity duration-300 flex flex-col justify-end p-4 ${showControls ? "opacity-100" : "opacity-0 pointer-events-none"}`}
                  >
                    <div className="flex flex-col gap-2">
                      {/* Integrated Progress Bar */}
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-mono text-white/70 w-10 text-right">
                          {formatTime(currentTime)}
                        </span>
                        <Tooltip content="Lùi 10 giây" className="flex-1">
                          <div
                            className="h-1.5 bg-white/20 rounded-full relative overflow-hidden cursor-pointer backdrop-blur-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              const rect =
                                e.currentTarget.getBoundingClientRect();
                              const x = e.clientX - rect.left;
                              if (videoRef.current)
                                videoRef.current.currentTime =
                                  (x / rect.width) * videoDuration;
                            }}
                          >
                            <div
                              className="absolute h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]"
                              style={{
                                width: `${(currentTime / (videoDuration || 1)) * 100}%`,
                              }}
                            />
                          </div>
                        </Tooltip>
                        <span className="text-[10px] font-mono text-white/70 w-10">
                          {formatTime(videoDuration)}
                        </span>
                      </div>

                      {/* Control Buttons Area */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 sm:gap-2">
                          <Tooltip content={isPlaying ? "Tạm dừng (Space)" : "Phát (Space)"}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                isPlaying
                                  ? videoRef.current?.pause()
                                  : videoRef.current?.play();
                              }}
                              className="p-2 text-white hover:scale-110 transition-transform"
                            >
                              {isPlaying ? (
                                <Pause className="w-6 h-6 fill-current" />
                              ) : (
                                <Play className="w-6 h-6 fill-current" />
                              )}
                            </button>
                          </Tooltip>

                          <Tooltip content="Lùi 5s (←)">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                skip(-5);
                              }}
                              className="p-2 text-white/70 hover:text-white transition-colors"
                            >
                              <SkipBack className="w-5 h-5" />
                            </button>
                          </Tooltip>

                          <Tooltip content="Tiến 5s (→)">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                skip(5);
                              }}
                              className="p-2 text-white/70 hover:text-white transition-colors"
                            >
                              <SkipForward className="w-5 h-5" />
                            </button>
                          </Tooltip>

                          <Tooltip content="Tốc độ phát">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleSpeed();
                              }}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold transition-all ml-2"
                            >
                              <Gauge className="w-3.5 h-3.5" />
                              {playbackSpeed}x
                            </button>
                          </Tooltip>

                          {/* Volume Control */}
                          <div className="flex items-center gap-2 ml-4 group/vol">
                            <button
                              onClick={toggleMute}
                              className="p-2 text-white/70 hover:text-white transition-colors"
                            >
                              {isMuted || volume === 0 ? (
                                <VolumeX className="w-5 h-5" />
                              ) : (
                                <Volume2 className="w-5 h-5" />
                              )}
                            </button>
                            <div className="w-0 group-hover/vol:w-24 transition-all duration-300 overflow-hidden flex items-center">
                              <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.01"
                                value={isMuted ? 0 : volume}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  setVolume(val);
                                  localStorage.setItem("zhiyu_volume", String(val));
                                  if (val > 0) {
                                    setIsMuted(false);
                                    localStorage.setItem("zhiyu_muted", "false");
                                  }
                                  if (videoRef.current)
                                    videoRef.current.volume = val;
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="w-20 h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-blue-500"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 sm:gap-4">
                          {/* Status Badge */}
                          <div className="px-3 py-2 bg-blue-600/40 backdrop-blur-xl rounded-xl border border-blue-400/20 text-[10px] font-mono uppercase tracking-widest text-white shadow-lg">
                            {state.status.includes("ing") ? (
                              <span className="flex items-center gap-1.5">
                                <Loader2 className="w-3 h-3 animate-spin" />{" "}
                                {state.status}
                              </span>
                            ) : (
                              state.status
                            )}
                          </div>

                          <Tooltip content={isFullscreen ? "Thoát toàn màn hình" : "Toàn màn hình"}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFullscreen();
                              }}
                              className="p-2 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all backdrop-blur-xl border border-white/10 shadow-lg"
                            >
                              {isFullscreen ? (
                                <Minimize2 className="w-4 h-4" />
                              ) : (
                                <Maximize2 className="w-4 h-4" />
                              )}
                            </button>
                          </Tooltip>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </section>

              {!isFullscreen && (
                <>
                  {/* Video Info Card */}
                  <section
                    className="px-6 py-5 rounded-3xl border flex flex-col gap-5 bg-zinc-900/50 border-zinc-800"
                  >
                {/* File Name Row */}
                <div className="flex items-center gap-4 pb-4 border-b border-zinc-800/50">
                  <div className="w-10 h-10 rounded-xl bg-blue-600/10 flex items-center justify-center text-blue-500 shrink-0 shadow-sm">
                    <FileVideo className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase font-black text-zinc-500 tracking-widest mb-0.5">
                      {(t as any).fileName}
                    </p>
                    <Tooltip content={state.videoFile?.name} className="max-w-full">
                      <h3
                        className="text-lg font-black truncate leading-tight"
                      >
                        {state.videoFile?.name}
                      </h3>
                    </Tooltip>
                  </div>
                </div>

                {/* Metadata Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-y-6 gap-x-4 sm:gap-x-8 items-center">
                  {/* Size */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-purple-600/10 flex items-center justify-center text-purple-500 shadow-sm shrink-0">
                      <HardDrive className="w-4.5 h-4.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider mb-0.5">
                        {(t as any).fileSize}
                      </p>
                      <p className="text-sm font-bold leading-none truncate">
                        {state.videoFile
                          ? formatFileSize(state.videoFile.size)
                          : "--"}
                      </p>
                    </div>
                  </div>

                  {/* Duration */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-emerald-600/10 flex items-center justify-center text-emerald-500 shadow-sm shrink-0">
                      <Clock className="w-4.5 h-4.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider mb-0.5">
                        {(t as any).duration}
                      </p>
                      <p className="text-sm font-bold leading-none truncate">
                        {formatTime(videoDuration)}
                      </p>
                    </div>
                  </div>

                  {/* Format */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-orange-600/10 flex items-center justify-center text-orange-500 shadow-sm shrink-0">
                      <Info className="w-4.5 h-4.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider mb-0.5">
                        {(t as any).format}
                      </p>
                      <p className="text-sm font-bold uppercase leading-none truncate">
                        {state.videoFile?.name.split(".").pop() || "Unknown"}
                      </p>
                    </div>
                  </div>

                  {/* Model */}
                  <div className="relative min-w-0">
                    <button
                      ref={modelBtnRef}
                      onClick={toggleModelDropdown}
                      onBlur={() => setTimeout(() => setIsModelDropdownOpen(false), 200)}
                      className="flex items-center gap-3 text-left p-1.5 -m-1.5 rounded-xl transition-all w-full hover:bg-white/5"
                    >
                      <div className="w-9 h-9 rounded-xl bg-blue-600/10 flex items-center justify-center text-blue-500 shadow-sm shrink-0">
                        <Cpu className="w-4.5 h-4.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider mb-0.5 flex items-center gap-1">
                          {(t as any).model}
                          <ChevronDown className={`w-3 h-3 transition-transform ${isModelDropdownOpen ? "rotate-180" : ""}`} />
                        </p>
                        <p className="text-sm font-bold leading-none truncate">
                          {AI_MODELS.find((m) => m.id === state.settings.extractionModel)?.label || state.settings.extractionModel}
                        </p>
                      </div>
                    </button>

                    <AnimatePresence>
                      {isModelDropdownOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: dropdownDirection === "up" ? 10 : -10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: dropdownDirection === "up" ? 10 : -10, scale: 0.95 }}
                          className={`absolute ${dropdownDirection === "up" ? "bottom-full mb-4" : "top-full mt-4"} left-0 w-56 rounded-xl border shadow-2xl z-[100] bg-zinc-900 border-zinc-800`}
                        >
                          <div className="px-3 py-2 text-xs font-black text-blue-500 uppercase tracking-widest border-b border-blue-500/10">
                            Chọn Mô Hình AI
                          </div>
                          <div className="p-2 max-h-64 overflow-y-auto custom-scrollbar">
                          {AI_MODELS.map((model) => {
                            const isActive = state.settings.extractionModel === model.id;

                            // Lấy màu trực tiếp từ AI_MODELS — không cần map riêng
                            const colorClasses: Record<string, string> = {
                              amber:   isActive ? "bg-amber-600   text-white shadow-lg shadow-amber-600/30"   : "text-amber-400/70   hover:bg-amber-600/10   hover:text-amber-400",
                              emerald: isActive ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/30" : "text-emerald-400/70 hover:bg-emerald-600/10 hover:text-emerald-400",
                              blue:    isActive ? "bg-blue-600    text-white shadow-lg shadow-blue-600/30"    : "text-blue-400/70    hover:bg-blue-600/10    hover:text-blue-400",
                              violet:  isActive ? "bg-violet-600  text-white shadow-lg shadow-violet-600/30"  : "text-violet-400/70  hover:bg-violet-600/10  hover:text-violet-400",
                              rose:    isActive ? "bg-rose-600    text-white shadow-lg shadow-rose-600/30"    : "text-rose-400/70    hover:bg-rose-600/10    hover:text-rose-400",
                              teal:    isActive ? "bg-teal-600    text-white shadow-lg shadow-teal-600/30"    : "text-teal-400/70    hover:bg-teal-600/10    hover:text-teal-400",
                              cyan:    isActive ? "bg-cyan-600    text-white shadow-lg shadow-cyan-600/30"    : "text-cyan-400/70    hover:bg-cyan-600/10    hover:text-cyan-400",
                              indigo:  isActive ? "bg-indigo-600  text-white shadow-lg shadow-indigo-600/30"  : "text-indigo-400/70  hover:bg-indigo-600/10  hover:text-indigo-400",
                              purple:  isActive ? "bg-purple-600  text-white shadow-lg shadow-purple-600/30"  : "text-purple-400/70  hover:bg-purple-600/10  hover:text-purple-400",
                            };
                            const cls = colorClasses[model.color] ?? colorClasses.purple;

                            return (
                              <button
                                key={model.id}
                                onClick={() => {
                                  setState((prev) => ({
                                    ...prev,
                                    settings: {
                                      ...prev.settings,
                                      extractionModel: model.id,
                                      translationModel: model.id,
                                    },
                                  }));
                                  setIsModelDropdownOpen(false);
                                }}
                                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-bold transition-all mb-0.5 ${cls}`}
                              >
                                {model.label}
                                {state.settings.extractionModel === model.id && (
                                  <Check className="w-4 h-4" />
                                )}
                              </button>
                            );
                          })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Prompt */}
                  <div className="relative min-w-0">
                    <button
                      ref={promptBtnRef}
                      onClick={togglePromptDropdown}
                      onBlur={() => setTimeout(() => setIsPromptDropdownOpen(false), 200)}
                      className="flex items-center gap-3 text-left p-1.5 -m-1.5 rounded-xl transition-all w-full hover:bg-white/5"
                    >
                      <div className="w-9 h-9 rounded-xl bg-orange-600/10 flex items-center justify-center text-orange-500 shadow-sm shrink-0">
                        <MessageSquare className="w-4.5 h-4.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider mb-0.5 flex items-center gap-1">
                          {(t as any).prompt}
                          <ChevronDown className={`w-3 h-3 transition-transform ${isPromptDropdownOpen ? "rotate-180" : ""}`} />
                        </p>
                        <p className="text-sm font-bold truncate leading-none">
                          {SYSTEM_PROMPTS.concat(state.settings.customPrompts).find(
                            (p) => p.id === state.settings.selectedPromptId,
                          )?.title || "Custom"}
                        </p>
                      </div>
                    </button>

                    <AnimatePresence>
                      {isPromptDropdownOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: dropdownDirection === "up" ? 10 : -10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: dropdownDirection === "up" ? 10 : -10, scale: 0.95 }}
                          className={`absolute ${dropdownDirection === "up" ? "bottom-full mb-4" : "top-full mt-4"} left-0 w-72 rounded-xl border shadow-2xl z-[100] bg-zinc-900 border-zinc-800`}
                        >
                          <div className="px-3 py-2 text-xs font-black text-orange-500 uppercase tracking-widest border-b border-orange-500/10">
                            Chọn Chế Độ Prompt
                          </div>
                          <div className="p-2 max-h-72 overflow-y-auto custom-scrollbar">                          {SYSTEM_PROMPTS.concat(state.settings.customPrompts || []).map(
                            (prompt) => {
                              const isActive = state.settings.selectedPromptId === prompt.id;

                              // Map màu cho system prompts; custom prompts dùng màu lưu trong object (nếu có) hoặc cycle
                              const SYSTEM_COLOR_MAP: Record<string, string> = {
                                'general':            'purple',
                                'gaming':             'rose',
                                'extract-text':       'emerald',
                                'combined-subtitles': 'orange',
                                'focus-lyrics':       'amber',
                                'describe-video':     'pink',
                                'chaptering':         'indigo',
                                'diarize-speakers':   'yellow',
                                'translate-directly': 'cyan',
                              };
                              const CUSTOM_COLORS = ['violet', 'teal', 'sky', 'lime', 'fuchsia', 'red'];
                              let colorKey: string;
                              if (SYSTEM_COLOR_MAP[prompt.id]) {
                                colorKey = SYSTEM_COLOR_MAP[prompt.id];
                              } else {
                                // Custom prompt: cycle màu theo index trong danh sách custom
                                const customIdx = (state.settings.customPrompts || []).findIndex(p => p.id === prompt.id);
                                colorKey = CUSTOM_COLORS[customIdx % CUSTOM_COLORS.length] ?? 'zinc';
                              }

                              const ALL_COLORS = ['purple','rose','emerald','orange','amber','pink','indigo','yellow','cyan','violet','teal','sky','lime','fuchsia','red','zinc'];
                              const colorClasses: Record<string, string> = {
                                purple:  isActive ? "bg-purple-600  text-white shadow-lg shadow-purple-600/30"  : "text-purple-400/70  hover:bg-purple-600/10  hover:text-purple-400",
                                rose:    isActive ? "bg-rose-600    text-white shadow-lg shadow-rose-600/30"    : "text-rose-400/70    hover:bg-rose-600/10    hover:text-rose-400",
                                emerald: isActive ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/30" : "text-emerald-400/70 hover:bg-emerald-600/10 hover:text-emerald-400",
                                orange:  isActive ? "bg-orange-600  text-white shadow-lg shadow-orange-600/30"  : "text-orange-400/70  hover:bg-orange-600/10  hover:text-orange-400",
                                amber:   isActive ? "bg-amber-600   text-white shadow-lg shadow-amber-600/30"   : "text-amber-400/70   hover:bg-amber-600/10   hover:text-amber-400",
                                pink:    isActive ? "bg-pink-600    text-white shadow-lg shadow-pink-600/30"    : "text-pink-400/70    hover:bg-pink-600/10    hover:text-pink-400",
                                indigo:  isActive ? "bg-indigo-600  text-white shadow-lg shadow-indigo-600/30"  : "text-indigo-400/70  hover:bg-indigo-600/10  hover:text-indigo-400",
                                yellow:  isActive ? "bg-yellow-600  text-white shadow-lg shadow-yellow-600/30"  : "text-yellow-400/70  hover:bg-yellow-600/10  hover:text-yellow-400",
                                cyan:    isActive ? "bg-cyan-600    text-white shadow-lg shadow-cyan-600/30"    : "text-cyan-400/70    hover:bg-cyan-600/10    hover:text-cyan-400",
                                violet:  isActive ? "bg-violet-600  text-white shadow-lg shadow-violet-600/30"  : "text-violet-400/70  hover:bg-violet-600/10  hover:text-violet-400",
                                teal:    isActive ? "bg-teal-600    text-white shadow-lg shadow-teal-600/30"    : "text-teal-400/70    hover:bg-teal-600/10    hover:text-teal-400",
                                sky:     isActive ? "bg-sky-600     text-white shadow-lg shadow-sky-600/30"     : "text-sky-400/70     hover:bg-sky-600/10     hover:text-sky-400",
                                lime:    isActive ? "bg-lime-600    text-white shadow-lg shadow-lime-600/30"    : "text-lime-400/70    hover:bg-lime-600/10    hover:text-lime-400",
                                fuchsia: isActive ? "bg-fuchsia-600 text-white shadow-lg shadow-fuchsia-600/30" : "text-fuchsia-400/70 hover:bg-fuchsia-600/10 hover:text-fuchsia-400",
                                red:     isActive ? "bg-red-600     text-white shadow-lg shadow-red-600/30"     : "text-red-400/70     hover:bg-red-600/10     hover:text-red-400",
                                zinc:    isActive ? "bg-zinc-600    text-white shadow-lg shadow-zinc-600/30"    : "text-zinc-400       hover:bg-zinc-600/10    hover:text-zinc-400",
                              };

                              return (
                                <button
                                  key={prompt.id}
                                  onClick={() => {
                                    setState((prev) => ({
                                      ...prev,
                                      settings: {
                                        ...prev.settings,
                                        selectedPromptId: prompt.id,
                                        transcriptionPrompt: prompt.content,
                                      },
                                    }));
                                    setIsPromptDropdownOpen(false);
                                  }}
                                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-bold transition-all mb-0.5 ${colorClasses[colorKey]}`}
                                >
                                  <span className="truncate pr-4">{prompt.title}</span>
                                  {state.settings.selectedPromptId ===
                                    prompt.id && <Check className="w-3.5 h-3.5 shrink-0" />}
                                </button>
                              );
                            },
                          )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </section>

              {/* Timeline Section */}
              {state.subtitles.length > 0 && (
                <Timeline 
                  subtitles={state.subtitles}
                  duration={videoDuration}
                  currentTime={currentTime}
                  onSeek={(t) => {
                    if (videoRef.current) {
                      videoRef.current.currentTime = t;
                      setCurrentTime(t);
                    }
                  }}
                  onUpdateSubtitle={handleUpdateSubtitle}
                  onDeleteSubtitle={handleDeleteSubtitle}
                  onAddSubtitle={handleAddSubtitle}
                  onSplitSubtitle={handleSplitSubtitle}
                  onMergeSubtitle={handleMergeSubtitle}
                  selectedId={selectedSubId}
                  onSelect={setSelectedSubId}
                  isDark={true}
                />
              )}

              {/* Action Area */}
              <section className="flex flex-col sm:flex-row gap-3">
                <input
                  type="file"
                  id="sub-upload"
                  accept=".srt,.vtt"
                  className="hidden"
                  onChange={handleSubtitleUpload}
                />

                <Tooltip content={(t as any).uploadSubtitleTooltip}>
                  <button
                    onClick={() =>
                      document.getElementById("sub-upload")?.click()
                    }
                    className="px-6 py-4 bg-indigo-500/10 hover:bg-indigo-500 text-indigo-500 hover:text-white rounded-2xl font-bold flex items-center justify-center transition-all border border-indigo-500/20"
                  >
                    <FileText className="w-5 h-5" />
                  </button>
                </Tooltip>

                <Tooltip content={(t as any).extractAudio}>
                  <button
                    disabled={state.status.includes("ing")}
                    onClick={handleExtractAudio}
                    className="px-6 py-4 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white rounded-2xl font-bold flex items-center justify-center transition-all border border-emerald-500/20 disabled:opacity-50"
                  >
                    <Music className="w-5 h-5" />
                  </button>
                </Tooltip>

                {/* Quy tắc phiên âm */}
                <Tooltip content="Quy tắc phiên âm">
                  <button
                    onClick={() => setIsTranscriptionRulesOpen(true)}
                    className={`relative px-6 py-4 rounded-2xl font-bold flex items-center justify-center transition-all border ${
                      getTranscriptionRules()
                        ? "bg-indigo-500/20 hover:bg-indigo-500 text-indigo-400 hover:text-white border-indigo-500/30"
                        : "bg-indigo-500/10 hover:bg-indigo-500 text-indigo-500 hover:text-white border-indigo-500/20"
                    }`}
                  >
                    <BookOpen className="w-5 h-5" />
                    {getTranscriptionRules() && (
                      <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-indigo-400 ring-2 ring-zinc-950" />
                    )}
                  </button>
                </Tooltip>

                {state.subtitles.length === 0 ? (
                  <button
                    disabled={state.status === "transcribing"}
                    onClick={handleStartTranscription}
                    className="relative flex-1 py-4 rounded-2xl font-black text-sm tracking-widest flex items-center justify-center gap-3 transition-all overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      background: state.status === "transcribing"
                        ? 'rgb(39,39,42)'
                        : 'linear-gradient(135deg, #1e40af 0%, #2563eb 35%, #7c3aed 65%, #1d4ed8 100%)',
                    }}
                  >
                    {state.status !== "transcribing" && (<>
                      {/* Fast scan line */}
                      <motion.div
                        animate={{ x: ['-100%', '200%'] }}
                        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut', repeatDelay: 2.5 }}
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-[-15deg] pointer-events-none"
                      />
                    </>)}
                    {/* Content */}
                    <span className="relative z-10 flex items-center gap-3 text-white">
                      {state.status === "transcribing" ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <motion.span
                          animate={{ rotate: [0, 15, -10, 0], scale: [1, 1.25, 1] }}
                          transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
                        >
                          <Sparkles className="w-5 h-5 text-blue-200 drop-shadow-[0_0_6px_rgba(147,197,253,1)]" />
                        </motion.span>
                      )}
                      <motion.span
                        animate={state.status !== "transcribing" ? { backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] } : {}}
                        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                        style={state.status !== "transcribing" ? {
                          background: 'linear-gradient(90deg, #fff 0%, #bfdbfe 30%, #e9d5ff 60%, #fff 100%)',
                          backgroundSize: '200% auto',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          backgroundClip: 'text',
                        } : { color: 'white' }}
                      >
                        {t.startTranscription}
                      </motion.span>
                    </span>
                  </button>
                ) : (
                  <div className="flex-1 flex gap-3">
                    <button
                      disabled={
                        state.status === "translating" ||
                        state.subtitles.some((s) => s.vietnamese)
                      }
                      onClick={handleTranslate}
                      className="flex-1 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-2xl font-black text-sm tracking-widest flex items-center justify-center gap-3 transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)] border border-white/10 disabled:opacity-50 disabled:bg-zinc-800 disabled:shadow-none"
                    >
                      {state.status === "translating" ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Languages className="w-5 h-5" />
                      )}
                      {state.subtitles.some((s) => s.vietnamese)
                        ? t.translated
                        : t.translate}
                    </button>
                    
                    <Tooltip content={t.confirmDeleteAll}>
                      <button
                        onClick={() => {
                          if (confirm(t.confirmDeleteAll)) {
                            setState(prev => ({ ...prev, subtitles: [], status: 'idle' }));
                          }
                        }}
                        className="px-6 py-4 bg-orange-500/10 hover:bg-orange-500 text-orange-500 hover:text-white rounded-2xl font-bold flex items-center justify-center transition-all border border-orange-500/20"
                      >
                        <Eraser className="w-5 h-5" />
                      </button>
                    </Tooltip>
                  </div>
                )}

                <Tooltip content={(t as any).deleteVideo}>
                  <button
                    onClick={reset}
                    className="px-6 py-4 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition-all border border-red-500/20"
                  >
                    <Trash2 className="w-5 h-5" />
                    <span className="sm:hidden">{(t as any).deleteVideo}</span>
                  </button>
                </Tooltip>
              </section>

              {/* Section 3: Subtitles List */}
              <section
                className="rounded-3xl border overflow-hidden flex flex-col h-[600px] min-h-[400px] bg-zinc-900/30 border-zinc-800"
              >
                <SubtitleView
                  subtitles={state.subtitles}
                  currentTime={currentTime}
                  onSeek={(t) => {
                    if (videoRef.current) {
                      videoRef.current.currentTime = t;
                      setCurrentTime(t);
                    }
                  }}
                  onUpdateSubtitle={handleUpdateSubtitle}
                  onDeleteSubtitle={handleDeleteSubtitle}
                  onAddSubtitle={handleAddSubtitle}
                  onSplitSubtitle={handleSplitSubtitle}
                  onMergeSubtitle={handleMergeSubtitle}
                  isTranslating={state.status === "translating"}
                  language={state.settings.language}
                  showOriginal={state.settings.showOriginal}
                  showTranslated={state.settings.showTranslated}
                  videoFileName={state.videoFile?.name}
                />
              </section>
            </>
          )}
        </div>
      )}
    </div>
  </main>
      
      {createPortal(
        <>
          <SettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            settings={state.settings}
            onSave={(newSettings) =>
              setState((prev) => ({ ...prev, settings: newSettings }))
            }
          />

          <SubtitleStyleModal
            isOpen={isSubtitleStyleOpen}
            onClose={() => setIsSubtitleStyleOpen(false)}
            style={state.settings.subtitleStyle}
            defaultStyle={DEFAULT_SUBTITLE_STYLE}
            onSave={(newStyle) =>
              setState((prev) => ({
                ...prev,
                settings: { ...prev.settings, subtitleStyle: newStyle },
              }))
            }
            onChange={(newStyle) =>
              setState((prev) => ({
                ...prev,
                settings: { ...prev.settings, subtitleStyle: newStyle },
              }))
            }
            language={state.settings.language}
            isDark={true}
            activeSubtitle={activeSub}
          />

          <TranscriptionRulesModal
            isOpen={isTranscriptionRulesOpen}
            onClose={() => setIsTranscriptionRulesOpen(false)}
          />

          {/* Persistent Progress Bar (Global Bottom-Right) */}
          <AnimatePresence>
            {state.status.includes("ing") && (
              <motion.div
                initial={{ opacity: 0, x: 50, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 50, scale: 0.9 }}
                className="fixed bottom-6 right-6 z-[100] p-4 pr-6 rounded-3xl bg-zinc-900/90 backdrop-blur-3xl border border-white/10 shadow-2xl flex items-center gap-5 ring-1 ring-white/5"
              >
                <div className="relative w-14 h-14 shrink-0">
                  <svg className="w-full h-full -rotate-90 filter drop-shadow-[0_0_10px_rgba(59,130,246,0.3)]" viewBox="0 0 100 100">
                    <circle className="text-zinc-800/80 stroke-current" strokeWidth="8" fill="transparent" r="42" cx="50" cy="50" />
                    <motion.circle 
                      className="text-blue-500 stroke-current" 
                      strokeWidth="10" 
                      strokeLinecap="round" 
                      fill="transparent" 
                      r="42" cx="50" cy="50"
                      animate={{ strokeDasharray: `${(progress / 100) * 263.8} 263.8` }}
                      transition={{ type: "spring", stiffness: 40, damping: 15 }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center font-black text-xs text-white">
                    {Math.round(progress)}%
                  </div>
                </div>
                <div className="min-w-[180px]">
                  <motion.div 
                    animate={{ opacity: [0.6, 1, 0.6] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="text-[9px] font-black text-blue-400 uppercase tracking-[0.3em] mb-1"
                  >
                    {state.status === "processing" ? "AUDIO EXTRACTION" : 
                     state.status === "transcribing" ? "AI TRANSCRIPTION" : "SUBTITLE TRANSLATION"}
                  </motion.div>
                  <h4 className="text-sm font-black text-white leading-tight">
                    {state.status === "processing" ? "Đang trích xuất âm thanh..." : 
                     state.status === "transcribing" ? "Đang nhận diện tiếng nói..." : "Đang dịch thuật phụ đề..."}
                  </h4>
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
                      <motion.div 
                        className="h-full bg-blue-500"
                        animate={{ width: `${progress}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest whitespace-nowrap">
                      {state.status === "processing" ? "Processing" : "AI ENGINE"}
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {isErrorDetailOpen && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setIsErrorDetailOpen(false)}
                  className="fixed inset-0 bg-black/80 backdrop-blur-sm"
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
                >
                  <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                        <Info className="w-4 h-4 text-red-500" />
                      </div>
                      <h3 className="font-bold text-zinc-100">{t.technicalErrorDetails}</h3>
                    </div>
                    <button
                      onClick={() => setIsErrorDetailOpen(false)}
                      className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400 hover:text-white"
                    >
                      <Minimize2 className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="p-6 overflow-y-auto">
                    <p className="text-sm text-zinc-400 mb-4">
                      {t.adminSupportHint}
                    </p>
                    <pre className="p-4 bg-black rounded-lg border border-zinc-800 text-[11px] font-mono text-zinc-300 whitespace-pre-wrap overflow-x-auto">
                      {errorDetail ? (
                        (() => {
                          const errObj = errorDetail instanceof Error 
                            ? { 
                                name: errorDetail.name, 
                                message: errorDetail.message, 
                                stack: errorDetail.stack,
                                ...errorDetail 
                              } 
                            : errorDetail;
                          return JSON.stringify(errObj, null, 2);
                        })()
                      ) : t.noInfo}
                    </pre>
                  </div>

                  <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-900/50 flex justify-end gap-3">
                    <button
                      onClick={() => {
                        const text = typeof errorDetail === 'object' ? JSON.stringify(errorDetail, null, 2) : String(errorDetail);
                        navigator.clipboard.writeText(text);
                        toast.success(t.copySuccess);
                      }}
                      className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-sm font-medium transition-colors border border-zinc-700"
                    >
                      {t.copy}
                    </button>
                    <button
                      onClick={() => setIsErrorDetailOpen(false)}
                      className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold shadow-lg shadow-blue-600/20 transition-all"
                    >
                      {t.cancel}
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </>,
        isFullscreen && containerRef.current ? containerRef.current : document.body
      )}

      <Toaster
        position="bottom-right"
        theme="dark"
        richColors
        toastOptions={{
          style: {
            background: 'rgba(24, 24, 27, 0.92)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '16px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.3)',
            fontSize: '13px',
            fontWeight: '500',
            padding: '14px 16px',
          },
          classNames: {
            toast: 'sonner-toast-custom',
            title: 'font-bold text-sm',
            description: 'text-xs mt-0.5 opacity-80',
            actionButton: 'bg-zinc-700 hover:bg-zinc-600 text-white text-xs font-bold rounded-lg px-3 py-1.5',
          },
        }}
      />
    </div>
  );
}

function formatTime(seconds: number): string {
  if (isNaN(seconds)) return "00:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
