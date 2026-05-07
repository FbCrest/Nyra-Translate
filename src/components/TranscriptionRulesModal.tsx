import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Plus,
  Trash2,
  BookOpen,
  Users,
  AlignLeft,
  SpellCheck,
  Heart,
  StickyNote,
  ChevronDown,
  ChevronUp,
  Save,
  RotateCcw,
  Info,
} from "lucide-react";
import {
  TranscriptionRules,
  TerminologyEntry,
  SpeakerEntry,
  DEFAULT_RULES,
  getTranscriptionRules,
  saveTranscriptionRules,
  clearTranscriptionRules,
} from "../services/transcriptionRulesService";
import { toast } from "sonner";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

type SectionKey = keyof Omit<TranscriptionRules, 'terminology' | 'speakerIdentification'>;

interface Section {
  key: string;
  label: string;
  icon: React.ReactNode;
  description: string;
  placeholder: string;
}

const LIST_SECTIONS: Section[] = [
  {
    key: "formattingConventions",
    label: "Quy tắc định dạng",
    icon: <AlignLeft className="w-4 h-4" />,
    description: "Quy tắc về cách trình bày, dấu câu, khoảng cách...",
    placeholder: "Ví dụ: Dùng dấu chấm lửng (...) khi câu bị ngắt giữa chừng",
  },
  {
    key: "spellingAndGrammar",
    label: "Chính tả & Ngữ pháp",
    icon: <SpellCheck className="w-4 h-4" />,
    description: "Quy tắc chính tả, ngữ pháp đặc thù cho nội dung này...",
    placeholder: "Ví dụ: Viết hoa tên nhân vật, địa danh",
  },
  {
    key: "relationships",
    label: "Quan hệ & Xưng hô",
    icon: <Heart className="w-4 h-4" />,
    description: "Cách xưng hô giữa các nhân vật, thứ bậc xã hội...",
    placeholder: "Ví dụ: Nhân vật A gọi nhân vật B là 'Sư phụ'",
  },
  {
    key: "additionalNotes",
    label: "Ghi chú thêm",
    icon: <StickyNote className="w-4 h-4" />,
    description: "Các lưu ý khác cho AI khi phiên âm...",
    placeholder: "Ví dụ: Video có nhiều tiếng ồn nền, ưu tiên lời thoại chính",
  },
];

export function TranscriptionRulesModal({ isOpen, onClose }: Props) {
  const [rules, setRules] = useState<TranscriptionRules>({ ...DEFAULT_RULES });
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["terminology"])
  );
  const [newTermTerm, setNewTermTerm] = useState("");
  const [newTermDef, setNewTermDef] = useState("");
  const [newSpeakerId, setNewSpeakerId] = useState("");
  const [newSpeakerDesc, setNewSpeakerDesc] = useState("");
  const [listInputs, setListInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      const saved = getTranscriptionRules();
      setRules(saved ? { ...DEFAULT_RULES, ...saved } : { ...DEFAULT_RULES });
    }
  }, [isOpen]);

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSave = () => {
    saveTranscriptionRules(rules);
    toast.success("Đã lưu quy tắc phiên âm", {
      description: "Quy tắc sẽ được áp dụng cho lần phiên âm tiếp theo.",
    });
    onClose();
  };

  const handleClear = () => {
    clearTranscriptionRules();
    setRules({ ...DEFAULT_RULES });
    toast.info("Đã xoá tất cả quy tắc phiên âm");
  };

  const addTerminology = () => {
    if (!newTermTerm.trim()) return;
    setRules((prev) => ({
      ...prev,
      terminology: [
        ...prev.terminology,
        { term: newTermTerm.trim(), definition: newTermDef.trim() },
      ],
    }));
    setNewTermTerm("");
    setNewTermDef("");
  };

  const removeTerminology = (index: number) => {
    setRules((prev) => ({
      ...prev,
      terminology: prev.terminology.filter((_, i) => i !== index),
    }));
  };

  const addSpeaker = () => {
    if (!newSpeakerId.trim()) return;
    setRules((prev) => ({
      ...prev,
      speakerIdentification: [
        ...prev.speakerIdentification,
        { speakerId: newSpeakerId.trim(), description: newSpeakerDesc.trim() },
      ],
    }));
    setNewSpeakerId("");
    setNewSpeakerDesc("");
  };

  const removeSpeaker = (index: number) => {
    setRules((prev) => ({
      ...prev,
      speakerIdentification: prev.speakerIdentification.filter((_, i) => i !== index),
    }));
  };

  const addListItem = (key: string) => {
    const value = listInputs[key]?.trim();
    if (!value) return;
    setRules((prev) => ({
      ...prev,
      [key]: [...((prev as any)[key] || []), value],
    }));
    setListInputs((prev) => ({ ...prev, [key]: "" }));
  };

  const removeListItem = (key: string, index: number) => {
    setRules((prev) => ({
      ...prev,
      [key]: ((prev as any)[key] || []).filter((_: any, i: number) => i !== index),
    }));
  };

  const hasRules =
    rules.atmosphere ||
    rules.terminology.length > 0 ||
    rules.speakerIdentification.length > 0 ||
    rules.formattingConventions.length > 0 ||
    rules.spellingAndGrammar.length > 0 ||
    rules.relationships.length > 0 ||
    rules.additionalNotes.length > 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
                  <BookOpen className="w-4 h-4 text-indigo-400" />
                </div>
                <div>
                  <h2 className="font-bold text-white text-sm">Quy tắc phiên âm</h2>
                  <p className="text-xs text-zinc-500">
                    Giúp AI phiên âm chính xác hơn với nội dung đặc thù
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-6 py-3 space-y-3">
              {/* Info banner — nằm trong scroll */}
              <div className="px-4 py-3 rounded-xl bg-blue-500/10 border border-blue-500/20 flex gap-3">
                <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-300 leading-relaxed">
                  Quy tắc này sẽ được tự động thêm vào prompt phiên âm. Hữu ích cho video game, phim có thuật ngữ chuyên môn, hoặc nội dung đặc thù.
                </p>
              </div>
              {/* Atmosphere */}
              <div className="rounded-xl border border-zinc-800 overflow-hidden">
                <button
                  onClick={() => toggleSection("atmosphere")}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-800/50 transition-colors"
                >
                  <div className="flex items-center gap-2 text-sm font-medium text-zinc-300">
                    <span>🎬</span>
                    <span>Bối cảnh / Không khí</span>
                    {rules.atmosphere && (
                      <span className="px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 text-[10px] font-bold">✓</span>
                    )}
                  </div>
                  {expandedSections.has("atmosphere") ? (
                    <ChevronUp className="w-4 h-4 text-zinc-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-zinc-500" />
                  )}
                </button>
                <AnimatePresence>
                  {expandedSections.has("atmosphere") && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: "auto" }}
                      exit={{ height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4">
                        <p className="text-xs text-zinc-500 mb-2">
                          Mô tả ngắn về nội dung video để AI hiểu ngữ cảnh tốt hơn
                        </p>
                        <textarea
                          value={rules.atmosphere}
                          onChange={(e) =>
                            setRules((prev) => ({ ...prev, atmosphere: e.target.value }))
                          }
                          placeholder="Ví dụ: Video hướng dẫn game MMORPG tiếng Trung, có nhiều thuật ngữ kỹ năng và tên boss..."
                          rows={3}
                          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 resize-none focus:outline-none focus:border-indigo-500 transition-colors"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Terminology */}
              <div className="rounded-xl border border-zinc-800 overflow-hidden">
                <button
                  onClick={() => toggleSection("terminology")}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-800/50 transition-colors"
                >
                  <div className="flex items-center gap-2 text-sm font-medium text-zinc-300">
                    <BookOpen className="w-4 h-4 text-amber-400" />
                    <span>Thuật ngữ & Tên riêng</span>
                    {rules.terminology.length > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold">
                        {rules.terminology.length}
                      </span>
                    )}
                  </div>
                  {expandedSections.has("terminology") ? (
                    <ChevronUp className="w-4 h-4 text-zinc-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-zinc-500" />
                  )}
                </button>
                <AnimatePresence>
                  {expandedSections.has("terminology") && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: "auto" }}
                      exit={{ height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 space-y-3">
                        <p className="text-xs text-zinc-500">
                          Tên nhân vật, kỹ năng, địa danh, thuật ngữ chuyên môn...
                        </p>

                        {/* Existing terms */}
                        {rules.terminology.map((entry, i) => (
                          <div
                            key={i}
                            className="flex items-start gap-2 p-2 rounded-lg bg-zinc-800/50 border border-zinc-700/50"
                          >
                            <div className="flex-1 min-w-0">
                              <span className="text-xs font-bold text-amber-400">{entry.term}</span>
                              {entry.definition && (
                                <span className="text-xs text-zinc-400 ml-2">→ {entry.definition}</span>
                              )}
                            </div>
                            <button
                              onClick={() => removeTerminology(i)}
                              className="text-zinc-600 hover:text-red-400 transition-colors shrink-0"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}

                        {/* Add new term */}
                        <div className="space-y-2">
                          <input
                            value={newTermTerm}
                            onChange={(e) => setNewTermTerm(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && addTerminology()}
                            placeholder="Thuật ngữ (vd: 腐潮, Phụ Triều)"
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition-colors"
                          />
                          <div className="flex gap-2">
                            <input
                              value={newTermDef}
                              onChange={(e) => setNewTermDef(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && addTerminology()}
                              placeholder="Giải thích / cách phiên âm (tuỳ chọn)"
                              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition-colors"
                            />
                            <button
                              onClick={addTerminology}
                              disabled={!newTermTerm.trim()}
                              className="px-3 py-2 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-400 hover:bg-amber-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Speaker Identification */}
              <div className="rounded-xl border border-zinc-800 overflow-hidden">
                <button
                  onClick={() => toggleSection("speakers")}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-800/50 transition-colors"
                >
                  <div className="flex items-center gap-2 text-sm font-medium text-zinc-300">
                    <Users className="w-4 h-4 text-emerald-400" />
                    <span>Nhận diện người nói</span>
                    {rules.speakerIdentification.length > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                        {rules.speakerIdentification.length}
                      </span>
                    )}
                  </div>
                  {expandedSections.has("speakers") ? (
                    <ChevronUp className="w-4 h-4 text-zinc-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-zinc-500" />
                  )}
                </button>
                <AnimatePresence>
                  {expandedSections.has("speakers") && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: "auto" }}
                      exit={{ height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 space-y-3">
                        <p className="text-xs text-zinc-500">
                          Mô tả giọng nói của từng người để AI nhận diện chính xác hơn
                        </p>

                        {rules.speakerIdentification.map((entry, i) => (
                          <div
                            key={i}
                            className="flex items-start gap-2 p-2 rounded-lg bg-zinc-800/50 border border-zinc-700/50"
                          >
                            <div className="flex-1 min-w-0">
                              <span className="text-xs font-bold text-emerald-400">{entry.speakerId}</span>
                              {entry.description && (
                                <span className="text-xs text-zinc-400 ml-2">→ {entry.description}</span>
                              )}
                            </div>
                            <button
                              onClick={() => removeSpeaker(i)}
                              className="text-zinc-600 hover:text-red-400 transition-colors shrink-0"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}

                        <div className="space-y-2">
                          <input
                            value={newSpeakerId}
                            onChange={(e) => setNewSpeakerId(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && addSpeaker()}
                            placeholder="Tên người nói (vd: Nhân vật A, Host)"
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors"
                          />
                          <div className="flex gap-2">
                            <input
                              value={newSpeakerDesc}
                              onChange={(e) => setNewSpeakerDesc(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && addSpeaker()}
                              placeholder="Mô tả giọng nói (tuỳ chọn)"
                              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors"
                            />
                            <button
                              onClick={addSpeaker}
                              disabled={!newSpeakerId.trim()}
                              className="px-3 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* List sections */}
              {LIST_SECTIONS.map((section) => {
                const items: string[] = (rules as any)[section.key] || [];
                return (
                  <div key={section.key} className="rounded-xl border border-zinc-800 overflow-hidden">
                    <button
                      onClick={() => toggleSection(section.key)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-800/50 transition-colors"
                    >
                      <div className="flex items-center gap-2 text-sm font-medium text-zinc-300">
                        <span className="text-zinc-400">{section.icon}</span>
                        <span>{section.label}</span>
                        {items.length > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full bg-zinc-700 text-zinc-400 text-[10px] font-bold">
                            {items.length}
                          </span>
                        )}
                      </div>
                      {expandedSections.has(section.key) ? (
                        <ChevronUp className="w-4 h-4 text-zinc-500" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-zinc-500" />
                      )}
                    </button>
                    <AnimatePresence>
                      {expandedSections.has(section.key) && (
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: "auto" }}
                          exit={{ height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-4 space-y-2">
                            <p className="text-xs text-zinc-500">{section.description}</p>

                            {items.map((item, i) => (
                              <div
                                key={i}
                                className="flex items-center gap-2 p-2 rounded-lg bg-zinc-800/50 border border-zinc-700/50"
                              >
                                <span className="flex-1 text-xs text-zinc-300">{item}</span>
                                <button
                                  onClick={() => removeListItem(section.key, i)}
                                  className="text-zinc-600 hover:text-red-400 transition-colors shrink-0"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}

                            <div className="flex gap-2">
                              <input
                                value={listInputs[section.key] || ""}
                                onChange={(e) =>
                                  setListInputs((prev) => ({
                                    ...prev,
                                    [section.key]: e.target.value,
                                  }))
                                }
                                onKeyDown={(e) =>
                                  e.key === "Enter" && addListItem(section.key)
                                }
                                placeholder={section.placeholder}
                                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
                              />
                              <button
                                onClick={() => addListItem(section.key)}
                                disabled={!listInputs[section.key]?.trim()}
                                className="px-3 py-2 rounded-lg bg-zinc-700/50 border border-zinc-600 text-zinc-400 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800 shrink-0">
              <button
                onClick={handleClear}
                disabled={!hasRules}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-zinc-500 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Xoá tất cả
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                >
                  Huỷ
                </button>
                <button
                  onClick={handleSave}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
                >
                  <Save className="w-4 h-4" />
                  Lưu quy tắc
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
