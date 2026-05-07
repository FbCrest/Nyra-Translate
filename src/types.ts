/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface SubtitleItem {
  id: string;
  startTime: number; // in seconds
  endTime: number; // in seconds
  chinese: string;
  vietnamese?: string;
}

export type AppLanguage = 'en' | 'vi' | 'zh' | 'ko' | 'ja';
export type AppTheme = 'light' | 'dark';
export type ProcessingStatus = 'idle' | 'uploading' | 'processing' | 'audio_extracted' | 'transcribing' | 'translating' | 'completed' | 'error';

export interface SubtitleStyle {
  fontSize: number;
  letterSpacing: number;
  lineHeight: number;
  textColor: string;
  backgroundColor: string;
  backgroundOpacity: number;
  backgroundBorderRadius: number;
  backgroundPaddingX: number;
  backgroundPaddingY: number;
  shadowColor: string;
  shadowBlur: number;
  strokeColor: string;
  strokeWidth: number;
  verticalPosition: number;
  fontFamily: string;
  fontWeight: string;
  fontStyle: string;
  textDecoration: string;
  textAlign?: 'left' | 'center' | 'right';
  textOpacity?: number; // 0–1, default 1
}

export interface GeminiKeyRecord {
  id: string;
  key: string;
  label?: string;
  status: 'active' | 'inactive' | 'error';
  tier: 'free' | 'paid';
  hasQuota?: boolean; // deprecated, kept for migration compatibility
  lastUsed?: number;
  errorCount: number;
}

export interface PromptTemplate {
  id: string;
  icon: string;
  title: string;
  description: string;
  content: string;
  isSystem?: boolean;
}

export interface AppSettings {
  apiKeys: GeminiKeyRecord[];
  activeKeyId: string | null;
  language: AppLanguage;
  theme: AppTheme;
  subtitleStyle: SubtitleStyle;
  showOriginal: boolean;
  showTranslated: boolean;
  isSubtitleVisible: boolean;
  extractionModel: string;
  translationModel: string;
  selectedPromptId: string;
  customPrompts: PromptTemplate[];
  transcriptionPrompt: string;
  customModels: { id: string, label: string, speed?: string, accuracy?: string }[];
}

export interface AppState {
  videoUrl: string | null;
  videoFile: File | null;
  subtitles: SubtitleItem[];
  status: ProcessingStatus;
  settings: AppSettings;
  error?: string;
}
