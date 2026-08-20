import fs from 'fs/promises'
import path from 'path'
import mammoth from 'mammoth'
import pdfParse from 'pdf-parse'
import { config } from './config.js'

/** 支持的文件类型 */
export const SUPPORTED_TYPES = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword',
  txt: 'text/plain',
  md: 'text/markdown',
}

/**
 * 从文件提取纯文本（PDF / DOCX / TXT / MD）
 * @param {string} filePath 文件路径
 * @param {string} mimeType MIME 类型
 * @returns {Promise<string>} 提取的文本
 */
export async function extractText(filePath, mimeType = '') {
  const ext = path.extname(filePath).toLowerCase().replace('.', '')
  const size = (await fs.stat(filePath)).size
  if (size > config.maxFileSizeMB * 1024 * 1024) {
    throw new Error(`文件超过 ${config.maxFileSizeMB}MB 限制`)
  }

  if (ext === 'pdf' || mimeType === 'application/pdf') {
    const buf = await fs.readFile(filePath)
    const data = await pdfParse(buf)
    return (data.text || '').trim()
  }

  if (ext === 'docx' || mimeType.includes('wordprocessingml')) {
    const buf = await fs.readFile(filePath)
    const result = await mammoth.extractRawText({ buffer: buf })
    return (result.value || '').trim()
  }

  if (ext === 'doc' || mimeType === 'application/msword') {
    // 老版 .doc 不支持直接解析，提示转换
    throw new Error('.doc 旧格式暂不支持，请转换为 .docx 或 PDF 后上传')
  }

  // txt / md / 其他按文本读取
  const raw = await fs.readFile(filePath, 'utf-8')
  return raw.trim()
}

/**
 * 文本切分（借鉴 PageLM：512 字符/块，30 重叠）
 * 短文本直接返回单块；长文本切成多个块，逐块生成后合并
 */
export function splitText(text, chunkSize = 512, overlap = 30) {
  if (!text) return []
  if (text.length <= chunkSize) return [text]
  const chunks = []
  let start = 0
  while (start < text.length) {
    let end = start + chunkSize
    if (end < text.length) {
      // 尽量在段落/句子边界切分
      const boundary = text.lastIndexOf('\n', end)
      const boundary2 = text.lastIndexOf('。', end)
      const b = Math.max(boundary, boundary2)
      if (b > start + chunkSize * 0.5) end = b + 1
    }
    chunks.push(text.slice(start, end))
    start = end - overlap
  }
  return chunks
}
