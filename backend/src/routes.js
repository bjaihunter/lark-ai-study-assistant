import { Router } from 'express'
import multer from 'multer'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { extractText } from './parser.js'
import { generate } from './generate.js'

const router = Router()
const upload = multer({
  dest: path.join(os.tmpdir(), 'lark-ai-study-uploads'),
  limits: { fileSize: 20 * 1024 * 1024 },
})

/**
 * POST /api/generate
 * multipart: file(可选) + text(可选) + type(quiz|flashcards|summary)
 * 至少提供 file 或 text 之一
 */
router.post('/generate', upload.single('file'), async (req, res) => {
  try {
    const { type, text, subject } = req.body
    if (!type || !['quiz', 'flashcards', 'summary'].includes(type)) {
      return res.status(400).json({ error: 'type 必须为 quiz|flashcards|summary' })
    }

    let content = (text || '').trim()
    let fileName = ''

    if (req.file) {
      fileName = req.file.originalname
      content = await extractText(req.file.path, req.file.mimetype)
      await fs.unlink(req.file.path).catch(() => {})
    }

    if (!content) {
      return res.status(400).json({ error: '无法从文件/文本提取内容' })
    }
    if (content.length < 20) {
      return res.status(400).json({ error: '内容太短，无法生成学习材料' })
    }

    const result = await generate(type, content, { subject })
    res.json({ ok: true, type, fileName, subject: subject || 'general', result })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

/** GET /api/health */
router.get('/health', (_req, res) => res.json({ ok: true, ts: Date.now() }))

export default router
