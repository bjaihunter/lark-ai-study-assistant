import 'dotenv/config'

export const config = {
  port: Number(process.env.PORT || 3100),
  llm: {
    baseURL: process.env.LLM_BASE_URL || 'https://api.deepseek.com',
    apiKey: process.env.LLM_API_KEY || '',
    model: process.env.LLM_MODEL || 'deepseek-chat',
    temperature: Number(process.env.LLM_TEMPERATURE || 0.7),
    maxTokens: Number(process.env.LLM_MAX_TOKENS || 4096),
  },
  maxFileSizeMB: Number(process.env.MAX_FILE_SIZE_MB || 20),
}
