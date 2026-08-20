import express from 'express'
import cors from 'cors'
import { config } from './config.js'
import routes from './routes.js'

const app = express()
app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use('/api', routes)

app.listen(config.port, () => {
  console.log(`✅ lark-ai-study-assistant backend listening on :${config.port}`)
})
