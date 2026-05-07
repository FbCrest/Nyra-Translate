/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { SubtitleItem, AppLanguage } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, Languages, Download, Trash2, ChevronDown, Check, FileText, Code, AlignLeft, Edit3, X } from 'lucide-react';
import { translations } from '../i18n';
import { Tooltip } from './ui/Tooltip';
import { toast } from 'sonner';
import { VariableSizeList as List } from 'react-window';

interface SubtitleViewProps {
  subtitles: SubtitleItem[];
  currentTime: number;
  onSeek: (time: number) => void;
  onUpdateSubtitle: (id: string, updates: Partial<SubtitleItem>) => void;
  onDeleteSubtitle: (id: string) => void;
  onAddSubtitle: (time: number) => void;
  onSplitSubtitle: (id: string, time: number) => void;
  onMergeSubtitle: (id: string) => void;
  isTranslating: boolean;
  language: AppLanguage;
  showOriginal: boolean;
  showTranslated: boolean;
  videoFileName?: string;
}

interface ListData {
  subtitles: SubtitleItem[];
  activeIndex: number;
  editingPopover: { subId: string; anchorRect: DOMRect } | null;
  editingTime: { id: string; field: 'start' | 'end' } | null;
  onSeek: (time: number) => void;
  onUpdateSubtitle: (id: string, updates: Partial<SubtitleItem>) => void;
  onDeleteSubtitle: (id: string) => void;
  onSplitSubtitleWithCurrentTime: (id: string) => void;
  onMergeSubtitle: (id: string) => void;
  openPopover: (subId: string, anchorRect: DOMRect) => void;
  setEditingTime: (val: { id: string; field: 'start' | 'end' } | null) => void;
  handleTimeEdit: (id: string, field: 'start' | 'end', value: string) => void;
  t: any;
  showOriginal: boolean;
  showTranslated: boolean;
}

const SubtitleRow = React.memo(({ 
  sub, 
  index, 
  isActive,
  onSeek, 
  onUpdateSubtitle, 
  onDeleteSubtitle, 
  onSplitSubtitleWithCurrentTime,
  onMergeSubtitle,
  openPopover,
  editingTime,
  setEditingTime,
  handleTimeEdit,
  t,
  showOriginal,
  showTranslated,
  style,
  isLast
}: {
  sub: SubtitleItem;
  index: number;
  isActive: boolean;
  onSeek: (time: number) => void;
  onUpdateSubtitle: (id: string, updates: Partial<SubtitleItem>) => void;
  onDeleteSubtitle: (id: string) => void;
  onSplitSubtitleWithCurrentTime: (id: string) => void;
  onMergeSubtitle: (id: string) => void;
  openPopover: (subId: string, anchorRect: DOMRect) => void;
  editingTime: { id: string; field: 'start' | 'end' } | null;
  setEditingTime: (val: { id: string; field: 'start' | 'end' } | null) => void;
  handleTimeEdit: (id: string, field: 'start' | 'end', value: string) => void;
  t: any;
  showOriginal: boolean;
  showTranslated: boolean;
  style?: React.CSSProperties;
  isLast: boolean;
}) => {
  const textAreaRef = useRef<HTMLDivElement>(null);

  const handleTextClick = () => {
    if (textAreaRef.current) {
      const rect = textAreaRef.current.getBoundingClientRect();
      openPopover(sub.id, rect);
    }
  };

  return (
    <div style={style} className="px-3 py-1">
      <div
        id={`subtitle-${sub.id}`}
        className={`p-2.5 rounded-2xl border transition-all group relative
          ${isActive 
            ? 'bg-blue-600/15 border-blue-500/50 ring-1 ring-blue-500/20 shadow-lg shadow-blue-900/10' 
            : 'bg-zinc-900/40 border-zinc-800/80 hover:bg-zinc-800/50 hover:border-zinc-700/80'}
        `}
      >
        {/* Header: timestamp + actions */}
        <div className="flex items-center justify-between mb-1.5 shrink-0">
          <div className="flex items-center gap-2">
            <div className="text-[10px] font-black text-zinc-600 min-w-[1.5rem] text-center">
              {index + 1}
            </div>
            {editingTime?.id === sub.id && editingTime?.field === 'start' ? (
              <input autoFocus type="text" defaultValue={formatTime(sub.startTime)}
                onBlur={(e) => { handleTimeEdit(sub.id, 'start', e.target.value); setEditingTime(null); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { handleTimeEdit(sub.id, 'start', e.currentTarget.value); setEditingTime(null); } }}
                className="w-20 px-1 py-1 rounded-lg bg-zinc-950 border border-blue-500 text-[10px] font-mono text-white text-center focus:outline-none"
              />
            ) : (
              <Tooltip content={t.doubleClickToEditTime}>
                <div className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold cursor-pointer transition-all duration-200 active:scale-95 ${isActive ? 'bg-blue-900/40 text-blue-300' : 'bg-zinc-800/80 text-zinc-400 hover:bg-zinc-700 hover:text-white'}`}
                  onClick={(e) => { if (e.detail === 2) setEditingTime({ id: sub.id, field: 'start' }); else onSeek(sub.startTime); }}>
                  {formatTime(sub.startTime)}
                </div>
              </Tooltip>
            )}
            <span className="text-zinc-600 font-black">—</span>
            {editingTime?.id === sub.id && editingTime?.field === 'end' ? (
              <input autoFocus type="text" defaultValue={formatTime(sub.endTime)}
                onBlur={(e) => { handleTimeEdit(sub.id, 'end', e.target.value); setEditingTime(null); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { handleTimeEdit(sub.id, 'end', e.currentTarget.value); setEditingTime(null); } }}
                className="w-20 px-1 py-1 rounded-lg bg-zinc-950 border border-blue-500 text-[10px] font-mono text-white text-center focus:outline-none"
              />
            ) : (
              <Tooltip content={t.doubleClickToEditTime}>
                <div className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold cursor-pointer transition-all duration-200 active:scale-95 ${isActive ? 'bg-zinc-700/50 text-zinc-300' : 'bg-zinc-800/80 text-zinc-400 hover:bg-zinc-700 hover:text-white'}`}
                  onClick={(e) => { if (e.detail === 2) setEditingTime({ id: sub.id, field: 'end' }); else onSeek(sub.endTime); }}>
                  {formatTime(sub.endTime)}
                </div>
              </Tooltip>
            )}
          </div>
          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <Tooltip content={t.editSubtitle}>
              <button onClick={handleTextClick} className="p-1.5 text-zinc-400 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-all">
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            </Tooltip>
            {!isLast && (
              <Tooltip content="Gộp với dòng tiếp theo">
                <button onClick={() => onMergeSubtitle(sub.id)} className="p-1.5 text-zinc-400 hover:text-orange-400 hover:bg-orange-400/10 rounded-lg transition-all">
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </Tooltip>
            )}
            <Tooltip content={t.splitSubtitle}>
              <button onClick={() => onSplitSubtitleWithCurrentTime(sub.id)} className="p-1.5 text-zinc-400 hover:text-cyan-400 hover:bg-cyan-400/10 rounded-lg transition-all">
                <Clock className="w-3.5 h-3.5" />
              </button>
            </Tooltip>
            <Tooltip content={t.deleteSubtitle}>
              <button onClick={() => onDeleteSubtitle(sub.id)} className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </Tooltip>
          </div>
        </div>

        {/* Text display — click to open popover */}
        <div
          ref={textAreaRef}
          className="px-1 cursor-pointer hover:bg-white/5 rounded-lg transition-colors py-0.5"
          onClick={handleTextClick}
        >
          {showOriginal && (
            <p className={`text-sm leading-snug ${isActive ? 'text-white' : 'text-zinc-200'} ${!sub.chinese ? 'italic text-zinc-500 text-xs' : 'font-medium'} whitespace-pre-wrap`}>
              {sub.chinese || t.clickToEditOriginal}
            </p>
          )}
          {showTranslated && sub.vietnamese && (
            <>
              {showOriginal && <div className="border-t border-white/8 my-1" />}
              <p className={`text-xs leading-snug italic whitespace-pre-wrap ${isActive ? 'text-blue-400' : 'text-blue-500/80'}`}>
                {sub.vietnamese}
              </p>
            </>
          )}
          {showTranslated && !sub.vietnamese && !showOriginal && (
            <p className="text-xs italic text-zinc-500">{t.clickToEditTranslated}</p>
          )}
        </div>
      </div>
    </div>
  );
}, (prev, next) => {
  return (
    prev.sub.id === next.sub.id &&
    prev.sub.startTime === next.sub.startTime &&
    prev.sub.endTime === next.sub.endTime &&
    prev.sub.chinese === next.sub.chinese &&
    prev.sub.vietnamese === next.sub.vietnamese &&
    prev.isActive === next.isActive &&
    prev.editingTime === next.editingTime &&
    prev.style?.top === next.style?.top &&
    prev.showOriginal === next.showOriginal &&
    prev.showTranslated === next.showTranslated
  );
});

SubtitleRow.displayName = "SubtitleRow";

const Row = React.memo(({ index, style, data }: { index: number; style: React.CSSProperties; data: ListData }) => {
  const { 
    subtitles, activeIndex, editingTime, onSeek, 
    onUpdateSubtitle, onDeleteSubtitle, onSplitSubtitleWithCurrentTime, 
    onMergeSubtitle, openPopover,
    setEditingTime, handleTimeEdit, t,
    showOriginal, showTranslated
  } = data;
  
  const sub = subtitles[index];
  if (!sub) return null;

  return (
    <SubtitleRow
      sub={sub}
      index={index}
      isActive={index === activeIndex}
      onSeek={onSeek}
      onUpdateSubtitle={onUpdateSubtitle}
      onDeleteSubtitle={onDeleteSubtitle}
      onSplitSubtitleWithCurrentTime={onSplitSubtitleWithCurrentTime}
      onMergeSubtitle={onMergeSubtitle}
      openPopover={openPopover}
      editingTime={editingTime}
      setEditingTime={setEditingTime}
      handleTimeEdit={handleTimeEdit}
      t={t}
      showOriginal={showOriginal}
      showTranslated={showTranslated}
      style={style}
      isLast={index === subtitles.length - 1}
    />
  );
});

Row.displayName = "Row";

// EditPopover — rendered via portal, position: fixed, không ảnh hưởng list layout
const EditPopover = React.memo(({
  sub, anchorRect, onUpdate, onClose, showOriginal, showTranslated, index, t
}: {
  sub: SubtitleItem;
  anchorRect: DOMRect;
  onUpdate: (id: string, updates: Partial<SubtitleItem>) => void;
  onClose: () => void;
  showOriginal: boolean;
  showTranslated: boolean;
  index: number;
  t: any;
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);
  const originalRef = useRef<HTMLTextAreaElement>(null);
  const translatedRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  const autoResize = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };

  useEffect(() => {
    autoResize(originalRef.current);
    autoResize(translatedRef.current);
    // Focus first textarea
    setTimeout(() => {
      if (showOriginal && originalRef.current) originalRef.current.focus();
      else if (showTranslated && translatedRef.current) translatedRef.current.focus();
    }, 50);
  }, []);

  // Luôn căn giữa màn hình — không phụ thuộc vào vị trí anchor
  const popoverWidth = Math.min(480, window.innerWidth - 32);
  const popoverMaxHeight = Math.min(400, window.innerHeight - 64);
  const left = (window.innerWidth - popoverWidth) / 2;
  const top = (window.innerHeight - popoverMaxHeight) / 2;

  // Close on outside click — giờ dùng backdrop, chỉ cần Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return createPortal(
    <AnimatePresence>
      {/* Backdrop mờ */}
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 bg-black/40 backdrop-blur-[2px]"
        style={{ zIndex: 9998 }}
        onClick={onClose}
      />
      <motion.div
        key="popover"
        ref={popoverRef}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
        style={{ position: 'fixed', left, top, width: popoverWidth, maxHeight: popoverMaxHeight, zIndex: 9999 }}
        className="bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <span className="text-xs font-black text-zinc-400 uppercase tracking-widest">
            Phụ đề #{index + 1}
          </span>
          <button onClick={onClose} className="p-1 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Fields */}
        <div className="p-4 space-y-3 overflow-y-auto flex-1">
          {showOriginal && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Phụ đề gốc</label>
              <textarea
                ref={originalRef}
                value={sub.chinese || ''}
                onChange={(e) => {
                  onUpdate(sub.id, { chinese: e.target.value });
                  autoResize(e.target);
                }}
                placeholder={t.clickToEditOriginal}
                className="w-full bg-zinc-800/60 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm font-medium text-white focus:outline-none focus:border-blue-500 resize-none leading-relaxed transition-colors"
                rows={2}
                style={{ minHeight: '60px', maxHeight: '160px', overflowY: 'auto' }}
              />
            </div>
          )}
          {showTranslated && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-blue-500/70 uppercase tracking-widest">Bản dịch</label>
              <textarea
                ref={translatedRef}
                value={sub.vietnamese || ''}
                onChange={(e) => {
                  onUpdate(sub.id, { vietnamese: e.target.value });
                  autoResize(e.target);
                }}
                placeholder={t.clickToEditTranslated}
                className="w-full bg-zinc-800/60 border border-blue-500/20 rounded-xl px-3 py-2.5 text-sm italic text-blue-400 focus:outline-none focus:border-blue-500/60 resize-none leading-relaxed transition-colors"
                rows={2}
                style={{ minHeight: '60px', maxHeight: '160px', overflowY: 'auto' }}
              />
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 pb-3">
          <p className="text-[10px] text-zinc-600">Nhấn Esc hoặc click ra ngoài để đóng</p>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
});

export const SubtitleView: React.FC<SubtitleViewProps> = React.memo(({ 
  subtitles, 
  currentTime, 
  onSeek, 
  onUpdateSubtitle,
  onDeleteSubtitle,
  onAddSubtitle,
  onSplitSubtitle,
  onMergeSubtitle,
  language,
  showOriginal,
  showTranslated,
  videoFileName,
}) => {
  const t = translations[language];
  const listRef = useRef<List>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [editingPopover, setEditingPopover] = useState<{ subId: string; anchorRect: DOMRect } | null>(null);
  const [editingTime, setEditingTime] = useState<{ id: string; field: 'start' | 'end' } | null>(null);

  const openPopover = useCallback((subId: string, anchorRect: DOMRect) => {
    setEditingPopover({ subId, anchorRect });
  }, []);

  const closePopover = useCallback(() => {
    setEditingPopover(null);
  }, []);
  const [lastActiveId, setLastActiveId] = useState<string | null>(null);
  const [containerHeight, setContainerHeight] = useState(600);

  useEffect(() => {
    const handleResize = () => {
      if (scrollContainerRef.current) {
        setContainerHeight(scrollContainerRef.current.offsetHeight);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleTimeEdit = useCallback((id: string, field: 'start' | 'end', value: string) => {
    const parts = value.split(/[:.]/);
    if (parts.length >= 2) {
      const mins = parseInt(parts[0]) || 0;
      const secs = parseInt(parts[1]) || 0;
      const ms = parts[2] ? parseInt(parts[2].padEnd(2, '0').slice(0, 2)) : 0;
      const totalSeconds = mins * 60 + secs + ms / 100;
      
      if (!isNaN(totalSeconds)) {
        onUpdateSubtitle(id, { [field === 'start' ? 'startTime' : 'endTime']: totalSeconds });
      }
    }
  }, [onUpdateSubtitle]);

  // Sync scroll to active item
  useEffect(() => {
    const activeIndex = subtitles.findIndex(s => currentTime >= s.startTime && currentTime <= s.endTime);
    if (activeIndex !== -1) {
      const activeId = subtitles[activeIndex].id;
      if (activeId !== lastActiveId && !editingPopover && !editingTime) {
        setLastActiveId(activeId);
        listRef.current?.scrollToItem(activeIndex, 'center');
      }
    } else if (lastActiveId) {
      setLastActiveId(null);
    }
  }, [currentTime, subtitles, lastActiveId, editingPopover, editingTime]);

  // Handle dynamic row heights
  const getItemSize = useCallback((index: number) => {
    const sub = subtitles[index];
    if (!sub) return 80;

    // Tính số dòng thực tế: đếm \n + wrap theo độ dài dòng
    const countLines = (text: string, charsPerLine: number) => {
      if (!text) return 1;
      return text.split('\n').reduce((acc, line) => {
        return acc + Math.max(1, Math.ceil(line.length / charsPerLine));
      }, 0);
    };

    let baseHeight = 56; // header row
    if (showOriginal) {
      baseHeight += countLines(sub.chinese || '', 50) * 22;
    }
    if (showTranslated && sub.vietnamese) {
      baseHeight += countLines(sub.vietnamese, 55) * 18 + 8;
    }
    if (!showOriginal && showTranslated && !sub.vietnamese) {
      baseHeight += 22;
    }
    return baseHeight + 16;
  }, [subtitles, showOriginal, showTranslated]);

  useEffect(() => {
    listRef.current?.resetAfterIndex(0);
  }, [subtitles, showOriginal, showTranslated]);

  const [isDownloadOpen, setIsDownloadOpen] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<'srt' | 'vtt' | 'json' | 'ass' | 'txt' | 'txt_clean'>('srt');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDownloadOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const downloadFile = (type: 'original' | 'translated', format: 'srt' | 'vtt' | 'json' | 'ass' | 'txt' | 'txt_clean') => {
    if (subtitles.length === 0) return;

    let content = '';
    let mimeType = 'text/plain';
    let extension = format === 'txt_clean' ? 'txt' : format;

    const getSubText = (sub: SubtitleItem) => type === 'original' ? sub.chinese : (sub.vietnamese || '');

    switch (format) {
      case 'srt':
        content = subtitles.map((sub, index) => {
          const text = getSubText(sub);
          return `${index + 1}\n${formatSRTTime(sub.startTime)} --> ${formatSRTTime(sub.endTime)}\n${text}\n`;
        }).join('\n');
        break;

      case 'vtt':
        content = 'WEBVTT\n\n' + subtitles.map((sub) => {
          const text = getSubText(sub);
          return `${formatVTTTime(sub.startTime)} --> ${formatVTTTime(sub.endTime)}\n${text}\n`;
        }).join('\n');
        break;

      case 'json':
        content = JSON.stringify(subtitles.map(sub => ({
          start: sub.startTime,
          end: sub.endTime,
          text: getSubText(sub)
        })), null, 2);
        mimeType = 'application/json';
        break;

      case 'ass':
        content = `[Script Info]\nTitle: Subtitles\nScriptType: v4.00+\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,Arial,20,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,2,2,10,10,10,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;
        content += subtitles.map(sub => {
          const text = getSubText(sub).replace(/\n/g, '\\N');
          return `Dialogue: 0,${formatASSTime(sub.startTime)},${formatASSTime(sub.endTime)},Default,,0,0,0,,${text}`;
        }).join('\n');
        break;

      case 'txt':
        content = subtitles.map(sub => {
          const text = getSubText(sub);
          return `[${formatSimpleTime(sub.startTime)} - ${formatSimpleTime(sub.endTime)}] ${text}`;
        }).join('\n');
        break;

      case 'txt_clean':
        content = subtitles.map(sub => getSubText(sub)).filter(t => t.trim()).join('\n');
        break;
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;

    // Tên file: [tên_video]_goc.srt hoặc [tên_video]_da_dich.srt
    const baseName = videoFileName
      ? videoFileName.replace(/\.[^/.]+$/, '').replace(/[<>:"/\\|?*]/g, '_')
      : 'subtitle';
    const suffix = type === 'original' ? 'original' : 'translated';
    a.download = `${baseName}_${suffix}.${extension}`;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setIsDownloadOpen(false);
    toast.success(`${t.downloadSuccess} ${type === 'original' ? t.originalSubtitle : t.translatedSubtitle} (${extension.toUpperCase()})`);
  };

  const currentTimeRef = useRef(currentTime);
  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  const onSplitSubtitleWithCurrentTime = useCallback((id: string) => {
    onSplitSubtitle(id, currentTimeRef.current);
  }, [onSplitSubtitle]);

  const activeIndex = useMemo(() => 
    subtitles.findIndex(s => currentTime >= s.startTime && currentTime <= s.endTime),
    [subtitles, currentTime]
  );

  const itemData: ListData = useMemo(() => ({
    subtitles,
    activeIndex,
    editingPopover,
    editingTime,
    onSeek,
    onUpdateSubtitle,
    onDeleteSubtitle,
    onSplitSubtitleWithCurrentTime,
    onMergeSubtitle,
    openPopover,
    setEditingTime,
    handleTimeEdit,
    t,
    showOriginal,
    showTranslated
  }), [subtitles, activeIndex, editingPopover, editingTime, onSeek, onUpdateSubtitle, onDeleteSubtitle, onSplitSubtitleWithCurrentTime, onMergeSubtitle, openPopover, setEditingTime, handleTimeEdit, t, showOriginal, showTranslated]);

  return (
    <div className="flex flex-col h-full rounded-xl overflow-hidden bg-zinc-950/40 border border-zinc-800/50">
      <div className="p-4 flex items-center justify-between border-b border-zinc-800/50 bg-zinc-900/30 shrink-0">
        <div className="flex items-center gap-4">
          <h3 className="text-sm font-mono uppercase tracking-widest text-zinc-500 flex items-center gap-2">
            <Clock className="w-4 h-4" /> {t.timeline}
          </h3>
          {subtitles.length > 0 && (
            <span className="px-3 py-1 bg-blue-600/20 text-blue-400 text-xs font-black rounded-lg border border-blue-500/20 tracking-tighter shadow-xl">
              {subtitles.length} {t.subtitleLines}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {subtitles.length > 0 && (
            <div className="relative" ref={dropdownRef}>
              <Tooltip content={t.downloadTooltip}>
                <button
                  onClick={() => setIsDownloadOpen(!isDownloadOpen)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black transition-all shadow-lg shadow-blue-900/20"
                >
                  <Download className="w-4 h-4" />
                  {t.downloadSubtitles}
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isDownloadOpen ? 'rotate-180' : ''}`} />
                </button>
              </Tooltip>

              <AnimatePresence>
                {isDownloadOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-2 w-80 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl z-50 overflow-hidden"
                  >
                    <div className="p-2 border-b border-zinc-800 bg-zinc-950/50">
                      <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-2 py-1">{t.fileFormat}</p>
                      <div className="grid grid-cols-2 gap-1 p-1">
                        {(['srt', 'vtt', 'json', 'ass', 'txt'] as const).map(fmt => (
                          <button
                            key={fmt}
                            onClick={() => setSelectedFormat(fmt)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-xs font-bold ${
                              selectedFormat === fmt 
                                ? 'bg-blue-600/20 text-blue-400 ring-1 ring-blue-500/30' 
                                : 'hover:bg-zinc-800 text-zinc-400 hover:text-white'
                            }`}
                          >
                            <FileText className={`w-3.5 h-3.5 ${selectedFormat === fmt ? 'text-blue-400' : 'text-zinc-500'}`} />
                            .{fmt.toUpperCase()}
                          </button>
                        ))}
                        <button
                          onClick={() => setSelectedFormat('txt_clean')}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-xs font-bold whitespace-nowrap ${
                            selectedFormat === 'txt_clean' 
                              ? 'bg-emerald-600/20 text-emerald-400 ring-1 ring-emerald-500/30' 
                              : 'hover:bg-zinc-800 text-zinc-400 hover:text-white'
                          }`}
                        >
                          <AlignLeft className={`w-3.5 h-3.5 ${selectedFormat === 'txt_clean' ? 'text-emerald-400' : 'text-zinc-500'}`} />
                          {t.contentOnly}
                        </button>
                      </div>
                    </div>

                    <div className="p-2 space-y-1">
                      <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-2 py-1">{t.downloadOptions}</p>
                      <button
                        onClick={() => downloadFile('original', selectedFormat)}
                        className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-zinc-800/50 text-zinc-300 hover:text-white transition-all group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-zinc-800 group-hover:bg-zinc-700 rounded-lg">
                            <Code className="w-4 h-4 text-zinc-400" />
                          </div>
                          <div className="text-left">
                            <p className="text-xs font-black">{t.downloadOriginal}</p>
                            <p className="text-[10px] text-zinc-500">{t.originalSubtitleDesc} (.{selectedFormat === 'txt_clean' ? 'txt' : selectedFormat.toUpperCase()})</p>
                          </div>
                        </div>
                        <Download className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>

                      <button
                        disabled={!subtitles.some(s => s.vietnamese)}
                        onClick={() => downloadFile('translated', selectedFormat)}
                        className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-zinc-800/50 text-zinc-300 hover:text-white transition-all group disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-600/10 group-enabled:group-hover:bg-blue-600/20 rounded-lg">
                            <Languages className="w-4 h-4 text-blue-400" />
                          </div>
                          <div className="text-left">
                            <p className="text-xs font-black">{t.downloadTranslated}</p>
                            <p className="text-[10px] text-zinc-500">{t.translatedSubtitleDesc} (.{selectedFormat === 'txt_clean' ? 'txt' : selectedFormat.toUpperCase()})</p>
                          </div>
                        </div>
                        <Download className="w-3.5 h-3.5 opacity-0 group-enabled:group-hover:opacity-100 transition-opacity" />
                      </button>
                    </div>

                    <div className="bg-zinc-950/80 p-3 flex items-start gap-2 border-t border-zinc-800">
                      <div className="p-1.5 bg-blue-500/10 rounded-lg mt-0.5">
                        <Check className="w-3 h-3 text-blue-400" />
                      </div>
                      <p className="text-[11px] text-zinc-400 leading-relaxed font-medium">
                        {t.downloadHint}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
          
          <Tooltip content="Thêm dòng phụ đề mới">
            <button
              onClick={() => onAddSubtitle(currentTime)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition-all"
            >
              + {t.addBtn}
            </button>
          </Tooltip>
        </div>
      </div>
      
      <div ref={scrollContainerRef} className="flex-1 min-h-0 relative">
        {subtitles.length === 0 ? (
          <div className="h-40 flex flex-col items-center justify-center text-zinc-600 p-8 text-center italic">
            <p>{t.noSubtitles}</p>
          </div>
        ) : (
          <List
            ref={listRef}
            height={containerHeight}
            itemCount={subtitles.length}
            itemSize={getItemSize}
            itemData={itemData}
            width="100%"
            className="custom-scrollbar"
          >
            {Row}
          </List>
        )}
      </div>

      {/* Edit Popover — rendered outside list, position: fixed */}
      {editingPopover && (() => {
        const sub = subtitles.find(s => s.id === editingPopover.subId);
        const idx = subtitles.findIndex(s => s.id === editingPopover.subId);
        if (!sub) return null;
        return (
          <EditPopover
            sub={sub}
            anchorRect={editingPopover.anchorRect}
            onUpdate={onUpdateSubtitle}
            onClose={closePopover}
            showOriginal={showOriginal}
            showTranslated={showTranslated}
            index={idx}
            t={t}
          />
        );
      })()}
    </div>
  );
});

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}

function formatSRTTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
}

function formatVTTTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}

function formatASSTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100); // ASS uses centiseconds
  
  return `${hours.toString().padStart(1, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}

function formatSimpleTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
