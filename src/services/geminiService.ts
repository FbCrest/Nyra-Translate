/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from "@google/genai";
import { SubtitleItem, GeminiKeyRecord } from "../types";
import { getTranscriptionRules, buildRulesText } from "./transcriptionRulesService";

function getGenAI(apiKey: string) {
  if (!apiKey) {
    throw new Error("No API Key provided. Please set it in Settings.");
  }
  return new GoogleGenAI({ apiKey });
}

// Model IDs khớp với su-translate-main (dùng thẳng, không cần remap)
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

// System instruction cho transcription — chỉ enforce JSON output, không override format timestamp
const TRANSCRIPTION_SYSTEM = `You are an expert transcriber and video analysis specialist.
Your task is to watch the entire video/audio from beginning to end and provide complete subtitles.

CRITICAL RULES:
1. PROCESS THE ENTIRE VIDEO: Do not stop until you reach the very end.
2. ABSOLUTE TIMESTAMPS: Always use total seconds from the start (e.g. 150.5 for 2m30s).
3. COMPLETENESS: Do not summarize. Capture every spoken segment.
4. GRANULARITY: Keep segments short (3-8 seconds) for better sync.
5. NO SHORTCUTS: Ensure output covers the full time range.

Output a JSON array. Each object must have:
- startTime: number (seconds from start)
- endTime: number (seconds from start)  
- text: string`;

/**
 * Tạo prompt dịch giống su-translate-main — đầy đủ rules, ví dụ input/output
 */
function buildTranslationPrompt(subtitleText: string, targetLanguage: string): string {
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
- ❌ "chỉ huy siêu chi tiết" → ✅ "hướng dẫn chỉ huy siêu chi tiết"
- ❌ "无间霜影" → ✅ "Vô Gian Sương Ảnh" (boss name)
- ❌ "符龙签" → ✅ "Phù Long Ký" (item name)
- ✅ "腐潮" → "Phụ Triều" (class name - correct Sino-Vietnamese)
- ❌ "腐潮" → "Phủ Triều" (wrong pronunciation)

**4. AVOID:**
- Word-by-word mechanical translation
- Using difficult Sino-Vietnamese when simple Vietnamese exists
- Losing game context
- Keeping English words that have a natural Vietnamese equivalent

**5. TECHNICAL INSTRUCTIONS:**
1. Translate ONLY the value of the "text" key for each object.
2. Preserve the original "id", "startTime" and "endTime" values EXACTLY as they are.
3. Ensure the translated text is natural and easy to read for Vietnamese gamers.
4. The output MUST be a valid JSON array with proper escaping.
5. Do NOT add, remove, or alter any keys in the JSON objects.
6. Do NOT include any explanations, comments, or additional text.
7. Do NOT wrap the response in code blocks.
8. Escape any quotes or special characters in the translated text properly.
9. Return ONLY the translated JSON array.

Example input:
[
    { "id": "sub-0", "startTime": 1.234, "endTime": 3.456, "text": "关山藏锋,荣誉挑战第三周山内456超详细指挥攻略" },
    { "id": "sub-1", "startTime": 4.123, "endTime": 5.789, "text": "老四无间霜影" }
]

Example output for Vietnamese:
[
    { "id": "sub-0", "startTime": 1.234, "endTime": 3.456, "text": "Quan Sơn Tàng Phong, hướng dẫn chỉ huy siêu chi tiết Thử Thách Vinh Dự tuần 3 - Sơn Nội 4,5,6" },
    { "id": "sub-1", "startTime": 4.123, "endTime": 5.789, "text": "Boss 4: Vô Gian Sương Ảnh" }
]

IMPORTANT: Make sure all quotes in the translated text are properly escaped. If the text contains quotes, use \\" instead of ".

Now, please translate the following subtitles into ${targetLanguage}:
${subtitleText}`;
}

/**
 * Tự động thử lại với key khác khi gặp lỗi quota/rate-limit
 */
async function executeWithRotation<T>(
  apiKeys: GeminiKeyRecord[],
  activeKeyId: string | null,
  onKeyError: (id: string, error: any) => void,
  task: (ai: any) => Promise<T>
): Promise<T> {
  const sortedKeys = [...apiKeys].sort((a, b) => {
    if (a.id === activeKeyId) return -1;
    if (b.id === activeKeyId) return 1;
    return a.errorCount - b.errorCount;
  });

  let lastError: any;
  for (const keyRecord of sortedKeys) {
    if (keyRecord.status === 'error' && keyRecord.errorCount > 5) continue;

    try {
      const ai = getGenAI(keyRecord.key);
      return await task(ai);
    } catch (error: any) {
      lastError = error;
      const isQuotaError =
        error?.message?.includes('429') || error?.message?.includes('quota');
      if (isQuotaError) {
        onKeyError(keyRecord.id, error);
        continue;
      }
      throw error;
    }
  }
  throw lastError || new Error('All API keys failed or no keys available.');
}

/**
 * Parse timestamp format từ response của Gemini
 * Hỗ trợ nhiều format:
 * - [ 00m0s367ms 00m4s187ms] Text  (không có dấu -)
 * - [00m30s000ms - 00m35s500ms] Text (có dấu -)
 * - [MM:SS - MM:SS] Text
 */
function parseTimestampResponse(text: string): Array<{ startTime: number; endTime: number; text: string }> {
  const results: Array<{ startTime: number; endTime: number; text: string }> = [];
  if (!text) return results;

  // Format: [MMmSSsNNNms MMmSSsNNNms] hoặc [MMmSSsNNNms - MMmSSsNNNms]
  // Dấu - là tuỳ chọn, có thể chỉ có khoảng trắng
  const regexMs = /\[\s*(\d+)m(\d+)s(?:(\d+)ms)?\s*(?:[-–]\s*)?(\d+)m(\d+)s(?:(\d+)ms)?\s*\]\s*(.+?)(?=\[|\s*$)/gs;
  let match: RegExpExecArray | null;

  while ((match = regexMs.exec(text)) !== null) {
    const startMin = parseInt(match[1]);
    const startSec = parseInt(match[2]);
    const startMs  = match[3] ? parseInt(match[3]) / 1000 : 0;
    const endMin   = parseInt(match[4]);
    const endSec   = parseInt(match[5]);
    const endMs    = match[6] ? parseInt(match[6]) / 1000 : 0;
    const content  = match[7].trim();

    if (content) {
      results.push({
        startTime: startMin * 60 + startSec + startMs,
        endTime:   endMin   * 60 + endSec   + endMs,
        text: content,
      });
    }
  }

  if (results.length > 0) return results;

  // Format 2: [MM:SS - MM:SS] Text
  const regexColon = /\[\s*(\d+):(\d+)\s*[-–]\s*(\d+):(\d+)\s*\]\s*(.+?)(?=\[|\s*$)/gs;
  while ((match = regexColon.exec(text)) !== null) {
    const startMin = parseInt(match[1]);
    const startSec = parseInt(match[2]);
    const endMin   = parseInt(match[3]);
    const endSec   = parseInt(match[4]);
    const content  = match[5].trim();
    if (content) {
      results.push({
        startTime: startMin * 60 + startSec,
        endTime:   endMin   * 60 + endSec,
        text: content,
      });
    }
  }

  return results;
}

/**
 * Build prompt cuối cùng: thay {contentType}, TARGET_LANGUAGE, inject rules
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
  onKeyError: (id: string, error: any) => void
): Promise<SubtitleItem[]> {
  const contentType = mimeType.startsWith('video') ? 'video' : 'audio';
  const finalPrompt = buildTranscriptionPrompt(prompt, contentType);
  const realModelName = resolveModel(model);

  return executeWithRotation(apiKeys, activeKeyId, onKeyError, async (ai) => {
    const response = await ai.models.generateContent({
      model: realModelName,
      // Không dùng systemInstruction cứng — để prompt tự điều khiển format
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { data: videoBase64, mimeType } },
            { text: finalPrompt },
          ],
        },
      ],
      // Không dùng responseSchema — để Gemini trả về text format [MMmSSsNNNms]
      // theo đúng prompt từ constants.ts
    });

    const rawText = response.text || '';
    console.log('[Transcribe] Raw response length:', rawText.length);
    console.log('[Transcribe] Raw response preview:', rawText.slice(0, 300));

    let items: Array<{ startTime: number; endTime: number; text: string }> = [];

    // Thử parse JSON trước (nếu Gemini trả về JSON)
    try {
      // Strip markdown code fences nếu có (```json ... ```)
      const stripped = rawText.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
      if (stripped.startsWith('[') || stripped.startsWith('{')) {
        const parsed = JSON.parse(stripped);
        const arr = Array.isArray(parsed) ? parsed : [];
        if (arr.length > 0) {
          // Normalize nhiều field name variants mà Gemini hay trả về:
          // { startTime, endTime, text } — format chuẩn
          // { start, end, label }        — format Gemini hay dùng
          // { start, end, text }
          // { startTime, endTime, label }
          const normalized = arr
            .map((item: any) => ({
              startTime: item.startTime ?? item.start ?? 0,
              endTime:   item.endTime   ?? item.end   ?? 0,
              text:      item.text      ?? item.label ?? item.content ?? '',
            }))
            .filter((item: any) => item.text && typeof item.startTime === 'number');

          if (normalized.length > 0) {
            items = normalized;
            console.log('[Transcribe] Parsed as JSON, items:', items.length);
          }
        }
      }
    } catch (e) {
      console.log('[Transcribe] Not JSON, trying timestamp format. Error:', e);
    }

    // Fallback: parse format [MMmSSsNNNms - MMmSSsNNNms] Text
    if (items.length === 0) {
      items = parseTimestampResponse(rawText);
      console.log('[Transcribe] Parsed as timestamp format, items:', items.length);
      if (items.length > 0) {
        console.log('[Transcribe] First item:', items[0]);
      }
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
  onKeyError: (id: string, error: any) => void
): Promise<SubtitleItem[]> {
  if (subtitles.length === 0) return [];

  const realModelName = resolveModel(model);
  const targetLanguage = localStorage.getItem('translation_target_language') || 'Vietnamese';

  // Giống su-translate-main: gửi field "text" thay vì "chinese"
  const input = subtitles.map(s => ({
    id: s.id,
    startTime: s.startTime,
    endTime: s.endTime,
    text: s.chinese,
  }));

  const subtitleText = JSON.stringify(input, null, 2);
  const prompt = buildTranslationPrompt(subtitleText, targetLanguage);

  return executeWithRotation(apiKeys, activeKeyId, onKeyError, async (ai) => {
    const response = await ai.models.generateContent({
      model: realModelName,
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
    });

    const rawText = response.text || '';
    console.log('[Translate] Raw response length:', rawText.length);
    console.log('[Translate] Raw response preview:', rawText.slice(0, 200));

    // Strip markdown code fences nếu có
    const stripped = rawText.trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();

    let translationsJson: any[] = [];
    try {
      translationsJson = JSON.parse(stripped);
      if (!Array.isArray(translationsJson)) translationsJson = [];
    } catch (e) {
      console.warn('[Translate] Failed to parse JSON response:', e);
    }

    const translationMap = new Map<string, string>();
    translationsJson.forEach((item: any) => {
      if (item.id && item.text) {
        translationMap.set(item.id, item.text);
      }
    });

    console.log('[Translate] Translated items:', translationMap.size);

    return subtitles.map(s => ({
      ...s,
      vietnamese: translationMap.get(s.id) || s.vietnamese,
    }));
  });
}
