import OpenAI from 'openai'
import { config } from './config.js'

/**
 * DeepSeek LLM 客户端（OpenAI 兼容协议）
 * baseURL 可指向 DeepSeek 官方或 Coze 网关，换模型零成本
 */
let client = null

export function getClient() {
  if (!client) {
    client = new OpenAI({
      baseURL: config.llm.baseURL,
      apiKey: config.llm.apiKey,
    })
  }
  return client
}

/**
 * 调用 LLM，支持结构化输出 + 严格重试（借鉴 PageLM 的 SYS + SYS_STRICT 双层设计）
 * @param {string} systemPrompt  主 prompt（定义输出契约）
 * @param {string} userContent   用户内容（资料文本/问题）
 * @param {object} options       { strictPrompt, maxRetries, json }
 * @returns {Promise<string>}    模型输出文本（json=true 时解析为对象）
 */
export async function callLLM(systemPrompt, userContent, options = {}) {
  const {
    strictPrompt = null,
    maxRetries = 2,
    json = false,
    temperature,
    maxTokens,
  } = options

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userContent },
  ]

  let lastError = null
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const resp = await getClient().chat.completions.create({
        model: config.llm.model,
        temperature: temperature ?? config.llm.temperature,
        max_tokens: maxTokens ?? config.llm.maxTokens,
        messages: attempt === 0 ? messages : [...messages, { role: 'assistant', content: lastRaw }, { role: 'user', content: strictPrompt }],
      })
      const text = resp.choices[0]?.message?.content || ''
      if (json) {
        try {
          return JSON.parse(extractJson(text))
        } catch (e) {
          lastError = new Error(`JSON 解析失败: ${e.message}`)
          lastRaw = text
          if (attempt < maxRetries) continue
          throw lastError
        }
      }
      return text
    } catch (e) {
      lastError = e
      lastRaw = e.raw || ''
      if (attempt >= maxRetries) throw lastError
    }
  }
  throw lastError
}

/** 从模型输出中提取 JSON（容忍 markdown 代码围栏/前后杂讯） */
export function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) return fenced[1].trim()
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start !== -1 && end !== -1 && end > start) return text.slice(start, end + 1)
  const s2 = text.indexOf('[')
  const e2 = text.lastIndexOf(']')
  if (s2 !== -1 && e2 !== -1 && e2 > s2) return text.slice(s2, e2 + 1)
  return text.trim()
}
