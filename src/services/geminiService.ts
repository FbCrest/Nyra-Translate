/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from "@google/genai";
import { SubtitleItem, GeminiKeyRecord } from "../types";
import { getTranscriptionRules, buildRulesText } from "./transcriptionRulesService";

function getGenAI(apiKey: string) {
  if (!apiKey) throw new Error("No API Key provided. Please set it in Settings.");
  return new GoogleGenAI({ apiKey });
}

const MODEL_MAPPING: Record<string, string> = {
  'gemini-2.5-pro':        'gemini-2.5-pro',
  'gemini-2.5-flash':      'gemini-2.5-flash',
  'gemini-2.5-flash-lite': 'gemini-2.5-flash-lite',
  'gemini-2.0-flash':      'gemini-2.0-flash',
  'gemini-2.0-flash-lite': 'gemini-2.0-flash-lite',
};

function resolveModel(model: string): string {
  return MODEL_MAPPING[model] || model || 'gemini-2.5-flash';
}

// System instruction cho transcription — nhất quán với responseSchema dùng MMmSSsNNNms string
const TRANSCRIPTION_SYSTEM = `You are an expert transcriber and video/audio analysis specialist.
Your task is to process the entire content from beginning to end and provide complete, accurate subtitles.

CRITICAL RULES:
1. PROCESS EVERYTHING: Do not stop until you reach the very end. Never truncate or summarize.
2. TIMESTAMP FORMAT: Use MMmSSsNNNms string format (e.g. "02m30s500ms" for 2 min 30.5 sec).
3. COMPLETENESS: Capture every spoken word or relevant audio segment.
4. GRANULARITY: Keep segments short (2-6 seconds) for better sync with audio.
5. ACCURACY: Timestamps must precisely match when speech starts and ends.
6. NO OVERLAP: Segments must not overlap in time.

Output a JSON array. Each object must have:
- startTime: string in MMmSSsNNNms format
- endTime: string in MMmSSsNNNms format
- text: string (transcribed content)`;

// System instruction cho dịch thuật
const TRANSLATION_SYSTEM = `You are a professional subtitle translator specializing in Chinese to Vietnamese translation for game and entertainment content.
Your role is to translate subtitle text accurately while preserving timing, context, and game-specific terminology.
Always return valid JSON array only — no markdown, no explanation, no code blocks.`;

/**
 * Tạo prompt dịch với rules inject từ TranscriptionRules nếu có
 */
function buildTranslationPrompt(subtitleText: string, targetLanguage: string): string {
  const rules = getTranscriptionRules();
  let rulesSection = '';

  if (rules) {
    rulesSection = '\n\n**CONTEXT FROM VIDEO ANALYSIS (use for consistent translation):**\n';
    if (rules.atmosphere) {
      rulesSection += `- Context/Atmosphere: ${rules.atmosphere}\n`;
    }
    if (rules.terminology?.length > 0) {
      rulesSection += '- Known terminology (MUST use these translations):\n';
      rules.terminology.forEach(t => {
        rulesSection += `  * "${t.term}" → "${t.definition}"\n`;
      });
    }
    if (rules.relationships?.length > 0) {
      rulesSection += '- Character relationships:\n';
      rules.relationships.forEach(r => { rulesSection += `  * ${r}\n`; });
    }
    if (rules.additionalNotes?.length > 0) {
      rulesSection += '- Additional notes:\n';
      rules.additionalNotes.forEach(n => { rulesSection += `  * ${n}\n`; });
    }
  }

  return `You are a professional subtitle translator specializing in game content. Below is a list of subtitles in JSON format. Your task is to translate the "text" of each subtitle into ${targetLanguage}.

CRITICAL TRANSLATION RULES:

**1. GAME TERMINOLOGY - DO NOT TRANSLATE:**
- Character names, boss names, skill names: Keep original or use Sino-Vietnamese pronunciation (Hán Việt)
- Class/Job names: Use correct Sino-Vietnamese (腐潮 = Phụ Triều, not Phủ Triều)
- Location names in games: Use Sino-Vietnamese (山内 = Sơn Nội, 关山藏锋 = Quan Sơn Tàng Phong)
- Item names: Use Sino-Vietnamese + explanation in parentheses if needed

**2. GAMING CONTEXT:**
- Keep technical terms: Tank, DPS, AOE, buff, boss, P1/P2
- Use correct Sino-Vietnamese pronunciation, not literal meaning
- Translate meaning, not word-by-word
- Prioritize clarity for Vietnamese gamers

**3. TRANSLATION EXAMPLES:**
- ❌ "núi 4,5,6" → ✅ "Sơn Nội 4,5,6" (game location name)
- ❌ "thử thách vinh dự" → ✅ "Thử Thách Vinh Dự" (game mode name)
- ❌ "无间霜影" → ✅ "Vô Gian Sương Ảnh" (boss name)
- ❌ "符龙签" → ✅ "Phù Long Ký" (item name)
- ✅ "腐潮" → "Phụ Triều" (correct Sino-Vietnamese)
- ❌ "腐潮" → "Phủ Triều" (wrong)

**4. AVOID:**
- Word-by-word mechanical translation
- Using difficult Sino-Vietnamese when simple Vietnamese exists
- Keeping English words that have a natural Vietnamese equivalent
${rulesSection}
**5. TECHNICAL INSTRUCTIONS:**
1. Translate ONLY the value of the "text" key for each object.
2. Preserve "id", "startTime", "endTime" values EXACTLY as they are.
3. Ensure translated text is natural and easy to read for Vietnamese gamers.
4. Return ONLY a valid JSON array — no markdown, no code blocks, no explanation.
5. Escape any special characters in translated text properly.

Example input:
[
    { "id": "sub-0", "startTime": 1.234, "endTime": 3.456, "text": "关山藏锋,荣誉挑战第三周山内456超详细指挥攻略" },
    { "id": "sub-1", "startTime": 4.123, "endTime": 5.789, "text": "老四无间霜影" }
]

Example output for Tiếng Việt:
[
    { "id": "sub-0", "startTime": 1.234, "endTime": 3.456, "text": "Quan Sơn Tàng Phong, hướng dẫn chỉ huy siêu chi tiết Thử Thách Vinh Dự tuần 3 - Sơn Nội 4,5,6" },
    { "id": "sub-1", "startTime": 4.123, "endTime": 5.789, "text": "Boss 4: Vô Gian Sương Ảnh" }
]

Now, please translate the following subtitles into ${targetLanguage}:
${subtitleText}`;
}

/**
 * Tự động thử lại với key khác khi gặp lỗi quota/rate-limit.
 * Không skip key dựa trên errorCount — user tự quản lý key.
 * Reset errorCount về 0 sau mỗi lần thành công.
 */
async function executeWithRotation<T>(
  apiKeys: GeminiKeyRecord[],
  activeKeyId: string | null,
  onKeyError: (id: string, error: any) => void,
  onKeySuccess: (id: string) => void,
  task: (ai: any) => Promise<T>
): Promise<T> {
  // Active key luôn được thử trước, sau đó theo thứ tự errorCount tăng dần
  const sortedKeys = [...apiKeys].sort((a, b) => {
    if (a.id === activeKeyId) return -1;
    if (b.id === activeKeyId) return 1;
    return a.errorCount - b.errorCount;
  });

  let lastError: any;
  for (const keyRecord of sortedKeys) {
    try {
      const ai = getGenAI(keyRecord.key);
      const result = await task(ai);
      // Reset errorCount sau khi thành công
      onKeySuccess(keyRecord.id);
      return result;
    } catch (error: any) {
      lastError = error;
      const isQuotaError =
        error?.message?.includes('429') ||
        error?.message?.includes('quota') ||
        error?.message?.includes('RESOURCE_EXHAUSTED');
      if (isQuotaError) {
        onKeyError(keyRecord.id, error);
        continue; // Thử key tiếp theo
      }
      throw error; // Lỗi khác thì throw ngay
    }
  }
  throw lastError || new Error('All API keys failed or no keys available.');
}

/**
 * Convert timestamp string sang seconds
 * Hỗ trợ: "00m30s500ms", "1.5" (float), "0:30" (MM:SS), "0:00:30" (HH:MM:SS)
 */
function parseTimeString(value: string | number): number {
  if (typeof value === 'number') return value;
  if (!value || typeof value !== 'string') return 0;

  // Format: MMmSSsNNNms (e.g., "00m30s500ms")
  const msFormat = value.match(/(\d+)m(\d+)s(\d+)ms/);
  if (msFormat) {
    return parseInt(msFormat[1]) * 60 + parseInt(msFormat[2]) + parseInt(msFormat[3]) / 1000;
  }

  // Format: float string (e.g., "1.5")
  const floatVal = parseFloat(value);
  if (!isNaN(floatVal)) return floatVal;

  // Format: HH:MM:SS.mmm
  const hhmmss = value.match(/(\d+):(\d+):(\d+)(?:\.(\d+))?/);
  if (hhmmss) {
    return parseInt(hhmmss[1]) * 3600 + parseInt(hhmmss[2]) * 60 + parseInt(hhmmss[3]) + (hhmmss[4] ? parseInt(hhmmss[4]) / 1000 : 0);
  }

  // Format: MM:SS
  const mmss = value.match(/(\d+):(\d+)/);
  if (mmss) {
    return parseInt(mmss[1]) * 60 + parseInt(mmss[2]);
  }

  return 0;
}

/**
 * Parse text format [MMmSSsNNNms - MMmSSsNNNms] Text (fallback)
 */
function parseTimestampResponse(text: string): Array<{ startTime: number; endTime: number; text: string }> {
  const results: Array<{ startTime: number; endTime: number; text: string }> = [];
  if (!text) return results;

  const regexMs = /\[\s*(\d+)m(\d+)s(?:(\d+)ms)?\s*(?:[-–]\s*)?(\d+)m(\d+)s(?:(\d+)ms)?\s*\]\s*(.+?)(?=\[|\s*$)/gs;
  let match: RegExpExecArray | null;

  while ((match = regexMs.exec(text)) !== null) {
    const content = match[7].trim();
    if (content) {
      results.push({
        startTime: parseInt(match[1]) * 60 + parseInt(match[2]) + (match[3] ? parseInt(match[3]) / 1000 : 0),
        endTime:   parseInt(match[4]) * 60 + parseInt(match[5]) + (match[6] ? parseInt(match[6]) / 1000 : 0),
        text: content,
      });
    }
  }

  if (results.length > 0) return results;

  const regexColon = /\[\s*(\d+):(\d+)\s*[-–]\s*(\d+):(\d+)\s*\]\s*(.+?)(?=\[|\s*$)/gs;
  while ((match = regexColon.exec(text)) !== null) {
    const content = match[5].trim();
    if (content) {
      results.push({
        startTime: parseInt(match[1]) * 60 + parseInt(match[2]),
        endTime:   parseInt(match[3]) * 60 + parseInt(match[4]),
        text: content,
      });
    }
  }

  return results;
}

/**
 * Safe JSON parse với fallback từng item
 */
function safeParseJsonArray(raw: string): any[] {
  const stripped = raw.trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  // Thử parse toàn bộ trước
  try {
    const parsed = JSON.parse(stripped);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {}

  // Fallback: tìm và parse từng object riêng lẻ
  const results: any[] = [];
  const objectRegex = /\{[^{}]*\}/g;
  let m: RegExpExecArray | null;
  while ((m = objectRegex.exec(stripped)) !== null) {
    try {
      results.push(JSON.parse(m[0]));
    } catch (_) {}
  }
  if (results.length > 0) {
    console.warn('[Parse] Full JSON failed, recovered', results.length, 'items via fallback');
  }
  return results;
}

/**
 * Build prompt transcription: thay {contentType}, TARGET_LANGUAGE, inject rules
 */
function buildTranscriptionPrompt(basePrompt: string, contentType: string): string {
  let prompt = basePrompt.replace(/\{contentType\}/g, contentType);

  const targetLanguage = localStorage.getItem('translation_target_language') || 'Tiếng Việt';
  if (prompt.includes('TARGET_LANGUAGE')) {
    prompt = prompt.replace(/TARGET_LANGUAGE/g, targetLanguage);
  }

  const rules = getTranscriptionRules();
  if (rules) {
    prompt += buildRulesText(rules);
  }

  return prompt;
}

export async function transcribeVideo(
  videoBase64: string,
  mimeType: string,
  apiKeys: GeminiKeyRecord[],
  activeKeyId: string | null,
  model: string,
  prompt: string,
  onKeyError: (id: string, error: any) => void,
  onKeySuccess: (id: string) => void = () => {},
): Promise<SubtitleItem[]> {
  const contentType = mimeType.startsWith('video') ? 'video' : 'audio';
  const finalPrompt = buildTranscriptionPrompt(prompt, contentType);
  const realModelName = resolveModel(model);

  return executeWithRotation(apiKeys, activeKeyId, onKeyError, onKeySuccess, async (ai) => {
    const response = await ai.models.generateContent({
      model: realModelName,
      systemInstruction: TRANSCRIPTION_SYSTEM,
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { data: videoBase64, mimeType } },
            { text: finalPrompt },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              startTime: {
                type: 'string',
                description: "Start time in MMmSSsNNNms format (e.g. '02m30s500ms')"
              },
              endTime: {
                type: 'string',
                description: "End time in MMmSSsNNNms format (e.g. '02m33s000ms')"
              },
              text: {
                type: 'string',
                description: 'Transcribed text content'
              }
            },
            required: ['startTime', 'endTime', 'text'],
          }
        },
        maxOutputTokens: 65536,
        topK: 32,
        topP: 0.95,
      },
    });

    const rawText = response.text || '';
    console.log('[Transcribe] Raw response length:', rawText.length);
    console.log('[Transcribe] Raw response preview:', rawText.slice(0, 300));

    let items: Array<{ startTime: number; endTime: number; text: string }> = [];

    const arr = safeParseJsonArray(rawText);
    if (arr.length > 0) {
      items = arr
        .map((item: any) => ({
          startTime: parseTimeString(item.startTime ?? item.start ?? '0'),
          endTime:   parseTimeString(item.endTime   ?? item.end   ?? '0'),
          text:      (item.text ?? item.label ?? item.content ?? '').trim(),
        }))
        .filter((item: any) => item.text !== '');
      console.log('[Transcribe] Parsed items:', items.length);
    } else {
      // Fallback text format
      items = parseTimestampResponse(rawText);
      console.log('[Transcribe] Fallback timestamp parse, items:', items.length);
    }

    if (items.length === 0) {
      console.warn('[Transcribe] No items parsed! Full response:', rawText);
    }

    return items.map((item, index) => ({
      id: `sub-${index}`,
      startTime: item.startTime,
      endTime:   item.endTime,
      chinese:   item.text,
    }));
  });
}

export async function translateSubtitles(
  subtitles: SubtitleItem[],
  apiKeys: GeminiKeyRecord[],
  activeKeyId: string | null,
  model: string,
  onKeyError: (id: string, error: any) => void,
  onKeySuccess: (id: string) => void = () => {},
): Promise<SubtitleItem[]> {
  if (subtitles.length === 0) return [];

  const realModelName = resolveModel(model);
  const targetLanguage = localStorage.getItem('translation_target_language') || 'Tiếng Việt';

  const input = subtitles.map(s => ({
    id: s.id,
    startTime: s.startTime,
    endTime: s.endTime,
    text: s.chinese,
  }));

  const subtitleText = JSON.stringify(input, null, 2);
  const prompt = buildTranslationPrompt(subtitleText, targetLanguage);

  return executeWithRotation(apiKeys, activeKeyId, onKeyError, onKeySuccess, async (ai) => {
    const response = await ai.models.generateContent({
      model: realModelName,
      systemInstruction: TRANSLATION_SYSTEM,
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
    });

    const rawText = response.text || '';
    console.log('[Translate] Raw response length:', rawText.length);

    const arr = safeParseJsonArray(rawText);
    console.log('[Translate] Parsed items:', arr.length);

    const translationMap = new Map<string, string>();
    arr.forEach((item: any) => {
      if (item.id && item.text) {
        translationMap.set(item.id, item.text);
      }
    });

    return subtitles.map(s => ({
      ...s,
      vietnamese: translationMap.get(s.id) || s.vietnamese,
    }));
  });
}
