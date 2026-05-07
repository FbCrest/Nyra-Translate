import { PromptTemplate } from './types';

export const SYSTEM_PROMPTS: PromptTemplate[] = [
  {
    id: 'general',
    icon: 'Mic',
    title: 'Nhận diện lời nói',
    description: 'Chuyển toàn bộ lời nói trong video hoặc audio thành phụ đề chính xác theo thời gian.',
    content: `Transcribe every spoken word in this {contentType} from start to finish. Be thorough and complete — do not skip, summarize, or truncate any speech. Break speech into short natural segments of 2-6 seconds based on pauses and breath breaks. Capture every word exactly as spoken. If there is no speech, return an empty array.`,
    isSystem: true
  },
  {
    id: 'gaming',
    icon: 'Gamepad2',
    title: 'Nhận diện lời nói về Game',
    description: 'Nhận diện lời nói trong game với thuật ngữ chuyên môn, tên kỹ năng và lời nói nhanh.',
    content: `Transcribe ALL spoken content from this {contentType}, especially fast-paced speech, game terminology, skill names, combos, and informal gamer language. Rules: preserve original wording exactly — do NOT paraphrase or correct grammar. Keep filler words and repeated words. Do NOT split skill names or game terms across segments. Break into short segments (2-5 seconds) based on natural pauses. If no spoken content, return an empty array.`,
    isSystem: true
  },
  {
    id: 'extract-text',
    icon: 'FileText',
    title: 'Trích xuất phụ đề (HardSub)',
    description: 'Trích xuất hardsub, văn bản có trên màn hình, bỏ qua âm thanh. Hiểu và chuyển thành phụ đề.',
    content: `Extract only the visible hardcoded subtitles and on-screen text from this {contentType}. Completely ignore all audio. Each entry must represent a single distinct piece of text with the exact time it appears and disappears. Keep text per entry as short as possible. If text changes or updates, create a new entry. If no visible text, return an empty array.`,
    isSystem: true
  },
  {
    id: 'combined-subtitles',
    icon: 'Layers',
    title: 'Phụ đề kết hợp',
    description: 'Kết hợp lời nói và hardsub trên màn hình để tạo phụ đề đầy đủ, hạn chế thiếu nội dung.',
    content: `Create comprehensive subtitles from this {contentType} by combining BOTH spoken content AND visible on-screen text. Strategy: (1) Transcribe all audible speech and dialogue. (2) Extract all visible text, hardcoded subtitles, captions, and graphics. (3) When both exist for the same moment, prioritize the more accurate version. For Chinese text, preserve complete characters and proper spacing. Break into short natural segments. If no content, return an empty array.`,
    isSystem: true
  },
  {
    id: 'focus-lyrics',
    icon: 'Music',
    title: 'Trích xuất lời bài hát',
    description: 'Chỉ nhận diện lời bài hát, bỏ qua lời nói và âm thanh khác.',
    content: `Transcribe ONLY the sung lyrics from this {contentType}. Explicitly ignore all spoken words, dialogue, narration, background music without vocals, and non-lyrical sounds. Break lyrics into short segments (2-5 seconds) based on musical phrasing and pauses. If no sung lyrics, return an empty array.`,
    isSystem: true
  },
  {
    id: 'describe-video',
    icon: 'Video',
    title: 'Mô tả video',
    description: 'Tự động mô tả những gì đang diễn ra trong video: hành động, cảnh vật và sự kiện chính.',
    content: `Describe the significant visual events, actions, and scene changes in this {contentType} in chronological order. Focus only on what is visually happening on screen — do not transcribe audio. Keep descriptions very concise (5-10 words each). Break into the smallest distinct visual moments. If no significant visual content, return an empty array.`,
    isSystem: true
  },
  {
    id: 'chaptering',
    icon: 'BookOpen',
    title: 'Phân chương',
    description: 'Phân chia video thành các chương dựa trên chủ đề và thay đổi nội dung.',
    content: `Analyze this {contentType} and identify distinct chapters based on major topic shifts or significant scene changes. Each entry: startTime = chapter start, endTime = chapter end (or next chapter start), text = "Chapter Title :: 1-2 sentence summary". Title must be 5-7 words max. Focus on major segmentation points only.`,
    isSystem: true
  },
  {
    id: 'diarize-speakers',
    icon: 'Users',
    title: 'Nhận diện người nói',
    description: 'Nhận diện ai đang nói và gắn tên người nói cho từng đoạn phụ đề.',
    content: `Transcribe the spoken content in this {contentType} AND identify who is speaking for each segment. Assign consistent labels like "Speaker 1", "Speaker 2", etc. Each entry must be a continuous segment from a single speaker. Format text as "Speaker N: [transcribed speech]". Break into short segments (2-5 seconds). If no spoken content, return an empty array.`,
    isSystem: true
  },
];

export const AI_MODELS = [
  {
    id: 'gemini-3.1-flash-lite-preview',
    label: 'Gemini 3.1 Flash Lite',
    tag: 'LITE',
    color: 'rose',
    description: 'Cực nhẹ, tốc độ nhanh nhất, tiêu tốn ít quota nhất',
    speed: 'Nhanh Nhất', speedScore: 5,
    accuracy: 'Khá',     accuracyScore: 2,
    load: 'Rất thấp',   loadScore: 1,  // tải server thấp = ít bị quá tải
  },
  {
    id: 'gemini-3-flash-preview',
    label: 'Gemini 3 Flash',
    tag: 'NEW',
    color: 'violet',
    description: 'Đa năng, tốc độ cao, xử lý tốt văn bản & hình ảnh',
    speed: 'Nhanh',      speedScore: 4,
    accuracy: 'Cao',     accuracyScore: 4,
    load: 'Thấp',        loadScore: 2,
  },
  {
    id: 'gemini-2.5-pro',
    label: 'Gemini 2.5 Pro',
    tag: 'PREMIUM',
    color: 'amber',
    description: 'Chính xác nhất, tốt nhất cho phân tích phức tạp',
    speed: 'Chậm',        speedScore: 2,
    accuracy: 'Cao Nhất', accuracyScore: 5,
    load: 'Rất cao',      loadScore: 5,  // nhiều người dùng = dễ bị 429
  },
  {
    id: 'gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    tag: 'BEST',
    color: 'emerald',
    description: 'Thông minh hơn & nhanh hơn, cân bằng tốt nhất',
    speed: 'Nhanh',      speedScore: 4,
    accuracy: 'Cao',     accuracyScore: 4,
    load: 'Cao',         loadScore: 4,
  },
  {
    id: 'gemini-2.5-flash-lite',
    label: 'Gemini 2.5 Flash Lite',
    tag: 'FASTEST',
    color: 'blue',
    description: 'Nhanh nhất trong dòng 2.5',
    speed: 'Nhanh Nhất', speedScore: 5,
    accuracy: 'Tốt',     accuracyScore: 3,
    load: 'Trung bình',  loadScore: 3,
  },
];
