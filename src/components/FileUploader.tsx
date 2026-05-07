/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useRef } from 'react';
import { Upload, Video, FileWarning, Music } from 'lucide-react';
import { motion } from 'motion/react';
import { AppLanguage } from '../types';
import { translations } from '../i18n';
import { toast } from 'sonner';

interface FileUploaderProps {
  onFileSelect: (file: File) => void;
  isLoading: boolean;
  language: AppLanguage;
}

export const FileUploader: React.FC<FileUploaderProps> = ({ onFileSelect, isLoading, language }) => {
  const t = translations[language];
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (file.type.startsWith('video/') || file.type.startsWith('audio/')) {
      onFileSelect(file);
    } else {
      toast.error(t.videoFileError);
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full"
    >
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        onClick={() => !isLoading && inputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all
          ${isLoading ? 'opacity-50 cursor-not-allowed border-zinc-700' : 'border-zinc-800 hover:border-blue-500 hover:bg-blue-500/5 bg-zinc-900/40'}
        `}
        id="uploader-container"
      >
        <input
          type="file"
          ref={inputRef}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
          className="hidden"
          accept="video/*,audio/*"
        />
        <div className="p-3 bg-zinc-900 rounded-full mb-4 border border-zinc-800">
          <Upload className="w-6 h-6 text-blue-400" />
        </div>
        <h3 className="text-lg font-bold mb-1">{t.upload}</h3>
        <p className="text-zinc-500 text-center text-sm mb-6 max-w-xs" dangerouslySetInnerHTML={{ __html: t.uploadDesc }} />
        <div className="flex items-center gap-4 text-[10px] font-mono text-zinc-600 uppercase tracking-widest">
          <span className="flex items-center gap-1"><Video className="w-3 h-3" /> MP4/MOV</span>
          <span className="flex items-center gap-1"><Music className="w-3 h-3" /> MP3/WAV/M4A</span>
          <span className="w-1 h-1 bg-zinc-700 rounded-full" />
          <span className="flex items-center gap-1"><FileWarning className="w-3 h-3" /> MULTILINGUAL</span>
        </div>
      </div>
    </motion.div>
  );
};
