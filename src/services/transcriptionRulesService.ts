/**
 * Service quản lý quy tắc phiên âm (Transcription Rules)
 * Cho phép người dùng định nghĩa thuật ngữ, người nói, quy tắc định dạng
 * để cải thiện độ chính xác khi phiên âm và dịch.
 */

export interface TerminologyEntry {
  term: string;
  definition: string;
}

export interface SpeakerEntry {
  speakerId: string;
  description: string;
}

export interface TranscriptionRules {
  atmosphere?: string;
  terminology: TerminologyEntry[];
  speakerIdentification: SpeakerEntry[];
  formattingConventions: string[];
  spellingAndGrammar: string[];
  relationships: string[];
  additionalNotes: string[];
}

const STORAGE_KEY = 'zhiyu_transcription_rules';

export const DEFAULT_RULES: TranscriptionRules = {
  atmosphere: '',
  terminology: [],
  speakerIdentification: [],
  formattingConventions: [],
  spellingAndGrammar: [],
  relationships: [],
  additionalNotes: [],
};

export function getTranscriptionRules(): TranscriptionRules | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;
    const parsed = JSON.parse(saved) as TranscriptionRules;
    // Validate it has at least some content
    const hasContent =
      parsed.atmosphere ||
      parsed.terminology?.length > 0 ||
      parsed.speakerIdentification?.length > 0 ||
      parsed.formattingConventions?.length > 0 ||
      parsed.spellingAndGrammar?.length > 0 ||
      parsed.relationships?.length > 0 ||
      parsed.additionalNotes?.length > 0;
    return hasContent ? parsed : null;
  } catch {
    return null;
  }
}

export function saveTranscriptionRules(rules: TranscriptionRules): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
}

export function clearTranscriptionRules(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Tạo đoạn text quy tắc để inject vào prompt phiên âm
 */
export function buildRulesText(rules: TranscriptionRules): string {
  let rulesText = '\n\nAdditional transcription rules to follow:\n';

  if (rules.atmosphere) {
    rulesText += `\n- Atmosphere/Context: ${rules.atmosphere}\n`;
  }

  if (rules.terminology?.length > 0) {
    rulesText += '\n- Terminology and Proper Nouns:\n';
    rules.terminology.forEach(term => {
      rulesText += `  * ${term.term}: ${term.definition}\n`;
    });
  }

  if (rules.speakerIdentification?.length > 0) {
    rulesText += '\n- Speaker Identification:\n';
    rules.speakerIdentification.forEach(speaker => {
      rulesText += `  * ${speaker.speakerId}: ${speaker.description}\n`;
    });
  }

  if (rules.formattingConventions?.length > 0) {
    rulesText += '\n- Formatting and Style Conventions:\n';
    rules.formattingConventions.forEach(convention => {
      rulesText += `  * ${convention}\n`;
    });
  }

  if (rules.spellingAndGrammar?.length > 0) {
    rulesText += '\n- Spelling, Grammar, and Punctuation:\n';
    rules.spellingAndGrammar.forEach(rule => {
      rulesText += `  * ${rule}\n`;
    });
  }

  if (rules.relationships?.length > 0) {
    rulesText += '\n- Relationships and Social Hierarchy:\n';
    rules.relationships.forEach(rel => {
      rulesText += `  * ${rel}\n`;
    });
  }

  if (rules.additionalNotes?.length > 0) {
    rulesText += '\n- Additional Notes:\n';
    rules.additionalNotes.forEach(note => {
      rulesText += `  * ${note}\n`;
    });
  }

  return rulesText;
}
