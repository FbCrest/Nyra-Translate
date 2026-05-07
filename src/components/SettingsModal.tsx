/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { X, Key, Languages, Moon, Sun, Plus, Check, Eye, EyeOff, RotateCcw, HelpCircle, HardDrive, Cpu, MessageSquare, Info, ShieldCheck, AlertCircle, Mic, Gamepad2, FileText, Layers, Music, Video, BookOpen, Users, Globe, ExternalLink, User, Youtube, Mail, Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AppSettings, AppLanguage, AppTheme, GeminiKeyRecord, PromptTemplate } from '../types';
import { translations } from '../i18n';
import { DEFAULT_SETTINGS } from '../App';
import { SYSTEM_PROMPTS, AI_MODELS } from '../constants';

import { Tooltip } from './ui/Tooltip';

const ICON_MAP: Record<string, any> = {
  Mic, Gamepad2, FileText, Layers, Music, Video, BookOpen, Users, Globe
};

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSave: (settings: AppSettings) => void;
}

type TabType = 'api' | 'video' | 'model' | 'prompt' | 'about';

/** Card dạng dashed để thêm prompt tuỳ chỉnh */
function AddCustomPromptCard({ onAdd }: { onAdd: (title: string, description: string, content: string) => void }) {
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');

  const handleAdd = () => {
    if (!title.trim() || !content.trim()) return;
    onAdd(title.trim(), description.trim(), content.trim());
    setTitle(''); setDescription(''); setContent('');
    setShowModal(false);
  };

  const handleCancel = () => {
    setTitle(''); setDescription(''); setContent('');
    setShowModal(false);
  };

  return (
    <>
      <div
        onClick={() => setShowModal(true)}
        className="flex flex-col items-center justify-center p-8 rounded-[32px] border border-dashed transition-all border-zinc-800 bg-zinc-900/20 hover:border-zinc-500 hover:bg-zinc-900/40 cursor-pointer text-zinc-500 hover:text-zinc-300"
      >
        <div className="w-10 h-10 rounded-full border border-zinc-800 flex items-center justify-center mb-3">
          <Plus className="w-5 h-5" />
        </div>
        <p className="font-bold text-xs">Thêm Prompt tuỳ chỉnh</p>
        <p className="text-[10px] text-zinc-600 mt-0.5 text-center">Tạo mẫu prompt của riêng bạn</p>
      </div>

      {showModal && createPortal(
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={handleCancel}
        >
          <div
            className="w-full max-w-lg bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
              <h3 className="font-bold text-white">Thêm Prompt tuỳ chỉnh</h3>
              <button onClick={handleCancel} className="p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Tên prompt <span className="text-red-400">*</span></label>
                <input
                  autoFocus
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="vd: Nhận diện tiếng Anh"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Mô tả</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Mô tả ngắn về prompt này..."
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Nội dung prompt <span className="text-red-400">*</span></label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Nhập nội dung prompt..."
                  rows={8}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-purple-500 transition-colors font-mono resize-none"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-800">
              <button onClick={handleCancel} className="px-4 py-2 text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors">
                Huỷ
              </button>
              <button
                onClick={handleAdd}
                disabled={!title.trim() || !content.trim()}
                className="px-5 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition-all flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Thêm prompt
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}


function AddCustomModelCard({ onAdd }: { onAdd: (id: string, label: string, speed: string, accuracy: string) => void }) {
  const [showModal, setShowModal] = useState(false);
  const [modelId, setModelId] = useState('');
  const [modelName, setModelName] = useState('');
  const [modelSpeed, setModelSpeed] = useState('');
  const [modelAccuracy, setModelAccuracy] = useState('');

  const SPEED_OPTIONS = ['Nhanh Nhất', 'Nhanh', 'Bình Thường', 'Chậm', 'Rất Chậm'];
  const ACCURACY_OPTIONS = ['Cao Nhất', 'Cao', 'Tốt', 'Khá'];

  const handleAdd = () => {
    if (!modelId.trim()) return;
    onAdd(
      modelId.trim(),
      modelName.trim() || modelId.trim(),
      modelSpeed || 'Bình Thường',
      modelAccuracy || 'Tốt'
    );
    setModelId(''); setModelName(''); setModelSpeed(''); setModelAccuracy('');
    setShowModal(false);
  };

  const handleCancel = () => {
    setModelId(''); setModelName(''); setModelSpeed(''); setModelAccuracy('');
    setShowModal(false);
  };

  return (
    <>
      {/* Card placeholder */}
      <div
        onClick={() => setShowModal(true)}
        className="flex flex-col items-center justify-center p-4 rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/20 hover:border-zinc-500 hover:bg-zinc-900/40 cursor-pointer transition-all min-h-[120px] gap-2 text-zinc-500 hover:text-zinc-300"
      >
        <div className="w-9 h-9 rounded-full border-2 border-dashed border-zinc-600 flex items-center justify-center">
          <Plus className="w-4 h-4" />
        </div>
        <div className="text-center">
          <p className="text-xs font-bold">Thêm mô hình tuỳ chỉnh</p>
          <p className="text-[10px] text-zinc-600 mt-0.5">Thêm ID mô hình Gemini của riêng bạn</p>
        </div>
      </div>

      {/* Portal modal */}
      {showModal && createPortal(
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={handleCancel}
        >
          <div
            className="w-full max-w-md bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
              <h3 className="font-bold text-white">Thêm mô hình tuỳ chỉnh</h3>
              <button onClick={handleCancel} className="p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <div className="px-6 py-5 space-y-5">
              {/* Model ID */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                  Model ID <span className="text-red-400">*</span>
                </label>
                <input
                  autoFocus
                  type="text"
                  value={modelId}
                  onChange={(e) => setModelId(e.target.value)}
                  placeholder="vd: gemini-2.5-pro-preview-03-25"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500 transition-colors font-mono"
                />
              </div>

              {/* Display Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Tên hiển thị</label>
                <input
                  type="text"
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  placeholder="vd: Gemini 2.5 Pro Preview"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              {/* Speed */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Tốc độ</label>
                <div className="flex flex-wrap gap-2">
                  {SPEED_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setModelSpeed(opt)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                        modelSpeed === opt
                          ? 'bg-blue-600 border-blue-500 text-white'
                          : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Accuracy */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Độ chính xác</label>
                <div className="flex flex-wrap gap-2">
                  {ACCURACY_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setModelAccuracy(opt)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                        modelAccuracy === opt
                          ? 'bg-purple-600 border-purple-500 text-white'
                          : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-800">
              <button onClick={handleCancel} className="px-4 py-2 text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors">
                Huỷ
              </button>
              <button
                onClick={handleAdd}
                disabled={!modelId.trim()}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition-all flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Thêm mô hình
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

export const SettingsModal: React.FC<SettingsModalProps> = React.memo(({ isOpen, onClose, settings, onSave }) => {
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const [activeTab, setActiveTab] = useState<TabType>('api');
  const [isViewingDetails, setIsViewingDetails] = useState<string | null>(null);
  const [editedPromptContent, setEditedPromptContent] = useState<string>('');
  const [newKey, setNewKey] = useState('');
  const [showKeyIndices, setShowKeyIndices] = useState<Set<string>>(new Set());
  const [zoomedQR, setZoomedQR] = useState<{ src: string; label: string } | null>(null);
  
  useEffect(() => {
    if (isOpen) setLocalSettings(settings);
  }, [isOpen, settings]);

  const t = translations[localSettings.language];
  const isDark = true;

  const viewingPrompt = SYSTEM_PROMPTS.find(p => p.id === isViewingDetails);

  if (!isOpen) return null;

  const handleAddKey = () => {
    if (!newKey.trim()) return;
    const keyData: GeminiKeyRecord = {
      id: Math.random().toString(36).substr(2, 9),
      key: newKey.trim(),
      status: 'active',
      tier: 'free',
      errorCount: 0
    };
    setLocalSettings(prev => ({
      ...prev,
      apiKeys: [...prev.apiKeys, keyData],
      activeKeyId: prev.activeKeyId || keyData.id
    }));
    setNewKey('');
  };

  const toggleTier = (id: string) => {
    setLocalSettings(prev => ({
      ...prev,
      apiKeys: prev.apiKeys.map(k => k.id === id ? { ...k, tier: k.tier === 'free' ? 'paid' : 'free' } : k)
    }));
  };

  const handleRemoveKey = (id: string) => {
    setLocalSettings(prev => {
      const filtered = prev.apiKeys.filter(k => k.id !== id);
      return {
        ...prev,
        apiKeys: filtered,
        activeKeyId: prev.activeKeyId === id ? (filtered[0]?.id || null) : prev.activeKeyId
      };
    });
  };

  const toggleShowKey = (id: string) => {
    const next = new Set(showKeyIndices);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setShowKeyIndices(next);
  };

  const maskKey = (key: string) => {
    if (key.length < 8) return '********';
    return `${key.slice(0, 4)}••••••${key.slice(-4)}`;
  };

  const tabs = [
    { id: 'api' as TabType, label: t.apiKeysTab, icon: Key, color: 'text-blue-400', activeBg: 'bg-blue-400/10' },
    { id: 'video' as TabType, label: t.videoProcessing, icon: HardDrive, color: 'text-green-400', activeBg: 'bg-green-400/10' },
    { id: 'model' as TabType, label: t.geminiModel, icon: Cpu, color: 'text-purple-400', activeBg: 'bg-purple-400/10' },
    { id: 'prompt' as TabType, label: t.prompt, icon: MessageSquare, color: 'text-orange-400', activeBg: 'bg-orange-400/10' },
    { id: 'about' as TabType, label: t.about, icon: Info, color: 'text-cyan-400', activeBg: 'bg-cyan-400/10' },
  ];

  return (
    <>
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-[90vw] border rounded-[40px] shadow-2xl overflow-hidden transition-colors duration-300 bg-zinc-950 border-zinc-800 text-white"
        >
          {/* Prompt Detail Overlay */}
          <AnimatePresence>
            {isViewingDetails && viewingPrompt && (
              <motion.div 
                initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
                animate={{ opacity: 1, backdropFilter: 'blur(8px)' }}
                exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
                className="absolute inset-0 z-[120] flex items-center justify-center p-8 bg-black/40"
              >
                <motion.div
                  initial={{ scale: 0.9, y: 20 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0.9, y: 20 }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full max-w-3xl rounded-[32px] p-6 shadow-2xl border bg-zinc-900 border-zinc-800"
                >
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-2xl bg-zinc-800 text-purple-400`}>
                        {React.createElement(ICON_MAP[viewingPrompt.icon] || Info, { className: "w-6 h-6" })}
                      </div>
                      <h4 className="text-xl font-bold text-white">{viewingPrompt.title}</h4>
                    </div>
                    <Tooltip content="Đóng cài đặt">
                      <button 
                        onClick={() => setIsViewingDetails(null)}
                        className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-500 hover:text-white"
                      >
                        <X className="w-6 h-6" />
                      </button>
                    </Tooltip>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <h5 className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-2">{t.description}</h5>
                      <p className="text-zinc-400 leading-relaxed text-sm">{viewingPrompt.description}</p>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="text-sm font-bold text-zinc-500 uppercase tracking-widest">{t.prompt}</h5>
                        <span className="text-[10px] text-zinc-600">{(t as any).editableDirectly}</span>
                      </div>
                      <textarea
                        value={editedPromptContent}
                        onChange={(e) => setEditedPromptContent(e.target.value)}
                        className="w-full p-4 rounded-xl bg-black/50 border border-zinc-800/50 font-mono text-xs leading-relaxed text-zinc-300 max-h-[480px] min-h-[280px] overflow-y-auto resize-none outline-none focus:border-purple-500/50 transition-colors custom-scrollbar"
                        spellCheck={false}
                      />
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-4 pt-4 border-t border-zinc-800">
                    {/* Prompt info */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`p-2 rounded-xl bg-zinc-800 text-purple-400 shrink-0`}>
                        {React.createElement(ICON_MAP[viewingPrompt.icon] || Info, { className: "w-4 h-4" })}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-0.5">{(t as any).currentlyViewing}</p>
                        <p className="text-sm font-bold text-zinc-300 truncate">{viewingPrompt.title}</p>
                      </div>
                      {localSettings.selectedPromptId === viewingPrompt.id && (
                        <span className="shrink-0 px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-[10px] font-black text-purple-400 uppercase tracking-wider">
                          {(t as any).inUse}
                        </span>
                      )}
                    </div>
                    {/* Action buttons */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setEditedPromptContent(viewingPrompt.content)}
                        className="px-4 py-2.5 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 text-sm font-medium transition-all"
                        title={(t as any).resetToDefault}
                      >
                        {(t as any).resetToDefault}
                      </button>
                      <button
                        onClick={() => setIsViewingDetails(null)}
                        className="px-4 py-2.5 rounded-xl border border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white text-sm font-medium transition-all"
                      >
                        Đóng
                      </button>
                      {/* Chỉ hiện nút khi chưa dùng prompt này, hoặc đã edit content */}
                      {!(localSettings.selectedPromptId === viewingPrompt.id && localSettings.transcriptionPrompt === editedPromptContent) && (
                        <button
                          onClick={() => {
                            setLocalSettings(prev => ({
                              ...prev,
                              selectedPromptId: viewingPrompt.id,
                              transcriptionPrompt: editedPromptContent
                            }));
                            setIsViewingDetails(null);
                          }}
                          className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-purple-900/30 text-sm"
                        >
                          {(t as any).useThisPrompt}
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
          {/* Header */}
          <div className="p-6 flex items-center justify-between border-b border-zinc-900/50">
            <div className="w-48 flex items-center">
              <h2 className="text-2xl font-black tracking-tight">{t.settings}</h2>
            </div>
            
            <div className="flex-1 flex justify-center">
              <div className="flex p-1.5 rounded-2xl bg-zinc-900/50 border border-zinc-800/50">
                {tabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 group
                      ${activeTab === tab.id 
                        ? tab.color
                        : 'text-zinc-500 hover:text-zinc-200'}
                    `}
                  >
                    {activeTab === tab.id && (
                      <motion.div
                        layoutId="activeTabIndicator"
                        className={`absolute inset-0 rounded-xl z-0 ${tab.activeBg}`}
                        transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
                      />
                    )}
                    <tab.icon className={`relative w-4 h-4 z-10 transition-all duration-300 
                      ${activeTab === tab.id ? 'scale-110 opacity-100' : 'opacity-40 group-hover:opacity-100 group-hover:scale-105'}
                    `} />
                    <span className="relative z-10">{tab.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="w-48 flex justify-end">
              <Tooltip content="Đóng (Esc)">
                <button 
                  onClick={onClose} 
                  className="p-2 rounded-xl transition-colors hover:bg-zinc-900 text-zinc-500 hover:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </Tooltip>
            </div>
          </div>

          <div className="p-8 h-[70vh] overflow-y-auto scrollbar-thin overflow-x-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="h-full"
              >
                {activeTab === 'api' && (
                  <div className="space-y-6">
                {/* Gemini Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <h3 className="text-sm font-bold text-blue-400">{t.apiKeysTitle}</h3>
                    <span className="px-2.5 py-0.5 bg-blue-600/10 text-blue-400 text-xs font-bold rounded-full border border-blue-600/20">
                      {localSettings.apiKeys.length} {t.activeKeys}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {localSettings.apiKeys.map(keyRecord => (
                      <div 
                        key={keyRecord.id}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all
                          ${localSettings.activeKeyId === keyRecord.id 
                            ? 'bg-blue-600/5 border-blue-600/30'
                            : 'bg-zinc-900 border-zinc-800'}
                        `}
                      >
                        <div className="flex-1 font-mono text-sm tracking-tight break-all min-w-0">
                          {showKeyIndices.has(keyRecord.id) ? keyRecord.key : maskKey(keyRecord.key)}
                        </div>                        
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {/* Tier Badge */}
                          <div className="flex bg-black/20 p-0.5 rounded-lg border border-white/5">
                            <Tooltip content="Đổi sang bậc trả phí (Paid Tier)">
                              <button 
                                onClick={() => toggleTier(keyRecord.id)}
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase transition-all
                                  ${keyRecord.tier === 'paid' ? 'bg-purple-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}
                                `}
                              >
                                Paid
                              </button>
                            </Tooltip>
                            <Tooltip content="Đổi sang bậc miễn phí (Free Tier)">
                              <button 
                                onClick={() => toggleTier(keyRecord.id)}
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase transition-all
                                  ${keyRecord.tier === 'free' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}
                                `}
                              >
                                Free
                              </button>
                            </Tooltip>
                          </div>

                          {/* Quota Badge removed */}

                          <div className="h-4 w-px bg-zinc-800" />

                          <Tooltip content={showKeyIndices.has(keyRecord.id) ? "Ẩn khóa" : "Hiện khóa"}>
                            <button 
                              onClick={() => toggleShowKey(keyRecord.id)}
                              className="p-1.5 text-zinc-500 hover:text-zinc-300 transition-colors rounded-lg hover:bg-zinc-800"
                            >
                              {showKeyIndices.has(keyRecord.id) ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </Tooltip>

                          <Tooltip content="Sử dụng khóa này làm mặc định">
                            <button 
                              onClick={() => setLocalSettings(prev => ({ ...prev, activeKeyId: keyRecord.id }))}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all
                                ${localSettings.activeKeyId === keyRecord.id 
                                  ? 'bg-blue-600 text-white' 
                                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}
                              `}
                            >
                              {localSettings.activeKeyId === keyRecord.id ? t.active : t.setActive}
                            </button>
                          </Tooltip>

                          <Tooltip content="Xoá khóa này">
                            <button 
                              onClick={() => handleRemoveKey(keyRecord.id)}
                              className="p-1.5 text-red-500/50 hover:text-red-500 transition-colors hover:bg-red-500/10 rounded-lg"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </Tooltip>
                        </div>
                      </div>
                    ))}

                    <div className="flex items-center gap-3 p-2.5 rounded-xl border bg-zinc-950 border-zinc-800">
                      <div className="p-2 bg-blue-600/10 text-blue-500 rounded-lg">
                        <Key className="w-4 h-4" />
                      </div>
                      <input
                        type="password"
                        value={newKey}
                        onChange={(e) => setNewKey(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddKey()}
                        placeholder={t.geminiKeyPlaceholder}
                        className="flex-1 bg-transparent border-0 px-1 py-1 text-sm focus:ring-0 font-mono"
                      />
                      <button 
                        onClick={handleAddKey}
                        disabled={!newKey.trim()}
                        className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-all"
                      >
                        {t.addKey}
                      </button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl border bg-zinc-900/30 border-zinc-800">
                      <h4 className="font-bold flex items-center gap-2 mb-3 text-blue-400 text-sm">
                        <ShieldCheck className="w-4 h-4" /> {t.apiKeyGuide}
                      </h4>
                      <ul className="space-y-2 text-xs text-zinc-400">
                        <li className="flex gap-3">
                          <span className="w-5 h-5 flex-shrink-0 bg-blue-600 text-white rounded-md flex items-center justify-center font-bold text-xs">1</span>
                          <span>{t.getApiKey} <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-blue-500 hover:underline font-bold">Google AI Studio</a></span>
                        </li>
                      </ul>
                    </div>

                    <div className="p-4 rounded-2xl border bg-zinc-900/30 border-zinc-800">
                      <h4 className="font-bold flex items-center gap-2 mb-3 text-orange-400 text-sm">
                        <RotateCcw className="w-4 h-4" /> {t.autoRotateKeys}
                      </h4>
                      <p className="text-xs text-zinc-400 leading-relaxed">
                        {t.autoRotateDesc}
                      </p>
                    </div>                  </div>
                </div>
              </div>
            )}

            {activeTab === 'video' && (
              <div className="flex flex-col items-center justify-center h-full text-zinc-500 space-y-6">
                <div className="w-24 h-24 rounded-full bg-green-400/10 flex items-center justify-center text-green-400 mb-2">
                  <HardDrive className="w-12 h-12" />
                </div>
                <h3 className="text-2xl font-bold text-green-400">{t.videoProcessing}</h3>
                <p className="text-zinc-400 text-lg">{(t as any).featureComingSoon}</p>
              </div>
            )}

            {activeTab === 'model' && (
              <div className="space-y-5 pb-8">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-purple-600/20 flex items-center justify-center text-purple-400">
                      <Cpu className="w-4 h-4" />
                    </div>
                    {t.selectModelTitle}
                  </h3>
                  <p className="text-zinc-500 text-xs leading-relaxed">
                    {t.selectModelDesc}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {AI_MODELS.map((model) => {
                    const isSelected = localSettings.extractionModel === model.id;

                    // Màu riêng cho từng model — RGB values cho CSS variables
                    const colorMap: Record<string, {
                      rgb: string, accent: string, badgeCls: string, checkCls: string
                    }> = {
                      amber:  { rgb: '245,158,11',  accent: '#f59e0b', badgeCls: 'bg-gradient-to-r from-amber-500 to-orange-500',   checkCls: 'bg-amber-500' },
                      emerald:{ rgb: '16,185,129',  accent: '#10b981', badgeCls: 'bg-gradient-to-r from-emerald-500 to-teal-500',   checkCls: 'bg-emerald-500' },
                      blue:   { rgb: '14,165,233',  accent: '#0ea5e9', badgeCls: 'bg-gradient-to-r from-sky-500 to-blue-500',       checkCls: 'bg-sky-500' },
                      violet: { rgb: '139,92,246',  accent: '#8b5cf6', badgeCls: 'bg-gradient-to-r from-violet-500 to-purple-500',  checkCls: 'bg-violet-500' },
                      cyan:   { rgb: '6,182,212',   accent: '#06b6d4', badgeCls: 'bg-gradient-to-r from-cyan-500 to-sky-500',       checkCls: 'bg-cyan-500' },
                      teal:   { rgb: '20,184,166',  accent: '#14b8a6', badgeCls: 'bg-gradient-to-r from-teal-500 to-emerald-600',   checkCls: 'bg-teal-500' },
                      rose:   { rgb: '244,63,94',   accent: '#f43f5e', badgeCls: 'bg-gradient-to-r from-rose-500 to-pink-500',      checkCls: 'bg-rose-500' },
                      zinc:   { rgb: '161,161,170', accent: '#a1a1aa', badgeCls: 'bg-gradient-to-r from-zinc-500 to-slate-500',     checkCls: 'bg-zinc-500' },
                      purple: { rgb: '168,85,247',  accent: '#a855f7', badgeCls: 'bg-gradient-to-r from-purple-500 to-violet-500',  checkCls: 'bg-purple-500' },
                    };
                    const c = colorMap[model.color] ?? colorMap.zinc;

                    return (
                      <div
                        key={model.id}
                        onClick={() => setLocalSettings(prev => ({
                          ...prev,
                          extractionModel: model.id,
                          translationModel: model.id
                        }))}
                        style={{
                          '--card-rgb': c.rgb,
                          transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1), box-shadow 0.3s cubic-bezier(0.4,0,0.2,1), border-color 0.3s ease',
                        } as React.CSSProperties}
                        className={`model-card-hover relative group cursor-pointer`}
                      >
                        {/* Nút tick nằm ngoài card (không bị overflow-hidden clip), di chuyển cùng wrapper */}
                        {isSelected && (
                          <div className="absolute -top-2 -right-2 z-30 pointer-events-none">
                            <div className={`w-8 h-8 ${c.checkCls} rounded-full flex items-center justify-center text-white border-2 border-zinc-950 shadow-lg`}>
                              <Check className="w-4 h-4 stroke-[3]" />
                            </div>
                          </div>
                        )}
                      <div
                        className={`relative flex flex-col p-4 rounded-2xl border text-left overflow-hidden outline-none h-full
                          ${isSelected
                            ? 'border-[rgba(var(--card-rgb),0.8)] bg-[rgba(var(--card-rgb),0.08)] shadow-[0_0_0_1px_rgba(var(--card-rgb),0.4),0_4px_20px_rgba(var(--card-rgb),0.25)]'
                            : 'bg-zinc-900 border-zinc-800'}
                        `}
                      >
                        {/* Gradient overlay */}
                        <div
                          className={`absolute inset-0 pointer-events-none transition-opacity duration-300 z-0
                            ${isSelected ? 'opacity-50' : 'opacity-0 group-hover:opacity-100'}`}
                          style={{ background: `linear-gradient(135deg, rgba(${c.rgb},0.10) 0%, rgba(${c.rgb},0.06) 100%)` }}
                        />

                        <div className="relative z-10 flex items-center justify-between mb-3">
                          <span className="font-bold tracking-tight text-[15px] transition-colors" style={{ color: c.accent }}>
                            {model.label}
                          </span>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-black tracking-wider text-white ${c.badgeCls}`}>
                            {model.tag}
                          </span>
                        </div>

                        <p className={`relative z-10 text-[13px] mb-4 leading-relaxed flex-1 transition-colors ${isSelected ? 'text-zinc-200' : 'text-zinc-500 group-hover:text-zinc-300'}`}>
                          {model.description}
                        </p>

                        <div className="relative z-10 space-y-2 mt-auto pt-3 border-t border-zinc-800/50">
                          {[
                            { label: 'Tốc độ',           value: model.speedScore,    text: model.speed },
                            { label: 'Chính xác',        value: model.accuracyScore, text: model.accuracy },
                            { label: 'Tình trạng quá tải', value: model.loadScore,   text: model.load },
                          ].map((stat) => (
                            <div key={stat.label}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-600">{stat.label}</span>
                                <span className="text-[10px] font-bold text-zinc-500">{stat.text}</span>
                              </div>
                              <div className="flex gap-0.5">
                                {Array.from({ length: 5 }).map((_, i) => (
                                  <div
                                    key={i}
                                    className="h-1.5 flex-1 rounded-full transition-all duration-300"
                                    style={{
                                      backgroundColor: i < stat.value
                                        ? c.accent
                                        : isSelected ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.05)',
                                      opacity: i < stat.value ? (0.5 + (i / stat.value) * 0.5) : 1,
                                    }}
                                  />
                                ))}
                              </div>
                            </div>
                          ))}
                          <div className="flex items-center justify-between pt-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-600">Model ID</span>
                            <code className="text-[10px] font-mono text-zinc-500 truncate ml-2">{model.id}</code>
                          </div>
                        </div>
                      </div>
                      </div>
                    );
                  })}

                  {/* Custom models — xếp tiếp ngay sau built-in, fill ô trống trước */}
                  {(localSettings.customModels || []).map((model) => (
                    <div
                      key={model.id}
                      onClick={() => setLocalSettings(prev => ({
                        ...prev,
                        extractionModel: model.id,
                        translationModel: model.id
                      }))}
                      className={`relative flex flex-col p-4 rounded-2xl border cursor-pointer transition-all
                        ${localSettings.extractionModel === model.id
                          ? 'border-blue-500 bg-blue-500/5'
                          : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'}
                      `}
                    >
                      {localSettings.extractionModel === model.id && (
                        <div className="absolute -top-2 -right-2 z-30">
                          <div className="w-7 h-7 bg-blue-500 rounded-full flex items-center justify-center text-white border-2 border-zinc-950">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                        </div>
                      )}
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-sm text-blue-400 truncate">{model.label}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black bg-zinc-800 text-zinc-400">CUSTOM</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setLocalSettings(prev => ({
                                ...prev,
                                customModels: prev.customModels.filter(m => m.id !== model.id)
                              }));
                            }}
                            className="p-1 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <p className="text-[10px] text-zinc-500 font-mono break-all mb-3">{model.id}</p>
                      <div className="space-y-1.5 mt-auto pt-3 border-t border-zinc-800/50">
                        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-tight">
                          <span className="text-zinc-600">Tốc độ:</span>
                          <span className={localSettings.extractionModel === model.id ? 'text-white' : 'text-zinc-400'}>{model.speed || '—'}</span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-tight">
                          <span className="text-zinc-600">Độ chính xác:</span>
                          <span className={localSettings.extractionModel === model.id ? 'text-white' : 'text-zinc-400'}>{model.accuracy || '—'}</span>
                        </div>
                      </div>
                    </div>
                  ))}

                </div>
              </div>
            )}

            {activeTab === 'prompt' && (
              <div className="space-y-5 pb-12">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold">{t.promptTemplates}</h3>
                  <p className="text-zinc-500 text-xs leading-relaxed">
                    {t.promptTemplatesDesc}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {SYSTEM_PROMPTS.map((template) => {
                    const Icon = ICON_MAP[template.icon] || Info;
                    const isSelected = localSettings.selectedPromptId === template.id;

                    // Màu riêng cho từng prompt
                    const promptColors: Record<string, { rgb: string, accent: string, iconBg: string, checkCls: string }> = {
                      'general':           { rgb: '168,85,247',  accent: '#a855f7', iconBg: 'bg-purple-500/15',  checkCls: 'bg-purple-600' },
                      'gaming':            { rgb: '244,63,94',   accent: '#f43f5e', iconBg: 'bg-rose-500/15',    checkCls: 'bg-rose-600' },
                      'extract-text':      { rgb: '16,185,129',  accent: '#10b981', iconBg: 'bg-emerald-500/15', checkCls: 'bg-emerald-500' },
                      'combined-subtitles':{ rgb: '249,115,22',  accent: '#f97316', iconBg: 'bg-orange-500/15',  checkCls: 'bg-orange-500' },
                      'focus-lyrics':      { rgb: '245,158,11',  accent: '#f59e0b', iconBg: 'bg-amber-500/15',   checkCls: 'bg-amber-500' },
                      'describe-video':    { rgb: '236,72,153',  accent: '#ec4899', iconBg: 'bg-pink-500/15',    checkCls: 'bg-pink-600' },
                      'chaptering':        { rgb: '99,102,241',  accent: '#6366f1', iconBg: 'bg-indigo-500/15',  checkCls: 'bg-indigo-600' },
                      'diarize-speakers':  { rgb: '234,179,8',   accent: '#eab308', iconBg: 'bg-yellow-500/15',  checkCls: 'bg-yellow-500' },
                      'translate-directly':{ rgb: '6,182,212',   accent: '#06b6d4', iconBg: 'bg-cyan-500/15',    checkCls: 'bg-cyan-500' },
                    };
                    const pc = promptColors[template.id] ?? { rgb: '161,161,170', accent: '#a1a1aa', iconBg: 'bg-zinc-500/15', checkCls: 'bg-zinc-500' };

                    return (
                      <div
                        key={template.id}
                        onClick={() => setLocalSettings(prev => ({
                          ...prev,
                          selectedPromptId: template.id,
                          transcriptionPrompt: template.content
                        }))}
                        style={{
                          '--card-rgb': pc.rgb,
                          transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1), box-shadow 0.3s cubic-bezier(0.4,0,0.2,1), border-color 0.3s ease',
                        } as React.CSSProperties}
                        className={`model-card-hover relative group cursor-pointer`}
                      >
                        {/* Nút tick nằm ngoài card, di chuyển cùng wrapper */}
                        {isSelected && (
                          <div className="absolute -top-2 -right-2 z-30 pointer-events-none">
                            <div className={`w-7 h-7 ${pc.checkCls} rounded-full flex items-center justify-center text-white border-2 border-zinc-950 shadow-lg`}>
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </div>
                          </div>
                        )}
                      <div
                        className={`relative flex flex-col p-5 rounded-[28px] border text-left overflow-hidden outline-none h-full
                          ${isSelected
                            ? 'border-[rgba(var(--card-rgb),0.8)] bg-[rgba(var(--card-rgb),0.08)] shadow-[0_0_0_1px_rgba(var(--card-rgb),0.4),0_4px_20px_rgba(var(--card-rgb),0.2)]'
                            : 'bg-zinc-900 border-zinc-800'}
                        `}
                      >
                        {/* Gradient overlay */}
                        <div
                          className={`absolute inset-0 pointer-events-none transition-opacity duration-300 z-0
                            ${isSelected ? 'opacity-50' : 'opacity-0 group-hover:opacity-100'}`}
                          style={{ background: `linear-gradient(135deg, rgba(${pc.rgb},0.10) 0%, rgba(${pc.rgb},0.05) 100%)` }}
                        />

                        <div className="relative z-10 flex items-center gap-3 mb-3">
                          <div className={`p-2.5 rounded-xl ${pc.iconBg} transition-all duration-300`} style={{ color: pc.accent }}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <h4 className="font-bold text-[14px] leading-tight transition-colors duration-300" style={{ color: pc.accent }}>
                            {template.title}
                          </h4>
                        </div>

                        <p className={`relative z-10 text-[13px] leading-relaxed flex-1 mb-4 transition-colors duration-300 ${isSelected ? 'text-zinc-300' : 'text-zinc-500 group-hover:text-zinc-400'}`}>
                          {template.description}
                        </p>

                        <div className="relative z-10 mt-auto pt-3 border-t border-zinc-800/30 flex justify-center">
                          <span
                            onClick={(e) => { e.stopPropagation(); setIsViewingDetails(template.id); setEditedPromptContent(template.content); }}
                            className="text-xs font-bold uppercase tracking-widest cursor-pointer transition-colors duration-300 text-zinc-600 hover:text-zinc-300"
                          >
                            {t.viewPromptDetails}
                          </span>
                        </div>
                      </div>
                      </div>
                    );
                  })}

                </div>

              </div>
            )}

            {activeTab === 'about' && (
              <div className="space-y-6 max-w-3xl mx-auto py-4">
                <div className="text-center">
                  <motion.h3 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="title-rainbow text-2xl font-black tracking-tighter"
                  >
                    {t.title}
                  </motion.h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Author Card */}
                  <motion.div 
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/40"
                  >
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center gap-2 text-purple-400">
                        <User className="w-4 h-4" />
                        <h4 className="text-sm font-bold text-zinc-300">{t.authorInfo}</h4>
                      </div>
                      
                      <div className="w-full space-y-2">
                        {[
                          { label: t.authorLabel, value: 'Sú', href: null },
                          { label: 'YouTube', value: '@Ping999-u4q', href: 'https://www.youtube.com/@Ping999-u4q' },
                          { label: 'Email', value: '0rion24kk@gmail.com', href: 'mailto:0rion24kk@gmail.com' },
                          { label: 'Discord', value: '0rion24k', href: null },
                          { label: 'WeChat', value: 'orion24k', href: null },
                        ].map((info) => (
                          <div key={info.label} className="flex gap-2 text-sm">
                            <span className="text-white font-bold whitespace-nowrap">{info.label}:</span>
                            {info.href ? (
                              <a
                                href={info.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group relative text-blue-400 break-all transition-colors duration-200 hover:text-cyan-300"
                              >
                                <span className="relative">
                                  {info.value}
                                  <span className="absolute left-0 -bottom-px h-px w-0 bg-gradient-to-r from-blue-400 to-cyan-300 rounded-full transition-all duration-300 group-hover:w-full" />
                                </span>
                              </a>
                            ) : (
                              <span className="text-zinc-400">{info.value}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>

                  {/* Support Card */}
                  <motion.div 
                    initial={{ x: 20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/40 text-center"
                  >
                    <div className="flex flex-col items-center gap-3">
                      <div className="flex items-center gap-2 text-rose-400">
                        <motion.div
                          animate={{ scale: [1, 1.3, 1, 1.15, 1] }}
                          transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 1.5, ease: 'easeInOut' }}
                        >
                          <Heart className="w-4 h-4 fill-current text-rose-400" />
                        </motion.div>
                        <h4 className="text-sm font-bold text-zinc-300">{t.supportProject}</h4>
                      </div>
                      
                      <p className="text-zinc-400 text-sm leading-relaxed">
                        {t.supportDesc}
                      </p>

                      {/* QR codes side by side — click to zoom */}
                      <div className="flex items-start gap-4">
                        {/* Momo QR */}
                        <div className="flex flex-col items-center gap-2">
                          <div
                            className="relative group/qr cursor-zoom-in"
                            onClick={() => setZoomedQR({ src: '/qr-momo.png', label: 'Momo' })}
                          >
                            <div className="absolute -inset-3 bg-rose-500/10 blur-xl rounded-full opacity-0 group-hover/qr:opacity-100 transition-opacity" />
                            <div className="relative bg-white p-3 rounded-2xl shadow-xl ring-2 ring-transparent group-hover/qr:ring-rose-400/40 transition-all">
                              <img src="/qr-momo.png" alt="QR Momo" className="w-36 h-36 object-contain" />
                            </div>
                          </div>
                          <div className="bg-zinc-800/50 px-3 py-1 rounded-full">
                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Momo</span>
                          </div>
                        </div>

                        {/* WeChat QR */}
                        <div className="flex flex-col items-center gap-2">
                          <div
                            className="relative group/qr cursor-zoom-in"
                            onClick={() => setZoomedQR({ src: '/qr-wechat.png', label: 'WeChat' })}
                          >
                            <div className="absolute -inset-3 bg-green-500/10 blur-xl rounded-full opacity-0 group-hover/qr:opacity-100 transition-opacity" />
                            <div className="relative bg-white p-3 rounded-2xl shadow-xl ring-2 ring-transparent group-hover/qr:ring-green-400/40 transition-all">
                              <img src="/qr-wechat.png" alt="QR WeChat" className="w-36 h-36 object-contain" />
                            </div>
                          </div>
                          <div className="bg-zinc-800/50 px-3 py-1 rounded-full">
                            <span className="text-[10px] font-bold text-green-600/70 uppercase tracking-widest">WeChat</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </div>

                <motion.div 
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="space-y-4 text-center"
                >
                  <div className="p-4 rounded-2xl bg-zinc-900/20 border border-zinc-800/50">
                    <p className="text-zinc-400 text-sm leading-relaxed max-w-2xl mx-auto">
                      {t.osgDesc}
                    </p>
                  </div>

                  <div className="flex flex-col items-center gap-3 py-4 border-t border-zinc-800">
                    <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">{t.language}</h4>
                    <div className="flex flex-wrap justify-center gap-2">
                      {[
                        { code: 'vi', label: 'Tiếng Việt' },
                        { code: 'en', label: 'English (Tiếng Anh)' },
                        { code: 'zh', label: '中文 (Tiếng Trung)' },
                        { code: 'ja', label: '日本語 (Tiếng Nhật)' },
                        { code: 'ko', label: '한국어 (Tiếng Hàn)' }
                      ].map(lang => (
                        <button
                          key={lang.code}
                          onClick={() => setLocalSettings(prev => ({ ...prev, language: lang.code as AppLanguage }))}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            localSettings.language === lang.code 
                              ? 'bg-blue-600 text-white' 
                              : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                          }`}
                        >
                          {lang.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <p className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em]">
                    {t.currentVersion}: v1.0.0 (Apr 24, 2026 07:00)
                  </p>
                </motion.div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t flex items-center justify-between bg-zinc-900/50 border-zinc-800">
            <button 
              onClick={() => {
                if (confirm(t.confirmRestore)) {
                  setLocalSettings(DEFAULT_SETTINGS);
                  toast.info('Đã khôi phục cài đặt gốc');
                }
              }}
              className="px-4 py-2 border border-red-500/30 text-red-500 rounded-lg text-sm font-medium hover:bg-red-500/10 transition-all flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" /> {t.restore}
            </button>

            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-5 py-2 rounded-lg text-sm font-medium transition-all bg-zinc-800 hover:bg-zinc-700"
              >
                {t.cancel} <span className="text-[10px] opacity-50 ml-1">(ESC)</span>
              </button>
              <button
                onClick={() => {
                  onSave(localSettings);
                  onClose();
                  toast.success('Đã lưu cài đặt');
                }}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-bold transition-all shadow-lg shadow-blue-900/40"
              >
                {t.save}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>

    {/* QR Lightbox */}
    {zoomedQR && createPortal(
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-sm cursor-zoom-out"
        onClick={() => setZoomedQR(null)}
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="flex flex-col items-center gap-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-white p-5 rounded-3xl shadow-2xl">
            <img src={zoomedQR.src} alt={`QR ${zoomedQR.label}`} className="w-72 h-72 object-contain" />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-white font-bold text-lg">{zoomedQR.label}</span>
            <span className="text-zinc-400 text-sm">· Click ra ngoài để đóng</span>
          </div>
        </motion.div>
      </motion.div>,
      document.body
    )}
    </>
  );
});
