import $ from 'jquery';
import { bitable, FieldType } from '@lark-base-open/js-sdk';
import './index.scss';

/**
 * 飞书 AI 学习助手插件 v2
 * 功能：
 *  1. 选表/输入文本 → AI 生成 测验/闪卡/摘要（支持学科定制）
 *  2. 结果写回多维表格（自动建字段）
 *  3. 错题本：测验答错标记 → 写入独立"错题本"表
 */

const API_BASE_URL = 'https://alternative-monitoring-saints-luke.trycloudflare.com/api'; // 后端公网地址

interface TableMeta { id: string; name: string; }
type GenType = 'quiz' | 'flashcards' | 'summary';

const TYPE_LABEL: Record<GenType, string> = {
  quiz: '📝 测验题', flashcards: '🃏 闪卡', summary: '📄 摘要',
};

const SUBJECTS: Record<string, string> = {
  general: '通用',
  gaokao: '📖 高考',
  postgraduate_math: '🧮 考研数学',
  postgraduate_english: '📗 考研英语',
  cet46: '🇬🇧 四六级',
  computer408: '💻 计算机408',
  professional: '🎓 专业课',
};

let tableList: TableMeta[] = [];
let selectedTableId = '';
let currentGenType: GenType = 'quiz';
let currentSubject = 'general';
let currentResult: any = null;

$(async function () {
  try {
    const [tables, selection] = await Promise.all([
      bitable.base.getTableMetaList(),
      bitable.base.getSelection(),
    ]);
    tableList = tables;
    selectedTableId = selection?.tableId || tables[0]?.id || '';
    render();
  } catch (e) {
    $('#container').html(`<div class="error">初始化失败: ${String(e)}</div>`);
  }
});

function render() {
  $('#container').html(`
    <div class="card">
      <label>选择数据表</label>
      <select id="table-select">${tableList.map(t =>
        `<option value="${t.id}" ${t.id === selectedTableId ? 'selected' : ''}>${t.name}</option>`
      ).join('')}</select>
    </div>

    <div class="card">
      <label>生成类型</label>
      <div class="type-group">
        ${(['quiz', 'flashcards', 'summary'] as GenType[]).map(t =>
          `<button class="type-btn ${t === currentGenType ? 'active' : ''}" data-type="${t}">${TYPE_LABEL[t]}</button>`
        ).join('')}
      </div>
      <label style="margin-top:10px">学科</label>
      <select id="subject-select">
        ${Object.entries(SUBJECTS).map(([k, v]) =>
          `<option value="${k}" ${k === currentSubject ? 'selected' : ''}>${v}</option>`
        ).join('')}
      </select>
    </div>

    <div class="card">
      <label>内容来源</label>
      <div class="source-tabs">
        <button class="src-btn active" data-src="text">✍️ 手动输入</button>
        <button class="src-btn" data-src="table">📋 表格记录</button>
      </div>
      <textarea id="content-input" rows="8" placeholder="粘贴学习资料文本…（或从表格记录读取）"></textarea>
      <div id="table-tip" class="hidden">将从当前表的前 20 条记录中提取文本字段作为学习资料</div>
    </div>

    <button id="generate-btn" class="primary-btn">🚀 生成学习材料</button>
    <div id="result" class="hidden"></div>
  `);

  let srcMode = 'text';

  $('#table-select').on('change', function () { selectedTableId = $(this).val() as string; });
  $('#subject-select').on('change', function () { currentSubject = $(this).val() as string; });

  $('.type-btn').on('click', function () {
    $('.type-btn').removeClass('active'); $(this).addClass('active');
    currentGenType = $(this).data('type') as GenType;
  });

  $('.src-btn').on('click', function () {
    $('.src-btn').removeClass('active'); $(this).addClass('active');
    srcMode = $(this).data('src') as string;
    $('#content-input').toggleClass('hidden', srcMode !== 'text');
    $('#table-tip').toggleClass('hidden', srcMode !== 'table');
  });

  $('#generate-btn').on('click', async function () {
    const btn = $(this);
    btn.prop('disabled', true).text('⏳ 生成中…（可能需要 30-60 秒）');
    $('#result').addClass('hidden');
    try {
      let text = '';
      if (srcMode === 'text') text = ($('#content-input').val() as string || '').trim();
      else text = await collectTableText(selectedTableId);
      if (!text || text.length < 20) { alert('内容太短，请提供至少 20 字的学习资料'); return; }
      const data = await callBackend(currentGenType, text, currentSubject);
      currentResult = data.result;
      renderResult(currentGenType, currentResult);
    } catch (e) {
      $('#result').removeClass('hidden').html(`<div class="error">❌ ${String(e)}</div>`);
    } finally {
      btn.prop('disabled', false).text('🚀 生成学习材料');
    }
  });
}

/** 从表格记录收集文本内容 */
async function collectTableText(tableId: string): Promise<string> {
  if (!tableId) return '';
  const table = await bitable.base.getTableById(tableId);
  const parts: string[] = [];
  const recordList = await table.getRecordList();
  let count = 0;
  for (const rec of recordList) {
    if (count >= 20) break;
    count++;
    try {
      const cells = await rec.getCellList();
      for (const cell of cells) {
        try {
          const val = await cell.getValue();
          if (typeof val === 'string' && val.trim()) parts.push(val.trim());
          else if (Array.isArray(val)) {
            const text = extractCellText(val);
            if (text) parts.push(text);
          }
        } catch { /* skip */ }
      }
    } catch { /* skip */ }
  }
  return parts.join('\n');
}

function extractCellText(val: any): string {
  try {
    if (Array.isArray(val)) return val.map(v => typeof v === 'string' ? v : v?.text || '').join(' ');
    return String(val);
  } catch { return ''; }
}

/** 调用后端生成 API */
async function callBackend(type: GenType, text: string, subject: string) {
  const form = new FormData();
  form.append('type', type);
  form.append('text', text);
  form.append('subject', subject);
  const resp = await fetch(`${API_BASE_URL}/generate`, { method: 'POST', body: form });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || `后端错误 HTTP ${resp.status}`);
  }
  return resp.json();
}

/** 渲染生成结果 */
function renderResult(type: GenType, result: any) {
  const box = $('#result').removeClass('hidden');
  let html = '';
  if (type === 'quiz' && result?.quiz) {
    html = result.quiz.map((q: any, i: number) => `
      <div class="quiz-item" data-idx="${i}">
        <p class="q-title"><b>${i + 1}. ${escapeHtml(q.question)}</b></p>
        <ul>${(q.options || []).map((o: string, oi: number) =>
          `<li data-opt="${oi}" class="${oi === q.correct ? 'correct' : ''}">${escapeHtml(o)}</li>`).join('')}</ul>
        <p class="q-exp">💡 ${escapeHtml(q.explanation || '')}</p>
        <div class="wrong-btns">
          <button class="wrong-btn" data-idx="${i}">❌ 标记错题</button>
        </div>
      </div>`).join('');
  } else if (type === 'flashcards' && result?.flashcards) {
    html = result.flashcards.map((f: any, i: number) => `
      <div class="card-item">
        <p class="card-front"><b>Q${i + 1}: ${escapeHtml(f.front)}</b> <span class="tag">${escapeHtml(f.tag || '')}</span></p>
        <p class="card-back">A: ${escapeHtml(f.back)}</p>
      </div>`).join('');
  } else if (type === 'summary' && result) {
    html = `
      <div class="summary-box">
        <h4>${escapeHtml(result.title || '学习摘要')}</h4>
        <p><b>概述：</b>${escapeHtml(result.overview || '')}</p>
        <p><b>要点：</b></p>
        <ul>${(result.key_points || []).map((k: string) => `<li>${escapeHtml(k)}</li>`).join('')}</ul>
        <p><b>概念：</b></p>
        <ul>${(result.concepts || []).map((c: any) => `<li><b>${escapeHtml(c.term)}</b>: ${escapeHtml(c.definition)}</li>`).join('')}</ul>
        <p><b>复习问题：</b></p>
        <ul>${(result.questions || []).map((q: string) => `<li>${escapeHtml(q)}</li>`).join('')}</ul>
      </div>`;
  } else {
    html = `<pre>${escapeHtml(JSON.stringify(result, null, 2))}</pre>`;
  }
  html += `
    <div class="action-row">
      <button id="copy-btn" class="secondary-btn">📋 复制结果</button>
      <button id="write-btn" class="secondary-btn">💾 写入当前表格</button>
    </div>`;
  box.html(html);

  $('#copy-btn').on('click', () => {
    const text = $('#result').text().replace('📋 复制结果', '').replace('💾 写入当前表格', '').trim();
    navigator.clipboard.writeText(text).then(() => alert('已复制到剪贴板！'));
  });

  $('#write-btn').on('click', () => writeResultToTable(currentGenType, currentResult));

  $('.wrong-btn').on('click', function () {
    const idx = Number($(this).data('idx'));
    writeWrongQuestion((currentResult?.quiz || [])[idx]);
  });
}

/** 写入生成结果到当前选中表（自动建字段） */
async function writeResultToTable(type: GenType, result: any) {
  if (!selectedTableId || !result) { alert('请先选择数据表'); return; }
  const table = await bitable.base.getTableById(selectedTableId);
  try {
    if (type === 'quiz') {
      const [fQ, fO, fA, fE] = await Promise.all([
        ensureField(table, '题目'), ensureField(table, '选项'),
        ensureField(table, '正确答案'), ensureField(table, '解析'),
      ]);
      const rows = (result.quiz || []).map((q: any, i: number) => ({
        fields: {
          [fQ]: `${i + 1}. ${q.question}`,
          [fO]: (q.options || []).join(' | '),
          [fA]: (q.options || [])[q.correct] || '',
          [fE]: q.explanation || '',
        },
      }));
      await table.addRecords(rows);
      alert(`✅ 已写入 ${rows.length} 道测验题到当前表！`);
    } else if (type === 'flashcards') {
      const [fF, fB, fT] = await Promise.all([
        ensureField(table, '正面'), ensureField(table, '背面'), ensureField(table, '标签'),
      ]);
      const rows = (result.flashcards || []).map((f: any) => ({
        fields: {
          [fF]: f.front || '',
          [fB]: f.back || '',
          [fT]: f.tag || '',
        },
      }));
      await table.addRecords(rows);
      alert(`✅ 已写入 ${rows.length} 张闪卡到当前表！`);
    } else if (type === 'summary') {
      const [fT, fO, fK, fQ] = await Promise.all([
        ensureField(table, '标题'), ensureField(table, '概述'),
        ensureField(table, '要点'), ensureField(table, '复习问题'),
      ]);
      await table.addRecords([{
        fields: {
          [fT]: result.title || '学习摘要',
          [fO]: result.overview || '',
          [fK]: (result.key_points || []).join('\n'),
          [fQ]: (result.questions || []).join('\n'),
        },
      }]);
      alert('✅ 已写入摘要到当前表！');
    }
  } catch (e) {
    alert(`写入失败: ${String(e)}`);
  }
}

/** 写入错题到"错题本"表（不存在则创建） */
async function writeWrongQuestion(q: any) {
  if (!q) return;
  try {
    let wrongTable;
    try {
      wrongTable = await bitable.base.getTableByName('错题本');
    } catch {
      const res = await bitable.base.addTable({
        name: '错题本',
        fields: [
          { type: FieldType.Text, name: '题目' },
          { type: FieldType.Text, name: '正确答案' },
          { type: FieldType.Text, name: '解析' },
          { type: FieldType.Text, name: '日期' },
        ],
      });
      wrongTable = await bitable.base.getTableById(res.tableId);
    }
    const [fQ, fA, fE, fD] = await Promise.all([
      ensureField(wrongTable, '题目'), ensureField(wrongTable, '正确答案'),
      ensureField(wrongTable, '解析'), ensureField(wrongTable, '日期'),
    ]);
    const rows = [{
      fields: {
        [fQ]: q.question || '',
        [fA]: (q.options || [])[q.correct] || '',
        [fE]: q.explanation || '',
        [fD]: new Date().toLocaleDateString('zh-CN'),
      },
    }];
    await wrongTable.addRecords(rows);
    alert('📝 已加入错题本！可在多维表格左侧找到「错题本」表');
  } catch (e) {
    alert(`错题本写入失败: ${String(e)}`);
  }
}

/** 确保字段存在，返回 fieldId */
async function ensureField(table: any, name: string): Promise<string> {
  try {
    const field = await table.getField(name);
    return field.id;
  } catch {
    const id = await table.addField({ type: FieldType.Text, name });
    return id;
  }
}

function escapeHtml(str: string): string {
  return String(str ?? '').replace(/[&<>"']/g, (c: string) => {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!;
  });
}
