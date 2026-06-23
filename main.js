import { marked } from 'marked';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js';
import html2pdf from 'html2pdf.js';

const editor = document.getElementById('editor');
const preview = document.getElementById('preview');
const btnEdit = document.getElementById('btn-edit');
const btnPreview = document.getElementById('btn-preview');
const btnSplit = document.getElementById('btn-split');
const editorContainer = document.getElementById('editor-container');
const btnTheme = document.getElementById('btn-theme');
const themeIcon = document.getElementById('theme-icon');
const btnIndent = document.getElementById('btn-indent');
const btnOutdent = document.getElementById('btn-outdent');
const btnUndo = document.getElementById('btn-undo');
const btnRedo = document.getElementById('btn-redo');

class HistoryManager {
  constructor(editor, maxHistory = 100) {
    this.editor = editor;
    this.maxHistory = maxHistory;
    this.undoStack = [];
    this.redoStack = [];
    this.isApplying = false;
    this.debounceTimer = null;
    this.lastValue = editor.value;
  }
  
  saveState() {
    return {
      value: this.editor.value,
      selectionStart: this.editor.selectionStart,
      selectionEnd: this.editor.selectionEnd
    };
  }
  
  restoreState(state) {
    this.isApplying = true;
    this.editor.value = state.value;
    this.editor.setSelectionRange(state.selectionStart, state.selectionEnd);
    updatePreview(); 
    this.lastValue = state.value;
    this.isApplying = false;
    this.updateButtonStates();
  }
  
  push(state = this.saveState()) {
    if (this.isApplying) return;
    
    if (this.undoStack.length > 0) {
      const last = this.undoStack[this.undoStack.length - 1];
      if (last.value === state.value) {
        last.selectionStart = state.selectionStart;
        last.selectionEnd = state.selectionEnd;
        return;
      }
    }
    
    this.undoStack.push(state);
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
    
    this.redoStack = [];
    this.lastValue = state.value;
    this.updateButtonStates();
  }
  
  undo() {
    if (this.undoStack.length <= 1) return;
    
    const current = this.saveState();
    this.redoStack.push(current);
    
    this.undoStack.pop();
    const prevState = this.undoStack[this.undoStack.length - 1];
    this.restoreState(prevState);
  }
  
  redo() {
    if (this.redoStack.length === 0) return;
    
    const nextState = this.redoStack.pop();
    this.undoStack.push(nextState);
    this.restoreState(nextState);
  }
  
  updateButtonStates() {
    if (btnUndo) {
      const canUndo = this.undoStack.length > 1;
      btnUndo.disabled = !canUndo;
      btnUndo.style.opacity = canUndo ? '1' : '0.4';
      btnUndo.style.cursor = canUndo ? 'pointer' : 'not-allowed';
    }
    if (btnRedo) {
      const canRedo = this.redoStack.length > 0;
      btnRedo.disabled = !canRedo;
      btnRedo.style.opacity = canRedo ? '1' : '0.4';
      btnRedo.style.cursor = canRedo ? 'pointer' : 'not-allowed';
    }
  }

  handleInput() {
    if (this.isApplying) return;
    
    const currentValue = this.editor.value;
    const diff = Math.abs(currentValue.length - this.lastValue.length);
    
    const lastChar = currentValue.slice(-1);
    if (/\s/.test(lastChar) || diff > 5) {
      clearTimeout(this.debounceTimer);
      this.push();
    } else {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => {
        this.push();
      }, 500);
    }
  }
}

let historyManager;

// Configure marked with highlight.js and custom GFM Alert renderer
marked.use({
  renderer: {
    blockquote(token) {
      const text = token.text || '';
      const match = text.match(/^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION|INFO)\]/i);
      
      if (match) {
        const type = match[1].toUpperCase();
        let contentHtml = this.parser.parse(token.tokens);
        
        // Remove the [!TYPE] marker text from rendered output
        contentHtml = contentHtml.replace(/\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION|INFO)\]/gi, '');
        
        let title = type;
        let icon = 'info';
        let colorClass = '';
        
        switch(type) {
          case 'NOTE':
          case 'INFO':
            title = 'INFO';
            icon = 'info';
            colorClass = 'border-sky-500 bg-sky-50 text-sky-900 dark:bg-sky-950/20 dark:text-sky-200';
            break;
          case 'TIP':
            title = 'TIP';
            icon = 'lightbulb';
            colorClass = 'border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-200';
            break;
          case 'IMPORTANT':
            title = 'IMPORTANT';
            icon = 'report';
            colorClass = 'border-purple-500 bg-purple-50 text-purple-900 dark:bg-purple-950/20 dark:text-purple-200';
            break;
          case 'WARNING':
            title = 'WARNING';
            icon = 'warning';
            colorClass = 'border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-950/20 dark:text-amber-200';
            break;
          case 'CAUTION':
            title = 'CAUTION';
            icon = 'dangerous';
            colorClass = 'border-rose-500 bg-rose-50 text-rose-900 dark:bg-rose-950/20 dark:text-rose-200';
            break;
        }
        
        return `
          <div class="alert-box border-l-4 p-4 my-4 rounded-r-md ${colorClass} not-prose">
            <div class="flex items-center gap-2 font-bold mb-1 text-sm tracking-wide uppercase">
              <span class="material-symbols-outlined text-lg">${icon}</span>
              <span>${title}</span>
            </div>
            <div class="alert-content text-sm leading-relaxed">${contentHtml}</div>
          </div>
        `;
      }
      
      const contentHtml = this.parser.parse(token.tokens);
      return `<blockquote class="border-l-4 border-slate-300 dark:border-slate-700 pl-4 py-1 my-4 italic text-slate-600 dark:text-slate-400">${contentHtml}</blockquote>`;
    }
  }
});

marked.setOptions({
  highlight: function (code, lang) {
    const language = hljs.getLanguage(lang) ? lang : 'plaintext';
    return hljs.highlight(code, { language }).value;
  },
  langPrefix: 'hljs language-',
  breaks: true,
  gfm: true
});

const STORAGE_KEY = 'md_editor_content';

// Default content matching the design's placeholder
const defaultContent = `# 환영합니다! 👋

이곳은 마크다운(Markdown)을 편하게 작성하고 실시간으로 미리 볼 수 있는 웹 에디터입니다.

## 📝 마크다운 기본 문법

여러분은 다음과 같은 다양한 서식을 쉽게 적용할 수 있습니다:

* **굵은 글씨**나 *기울임 꼴*을 사용해 강조해 보세요.
* [링크](https://github.com)를 걸거나 아래처럼 이미지를 넣을 수도 있습니다.

![Markdown](https://placehold.co/800x120/003ec7/FFFFFF/png?text=Markdown+Editor)

### 1. 목록 만들기
1. 번호가 있는 목록
2. 순서가 없는 목록
   - 하위 항목
   - [ ] 할 일 (체크박스)
   - [x] 완료된 일

### 2. 인용구 및 코드
> "글을 쓰는 것은 생각을 정리하는 가장 좋은 방법입니다."

\`\`\`javascript
// 코드 블록 예시
function greet(name) {
  console.log(\`Hello, \${name}!\`);
}
greet('World');
\`\`\`

### 3. 표 (Table)

| 기능 | 단축키 / 기호 |
| --- | --- |
| 굵게 | \`**텍스트**\` |
| 제목 | \`# 제목\` |

---

상단의 툴바를 이용하거나, 빈 줄에서 **\`/\` (슬래시)**를 입력하여 더 많은 기능을 빠르게 호출해 보세요! 🎉`;

const savedContent = localStorage.getItem(STORAGE_KEY);
editor.value = savedContent || defaultContent;

async function updatePreview() {
  const mdContent = editor.value;
  const rawHtml = await marked.parse(mdContent);
  const safeHtml = DOMPurify.sanitize(rawHtml);
  preview.innerHTML = safeHtml;
  localStorage.setItem(STORAGE_KEY, mdContent);
}

// Initial render
updatePreview();
setMode('split'); // Set default mode to split

// History Initialisation
historyManager = new HistoryManager(editor);
historyManager.push();

if (btnUndo) {
  btnUndo.addEventListener('click', () => {
    historyManager.undo();
  });
}

if (btnRedo) {
  btnRedo.addEventListener('click', () => {
    historyManager.redo();
  });
}

// Event listeners
editor.addEventListener('input', () => {
  updatePreview();
  historyManager.handleInput();
});

// Mode Toggle
function setMode(mode) {
  const activeClass = "px-3 py-1 text-sm font-medium bg-white dark:bg-slate-700 shadow-sm rounded-md text-on-surface dark:text-slate-50";
  const inactiveClass = "px-3 py-1 text-sm font-medium text-outline hover:text-on-surface dark:hover:text-slate-200 transition-colors";

  if(btnEdit) btnEdit.className = mode === 'edit' ? activeClass : inactiveClass;
  if(btnPreview) btnPreview.className = mode === 'preview' ? activeClass : inactiveClass;
  if(btnSplit) btnSplit.className = mode === 'split' ? activeClass : inactiveClass;

  if (mode === 'edit') {
    editor.classList.remove('hidden');
    preview.classList.add('hidden');
    editorContainer.classList.remove('max-w-full');
    editorContainer.classList.add('max-w-5xl');
  } else if (mode === 'preview') {
    editor.classList.add('hidden');
    preview.classList.remove('hidden');
    editorContainer.classList.remove('max-w-full');
    editorContainer.classList.add('max-w-5xl');
    updatePreview();
  } else if (mode === 'split') {
    editor.classList.remove('hidden');
    preview.classList.remove('hidden');
    editorContainer.classList.remove('max-w-5xl');
    editorContainer.classList.add('max-w-full');
    updatePreview();
  }
}

if (btnEdit && btnPreview) {
  btnEdit.addEventListener('click', () => setMode('edit'));
  btnPreview.addEventListener('click', () => setMode('preview'));
}
if (btnSplit) {
  btnSplit.addEventListener('click', () => setMode('split'));
}

// Synchronized scrolling for split mode
editor.addEventListener('scroll', () => {
  if (!preview.classList.contains('hidden')) {
    const percentage = editor.scrollTop / (editor.scrollHeight - editor.clientHeight);
    preview.scrollTop = percentage * (preview.scrollHeight - preview.clientHeight);
  }
});

// File operations
const btnNew = document.getElementById('btn-new');
const btnReset = document.getElementById('btn-reset');
const btnOpen = document.getElementById('btn-open');
const btnDownload = document.getElementById('btn-download');
const btnGuide = document.getElementById('btn-guide');

if (btnGuide) {
  btnGuide.addEventListener('click', () => {
    window.open('guide.html', 'MarkdownGuide', 'width=800,height=900,left=100,top=100,menubar=no,toolbar=no,location=no,status=no');
  });
}

if (btnNew) {
  btnNew.addEventListener('click', () => {
    if (editor.value.trim() === '' || confirm('작성 중인 내용이 지워집니다. 새 문서를 시작하시겠습니까?')) {
      editor.value = '';
      updatePreview();
      if (historyManager) historyManager.push();
      setMode('edit');
    }
  });
}

if (btnReset) {
  btnReset.addEventListener('click', () => {
    if (confirm('모든 내용이 초기 디폴트 템플릿으로 되돌아갑니다. 계속하시겠습니까?')) {
      editor.value = defaultContent;
      updatePreview();
      if (historyManager) historyManager.push();
    }
  });
}

if (btnOpen) {
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.md,.txt,text/*';
  fileInput.style.display = 'none';
  
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      editor.value = e.target.result;
      updatePreview();
      if (historyManager) historyManager.push();
      fileInput.value = ''; // reset so same file can be loaded again
    };
    reader.readAsText(file);
  });

  btnOpen.addEventListener('click', () => {
    fileInput.click();
  });
}

const saveDropdown = document.getElementById('save-dropdown');

function toggleSaveDropdown(e) {
  e.stopPropagation();
  const rect = btnDownload.getBoundingClientRect();
  saveDropdown.style.top = `${rect.bottom + 8}px`;
  saveDropdown.style.left = `${rect.right - 192}px`; // width is 48 (192px)
  
  if (saveDropdown.classList.contains('hidden')) {
    // Close other dropdowns
    document.getElementById('emoji-dropdown')?.classList.add('hidden');
    document.getElementById('table-dropdown')?.classList.add('hidden');
    saveDropdown.classList.remove('hidden');
  } else {
    saveDropdown.classList.add('hidden');
  }
}

async function saveFileAsText(extension) {
  saveDropdown.classList.add('hidden');
  const content = editor.value;
  
  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: `document.${extension}`,
        types: [{
          description: 'Document File',
          accept: {'text/plain': [`.${extension}`]},
        }],
      });
      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error(err);
        alert('파일 저장 중 오류가 발생했습니다.');
      }
    }
  } else {
    let filename = prompt('저장할 파일명을 입력하세요 (확장자 포함)', `document.${extension}`);
    if (filename) {
      if (!filename.endsWith(`.${extension}`)) {
        filename += `.${extension}`;
      }
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    }
  }
}

async function saveFileAsPdf() {
  saveDropdown.classList.add('hidden');
  const opt = {
    margin: 10,
    filename: 'document.pdf',
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };
  
  // Clone the preview to avoid modifying the actual DOM
  const element = preview.cloneNode(true);
  element.style.padding = '20px';
  element.style.color = '#000'; // Force dark text for PDF if in dark mode
  element.style.backgroundColor = '#fff';
  
  html2pdf().set(opt).from(element).save();
}

async function saveFileAsDocx() {
  saveDropdown.classList.add('hidden');
  const content = preview.innerHTML;
  
  // Wrap content in basic HTML structure for html-docx-js
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="ko">
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: 'Malgun Gothic', sans-serif; line-height: 1.6; color: #333; }
        h1, h2, h3, h4, h5, h6 { color: #000; margin-top: 24px; margin-bottom: 16px; font-weight: bold; }
        p { margin-top: 0; margin-bottom: 16px; }
        table { border-collapse: collapse; width: 100%; margin-bottom: 16px; }
        th, td { border: 1px solid #ccc; padding: 8px; }
        th { background-color: #f2f2f2; font-weight: bold; }
        pre, code { background-color: #f5f5f5; font-family: monospace; padding: 2px 4px; border-radius: 4px; }
        pre { padding: 16px; overflow: auto; }
        pre code { background-color: transparent; padding: 0; }
        blockquote { border-left: 4px solid #ccc; margin-left: 0; padding-left: 16px; color: #666; }
      </style>
    </head>
    <body>
      ${content}
    </body>
    </html>
  `;
  
  // Use window.htmlDocx since we loaded it via CDN
  const converted = typeof window.htmlDocx.asBlob === 'function' ? window.htmlDocx.asBlob(htmlContent) : window.htmlDocx(htmlContent);
  
  const url = URL.createObjectURL(converted);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'document.docx';
  a.click();
  URL.revokeObjectURL(url);
}

async function saveFileAsHtml() {
  saveDropdown.classList.add('hidden');
  const content = preview.innerHTML;
  
  const htmlContent = `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>Exported HTML</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 2rem; }
    h1, h2, h3, h4, h5, h6 { color: #111; margin-top: 1.5em; margin-bottom: 0.5em; font-weight: bold; }
    h1 { border-bottom: 1px solid #eee; padding-bottom: 0.3em; }
    h2 { border-bottom: 1px solid #eee; padding-bottom: 0.3em; }
    p { margin-top: 0; margin-bottom: 1em; }
    a { color: #0366d6; text-decoration: none; }
    a:hover { text-decoration: underline; }
    ul, ol { padding-left: 2em; margin-bottom: 1em; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 1em; }
    th, td { border: 1px solid #dfe2e5; padding: 6px 13px; }
    th { background-color: #f6f8fa; font-weight: bold; }
    tr:nth-child(2n) { background-color: #f6f8fa; }
    pre, code { font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace; background-color: #f6f8fa; border-radius: 3px; }
    code { padding: 0.2em 0.4em; font-size: 85%; }
    pre { padding: 16px; overflow: auto; font-size: 85%; line-height: 1.45; }
    pre code { background-color: transparent; padding: 0; }
    blockquote { border-left: 0.25em solid #dfe2e5; margin: 0 0 1em 0; padding: 0 1em; color: #6a737d; }
    hr { height: 0.25em; padding: 0; margin: 24px 0; background-color: #e1e4e8; border: 0; }
    img { max-width: 100%; box-sizing: content-box; }
  </style>
</head>
<body>
  ${content}
</body>
</html>
  `;
  
  const blob = new Blob([htmlContent], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'document.html';
  a.click();
  URL.revokeObjectURL(url);
}

if (btnDownload && saveDropdown) {
  btnDownload.addEventListener('click', toggleSaveDropdown);
  
  const options = saveDropdown.querySelectorAll('button[data-format]');
  options.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const format = btn.getAttribute('data-format');
      if (format === 'md' || format === 'txt') {
        saveFileAsText(format);
      } else if (format === 'pdf') {
        saveFileAsPdf();
      } else if (format === 'docx') {
        saveFileAsDocx();
      } else if (format === 'html') {
        saveFileAsHtml();
      }
    });
  });
}


const btnCopy = document.getElementById('btn-copy');
const copyIcon = document.getElementById('copy-icon');
const copyText = document.getElementById('copy-text');

if (btnCopy) {
  btnCopy.addEventListener('click', async () => {
    try {
      const content = editor.value;
      await navigator.clipboard.writeText(content);
      
      // Visual feedback
      copyIcon.textContent = 'check';
      copyText.textContent = '완료!';
      btnCopy.classList.replace('bg-primary', 'bg-green-600');
      btnCopy.classList.replace('hover:bg-primary-container', 'hover:bg-green-700');
      
      setTimeout(() => {
        copyIcon.textContent = 'content_copy';
        copyText.textContent = '복사';
        btnCopy.classList.replace('bg-green-600', 'bg-primary');
        btnCopy.classList.replace('hover:bg-green-700', 'hover:bg-primary-container');
      }, 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
      alert('클립보드 복사에 실패했습니다.');
    }
  });
}

// Basic toolbar integration (optional but nice)
document.querySelectorAll('.group').forEach(btn => {
  btn.addEventListener('click', () => {
    const icon = btn.querySelector('.material-symbols-outlined').textContent;
    let insert = '';
    switch(icon) {
      case 'format_bold': insert = '**텍스트**'; break;
      case 'format_italic': insert = '*텍스트*'; break;
      case 'link': insert = '[링크명](url)'; break;
      case 'image': insert = '![이미지 설명](url)'; break;
      case 'format_list_bulleted': insert = '\n* 항목'; break;
      case 'format_list_numbered': insert = '\n1. 항목'; break;
      case 'format_quote': insert = '\n> 인용구'; break;
      case 'table_chart':
        if (typeof openTableDropdown === 'function') {
          openTableDropdown(btn);
        }
        return;
      case 'title': insert = '\n## 제목'; break;
      case 'checklist': insert = '\n- [ ] 할일'; break;
      case 'horizontal_rule': insert = '\n\n---\n\n'; break;
      case 'info': insert = '\n> [!info]\n> 콜아웃(정보) 내용을 입력하세요.\n'; break;
      case 'unfold_more': insert = '\n<details>\n<summary>토글 제목을 입력하세요</summary>\n\n여기에 숨겨질 상세 내용을 작성하세요.\n\n</details>\n'; break;
    }
    if (insert) {
      editor.setRangeText(insert, editor.selectionStart, editor.selectionEnd, 'end');
      editor.focus({ preventScroll: true });
      updatePreview();
      if (historyManager) historyManager.push();
    }
  });
});

// Zoom control
const zoomSelect = document.getElementById('zoom-select');
const zoomInput = document.getElementById('zoom-input');
let currentZoom = 100;

function applyZoom(value) {
  let val = parseInt(value, 10);
  // 5% 이하 또는 200% 이상이면 작동하지 않음
  if (isNaN(val) || val <= 5 || val >= 200) {
    if (zoomInput) zoomInput.value = currentZoom;
    return;
  }
  
  currentZoom = val;
  const zoomValue = val + '%';
  editor.style.zoom = zoomValue;
  preview.style.zoom = zoomValue;
  
  if (zoomInput && zoomInput.value != val) zoomInput.value = val;
  if (zoomSelect) zoomSelect.value = val; // 일치하는 option이 없으면 빈 값으로 둠
}

if (zoomSelect) {
  zoomSelect.addEventListener('change', (e) => {
    applyZoom(e.target.value);
  });
}

if (zoomInput) {
  zoomInput.addEventListener('change', (e) => {
    applyZoom(e.target.value);
  });
  zoomInput.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') {
      applyZoom(e.target.value);
    }
  });
}

// --- Slash Command (Notion-style) ---
const slashMenu = document.getElementById('slash-menu');
const slashItems = document.querySelectorAll('.slash-item');
let slashMenuOpen = false;
let slashStartIndex = -1;
let currentSlashFocus = -1;

function getCaretCoordinates(element, position) {
  const div = document.createElement('div');
  const style = window.getComputedStyle(element);
  for (const prop of style) { div.style[prop] = style[prop]; }
  div.style.position = 'absolute';
  div.style.visibility = 'hidden';
  div.style.whiteSpace = 'pre-wrap';
  div.style.wordWrap = 'break-word';
  div.textContent = element.value.substring(0, position);
  const span = document.createElement('span');
  span.textContent = element.value.substring(position) || '.';
  div.appendChild(span);
  document.body.appendChild(div);
  const coordinates = {
    top: span.offsetTop - element.scrollTop,
    left: span.offsetLeft - element.scrollLeft,
    height: parseInt(style.lineHeight) || 20
  };
  document.body.removeChild(div);
  return coordinates;
}

function openSlashMenu(index) {
  slashMenuOpen = true;
  slashStartIndex = index;
  currentSlashFocus = -1;
  slashMenu.classList.remove('hidden');
  
  const coords = getCaretCoordinates(editor, index);
  const editorRect = editor.getBoundingClientRect();
  
  let topPos = editorRect.top + coords.top + coords.height + window.scrollY;
  let leftPos = editorRect.left + coords.left + window.scrollX;
  
  if (topPos + 320 > window.innerHeight) {
    topPos = topPos - 320 - coords.height;
  }
  
  slashMenu.style.top = `${topPos}px`;
  slashMenu.style.left = `${leftPos}px`;
}

function closeSlashMenu() {
  slashMenuOpen = false;
  slashStartIndex = -1;
  slashMenu.classList.add('hidden');
  slashItems.forEach(item => item.classList.remove('bg-surface-container-low'));
}

function insertSlashItem(item) {
  if (slashStartIndex === -1) return;
  const command = item.getAttribute('data-command');
  
  if (command === 'table_chart') {
    editor.setRangeText('', slashStartIndex, editor.selectionEnd, 'end');
    editor.selectionStart = slashStartIndex;
    editor.selectionEnd = slashStartIndex;
    if (typeof openTableDropdown === 'function') {
      openTableDropdown(item);
    }
    closeSlashMenu();
    return;
  }

  const insertText = item.getAttribute('data-insert');
  if (insertText) {
    editor.setRangeText(insertText, slashStartIndex, editor.selectionEnd, 'end');
    editor.focus({ preventScroll: true });
    updatePreview();
    if (historyManager) historyManager.push();
  }
  
  closeSlashMenu();
}

function openTableDropdown(anchorElement) {
  if (typeof emojiDropdown !== 'undefined' && emojiDropdown) emojiDropdown.classList.add('hidden');
  if (typeof headerDropdown !== 'undefined' && headerDropdown) headerDropdown.classList.add('hidden');
  
  if (typeof tableDropdown !== 'undefined' && tableDropdown) {
    const rect = anchorElement.getBoundingClientRect();
    let left = rect.left;
    let top = rect.bottom + window.scrollY;
    
    if (left + 208 > window.innerWidth) {
      left = window.innerWidth - 208 - 16;
    }
    if (left < 16) left = 16;
    
    tableDropdown.style.top = `${top}px`;
    tableDropdown.style.left = `${left}px`;
    tableDropdown.classList.remove('hidden');
    
    colInput.value = 2;
    rowInput.value = 2;
    setTimeout(() => colInput.focus(), 50);
  }
}

editor.addEventListener('input', (e) => {
  if (!slashMenuOpen) {
    const pos = editor.selectionStart;
    const textBeforeCursor = editor.value.substring(0, pos);
    if (textBeforeCursor.endsWith('/')) {
      if (textBeforeCursor.length === 1 || /[\s\n]$/.test(textBeforeCursor.charAt(textBeforeCursor.length - 2))) {
        openSlashMenu(pos - 1);
      }
    }
  } else {
    const pos = editor.selectionStart;
    if (pos <= slashStartIndex || editor.value.charAt(slashStartIndex) !== '/') {
      closeSlashMenu();
    }
  }
});

editor.addEventListener('keydown', (e) => {
  // --- Undo/Redo Shortcuts ---
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const isCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;
  
  if (isCmdOrCtrl && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    if (e.shiftKey) {
      if (historyManager) historyManager.redo();
    } else {
      if (historyManager) historyManager.undo();
    }
    return;
  }
  
  if ((isCmdOrCtrl && e.key.toLowerCase() === 'y') || (isMac && isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 'z')) {
    e.preventDefault();
    if (historyManager) historyManager.redo();
    return;
  }

  if (e.key === 'Tab') {
    e.preventDefault();
    if (e.shiftKey) {
      adjustIndentation('outdent');
    } else {
      adjustIndentation('indent');
    }
    return;
  }
  
  if (!slashMenuOpen) return;
  
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    currentSlashFocus = (currentSlashFocus + 1) % slashItems.length;
    updateSlashFocus();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    currentSlashFocus = currentSlashFocus <= 0 ? slashItems.length - 1 : currentSlashFocus - 1;
    updateSlashFocus();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (currentSlashFocus >= 0) {
      insertSlashItem(slashItems[currentSlashFocus]);
    } else {
      insertSlashItem(slashItems[0]);
    }
  } else if (e.key === 'Escape') {
    closeSlashMenu();
  }
});

function updateSlashFocus() {
  slashItems.forEach((item, idx) => {
    if (idx === currentSlashFocus) {
      item.classList.add('bg-surface-container-low');
      item.scrollIntoView({ block: 'nearest' });
    } else {
      item.classList.remove('bg-surface-container-low');
    }
  });
}

slashItems.forEach(item => {
  item.addEventListener('click', () => insertSlashItem(item));
  item.addEventListener('mouseenter', () => {
    currentSlashFocus = Array.from(slashItems).indexOf(item);
    updateSlashFocus();
  });
});

document.addEventListener('click', (e) => {
  const path = e.composedPath();
  if (slashMenuOpen && e.target !== editor && !path.includes(slashMenu)) {
    closeSlashMenu();
  }
});

// Theme Toggle Functionality
function initTheme() {
  const savedTheme = localStorage.getItem('theme');
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  if (savedTheme === 'dark' || (!savedTheme && systemPrefersDark)) {
    document.documentElement.classList.add('dark');
    if (themeIcon) themeIcon.textContent = 'light_mode';
  } else {
    document.documentElement.classList.remove('dark');
    if (themeIcon) themeIcon.textContent = 'dark_mode';
  }
}

if (btnTheme) {
  btnTheme.addEventListener('click', () => {
    const isDark = document.documentElement.classList.contains('dark');
    if (isDark) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      if (themeIcon) themeIcon.textContent = 'dark_mode';
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      if (themeIcon) themeIcon.textContent = 'light_mode';
    }
  });
}

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
  if (!localStorage.getItem('theme')) {
    if (e.matches) {
      document.documentElement.classList.add('dark');
      if (themeIcon) themeIcon.textContent = 'light_mode';
    } else {
      document.documentElement.classList.remove('dark');
      if (themeIcon) themeIcon.textContent = 'dark_mode';
    }
  }
});

initTheme();

// --- Title Level Dropdown ---
const btnHeaderMenu = document.getElementById('btn-header-menu');
const headerDropdown = document.getElementById('header-dropdown');
const btnEmoji = document.getElementById('btn-emoji');
const emojiDropdown = document.getElementById('emoji-dropdown');

// --- Table Dropdown ---
const tableDropdown = document.getElementById('table-dropdown');
const colInput = document.getElementById('table-cols');
const rowInput = document.getElementById('table-rows');
const btnApplyTable = document.getElementById('btn-apply-table');

if (btnApplyTable) {
  btnApplyTable.addEventListener('click', (e) => {
    e.stopPropagation();
    const cols = parseInt(colInput.value) || 2;
    const rows = parseInt(rowInput.value) || 2;
    
    let tableMarkdown = '\n\n';
    
    for (let i = 0; i < cols; i++) tableMarkdown += `| 제목 ${i + 1} `;
    tableMarkdown += '|\n';
    
    for (let i = 0; i < cols; i++) tableMarkdown += '| --- ';
    tableMarkdown += '|\n';
    
    const contentRows = rows <= 1 ? 1 : rows - 1;
    for (let r = 0; r < contentRows; r++) {
      for (let c = 0; c < cols; c++) tableMarkdown += '| 내용 ';
      tableMarkdown += '|\n';
    }
    tableMarkdown += '\n';
    
    editor.setRangeText(tableMarkdown, editor.selectionStart, editor.selectionEnd, 'end');
    editor.focus({ preventScroll: true });
    updatePreview();
    if (historyManager) historyManager.push();
    
    tableDropdown.classList.add('hidden');
  });

  document.addEventListener('click', (e) => {
    const path = e.composedPath();
    if (tableDropdown && !tableDropdown.classList.contains('hidden')) {
      const isBtn = e.target.closest('.group') || e.target.closest('.slash-item');
      if (!path.includes(tableDropdown) && !isBtn) {
        tableDropdown.classList.add('hidden');
      }
    }
  });
}

if (btnHeaderMenu && headerDropdown) {
  btnHeaderMenu.addEventListener('click', (e) => {
    e.stopPropagation();
    const isHidden = headerDropdown.classList.contains('hidden');
    
    // Close emoji dropdown if open
    if (emojiDropdown) emojiDropdown.classList.add('hidden');
    
    if (isHidden) {
      const rect = btnHeaderMenu.getBoundingClientRect();
      headerDropdown.style.top = `${rect.bottom}px`;
      headerDropdown.style.left = `${rect.left}px`;
      headerDropdown.classList.remove('hidden');
    } else {
      headerDropdown.classList.add('hidden');
    }
  });

  document.querySelectorAll('.header-option').forEach(option => {
    option.addEventListener('click', (e) => {
      e.stopPropagation();
      const level = parseInt(option.getAttribute('data-level'), 10);
      const hashes = '#'.repeat(level);
      const insert = `\n${hashes} 제목 ${level}\n`;
      
      editor.setRangeText(insert, editor.selectionStart, editor.selectionEnd, 'end');
      editor.focus({ preventScroll: true });
      updatePreview();
      if (historyManager) historyManager.push();
      headerDropdown.classList.add('hidden');
    });
  });

  document.addEventListener('click', (e) => {
    const path = e.composedPath();
    if (!headerDropdown.classList.contains('hidden') && !path.includes(btnHeaderMenu) && !path.includes(headerDropdown)) {
      headerDropdown.classList.add('hidden');
    }
  });
}

// --- Emoji List Dropdown (v2.0.0 redesigned) ---
const emojiCategories = [
  {
    id: 'smileys',
    name: '표정',
    icon: '😀',
    emojis: [
      { char: '😀', tags: '웃음 기쁨 행복 즐거움 smile happy joy' },
      { char: '😃', tags: '웃음 기쁨 행복 즐거움 smile happy joy' },
      { char: '😄', tags: '웃음 기쁨 행복 즐거움 smile happy joy' },
      { char: '😁', tags: '미소 기쁨 행복 방긋 smile happy' },
      { char: '😆', tags: '미소 눈웃음 기쁨 대박 smile happy' },
      { char: '😅', tags: '땀 식은땀 안도 쑥스러움 smile sweat' },
      { char: '😂', tags: '눈물 기쁨 폭소 감격 tear laugh lol' },
      { char: '🤣', tags: '웃음 폭소 데굴데굴 빵터짐 laugh lol' },
      { char: '😊', tags: '미소 부끄럼 행복 따뜻 smile happy blush' },
      { char: '😇', tags: '천사 착함 순수 수호신 angel halo' },
      { char: '🙂', tags: '미소 안도 밋밋 smile' },
      { char: '🙃', tags: '거꾸로 반전 위트 upside-down' },
      { char: '😉', tags: '윙크 위트 매력 wink' },
      { char: '😌', tags: '안도 편안 명상 휴식 relief peace' },
      { char: '😍', tags: '하트 눈사랑 하트눈 반함 love heart eyes' },
      { char: '🥰', tags: '사랑 하트 부끄럼 행복 love hearts blush' },
      { char: '😘', tags: '뽀뽀 사랑 키스 kiss love' },
      { char: '😗', tags: '뽀뽀 키스 kiss' },
      { char: '😙', tags: '뽀뽀 미소 kiss happy' },
      { char: '😚', tags: '뽀뽀 눈감음 kiss close' },
      { char: '😋', tags: '맛있다 장난 메롱 냠냠 yummy tongue' },
      { char: '😛', tags: '메롱 장난 아메롱 tongue' },
      { char: '😝', tags: '메롱 눈감음 장난 아메롱 tongue close' },
      { char: '😜', tags: '메롱 윙크 장난 위트 tongue wink' },
      { char: '🤪', tags: '장난 미치광이 엽기 똘끼 crazy silly' },
      { char: '🤨', tags: '의심 생각 못마땅 brow suspicious' },
      { char: '🧐', tags: '분석 돋보기 안경 탐정 조사 monocle investigate' },
      { char: '🤓', tags: '범생이 안경 안경잡이 똑똑 nerd glasses' },
      { char: '😎', tags: '선글라스 멋짐 여유 쿨 cool glasses' },
      { char: '🥸', tags: '변장 가면 위장 disguise mask' },
      { char: '🤩', tags: '별눈 기쁨 흥분 눈부심 star eyes excitement' },
      { char: '🥳', tags: '파티 축하 축제 생일 party celebrate birthday' },
      { char: '😏', tags: '비웃음 썩소 거만 smirk sly' },
      { char: '😒', tags: '불만 시큰둥 뚱함 unamused unhappy' },
      { char: '😞', tags: '실망 우울 속상 낙담 disappointed sad' },
      { char: '😔', tags: '우울 생각 슬픔 시름 pensive sad' },
      { char: '😟', tags: '걱정 불안 근심 worried anxious' },
      { char: '😕', tags: '혼란 의아 어리둥절 confused puzzled' },
      { char: '🙁', tags: '슬픔 불만 시무룩 frown sad' },
      { char: '☹️', tags: '슬픔 불만 시무룩 frown sad' },
      { char: '😣', tags: '인내 괴로움 끙끙 persevere pain' },
      { char: '😖', tags: '괴로움 혼란 어쩔줄모름 confounded pain' },
      { char: '😫', tags: '피곤 짜증 힘듦 tired weary' },
      { char: '😩', tags: '피곤 힘듦 지침 weary tired' },
      { char: '🥺', tags: '부탁 아련 애원 눈물 힝 pleading cry' },
      { char: '😢', tags: '눈물 슬픔 흑흑 cry tear' },
      { char: '😭', tags: '대성통곡 눈물 슬픔 엉엉 sob cry tear' },
      { char: '😤', tags: '콧김 흥분 분노 극복 triumph win' },
      { char: '😠', tags: '화남 분노 짜증 angry mad' },
      { char: '😡', tags: '분노 화남 폭발 angry rage mad' },
      { char: '🤬', tags: '욕설 분노 화남 욕 curse swear' },
      { char: '🤯', tags: '충격 머리 폭발 대박 멘붕 explode mind shock' },
      { char: '😳', tags: '당황 부끄럼 붉어짐 blush flush shock' },
      { char: '🥵', tags: '덥다 열 더위 땀 핫 hot heat sweat' },
      { char: '🥶', tags: '춥다 얼어붙음 추위 덜덜 cold ice freeze' },
      { char: '😱', tags: '공포 비명 충격 으악 scream fear shock' },
      { char: '😨', tags: '두려움 불안 무서움 fearful scared' },
      { char: '😰', tags: '식은땀 걱정 두려움 헉 anxious sweat fear' },
      { char: '😥', tags: '안도 땀 슬픔 다행 sad sweat relief' },
      { char: '😓', tags: '땀 실망 걱정 휴 sweat disappointment' },
      { char: '🤗', tags: '포옹 환영 반가움 hug welcome' },
      { char: '🤔', tags: '생각 고민 의문 의심 think ponder' },
      { char: '🫣', tags: '훔쳐보기 몰래보기 엿보기 peek face' },
      { char: '🤭', tags: '입막음 웃음 웁스 giggle oops' },
      { char: '🫢', tags: '놀람 입막음 헉 gasp shocked' },
      { char: '🤫', tags: '조용 쉿 비밀 shush quiet' },
      { char: '🫠', tags: '녹아내림 더위 힘듦 melt hot' },
      { char: '🤥', tags: '거짓말 피노키오 liar pinocchio' },
      { char: '😶', tags: '말없음 비밀 침묵 speechless silent' },
      { char: '😶‍🌫️', tags: '안개속 몽롱 흐림 fog cloud' },
      { char: '😐', tags: '무표정 그저그럼 중립 neutral flat' },
      { char: '😑', tags: '무표정 뚱함 언짢음 expressionless flat' },
      { char: '😬', tags: '이익 난감 곤란 grimace awkward' },
      { char: '🫨', tags: '흔들림 진동 충격 shake shock' },
      { char: 'roll eyes', char: '🙄', tags: '눈굴리기 한심 절레절레 roll eyes' },
      { char: '😯', tags: '놀람 오 의아 hushed surprise' },
      { char: '😦', tags: '입벌림 놀람 걱정 frown open' },
      { char: '😧', tags: '당황 괴로움 슬픔 anguish sad' },
      { char: '😮', tags: '놀람 입벌림 오 open mouth surprise' },
      { char: '😲', tags: '깜놀 충격 대박 astonished shock' },
      { char: '🥱', tags: '하품 피곤 졸림 yawn tired' },
      { char: '😴', tags: '잠 수면 쿨쿨 sleep zzz' },
      { char: '🤤', tags: '침 질질 맛있겠다 drool sleep' },
      { char: '😪', tags: '졸림 콧물 수면 sleepy sleep' },
      { char: '😵', tags: '어지러움 혼란 빙글빙글 dizzy dead' },
      { char: '😵‍💫', tags: '어지러움 혼란 멘붕 dizzy confused' },
      { char: '🤐', tags: '지퍼 입다물기 비밀 zipper mouth secret' },
      { char: '🥴', tags: '만취 취함 비틀 woozy drunk' },
      { char: '🤢', tags: '구역질 울렁거림 속안좋음 nauseated sick' },
      { char: '🤮', tags: '구토 토하기 웩 vomit spew sick' },
      { char: '🤧', tags: '재채기 감기 비염 sneeze sick cold' },
      { char: '😷', tags: '마스크 코로나 황사 mask sick protection' },
      { char: '🤒', tags: '발열 아픔 감기 열 thermometer sick' },
      { char: '🤕', tags: '부상 붕대 다침 아픔 bandage sick hurt' }
    ]
  },
  {
    id: 'people',
    name: '사람',
    icon: '🙋',
    emojis: [
      { char: '👋', tags: '손흔들기 안녕 인사 손 wave hello hi' },
      { char: '🤚', tags: '손등 멈춰 손 backhand' },
      { char: '🖐️', tags: '손가락 손바닥 쫙 hand five' },
      { char: '✋', tags: '멈춰 정지 하이파이브 stop hand' },
      { char: '🖖', tags: '스타트렉 발칸 인사 vulcan sci-fi' },
      { char: '👌', tags: '오케이 승인 확인 ok okay' },
      { char: '🤌', tags: '이탈리아 만두 규탄 pinching finger' },
      { char: '🤏', tags: '조금 한꼬집 작음 pinch small' },
      { char: '✌️', tags: '브이 승리 평화 v sign victory peace' },
      { char: '🤞', tags: '행운 꼬기 fingers crossed luck' },
      { char: '🫰', tags: '하트 손가락하트 사랑 finger heart love' },
      { char: '🤟', tags: '사랑해 수화 love-you sign' },
      { char: '🤘', tags: '락 메탈 락앤롤 rock on horn' },
      { char: '🤙', tags: '전화해 스웩 call me sign' },
      { char: '👈', tags: '왼쪽 가리키기 손가락 point left' },
      { char: '👉', tags: '오른쪽 가리키기 손가락 point right' },
      { char: '👆', tags: '위 가리키기 손가락 point up' },
      { char: '🖕', tags: '뻐큐 욕설 가운데손가락 middle finger rude' },
      { char: '👇', tags: '아래 가리키기 손가락 point down' },
      { char: '☝️', tags: '하나 검지 검지손가락 point up one' },
      { char: '🫵', tags: '너 바로너 가리키기 point you' },
      { char: '👍', tags: '따봉 최고 좋아요 thumbs up good' },
      { char: '👎', tags: '비추 싫어요 에러 thumbs down bad' },
      { char: '✊', tags: '주먹 화이팅 fist power' },
      { char: '👊', tags: '펀치 주먹 쾅 fist punch' },
      { char: '🤛', tags: '왼쪽주먹 펀치 fist left' },
      { char: '🤜', tags: '오른쪽주먹 펀치 fist right' },
      { char: '👏', tags: '박수 짝짝짝 clap bravo' },
      { char: '🙌', tags: '만세 야호 기쁨 hands up celebrate' },
      { char: '👐', tags: '오픈 펼친손 open hands' },
      { char: '🤲', tags: '모은손 기도 감사 palms up pray' },
      { char: '🤝', tags: '악수 협력 계약 handshake agreement' },
      { char: '🙏', tags: '기도 부탁 합장 고맙습니다 pray please thank you' },
      { char: '✍️', tags: '글쓰기 펜 필기 공부 write pen' },
      { char: '💅', tags: '네일 매니큐어 뷰티 nail polish beauty' },
      { char: '🤳', tags: '셀카 사진 셀피 selfie phone camera' },
      { char: '💪', tags: '근육 힘 화이팅 헬스 muscle power fitness' },
      { char: '🦾', tags: '로봇팔 근육 사이보그 mechanical arm' },
      { char: '🦿', tags: '로봇다리 의족 사이보그 mechanical leg' },
      { char: '🦵', tags: '다리 하체 leg stretch' },
      { char: '🦶', tags: '발 맨발 foot step' },
      { char: '👂', tags: '귀 청각 소리 ear hear' },
      { char: '🦻', tags: '보청기 귀 ear hearing aid' },
      { char: '👃', tags: '코 후각 냄새 nose smell' },
      { char: '🧠', tags: '뇌 머리 생각 지식 brain mind intellect' },
      { char: '🫀', tags: '심장 장기 하트 heart organ anatomical' },
      { char: '🫁', tags: '폐 호흡 건강 lungs breathe' },
      { char: '🦷', tags: '치아 이빨 치과 tooth dentist' },
      { char: '🦴', tags: '뼈 다골 강아지뼈 bone skeleton' },
      { char: '👀', tags: '눈 감시 보기 시선 eyes look see' },
      { char: '👁️', tags: '외눈 눈 보기 eye look' },
      { char: '👅', tags: '혀 맛 메롱 tongue taste' },
      { char: '👄', tags: '입술 뽀뽀 말하기 mouth lips kiss' },
      { char: '💋', tags: '입술자국 뽀뽀 키스 kiss mark love' },
      { char: '🩸', tags: '피 혈액 헌혈 blood red drop' },
      { char: '👤', tags: '실루엣 사람 유저 user profile' },
      { char: '👥', tags: '사람들 실루엣 그룹 users group' },
      { char: '🫂', tags: '포옹 위로 따뜻함 허그 hug comfort' },
      { char: '🧑', tags: '사람 어른 일반 person adult' },
      { char: '👧', tags: '소녀 여자아이 꼬마 girl kid child' },
      { char: '👦', tags: '소년 남자아이 꼬마 boy kid child' },
      { char: '👩', tags: '여성 여자 어른 woman adult' },
      { char: '👨', tags: '남성 남자 어른 man adult' },
      { char: '👶', tags: '아기 아가 꼬마 baby infant' },
      { char: '👵', tags: '할머니 여성 노인 grandmother old' },
      { char: '👴', tags: '할아버지 남성 노인 grandfather old' },
      { char: '👲', tags: '아시아 모자 중국 man cap' },
      { char: '👳', tags: '터번 인도 이슬람 turban' },
      { char: '👮', tags: '경찰 경찰관 포돌이 cop police' },
      { char: '👷', tags: '공사 안전모 엔지니어 worker construction' },
      { char: '💂', tags: '근위병 영국 군인 guard soldier' },
      { char: '🕵️', tags: '탐정 돋보기 스파이 detective spy' },
      { char: '🧑‍⚕️', tags: '의사 간호사 병원 의료 doctor nurse medical' },
      { char: '🧑‍🎓', tags: '학생 졸업 대학생 student graduate' },
      { char: '🧑‍🏫', tags: '선생님 교사 교육 teacher school' },
      { char: '🧑‍⚖️', tags: '판사 법원 변호사 judge law court' },
      { char: '🧑‍🌾', tags: '농부 농업 시골 farmer agriculture' },
      { char: '🧑‍🍳', tags: '요리사 셰프 음식 cook chef kitchen' },
      { char: '🧑‍🔧', tags: '정비사 공구 엔지니어 mechanic repair' },
      { char: '🧑‍🏭', tags: '공장 노동자 기술자 worker factory' },
      { char: '🧑‍💼', tags: '회사원 직장인 오피스 worker office business' },
      { char: '🧑‍🔬', tags: '과학자 연구원 실험실 scientist laboratory' },
      { char: '🧑‍💻', tags: '개발자 코딩 프로그래머 맥북 developer coder programmer' },
      { char: '🧑‍🎤', tags: '가수 보컬 록스타 singer artist music' },
      { char: '🧑‍🎨', tags: '화가 미술 아티스트 artist painter' },
      { char: '🧑‍✈️', tags: '조종사 파일럿 비행기 pilot flight' },
      { char: '🧑‍🚀', tags: '우주비행사 아스트로넛 astronaut space' },
      { char: '🧑‍🚒', tags: '소방관 119 구조대 firefighter rescue' }
    ]
  },
  {
    id: 'animals',
    name: '동물',
    icon: '🐱',
    emojis: [
      { char: '🐶', tags: '개 강아지 댕댕이 dog puppy pet' },
      { char: '🐱', tags: '고양이 냥이 야옹이 cat kitty pet' },
      { char: '🐭', tags: '쥐 생쥐 마우스 mouse rat' },
      { char: '🐹', tags: '햄스터 햄찌 hamster pet' },
      { char: '🐰', tags: '토끼 토깽이 rabbit bunny' },
      { char: '🦊', tags: '여우 fox' },
      { char: '🐻', tags: '곰 곰돌이 bear' },
      { char: '🐼', tags: '판다 푸바오 panda' },
      { char: '🐨', tags: '코알라 koala' },
      { char: '🐯', tags: '호랑이 범 tiger' },
      { char: '🦁', tags: '사자 라이온 lion' },
      { char: '🐮', tags: '소 황소 cow bull' },
      { char: '🐷', tags: '돼지 꿀꿀이 pig' },
      { char: '🐸', tags: '개구리 와글 frog' },
      { char: '🐵', tags: '원숭이 monkey' },
      { char: '🐔', tags: '닭 치킨 꼭끼오 chicken rooster' },
      { char: '🐧', tags: '펭귄 펭수 penguin' },
      { char: '🐦', tags: '새 짹짹이 bird' },
      { char: '🐤', tags: '병아리 삐약이 chick baby bird' },
      { char: '🐣', tags: '부화 알 병아리 hatching chick' },
      { char: '🐥', tags: '병아리 정면 chick front' },
      { char: '🦆', tags: '오리 꽥꽥이 duck' },
      { char: '🦅', tags: '독수리 수리 eagle' },
      { char: '🦉', tags: '부엉이 올빼미 owl wisdom' },
      { char: '🦇', tags: '박쥐 배트맨 bat' },
      { char: '🐺', tags: '늑대 울프 wolf' },
      { char: '🐗', tags: '멧돼지 돈 boar wild pig' },
      { char: '🐴', tags: '말 유니콘 horse' },
      { char: '🦄', tags: '유니콘 판타지 unicorn fantasy' },
      { char: '🐝', tags: '벌 꿀벌 bee honey' },
      { char: '🪱', tags: '지렁이 벌레 worm bug' },
      { char: '🐛', tags: '애벌레 벌레 caterpillar bug' },
      { char: '🦋', tags: '나비 뷰티 butterfly insect' },
      { char: '🐌', tags: '달팽이 달팽이관 snail slug' },
      { char: '🐞', tags: '무당벌레 ladybug insect' },
      { char: '🐜', tags: '개미 일개미 ant insect' },
      { char: '🕷️', tags: '거미 스파이더 spider' },
      { char: '🦂', tags: '전갈 쏘기 scorpion sting' },
      { char: '🐢', tags: '거북이 닌자 turtle tortoise' },
      { char: '🐍', tags: '뱀 스네이크 snake' },
      { char: '🦎', tags: '도마뱀 파충류 lizard reptile' },
      { char: '🐙', tags: '문어 타코 octopus' },
      { char: '🦑', tags: '오징어 갑오징어 squid' },
      { char: '🦞', tags: '랍스터 바닷가재 lobster shellfish' },
      { char: '🦀', tags: '게 꽃게 crab shellfish' },
      { char: '🐠', tags: '열대어 물고기 tropical fish' },
      { char: '🐟', tags: '물고기 생선 fish' },
      { char: '🐡', tags: '복어 물고기 blowfish' },
      { char: '🐬', tags: '돌고래 고래 dolphin marine' },
      { char: '🐳', tags: '고래 고래물뿜기 whale water' },
      { char: '🐋', tags: '대왕고래 whale large' },
      { char: '🦈', tags: '상어 죠스 shark ocean' },
      { char: '🐊', tags: '악어 크로코다일 crocodile alligator' },
      { char: '🦖', tags: '공룡 티라노 t-rex dinosaur' },
      { char: '🦕', tags: '공룡 초식공룡 sauropod dinosaur' },
      { char: '🦍', tags: '고릴라 킹콩 gorilla ape' },
      { char: '🦧', tags: '오랑우탄 유인원 orangutan ape' },
      { char: '🐆', tags: '표범 레오파드 leopard cat' },
      { char: '🐅', tags: '호랑이 전신 tiger large' },
      { char: '🐃', tags: '물소 버팔로 buffalo' },
      { char: '🐂', tags: '황소 ox' },
      { char: '🐄', tags: '젖소 우유 cow milk' },
      { char: '🐪', tags: '낙타 메르스 camel desert' },
      { char: '🐫', tags: '쌍봉낙타 camel two-humps' },
      { char: '🦒', tags: '기린 목이긴 giraffe' },
      { char: '🐘', tags: '코끼리 덤보 elephant' },
      { char: '🦣', tags: '매머드 맘모스 mammoth extinct' },
      { char: '🦏', tags: '코뿔소 라이노 rhinoceros' },
      { char: '🦛', tags: '하마 히포 hippopotamus' },
      { char: '🐎', tags: '경마 레이스 horse racing' },
      { char: '🐖', tags: '돼지 전신 pig pink' },
      { char: '🐏', tags: '숫양 뿔양 ram' },
      { char: '🐑', tags: '양 메에 sheep' },
      { char: '🐐', tags: '염소 goat' },
      { char: '🦌', tags: '사슴 루돌프 deer stags' },
      { char: '🐕', tags: '개 도그 dog' },
      { char: '🐈', tags: '고양이 전신 cat' },
      { char: '🐈‍⬛', tags: '검은고양이 냥이 black cat' },
      { char: '🐓', tags: '수탉 닭 rooster' },
      { char: '🦃', tags: '칠면조 추수감사절 turkey' },
      { char: '🕊️', tags: '비둘기 평화 dove peace' },
      { char: '🐇', tags: '토끼 전신 rabbit' },
      { char: '🦝', tags: '너구리 라쿤 raccoon' },
      { char: '🦡', tags: '오소리 badger' },
      { char: '🦦', tags: '수달 보노보노 otter' },
      { char: '🦫', tags: '비버 댐 beaver' },
      { char: '🦥', tags: '나무늘보 느림 sloth' },
      { char: '🌲', tags: '소나무 전나무 침엽수 pine evergreen' },
      { char: '🌳', tags: '낙엽수 나무 정원 deciduous tree' },
      { char: '🌴', tags: '야자수 바닷가 휴양지 palm island' },
      { char: '🌵', tags: '선인장 사막 cactus desert' },
      { char: '🌾', tags: '벼 보리 밀 이삭 rice wheat sheaf' },
      { char: '🌿', tags: '허브 잎사귀 풀 herb foliage' },
      { char: '🍀', tags: '네잎클로버 클로버 행운 luck clover' },
      { char: '🍁', tags: '단풍 단풍잎 가을 maple leaf autumn' },
      { char: '🍂', tags: '낙엽 가을 쓸쓸함 fallen leaves autumn' },
      { char: '🍃', tags: '잎 흩날리는 풀잎 leaf wind flutter' },
      { char: '🌸', tags: '벚꽃 꽃 사쿠라 봄 cherry blossom flower' },
      { char: '🌹', tags: '장미 장미꽃 사랑 rose flower love' },
      { char: '🌺', tags: '무궁화 하와이 꽃 hibiscus flower' },
      { char: '🌻', tags: '해바라기 태양 꽃 sunflower flower' },
      { char: '🌼', tags: '국화 노란꽃 데이지 blossom daisy' },
      { char: '🌷', tags: '튤립 구근 꽃 tulip flower' },
      { char: '🍄', tags: '버섯 독버섯 마리오 mushroom fungus' },
      { char: '🌰', tags: '밤 도토리 알밤 chestnut nut' },
      { char: '🐚', tags: '소라 조개 껍데기 seashell spiral' },
      { char: '🕸️', tags: '거미줄 스파이더웹 spider web' }
    ]
  },
  {
    id: 'food',
    name: '음식',
    icon: '🍔',
    emojis: [
      { char: '🍏', tags: '풋사과 청사과 아오리 green apple fruit' },
      { char: '🍎', tags: '빨간사과 사과 백설공주 red apple fruit' },
      { char: '🍐', tags: '배 과일 서양배 pear fruit' },
      { char: '🍊', tags: '귤 오렌지 감 탠저린 orange mandarin fruit' },
      { char: '🍋', tags: '레몬 시트러스 비타민 lemon fruit sour' },
      { char: '🍌', tags: '바나나 옐로우 banana fruit' },
      { char: '🍉', tags: '수박 여름 watermelon fruit' },
      { char: '🍇', tags: '포도 거봉 포도송이 grapes fruit' },
      { char: '🍓', tags: '딸기 스트로베리 strawberry fruit' },
      { char: '🍒', tags: '체리 앵두 버찌 cherries fruit' },
      { char: '🍑', tags: '복숭아 피치 peach fruit' },
      { char: '🥭', tags: '망고 열대과일 mango tropical' },
      { char: '🍍', tags: '파인애플 아난아스 pineapple tropical' },
      { char: '🥥', tags: '코코넛 야자 coconut tropical' },
      { char: '🥝', tags: '키위 참다래 kiwi fruit' },
      { char: '🍅', tags: '토마토 방울토마토 tomato vegetable' },
      { char: '🍆', tags: '가지 채소 eggplant vegetable' },
      { char: '🥑', tags: '아보카도 샌드위치 avocado fruit' },
      { char: '🥦', tags: '브로콜리 야채 broccoli vegetable' },
      { char: '🥬', tags: '상추 배추 양배추 샐러드 leafy green lettuce' },
      { char: '🥒', tags: '오이 피클 cucumber pickle' },
      { char: '🌶️', tags: '고추 매운맛 핫 스파이시 hot pepper chili' },
      { char: '🌽', tags: '옥수수 마약옥수수 corn grain' },
      { char: '🥕', tags: '당근 바니 carrot vegetable' },
      { char: '🥔', tags: '감자 포테이토 potato vegetable' },
      { char: '🍠', tags: '고구마 군고구마 sweet potato' },
      { char: '🧅', tags: '양파 채소 onion vegetable' },
      { char: '🧄', tags: '마늘 갈릭 garlic vegetable' },
      { char: '🥐', tags: '크로와상 빵 크루아상 croissant bread bakery' },
      { char: '🥯', tags: '베이글 빵 크림치즈 bagel bread' },
      { char: '🍞', tags: '식빵 토스트 빵 bread toast' },
      { char: '🥖', tags: '바게트 프랑스 빵 baguette bread' },
      { char: '🧀', tags: '치즈 제리 치즈조각 cheese yellow' },
      { char: '🥚', tags: '계란 달걀 날달걀 egg raw' },
      { char: '🍳', tags: '계란후라이 프라이팬 요리 egg cooking pan' },
      { char: '🥞', tags: '팬케이크 시럽 핫케이크 pancake breakfast' },
      { char: '🧇', tags: '와플 벨기에 디저트 waffle bakery' },
      { char: '🥓', tags: '베이컨 삼겹살 고기 bacon meat' },
      { char: '🥩', tags: '스테이크 소고기 육류 meat steak beef' },
      { char: '🍗', tags: '닭다리 치킨 통닭 chicken drumstick' },
      { char: '🍖', tags: '만화고기 갈비 고기 meat bone' },
      { char: '🌭', tags: '핫도그 소시지 hotdog sausage' },
      { char: '🍔', tags: '햄버거 버거 맥도날드 hamburger burger fastfood' },
      { char: '🍟', tags: '감자튀김 감튀 프렌치프라이 french fries fastfood' },
      { char: '🍕', tags: '피자 피자조각 도우 pizza cheese' },
      { char: '🥪', tags: '샌드위치 토스트 sandwich bread' },
      { char: '🌮', tags: '타코 멕시코 taco mexican' },
      { char: '🌯', tags: '부리토 브리또 burrito mexican' },
      { char: '🥗', tags: '샐러드 웰빙 야채 salad healthy' },
      { char: '🍿', tags: '팝콘 영화관 극장 popcorn snack' },
      { char: '🍱', tags: '도시락 벤또 일식 bento box lunch' },
      { char: '🥟', tags: '만두 군만두 딤섬 dumpling dimsum' },
      { char: '🍣', tags: '초밥 스시 회 sushi fish' },
      { char: '🍜', tags: '라면 라멘 우동 국수 ramen noodle soup' },
      { char: '🍝', tags: '스파게티 파스타 이탈리아 spaghetti pasta' },
      { char: '🍦', tags: '소프트아이스크림 콘 디저트 ice cream cone' },
      { char: '🍩', tags: '도넛 도너츠 디저트 donut bakery' },
      { char: '🍪', tags: '쿠키 과자 초코칩 cookie biscuit' },
      { char: '🎂', tags: '생일케이크 케이크 축하 cake birthday party' },
      { char: '🍰', tags: '조각케이크 디저트 strawberry cake slice' },
      { char: '🍫', tags: '초콜릿 가나 초콜렛 chocolate bar sweet' },
      { char: '🍬', tags: '사탕 캔디 단것 candy sweet' },
      { char: '🍭', tags: '막대사탕 롤리팝 lollipop candy' },
      { char: '🍯', tags: '꿀 꿀단지 푸우 honey pot sweet' },
      { char: '☕', tags: '커피 에스프레소 카페인 커피잔 coffee cafe hot' },
      { char: '🍵', tags: '녹차 찻잔 전통차 green tea hot' },
      { char: '🍶', tags: '사케 정종 도자기 술병 sake bottle drink' },
      { char: '🍾', tags: '샴페인 샴페인병 축하 champagne bottle celebrate' },
      { char: '🍷', tags: '와인 와인잔 술 레드와인 wine glass alcohol' },
      { char: '🍸', tags: '칵테일 바 술 마티니 cocktail drink bar' },
      { char: '🍹', tags: '열대음료 주스 트로피컬 drink tropical juice' },
      { char: '🍺', tags: '맥주 생맥주 술 피어 beer mug alcohol' },
      { char: '🍻', tags: '맥주잔 건배 짠 축배 cheers beers alcohol' },
      { char: '🥤', tags: '소다 콜라 탄산음료 빨대 soda cup cola drink' },
      { char: '🧃', tags: '팩주스 음료수 어린이 juice box drink' },
      { char: '🧉', tags: '마테차 남미 전통차 mate drink' },
      { char: '🧊', tags: '얼음 아이스 큐브 ice cube cold' }
    ]
  },
  {
    id: 'activities',
    name: '활동',
    icon: '⚽',
    emojis: [
      { char: '⚽', tags: '축구 축구공 월드컵 soccer football ball' },
      { char: '🏀', tags: '농구 농구공 엔비에이 basketball ball hoop' },
      { char: '🏈', tags: '미식축구 풋볼 미럭 football rugger ball' },
      { char: '⚾', tags: '야구 야구공 메이저리그 baseball ball' },
      { char: '🥎', tags: '소프트볼 야구공 softball ball' },
      { char: '🎾', tags: '테니스 테니스공 라켓 tennis ball racket' },
      { char: '🏐', tags: '배구 배구공 네트 volleyball ball' },
      { char: '🏉', tags: '럭비 럭비공 rugby football ball' },
      { char: '🥏', tags: '원반 플라잉디스크 frisbee flying disc' },
      { char: '🎱', tags: '당구 당구공 포켓볼 8볼 billiards pool 8ball' },
      { char: '🪀', tags: '요요 장난감 yoyo toy' },
      { char: '🏓', tags: '탁구 핑퐁 탁구채 탁구공 ping pong table tennis' },
      { char: '🏸', tags: '배드민턴 셔틀콕 badminton racket' },
      { char: '🏒', tags: '아이스하키 하키 스틱 하키공 ice hockey' },
      { char: '🏑', tags: '필드하키 하키 field hockey' },
      { char: '🥍', tags: '라크로스 스포츠 lacrosse' },
      { char: '🏹', tags: '양궁 활 화살 국궁 bow arrow archery' },
      { char: '🎣', tags: '낚시 물고기 낚싯대 fishing fish rod' },
      { char: '🤿', tags: '다이빙 스노클링 마스크 diving mask snorkel' },
      { char: '🥊', tags: '권투 복싱 글러브 boxing glove punch' },
      { char: '🥋', tags: '태권도 유도 도복 무술 martial arts judo karate' },
      { char: '🥅', tags: '골대 그물 축구골대 goal net' },
      { char: '⛳', tags: '골프 홀인원 깃발 golf hole flag' },
      { char: '⛸️', tags: '스케이트 피겨 아이스 스케이트 ice skate' },
      { char: '🛷', tags: '썰매 겨울 루지 sled' },
      { char: '🥌', tags: '컬링 스톤 컬링스톤 curling stone' },
      { char: '🎯', tags: '다트 조준 과녁 정중앙 darts bulls eye' },
      { char: '🎳', tags: '볼링 볼링공 볼링핀 bowling strike' },
      { char: '🎮', tags: 'game game controller gamepad' },
      { char: '🕹️', tags: '조이스틱 레트로 오락실 joystick retro game' },
      { char: '🎰', tags: '슬롯머신 카지노 도박 slot machine casino' },
      { char: '🎲', tags: '주사위 보드게임 dice game' },
      { char: '🧩', tags: '퍼즐 직소 퍼즐 조각 puzzle pieces' },
      { char: '🧸', tags: '테디베어 인형 곰인형 teddy bear toy' },
      { char: '🎨', tags: '팔레트 미술 화가 그림 palette art paint' },
      { char: '🎬', tags: '슬레이트 영화 감독 촬영 clapper board movie' },
      { char: '🎤', tags: '마이크 노래방 보컬 녹음 mic microphone music' },
      { char: '🎧', tags: '헤드폰 헤드셋 청취 음악 headphones music' },
      { char: '🎼', tags: '악보 음표 클래식 오선지 musical score music' },
      { char: '🎹', tags: '피아노 신디사이저 키보드 piano keyboard music' },
      { char: '🥁', tags: '드럼 드럼스틱 타악기 drum instrument music' },
      { char: '🎸', tags: '기타 일렉기타 악기 guitar instrument music' },
      { char: '🎻', tags: '바이올린 현악기 악기 violin instrument music' },
      { char: '🎺', tags: '트럼펫 나팔 관악기 trumpet brass instrument' },
      { char: '🎷', tags: '색소폰 재즈 관악기 saxophone jazz' },
      { char: '🪗', tags: '아코디언 손풍금 accordion' },
      { char: '🎫', tags: '티켓 승차권 입장권 ticket' },
      { char: '🎟️', tags: '영화표 티켓 입장권 admission tickets' },
      { char: '🏆', tags: '트로피 우승 1등 시상 우승컵 trophy prize winner' },
      { char: '🥇', tags: '금메달 메달 1등 gold medal prize first' },
      { char: '🥈', tags: '은메달 메달 2등 silver medal second' },
      { char: '🥉', tags: '동메달 메달 3등 bronze medal third' },
      { char: '🏅', tags: '메달 스포츠 훈장 sports medal' },
      { char: '🎖️', tags: '군인 훈장 훈장메달 military medal' },
      { char: '🎭', tags: '가면 연극 뮤지컬 셰익스피어 performing arts theater' },
      { char: '🧵', tags: '실 바느질 재봉 thread sewing' },
      { char: '🪡', tags: '바늘 실 바느질 needle sewing' },
      { char: '🧶', tags: '실타래 뜨개질 털실 yarn knitting' },
      { char: '🪢', tags: '매듭 밧줄 묶기 knot rope' },
      { char: '🧳', tags: '러기지 여행가방 캐리어 luggage suitcase' }
    ]
  },
  {
    id: 'travel',
    name: '여행',
    icon: '✈️',
    emojis: [
      { char: '🚗', tags: '승용차 자동차 빨간차 car automobile red' },
      { char: '🚕', tags: '택시 옐로우캡 taxi cab yellow' },
      { char: '🚙', tags: 'suv 자동차 레저 blue car sport' },
      { char: '🚌', tags: '버스 시내버스 대중교통 bus transit' },
      { char: '🚎', tags: '트롤리버스 무궤도전차 trolleybus' },
      { char: '🏎️', tags: '레이싱카 f1 포뮬러 racing car speed' },
      { char: '🚓', tags: '경찰차 싸이렌 수사 police car cop' },
      { char: '🚑', tags: '구급차 응급차 병원 ambulance medical' },
      { char: '🚒', tags: '소방차 소방서 화재 fire engine rescue' },
      { char: '🚐', tags: '미니밴 승합차 캠핑카 minibus van' },
      { char: '🚚', tags: '트럭 화물차 운송 delivery truck cargo' },
      { char: '🚛', tags: '대형트럭 트레일러 화물차 truck large' },
      { char: '🚜', tags: '트랙터 경운기 농기계 tractor farm' },
      { char: '🛵', tags: '스쿠터 오토바이 배달 motor scooter motorcycle' },
      { char: '🚲', tags: '자전거 사이클 따릉이 bicycle bike cycle' },
      { char: '🛴', tags: '킥보드 킥스쿠터 kick scooter' },
      { char: '🚨', tags: '비상등 사이렌 경보 경찰차 siren emergency light' },
      { char: '🚥', tags: '신호등 교통신호 신호 traffic light horizontal' },
      { char: '⚓', tags: '닻 항구 배 anchor harbor navy' },
      { char: '⛵', tags: '돛단배 요트 항해 sailboat yacht' },
      { char: '🛶', tags: '카누 카약 보트 canoe kayak' },
      { char: '🚤', tags: '모터보트 제트스키 speedboat boat speed' },
      { char: '🛳️', tags: '크루즈 여객선 배 passenger ship cruise' },
      { char: '🚢', tags: '배 선박 화물선 ship vessel cargo' },
      { char: '✈️', tags: '비행기 항공기 여객기 airplane flight travel' },
      { char: '🛫', tags: '이륙 비행기출발 departure airplane takeoff' },
      { char: '🛬', tags: '착륙 비행기도착 arrival airplane landing' },
      { char: '🪂', tags: '낙하산 패러글라이딩 스카이다이빙 parachute skydive' },
      { char: '🚁', tags: '헬리콥터 헬기 수송 helicopter chopper' },
      { char: '🚀', tags: '로켓 우주선 나사 발사 rocket space nasa launcher' },
      { char: '🛸', tags: 'UFO 비행접시 외계인 ufo alien space' },
      { char: '🌍', tags: '지구 아프리카 유럽 earth globe africa europe' },
      { char: '🌎', tags: '지구 아메리카 대륙 earth globe americas' },
      { char: '🌏', tags: '지구 아시아 오세아니아 한국 earth globe asia' },
      { char: '🌐', tags: '지구본 인터넷 네트워크 globe meridians internet' },
      { char: '🗺️', tags: '세계지도 지도 약도 map world' },
      { char: '🧭', tags: '나침반 방향 나침의 compass direction' },
      { char: '🏔️', tags: '눈덮인산 설산 산맥 mountain snow peak' },
      { char: '⛰️', tags: '산 등산 봉우리 mountain hill peak' },
      { char: '🌋', tags: '화산 용암 분출 volcano lava erupt' },
      { char: '🗻', tags: '후지산 일본산 fuji mountain japan' },
      { char: '🏕️', tags: '캠핑 텐트 캠핑장 camping tent outdoor' },
      { char: '🏖️', tags: '해변 파라솔 바닷가 피서 beach umbrella sea' },
      { char: '🏜️', tags: '사막 모래 선인장 desert sand' },
      { char: '🏝️', tags: '섬 무인도 야자수 island tropical' },
      { char: '🏞️', tags: '국립공원 계곡 자연 국립공원 national park river' },
      { char: '🏟️', tags: '경기장 체육관 스타디움 stadium arena' },
      { char: '🏛️', tags: '신전 법원 미술관 고전건물 classical building museum' },
      { char: '🏗️', tags: '공사 현장 크레인 빌딩건설 building construction crane' },
      { char: '🏠', tags: '집 주택 마이홈 house home' },
      { char: '🏡', tags: '정원주택 집 전원주택 house garden yard' },
      { char: '🏢', tags: '빌딩 사무실 회사 오피스 office building tower' },
      { char: '🏣', tags: '우체국 우편 post office mail' },
      { char: '🏥', tags: '병원 응급실 의원 hospital clinic medical' },
      { char: '🏦', tags: '은행 뱅크 예금 bank finance money' },
      { char: '🏨', tags: '호텔 숙소 숙박 hotel lodging' },
      { char: '🏪', tags: '편의점 24시 cvs convenience store' },
      { char: '🏫', tags: '학교 스쿨 초등학교 school education' },
      { char: '🏬', tags: '백화점 쇼핑몰 쇼핑타운 department store mall' },
      { char: '🏭', tags: '공장 팩토리 굴뚝 factory industry' },
      { char: '🏯', tags: '일본성 캐슬 성 castle japanese' },
      { char: '🏰', tags: '유럽성 디즈니성 캐슬 castle fortress' },
      { char: '🗼', tags: '도쿄타워 에펠탑 송신탑 tokyo tower mast' },
      { char: '🗽', tags: '자유의여신상 뉴욕 미국 statue of liberty new york' },
      { char: '⛪', tags: '교회 성당 십자가 church christian' },
      { char: '🕌', tags: '모스크 이슬람 이슬람사원 mosque islam' },
      { char: '🕍', tags: '시나고그 유대교 유대교회당 synagogue jewish' },
      { char: '⛩️', tags: '신사 신토 도리이 shrine shinto gate' },
      { char: '♨️', tags: '온천 온수 목욕탕 사우나 hot spring spa bath' },
      { char: '☀️', tags: '태양 해 맑음 날씨 sun sunny hot' },
      { char: '🌤️', tags: '해구름 약간흐림 sun cloudy weather' },
      { char: '⛅', tags: '구름 해 흐림 sun cloud weather' },
      { char: '🌥️', tags: '많이흐림 해숨음 cloud sun weather' },
      { char: '☁️', tags: '구름 날씨 흐림 cloud cloudy' },
      { char: '🌦️', tags: '여우비 소나기 비구름 rain sun cloud' },
      { char: '🌧️', tags: '비 강수량 우산 rain cloud rainy' },
      { char: '⛈️', tags: '천둥번개 비 번개구름 storm lightning rain' },
      { char: '🌩️', tags: '번개 벼락 낙뢰 lightning storm' },
      { char: '🌨️', tags: '눈 내리는눈 함박눈 snow cloud snowy' },
      { char: '❄️', tags: '눈송이 결정체 눈 결빙 snowflake ice cold' },
      { char: '💨', tags: '바람 먼지 달리다 대시 wind dash running' },
      { char: '🌪️', tags: '토네이도 회오리바람 태풍 tornado whirlwind' },
      { char: '🌫️', tags: '안개 박무 미세먼지 fog hazy mist' },
      { char: '🌈', tags: '무지개 레인보우 일곱색 rainbow color' },
      { char: '⚡', tags: '고전압 번개 피뢰침 voltage lightning electric' }
    ]
  },
  {
    id: 'objects',
    name: '물건',
    icon: '💡',
    emojis: [
      { char: '💻', tags: '노트북 컴퓨터 맥북 피씨 laptop computer pc macbook' },
      { char: '🖥️', tags: '모니터 데스크탑 화면 screen desktop monitor' },
      { char: '🖨️', tags: '프린터 복사기 인쇄 printer copy machine' },
      { char: '⌨️', tags: '키보드 자판 입력기 keyboard layout' },
      { char: '🖱️', tags: '마우스 마우스클릭 입력장치 mouse click' },
      { char: '💽', tags: '미니디스크 엠디 저장매체 minidisc drive md' },
      { char: '💾', tags: '플로피디스크 디스켓 저장 floppy disk save' },
      { char: '💿', tags: '시디 CD 음반 cd compact disc' },
      { char: '📀', tags: '디브이디 DVD 영화 dvd laser disc' },
      { char: '📼', tags: '비디오테이프 카세트 VHS videotape cassette' },
      { char: '📷', tags: '카메라 사진기 촬영 camera photo' },
      { char: '📸', tags: '카메라플래시 사진촬영 플래시 camera flash photo' },
      { char: '📹', tags: '비디오카메라 촬영기 캠코더 video camera camcorder' },
      { char: '🎥', tags: '영사기 영화카메라 시네마 movie camera cinema' },
      { char: '📺', tags: '텔레비전 티비 방송 tv television' },
      { char: '📻', tags: '라디오 방송 에프엠 radio broadcasting' },
      { char: '🎙️', tags: '스튜디오마이크 녹음 마이크 studio microphone recording' },
      { char: '⏱️', tags: '스톱워치 초시계 타이머 stopwatch timer' },
      { char: '⏰', tags: '알람시계 자명종 시계 alarm clock wake' },
      { char: '⌛', tags: '모래시계 대기 끝 hourglass done' },
      { char: '⏳', tags: '모래시계진행 로딩 hourglass flowing wait' },
      { char: '📡', tags: '위성안테나 파라볼라 통신 satellite antenna radar' },
      { char: '🔋', tags: '배터리 건전지 충전 battery power charge' },
      { char: '🔌', tags: '전원플러그 콘센트 전기 plug electric power' },
      { char: '💡', tags: '전구 아이디어 생각 라이트 light bulb idea genius' },
      { char: '🔦', tags: '손전등 플래시라이트 조명 flashlight torch' },
      { char: '🕯️', tags: '양초 촛불 촛대 candle wax flame' },
      { char: '💸', tags: '날아가는돈 돈 낭비 지출 money wings fly' },
      { char: '💵', tags: '달러 달러지폐 미국돈 dollar bill cash money' },
      { char: '💴', tags: '엔화 일본돈 지폐 yen bill cash money' },
      { char: '💶', tags: '유로 유로화 지폐 euro bill cash money' },
      { char: '💷', tags: '파운드 영국돈 지폐 pound bill cash money' },
      { char: '🪙', tags: '동전 코인 메달 coin cash currency' },
      { char: '💎', tags: '다이아몬드 보석 쥬얼리 diamond gem jewelry' },
      { char: '🔧', tags: '렌치 스패너 공구 수리 wrench tool repair' },
      { char: '🔨', tags: '망치 공구 해머 hammer tool build' },
      { char: '🛠️', tags: '망치와스패너 공구 도구 작업 tools hammer wrench' },
      { char: '⚙️', tags: '톱니바퀴 설정 기어 옵션 gear cog wheel options' },
      { char: '🧱', tags: '벽돌 블록 brick block' },
      { char: '⛓️', tags: '쇠사슬 체인 속박 chains lock link' },
      { char: '🔫', tags: '물총 권총 장난감총 water gun pistol toy' },
      { char: '💣', tags: '폭탄 폭발 터짐 테러 bomb explosion explosive' },
      { char: '🧨', tags: '폭죽 다이너마이트 소방방 firecracker dynamite' },
      { char: '🛡️', tags: '방패 보초 보안 가드 shield protection security' },
      { char: '🔑', tags: '열쇠 키 잠금 key lock' },
      { char: '🗝️', tags: '오래된열쇠 비밀번호 key old password' },
      { char: '📦', tags: '상자 박스 소포 택배 package box parcel' },
      { char: '🏷️', tags: '태그 라벨 가격표 tag label ticket' },
      { char: '✉️', tags: '편지 봉투 메일 우편 envelope email letter' },
      { char: '📨', tags: '수신편지 메일도착 incoming envelope inbox' },
      { char: '📊', tags: '바차트 막대그래프 통계 bar chart statistics' },
      { char: '📈', tags: '우상향차트 성장 상승 그래프 chart increasing trend' },
      { char: '📉', tags: '우하향차트 감소 하락 그래프 chart decreasing trend' },
      { char: '📅', tags: '달력 일정 캘린더 calendar date schedule' },
      { char: '📆', tags: '일일달력 날짜 calendar tear-off' },
      { char: '📋', tags: '클립보드 보고서 결재서류 clipboard board report' },
      { char: '📌', tags: '압정 핀 고정 pushpin pin' },
      { char: '📍', tags: '지도핀 위치 핀 고정 round pushpin marker' },
      { char: '📎', tags: '클립 종이클립 사무용품 paperclip clip' },
      { char: '📝', tags: '메모지 메모 필기 공책 memo notepad write' },
      { char: '🔒', tags: '잠금 자물쇠 보안 lock closed safety' },
      { char: '🔓', tags: '잠금해제 열린자물쇠 unlock open' },
      { char: '🔏', tags: '자물쇠와펜 서명 암호화 lock with pen key signature' },
      { char: '🔐', tags: '열쇠와자물쇠 보안인증 lock with key secure' },
      { char: '🧯', tags: '소화기 소방 화재진압 fire extinguisher safety' },
      { char: '🛒', tags: '쇼핑카트 카트 마트 shopping cart market' },
      { char: '🚬', tags: '담배 흡연 담배연기 cigarette smoking' },
      { char: '⚰️', tags: '관 죽음 장례식 coffin death funeral' },
      { char: '🪦', tags: '비석 무덤 묘지 gravestone grave tomb' },
      { char: '🔮', tags: '수정구슬 마법 점쟁이 crystal ball magic fortune' },
      { char: '🧿', tags: '나자르본주 악마의눈 부적 nazar amulet lucky' },
      { char: '📿', tags: '묵주 염주 종교기도 prayer beads rosary' },
      { char: '💊', tags: '알약 약 의약품 캡슐 pill capsule medicine' },
      { char: '🩹', tags: '대역반창고 밴드 상처 adhesive bandage wound' },
      { char: '🩺', tags: '청진기 의사 의학 stethoscope doctor medical' },
      { char: '🚽', tags: '변기 화장실 양변기 toilet bathroom' },
      { char: '🚿', tags: '샤워기 목욕 샤워 shower bath' },
      { char: '🛁', tags: '욕조 목욕 욕실 bathtub bath' },
      { char: '🧹', tags: '빗자루 청소 청소도구 broom clean' },
      { char: '🧺', tags: '바구니 빨래바구니 basket laundry' },
      { char: '🧻', tags: '휴지 화장지 롤휴지 roll of paper toilet' },
      { char: '🧼', tags: '비누 거품 세정 soap bubbles wash' },
      { char: '🧽', tags: '스펀지 설거지 청소 sponge cleaning' },
      { char: '🪣', tags: '양동이 버킷 물통 bucket pail' }
    ]
  },
  {
    id: 'symbols',
    name: '기호',
    icon: '🔣',
    emojis: [
      { char: '❤️', tags: '하트 빨간하트 사랑 애정 heart love red' },
      { char: '🧡', tags: '주황하트 사랑 heart orange' },
      { char: '💛', tags: '노란하트 우정 heart yellow' },
      { char: '💚', tags: '초록하트 환경 heart green' },
      { char: '💙', tags: '파란하트 신뢰 heart blue' },
      { char: '💜', tags: '보라하트 아미 heart purple' },
      { char: '🖤', tags: '검은하트 다크 heart black' },
      { char: '🤍', tags: '하얀하트 순수 heart white' },
      { char: '🤎', tags: '갈색하트 초콜릿 heart brown' },
      { char: '💯', tags: '백점 만점 최고 정답 100 hundred points' },
      { char: '💥', tags: '폭발 충격 쾅 팡 collision explosion crash' },
      { char: '✨', tags: '반짝반짝 별빛 스파클 반짝 sparkles flash' },
      { char: '🔥', tags: '불 불타오름 인기 핫 파이어 fire hot flame' },
      { char: '⚠️', tags: '주의 경고 위험 느낌표 warning alert danger' },
      { char: '⛔', tags: '진입금지 일방통행 금지 no entry forbidden' },
      { char: '🚫', tags: '금지 제한 불가 prohibited forbidden' },
      { char: '❌', tags: '엑스 곱하기 틀림 오답 cross x mark' },
      { char: '⭕', tags: '동그라미 정답 오케이 circle o mark' },
      { char: '🛑', tags: '정지 멈춤 표지판 stop sign' },
      { char: '📛', tags: '이름표 명찰 유치원 name badge' },
      { char: '💮', tags: '참잘했어요 꽃도장 참잘했음 rosette stamp flower' },
      { char: '💢', tags: '화남 분노 빡침 핏줄 anger vein crash' },
      { char: '💬', tags: '말풍선 대화 채팅 댓글 speech balloon chat' },
      { char: '💭', tags: '생각풍선 고민 꿈 생각 thought balloon think' },
      { char: '💤', tags: '피곤 잠 졸림 잘시간 zzz sleep tired' },
      { char: '🔔', tags: '종 벨 알림 알람 bell notification chime' },
      { char: '🔕', tags: '무음 종소리꺼짐 매너모드 bell muted silent' },
      { char: '🎵', tags: '음표 멜로디 음악 뮤직 musical note music' },
      { char: '🎶', tags: '음표들 노래 음악 멜로디 musical notes melody music' },
      { char: '➕', tags: '더하기 플러스 연산자 plus sign math' },
      { char: '➖', tags: '빼기 마이너스 연산자 minus sign math' },
      { char: '✖️', tags: '곱하기 엑스 연산자 multiply sign math' },
      { char: '➗', tags: '나누기 연산자 divide sign math' },
      { char: '🟰', tags: '등호 는 같다 equal sign math' },
      { char: '♾️', tags: '무한대 인피니티 무한 infinity endless' },
      { char: '❓', tags: '물음표 의문 질문 퀘스천 question mark query' },
      { char: '❔', tags: '하얀물음표 질문 white question mark' },
      { char: '❕', tags: '하얀느낌표 경고 white exclamation mark' },
      { char: '❗️', tags: '느낌표 경고 주의 exclamation mark alert' },
      { char: '〰️', tags: '물결 물결선 웨이브 wavy dash tide' },
      { char: '💱', tags: '환전 외환 화폐교환 currency exchange' },
      { char: '💲', tags: '달러기호 돈 달러표시 dollar sign money' },
      { char: '⚕️', tags: '의학기호 아스클레피오스 병원 medical symbol medicine' },
      { char: '♻️', tags: '재활용 리사이클 환경보호 recycling symbol' },
      { char: '⚜️', tags: '백합문양 프랑스 왕실 fleur-de-lis lily' },
      { char: '🔱', tags: '삼지창 포세이돈 무기 trident emblem' },
      { char: '🔰', tags: '초보자마크 초보 일본초보마크 beginner driver shield' },
      { char: '🔞', tags: '19금 미성년자관람불가 성인 no one under 18' },
      { char: '📵', tags: '휴대폰금지 전자기기금지 no mobile phones' },
      { char: '🚭', tags: '금연 담배금지 no smoking' },
      { char: '🔀', tags: '셔플 무작위 재생 shuffle tracks' },
      { char: '🔁', tags: '반복 한곡반복 repeat tracks' },
      { char: '🔂', tags: '한곡만반복 repeat once' },
      { char: '▶️', tags: '재생 플레이 play button' },
      { char: '⏩', tags: '빨리감기 포워드 fast-forward' },
      { char: '◀️', tags: '뒤로재생 play reverse' },
      { char: '⏪', tags: '되감기 리와인드 rewind' },
      { char: '🔼', tags: '위로 상승 삼각 버튼 up button' },
      { char: '🔽', tags: '아래로 하락 삼각 버튼 down button' },
      { char: '🎦', tags: '영화관 시네마 표시 cinema sign' },
      { char: '📶', tags: '와이파이 수신호 안테나 수신감도 antenna bars signal' },
      { char: '📳', tags: '진동 진동모드 vibration mode phone' },
      { char: '📴', tags: '전원끄기 폰꺼짐 phone off' },
      { char: '🛜', tags: '무선인터넷 와이파이 와이파이기호 wireless wifi' }
    ]
  },
  {
    id: 'characters',
    name: '문자',
    icon: '🔠',
    emojis: [
      { char: '0️⃣', tags: '숫자 0 영 zero' },
      { char: '1️⃣', tags: '숫자 1 일 one' },
      { char: '2️⃣', tags: '숫자 2 이 two' },
      { char: '3️⃣', tags: '숫자 3 삼 three' },
      { char: '4️⃣', tags: '숫자 4 사 four' },
      { char: '5️⃣', tags: '숫자 5 오 five' },
      { char: '6️⃣', tags: '숫자 6 육 six' },
      { char: '7️⃣', tags: '숫자 7 칠 seven' },
      { char: '8️⃣', tags: '숫자 8 팔 eight' },
      { char: '9️⃣', tags: '숫자 9 구 nine' },
      { char: '🔟', tags: '숫자 10 십 ten' },
      { char: '#️⃣', tags: '해시태그 샵 우물정 hashtag' },
      { char: '*️⃣', tags: '별표 아스테리스크 곱하기 asterisk star' },
      { char: '🅰️', tags: '에이 알파벳 A 혈액형 blood type' },
      { char: '🅱️', tags: '비 알파벳 B 혈액형 blood type' },
      { char: '🆎', tags: '에이비 알파벳 AB 혈액형 blood type' },
      { char: '🅾️', tags: '오 알파벳 O 혈액형 blood type' },
      { char: '🆗', tags: '오케이 알았어 확인 ok okay' },
      { char: '🆕', tags: '뉴 새로운 신규 신상 new fresh' },
      { char: '🆙', tags: '업 위로 상승 up increase' },
      { char: '🆒', tags: '쿨 멋진 cool nice' },
      { char: '🆓', tags: '프리 무료 공짜 free gratis' },
      { char: 'ℹ️', tags: '정보 인포메이션 안내 information info' },
      { char: '🆔', tags: '아이디 신분증 id identity' },
      { char: 'Ⓜ️', tags: '엠 메트로 지하철 m metro' },
      { char: '🅿️', tags: '피 주차장 파킹 p parking' },
      { char: '🆘', tags: '에스오에스 구조 긴급 sos help' }
    ]
  },
  {
    id: 'flags',
    name: '국기',
    icon: '🏁',
    emojis: [
      { char: '🇰🇷', tags: '한국 대한민국 태극기 국기 south korea kr flag' },
      { char: '🇺🇸', tags: '미국 성조기 국기 usa us united states flag' },
      { char: '🇯🇵', tags: '일본 국기 일장기 japan jp flag' },
      { char: '🇨🇳', tags: '중국 오성홍기 국기 china cn flag' },
      { char: '🇬🇧', tags: '영국 국기 유니언잭 uk gb united kingdom flag' },
      { char: '🇫🇷', tags: '프랑스 국기 삼색기 france fr flag' },
      { char: '🇩🇪', tags: '독일 국기 germany de flag' },
      { char: '🇮🇹', tags: '이탈리아 국기 italy it flag' },
      { char: '🇨🇦', tags: '캐나다 국기 단풍잎 canada ca flag' },
      { char: '🇦🇺', tags: '호주 국기 오스트레일리아 australia au flag' },
      { char: '🇧🇷', tags: '브라질 국기 brazil br flag' },
      { char: '🏁', tags: '체크무늬 깃발 레이싱 결승선 마감 check flag finish' },
      { char: '🚩', tags: '빨간 깃발 삼각형 깃발 목표 red flag triangular' },
      { char: '🎌', tags: '교차된 깃발 일본 깃발 crossed flags' },
      { char: '🏴', tags: '검은 깃발 해적 black flag' },
      { char: '🏳️', tags: '하얀 깃발 항복 백기 white flag surrender' },
      { char: '🏳️‍🌈', tags: '무지개 깃발 성소수자 평등 프라이드 rainbow flag pride' },
      { char: '🏴‍☠️', tags: '해적기 해골 마크 깃발 pirate flag skull' }
    ]
  }
];

let activeEmojiCategoryId = 'smileys';
const emojiTabsContainer = document.getElementById('emoji-tabs');
const emojiGridContainer = document.getElementById('emoji-grid');
const emojiSearchInput = document.getElementById('emoji-search');

// Render emoji picker: tabs and emojis matching state
function renderEmojiPicker() {
  if (!emojiTabsContainer || !emojiGridContainer) return;

  // Render Category Tabs
  emojiTabsContainer.innerHTML = emojiCategories.map(cat => {
    const isActive = cat.id === activeEmojiCategoryId;
    const activeClass = 'bg-primary text-white dark:bg-primary-container dark:text-on-primary-container';
    const inactiveClass = 'bg-surface-container hover:bg-surface-container-high dark:bg-slate-700 dark:hover:bg-slate-600 text-on-surface-variant dark:text-slate-300';
    return `
      <button type="button" class="emoji-tab-btn shrink-0 flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-colors ${isActive ? activeClass : inactiveClass}" data-category-id="${cat.id}">
        <span>${cat.icon}</span>
        <span>${cat.name}</span>
      </button>
    `;
  }).join('');

  // Collect matching emojis
  const query = (emojiSearchInput ? emojiSearchInput.value : '').trim().toLowerCase();
  let emojiList = [];

  if (query) {
    emojiCategories.forEach(cat => {
      cat.emojis.forEach(emoji => {
        if (emoji.tags.toLowerCase().includes(query) || emoji.char.includes(query)) {
          if (!emojiList.some(e => e.char === emoji.char)) {
            emojiList.push(emoji);
          }
        }
      });
    });
  } else {
    const activeCat = emojiCategories.find(cat => cat.id === activeEmojiCategoryId);
    if (activeCat) {
      emojiList = activeCat.emojis;
    }
  }

  // Render Grid Content
  if (emojiList.length === 0) {
    emojiGridContainer.innerHTML = `
      <div class="col-span-8 text-[11px] text-center text-outline dark:text-slate-500 py-6 font-semibold">
        검색 결과가 없습니다
      </div>
    `;
  } else {
    emojiGridContainer.innerHTML = emojiList.map(emoji => `
      <button type="button" class="emoji-option text-xl p-1 hover:bg-surface-container-low dark:hover:bg-slate-700 rounded transition-colors flex items-center justify-center" data-emoji="${emoji.char}" title="${emoji.tags.split(' ')[0]}">
        ${emoji.char}
      </button>
    `).join('');
  }
}

// Attach event listeners for emoji selection
if (btnEmoji && emojiDropdown) {
  btnEmoji.addEventListener('click', (e) => {
    e.stopPropagation();
    const isHidden = emojiDropdown.classList.contains('hidden');
    
    if (headerDropdown) headerDropdown.classList.add('hidden');
    
    if (isHidden) {
      // Calculate layout coordinates dynamically to avoid screen limits
      const rect = btnEmoji.getBoundingClientRect();
      let left = rect.left;
      let top = rect.bottom + window.scrollY;
      
      if (left + 288 > window.innerWidth) {
        left = window.innerWidth - 288 - 16;
      }
      if (left < 16) {
        left = 16;
      }
      
      emojiDropdown.style.top = `${top}px`;
      emojiDropdown.style.left = `${left}px`;
      emojiDropdown.classList.remove('hidden');
      
      // Focus Search and Reset values
      if (emojiSearchInput) {
        emojiSearchInput.value = '';
        setTimeout(() => emojiSearchInput.focus(), 50);
      }
      activeEmojiCategoryId = 'smileys';
      renderEmojiPicker();
    } else {
      emojiDropdown.classList.add('hidden');
    }
  });

  // Tab switching click handling
  if (emojiTabsContainer) {
    emojiTabsContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.emoji-tab-btn');
      if (!btn) return;
      
      e.stopPropagation(); // 브라우저 호환성을 위해 이벤트 버블링 강제 차단
      activeEmojiCategoryId = btn.getAttribute('data-category-id');
      if (emojiSearchInput) emojiSearchInput.value = ''; // Reset query on tab change
      renderEmojiPicker();
    });
  }

  // Live input filtering event
  if (emojiSearchInput) {
    emojiSearchInput.addEventListener('input', () => {
      if (emojiSearchInput.value.trim()) {
        // Remove selection color from tabs when searching globally
        const tabs = emojiTabsContainer.querySelectorAll('.emoji-tab-btn');
        tabs.forEach(tab => {
          tab.className = 'emoji-tab-btn shrink-0 flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-colors bg-surface-container hover:bg-surface-container-high dark:bg-slate-700 dark:hover:bg-slate-600 text-on-surface-variant dark:text-slate-300';
        });
      } else {
        // Restore tab active colors
        renderEmojiPicker();
        return;
      }
      renderEmojiPicker();
    });
    
    emojiSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        emojiDropdown.classList.add('hidden');
        editor.focus({ preventScroll: true });
      }
    });
  }

  // Emoji selection (Event delegation)
  if (emojiGridContainer) {
    emojiGridContainer.addEventListener('click', (e) => {
      const opt = e.target.closest('.emoji-option');
      if (!opt) return;
      
      e.stopPropagation();
      const emoji = opt.getAttribute('data-emoji');
      
      editor.setRangeText(emoji, editor.selectionStart, editor.selectionEnd, 'end');
      editor.focus({ preventScroll: true });
      updatePreview();
      if (historyManager) historyManager.push();
      emojiDropdown.classList.add('hidden');
    });
  }

  document.addEventListener('click', (e) => {
    const path = e.composedPath();
    if (!emojiDropdown.classList.contains('hidden') && !path.includes(btnEmoji) && !path.includes(emojiDropdown)) {
      emojiDropdown.classList.add('hidden');
    }
  });
}

// --- List Indentation Control ---
function adjustIndentation(direction) {
  const text = editor.value;
  const start = editor.selectionStart;
  const end = editor.selectionEnd;
  
  // Find lines starting and ending boundaries
  let lineStart = text.lastIndexOf('\n', start - 1) + 1;
  let lineEnd = text.indexOf('\n', end);
  if (lineEnd === -1) lineEnd = text.length;
  
  const selectedLinesText = text.substring(lineStart, lineEnd);
  const lines = selectedLinesText.split('\n');
  
  let modifiedLines = [];
  let diff = 0; // Track change in length to adjust selection
  
  if (direction === 'indent') {
    modifiedLines = lines.map(line => {
      diff += 2;
      return '  ' + line;
    });
  } else if (direction === 'outdent') {
    modifiedLines = lines.map(line => {
      if (line.startsWith('  ')) {
        diff -= 2;
        return line.substring(2);
      } else if (line.startsWith('\t')) {
        diff -= 1;
        return line.substring(1);
      } else if (line.startsWith(' ')) {
        diff -= 1;
        return line.substring(1);
      }
      return line;
    });
  }
  
  const newText = modifiedLines.join('\n');
  editor.setRangeText(newText, lineStart, lineEnd, 'select');
  
  // Re-select range proportionally
  editor.setSelectionRange(
    Math.max(lineStart, start + (direction === 'indent' ? 2 : -2)),
    Math.max(lineStart, end + diff)
  );
  
  editor.focus({ preventScroll: true });
  updatePreview();
  if (historyManager) historyManager.push();
}

if (btnIndent) {
  btnIndent.addEventListener('click', () => adjustIndentation('indent'));
}

if (btnOutdent) {
  btnOutdent.addEventListener('click', () => adjustIndentation('outdent'));
}

// Register Service Worker for PWA installation
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then((reg) => {
        console.log('ServiceWorker registration successful with scope: ', reg.scope);
        
        // Active checker for updates
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('New content is available, service worker will update.');
            }
          });
        });
      })
      .catch((err) => {
        console.error('ServiceWorker registration failed: ', err);
      });
  });

  // Reload the page once the new service worker takes over (forces cache refresh)
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      window.location.reload();
      refreshing = true;
    }
  });
}

// --- Changelog Modal Control ---
const btnChangelog = document.getElementById('btn-changelog');
const changelogModal = document.getElementById('changelog-modal');
const changelogBackdrop = document.getElementById('changelog-backdrop');
const btnCloseChangelog = document.getElementById('btn-close-changelog');
const btnCloseChangelogX = document.getElementById('btn-close-changelog-x');

if (btnChangelog && changelogModal) {
  const openModal = () => {
    changelogModal.classList.remove('hidden');
  };
  const closeModal = () => {
    changelogModal.classList.add('hidden');
  };

  btnChangelog.addEventListener('click', openModal);
  if (btnCloseChangelog) btnCloseChangelog.addEventListener('click', closeModal);
  if (btnCloseChangelogX) btnCloseChangelogX.addEventListener('click', closeModal);
  if (changelogBackdrop) changelogBackdrop.addEventListener('click', closeModal);
}



