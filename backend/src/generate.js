import { callLLM } from './llm.js'
import { splitText } from './parser.js'
import { PROMPTS, SUBJECT_GUIDES } from './prompts.js'

/**
 * 生成引擎：对长文本分块生成后合并（MVP 无需向量库）
 * 生成类型: quiz | flashcards | summary
 * @param {string} subject 学科标识（见 SUBJECT_GUIDES），默认 general
 */
export async function generate(type, text, options = {}) {
  const { sys, strict } = PROMPTS[type]
  if (!sys) throw new Error(`未知生成类型: ${type}`)

  const subject = options.subject || 'general'
  const subjectGuide = SUBJECT_GUIDES[subject] || SUBJECT_GUIDES.general
  const sysWithSubject = `${sys}\n\nSUBJECT ADAPTATION\n${subjectGuide}`

  const chunks = splitText(text)
  const results = []

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    const header = chunks.length > 1
      ? `（材料第 ${i + 1}/${chunks.length} 部分）\n\n`
      : ''
    const data = await callLLM(sysWithSubject, header + chunk, {
      strictPrompt: strict,
      json: true,
      maxRetries: 2,
      ...options,
    })
    results.push(data)
  }

  return mergeResults(type, results)
}

/** 合并分块结果 */
function mergeResults(type, results) {
  if (results.length === 1) return results[0]
  switch (type) {
    case 'quiz':
      return { quiz: results.flatMap(r => r.quiz || []) }
    case 'flashcards':
      return { flashcards: results.flatMap(r => r.flashcards || []) }
    case 'summary':
      return {
        title: results[0]?.title || '',
        overview: results.map(r => r.overview || '').join('\n'),
        key_points: results.flatMap(r => r.key_points || []),
        concepts: results.flatMap(r => r.concepts || []),
        questions: results.flatMap(r => r.questions || []),
      }
    default:
      return results[0]
  }
}
