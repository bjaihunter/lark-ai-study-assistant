# 📚 飞书 AI 学习助手（lark-ai-study-assistant）

基于飞书多维表格的 AI 学习工具：上传学习资料（PDF/DOCX/文本）→ 一键生成 **测验题 / 闪卡 / 摘要**，结果可复制或写回多维表格。

> 架构参考：PageLM（NotebookLM 开源版）· LLM：DeepSeek（OpenAI 兼容，可切换 Coze 网关）

## 功能

| 能力 | 说明 |
|---|---|
| 📝 测验生成 | 5 道选择题（含选项/答案/解析），贴合资料内容 |
| 🃏 闪卡生成 | 10 张间隔复习闪卡（概念/公式/定义/方法/考点） |
| 📄 摘要生成 | 结构化摘要（概述/要点/概念表/复习问题） |
| 📋 表格集成 | 直接读取多维表格记录作为学习资料 |
| 📤 文件上传 | 支持 PDF / DOCX / TXT / Markdown |

## 架构

```
┌─ plugin/（飞书多维表格插件）────────────────┐
│  TS + Vite + @lark-base-open/js-sdk        │
│  选表 → 输入/选记录 → 调后端 → 展示结果     │
├─ backend/（Node.js 服务）───────────────────┤
│  Express + multer + pdf-parse + mammoth    │
│  parser(文档解析) → split(512/30) →        │
│  llm(DeepSeek 双层 prompt+严格重试) → 合并  │
└────────────────────────────────────────────┘
```

## 快速开始

### 1. 后端

```bash
cd backend
cp .env.example .env        # 填入 LLM_API_KEY（DeepSeek）
npm install
npm start                   # 监听 :3100
# 测试: curl http://localhost:3100/api/health
```

### 2. 插件

```bash
cd plugin
npm install
npm run dev                 # 本地开发
npm run build               # 产物 dist/
```

构建后把 `dist/` 部署到任意静态托管（GitHub Pages / Vercel / Cloudflare），在多维表格「添加自定义插件」填入 URL 即可使用。

> 插件中 `API_BASE_URL` 需改为后端公网地址（本地联调可用 localhost）。

## API

`POST /api/generate`（multipart）

| 字段 | 说明 |
|---|---|
| type | `quiz` / `flashcards` / `summary` |
| text | 学习资料文本（与 file 二选一） |
| file | PDF/DOCX/TXT/MD 文件（与 text 二选一） |

## 路线图

- [x] MVP 骨架（后端 3 端点 + 插件 UI）
- [ ] 结果写回多维表格（新建记录/新表）
- [ ] 错题本 & 复习计划（结合多维表格看板）
- [ ] 多学科模板（考研/四六级/专业课）
- [ ] 向量检索（接硅基流动/本地 ollama，长文档）

## License

MIT · 借鉴 PageLM 架构思路（未复制其代码，其自定义社区许可证不适用于本项目）
