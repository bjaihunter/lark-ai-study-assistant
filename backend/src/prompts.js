/**
 * 生成引擎的 Prompt 定义（借鉴 PageLM 的 SYS + SYS_STRICT 双层设计）
 * 结构化输出契约 + 严格重试兜底
 */

// ============ 测验生成（5 道选择题） ============
export const QUIZ_SYS = `PRIMARY OBJECTIVE
Generate exactly 5 multiple-choice questions based on the provided study material.

OUTPUT CONTRACT
Return only a JSON object: {"quiz": [ ... 5 items ... ]}
No markdown, no code fences, no prose outside the JSON.

SCHEMA (each item)
"question": string, 12..160 chars, unambiguous
"options": array of exactly 4 distinct strings, each prefixed A) B) C) D)
"correct": number 0..3 (0-based index into options)
"explanation": string, 12..200 chars, cites material facts

STYLE
Chinese content preferred when material is Chinese. Plain text only. No extra keys.

VALIDATION
Exactly 5 items; each has all 4 keys; options length 4; correct in [0,3].

FAIL-SAFE
Base questions strictly on the provided material. Output only the JSON object.`

export const QUIZ_STRICT = `RETRY: STRICT FORMAT ONLY
Output only a JSON object {"quiz":[...]} with exactly 5 items.
Each item: question(string), options(4 strings prefixed A)-D)), correct(0..3), explanation(string).
No markdown, no extra text.`

// ============ 闪卡生成（10 张） ============
export const FLASHCARD_SYS = `PRIMARY OBJECTIVE
Generate exactly 10 flashcards from the provided study material for spaced-repetition review.

OUTPUT CONTRACT
Return only a JSON object: {"flashcards": [ ... 10 items ... ]}
No markdown, no code fences.

SCHEMA (each item)
"front": string, 8..120 chars, a concise prompt/question (Chinese if material is Chinese)
"back": string, 12..200 chars, the answer/explanation
"tag": string, one of "概念|公式|定义|方法|考点"

VALIDATION
Exactly 10 items; each has front/back/tag; strings non-empty.

FAIL-SAFE
Extract the most testable knowledge points. Output only the JSON object.`

export const FLASHCARD_STRICT = `RETRY: STRICT FORMAT ONLY
Output only a JSON object {"flashcards":[...]} with exactly 10 items.
Each item: front(string), back(string), tag(概念|公式|定义|方法|考点).
No markdown, no extra text.`

// ============ 摘要生成 ============
export const SUMMARY_SYS = `PRIMARY OBJECTIVE
Create a structured study summary from the provided material.

OUTPUT CONTRACT
Return only a JSON object with keys: title, overview, key_points (array of 5..8 strings), concepts (array of {term, definition} 3..5 items), questions (array of 3 review questions).

No markdown, no code fences.

STYLE
Chinese output when material is Chinese. Key points concise, exam-oriented.

FAIL-SAFE
Output only the JSON object.`

export const SUMMARY_STRICT = `RETRY: STRICT FORMAT ONLY
Output only a JSON object with keys: title(string), overview(string), key_points(array of strings), concepts(array of {term, definition}), questions(array of strings).
No markdown, no extra text.`

/** 按类型取 prompt 对 */
export const PROMPTS = {
  quiz: { sys: QUIZ_SYS, strict: QUIZ_STRICT },
  flashcards: { sys: FLASHCARD_SYS, strict: FLASHCARD_STRICT },
  summary: { sys: SUMMARY_SYS, strict: SUMMARY_STRICT },
}

/** 学科定制：附加到 system prompt 的学科指导 */
export const SUBJECT_GUIDES = {
  general: '通用学科：按资料内容出题。',
  gaokao: '高考学科：贴合高考考点与题型（选择/填空/简答），难度匹配高中水平。',
  postgraduate_math: '考研数学：偏重概念理解与计算题型，关键公式要单独成卡，考点标注数一/数二/数三通用范围。',
  postgraduate_english: '考研英语：偏重词汇辨析、长难句理解、阅读题型，闪卡以单词/短语/固定搭配为主。',
  cet46: '四六级英语：偏重高频词汇、听力常见表达、写作模板句型，闪卡以单词/短语为主。',
  computer408: '计算机408统考：偏重数据结构、操作系统、计算机网络、计算机组成原理的核心概念与典型题。',
  professional: '专业课：按资料内容精确出题，重视术语准确性与概念边界。',
}

