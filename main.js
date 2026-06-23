import { marked } from 'marked';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js';

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

if (btnDownload) {
  btnDownload.addEventListener('click', async () => {
    const content = editor.value;
    
    if (window.showSaveFilePicker) {
      try {
        // Show the native file save dialog
        const handle = await window.showSaveFilePicker({
          suggestedName: 'document.md',
          types: [{
            description: 'Markdown File',
            accept: {'text/markdown': ['.md', '.txt']},
          }],
        });
        const writable = await handle.createWritable();
        await writable.write(content);
        await writable.close();
      } catch (err) {
        // Ignore AbortError (user cancelled the dialog)
        if (err.name !== 'AbortError') {
          console.error(err);
          alert('파일 저장 중 오류가 발생했습니다.');
        }
      }
    } else {
      // Fallback for browsers that don't support showSaveFilePicker
      let filename = prompt('저장할 파일명을 입력하세요 (확장자 포함)', 'document.md');
      if (filename) {
        if (!filename.endsWith('.md') && !filename.endsWith('.txt')) {
          filename += '.md';
        }
        const blob = new Blob([content], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      }
    }
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
      case 'table_chart': insert = '\n\n| 제목 | 제목 |\n| --- | --- |\n| 내용 | 내용 |\n'; break;
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
  const insertText = item.getAttribute('data-insert');
  
  editor.setRangeText(insertText, slashStartIndex, editor.selectionEnd, 'end');
  editor.focus({ preventScroll: true });
  updatePreview();
  if (historyManager) historyManager.push();
  
  closeSlashMenu();
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
  if (slashMenuOpen && e.target !== editor && !slashMenu.contains(e.target)) {
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
    if (!headerDropdown.classList.contains('hidden') && !btnHeaderMenu.contains(e.target) && !headerDropdown.contains(e.target)) {
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
      { char: '😀', tags: '웃음 기쁨 행복 smile happy' },
      { char: '😃', tags: '웃음 기쁨 행복 smile happy' },
      { char: '😄', tags: '웃음 기쁨 행복 smile happy' },
      { char: '😁', tags: '미소 기쁨 행복 smile happy' },
      { char: '😆', tags: '미소 눈웃음 기쁨 smile happy' },
      { char: '😅', tags: '땀 식은땀 안도 smile sweat' },
      { char: '😂', tags: '눈물 기쁨 폭소 lol laugh tear' },
      { char: '🤣', tags: '웃음 폭소 데굴데굴 lol laugh' },
      { char: '😊', tags: '미소 부끄럼 행복 smile happy' },
      { char: '😇', tags: '천사 착함 순수 angel halo' },
      { char: '🙂', tags: '미소 안도 smile' },
      { char: '🙃', tags: '거꾸로 반전 upside-down' },
      { char: '😉', tags: '윙크 위트 wink' },
      { char: '😌', tags: '안도 편안 relief' },
      { char: '😍', tags: '하트 눈사랑 하트눈 love heart eyes' },
      { char: '🥰', tags: '사랑 하트 부끄럼 love hearts' },
      { char: '😘', tags: '뽀뽀 사랑 kiss love' },
      { char: '😗', tags: '뽀뽀 kiss' },
      { char: '😙', tags: '뽀뽀 미소 kiss' },
      { char: '😚', tags: '뽀뽀 눈감음 kiss' },
      { char: '😋', tags: '맛있다 장난 메롱 yummy tongue' },
      { char: '😛', tags: '메롱 장난 tongue' },
      { char: '😝', tags: '메롱 눈감음 장난 tongue' },
      { char: '😜', tags: '메롱 윙크 장난 tongue wink' },
      { char: '🤪', tags: '장난 미치광이 crazy' },
      { char: '🤨', tags: '의심 생각 brow' },
      { char: '🧐', tags: '분석 돋보기 안경 monocle' },
      { char: '🤓', tags: '범생이 안경 안경잡이 nerd' },
      { char: '😎', tags: '선글라스 멋짐 여유 cool glasses' },
      { char: '🥸', tags: '변장 가면 disguise' },
      { char: '🤩', tags: '별눈 기쁨 star eyes' },
      { char: '🥳', tags: '파티 축하 축제 party celebrate' },
      { char: '😏', tags: '비웃음 썩소 smirk' },
      { char: '😒', tags: '불만 시큰둥 unamused' },
      { char: '😞', tags: '실망 우울 속상 disappointed' },
      { char: '😔', tags: '우울 생각 슬픔 pensive' },
      { char: '😟', tags: '걱정 불안 worried' },
      { char: '😕', tags: '혼란 의아 confused' },
      { char: '🙁', tags: '슬픔 불만 frown' },
      { char: '☹️', tags: '슬픔 불만 frown' },
      { char: '😣', tags: '인내 괴로움 persevere' },
      { char: '😖', tags: '괴로움 혼란 confounded' },
      { char: '😫', tags: '피곤 짜증 tired' },
      { char: '😩', tags: '피곤 힘듦 weary' },
      { char: '🥺', tags: '부탁 아련 애원 눈물 pleading' },
      { char: '😢', tags: '눈물 슬픔 cry' },
      { char: '😭', tags: '대성통곡 눈물 슬픔 sob cry' },
      { char: '😤', tags: '콧김 흥분 분노 triumph' },
      { char: '😠', tags: '화남 분노 angry' },
      { char: '😡', tags: '분노 화남 angry rage' },
      { char: '🤬', tags: '욕설 분노 화남 curse swear' },
      { char: '🤯', tags: '충격 머리 폭발 대박 explode mind' },
      { char: '😳', tags: '당황 부끄럼 blush flush' },
      { char: '🥵', tags: '덥다 열 더위 hot heat' },
      { char: '🥶', tags: '춥다 얼어붙음 추위 cold ice' },
      { char: '😱', tags: '공포 비명 충격 scream fear' },
      { char: '😨', tags: '두려움 불안 fearful' },
      { char: '😰', tags: '식은땀 걱정 두려움 anxious sweat' },
      { char: '😥', tags: '안도 땀 슬픔 sad sweat' },
      { char: '😓', tags: '땀 실망 걱정 sweat' }
    ]
  },
  {
    id: 'hands',
    name: '신체',
    icon: '👋',
    emojis: [
      { char: '👋', tags: '손 흔들기 안녕 인사 wave hello' },
      { char: '🤚', tags: '등 뒤 손등 backhand' },
      { char: '🖐️', tags: '손가락 펼치기 hand' },
      { char: '✋', tags: '멈춰 정지 stop hand' },
      { char: '🖖', tags: '발칸 인사 vulcan' },
      { char: '👌', tags: '오케이 확인 ok' },
      { char: '🤌', tags: '이탈리아 손짓 만두 pinching' },
      { char: '🤏', tags: '조금 한 꼬집 pinch' },
      { char: '✌️', tags: '브이 평화 victory peace' },
      { char: '🤞', tags: '행운 손가락 cross' },
      { char: '🫰', tags: '하트 손가락 k-heart' },
      { char: '🤟', tags: '사랑해 rock-on love' },
      { char: '🤘', tags: '락 메탈 하이 rock' },
      { char: '🤙', tags: '전화해 call' },
      { char: '👈', tags: '왼쪽 가리키기 left pointer' },
      { char: '👉', tags: '오른쪽 가리키기 right pointer' },
      { char: '👆', tags: '위 가리키기 up pointer' },
      { char: '🖕', tags: '뻐큐 욕설 middle finger' },
      { char: '👇', tags: '아래 가리키기 down pointer' },
      { char: '☝️', tags: '검지 하나 point' },
      { char: '👍', tags: '최고 따봉 좋아요 thumbs-up like' },
      { char: '👎', tags: '싫어요 비추 thumbs-down dislike' },
      { char: '✊', tags: '주먹 fist' },
      { char: '👊', tags: '펀치 주먹 punch' },
      { char: '🤛', tags: '왼쪽 주먹 fist-left' },
      { char: '🤜', tags: '오른쪽 주먹 fist-right' },
      { char: '👏', tags: '박수 짝짝짝 clap' },
      { char: '🙌', tags: '만세 야호 celebrate hooray' },
      { char: '👐', tags: '펼친 손 open' },
      { char: '🤲', tags: '모은 손 palms' },
      { char: '🤝', tags: '악수 협력 shake hands' },
      { char: '🙏', tags: '기도 부탁 감사 고맙습니다 pray please thanks' },
      { char: '✍️', tags: '글쓰기 펜 필기 write pen' },
      { char: '💅', tags: '네일 매니큐어 nail' },
      { char: '🤳', tags: '셀카 사진 selfie' },
      { char: '💪', tags: '근육 힘 화이팅 muscle power strength' },
      { char: '🧠', tags: '뇌 생각 지식 brain' },
      { char: '🫀', tags: '심장 하트 장기 heart anatomical' },
      { char: '👀', tags: '눈 감시 보기 eyes look see' },
      { char: '👁️', tags: '눈 하나 eye see' },
      { char: '🗣️', tags: '말하는 사람 speak talk' },
      { char: '👤', tags: '사람 실루엣 silhouette' },
      { char: '👥', tags: '사람들 실루엣 silhouettes' },
      { char: '🫂', tags: '포옹 위로 허그 hug' }
    ]
  },
  {
    id: 'animals',
    name: '동물',
    icon: '🐱',
    emojis: [
      { char: '🐶', tags: '개 강아지 dog puppy' },
      { char: '🐱', tags: '고양이 야옹이 cat kitty' },
      { char: '🐭', tags: '쥐 마우스 mouse' },
      { char: '🐹', tags: '햄스터 hamster' },
      { char: '🐰', tags: '토끼 rabbit bunny' },
      { char: '🦊', tags: '여우 fox' },
      { char: '🐻', tags: '곰 bear' },
      { char: '🐼', tags: '판다 panda' },
      { char: '🐻‍❄️', tags: '북극곰 polar bear' },
      { char: '🐨', tags: '코알라 koala' },
      { char: '🐯', tags: '호랑이 tiger' },
      { char: '🦁', tags: '사자 lion' },
      { char: '🐮', tags: '소 cow' },
      { char: '🐷', tags: '돼지 pig' },
      { char: '🐸', tags: '개구리 frog' },
      { char: '🐵', tags: '원숭이 monkey' },
      { char: '🐔', tags: '닭 치킨 chicken' },
      { char: '🐧', tags: '펭귄 penguin' },
      { char: '🐦', tags: '새 bird' },
      { char: '🐤', tags: '병아리 chick' },
      { char: '🦆', tags: '오리 duck' },
      { char: '🦅', tags: '독수리 eagle' },
      { char: '🦉', tags: '부엉이 올빼미 owl' },
      { char: '🦇', tags: '박쥐 bat' },
      { char: '🐺', tags: '늑대 wolf' },
      { char: '🐗', tags: '멧돼지 boar' },
      { char: '🐴', tags: '말 horse' },
      { char: '🦄', tags: '유니콘 unicorn' },
      { char: '🐝', tags: '벌 꿀벌 bee' },
      { char: '🪱', tags: '지렁이 worm' },
      { char: '🐛', tags: '애벌레 벌레 bug caterpillar' },
      { char: '🦋', tags: '나비 butterfly' },
      { char: '🐌', tags: '달팽이 snail' },
      { char: '🐞', tags: '무당벌레 ladybug' },
      { char: '🐜', tags: '개미 ant' },
      { char: '🕷️', tags: '거미 spider' },
      { char: '🦂', tags: '전갈 scorpion' },
      { char: '🐢', tags: '거북이 turtle' },
      { char: '🐍', tags: '뱀 snake' },
      { char: '🦎', tags: '도마뱀 lizard' },
      { char: '🐙', tags: '문어 octopus' },
      { char: '🦑', tags: '오징어 squid' },
      { char: '🦞', tags: '바닷가재 랍스터 lobster' },
      { char: '🦀', tags: '게 crab' },
      { char: '🐠', tags: '물고기 열대어 fish' },
      { char: '🐟', tags: '물고기 생선 fish' },
      { char: '🐬', tags: '돌고래 dolphin' },
      { char: '🐳', tags: '고래 whale' },
      { char: '🦈', tags: '상어 shark' },
      { char: '🐊', tags: '악어 crocodile' },
      { char: '🦖', tags: '티라노 공룡 t-rex' },
      { char: '🦕', tags: '아파토 공룡 dinosaur' },
      { char: '🦍', tags: '고릴라 gorilla' },
      { char: '🦧', tags: '오랑우탄 orangutan' },
      { char: '🌲', tags: '나무 소나무 pine tree' },
      { char: '🌳', tags: '나무 낙엽수 tree' },
      { char: '🌴', tags: '야자수 palm tree' },
      { char: '🌵', tags: '선인장 cactus' },
      { char: '🌾', tags: '벼 보리 grain rice' },
      { char: '🌿', tags: '허브 풀잎 herb leaf' },
      { char: '🍀', tags: '네잎클로버 행운 clover luck' },
      { char: '🍁', tags: '단풍잎 가을 maple autumn' },
      { char: '🍂', tags: '낙엽 가을 leaves fall' },
      { char: '🍃', tags: '바람에 날리는 잎 leaf wind' },
      { char: '🌸', tags: '벚꽃 꽃 봄 cherry blossom flower' },
      { char: '🌹', tags: '장미 꽃 rose flower' },
      { char: '🌺', tags: '무궁화 꽃 하와이 hibiscus flower' },
      { char: '🌻', tags: '해바라기 꽃 sunflower' },
      { char: '🌼', tags: '꽃 daisy flower' },
      { char: '🌷', tags: '튤립 꽃 tulip flower' },
      { char: '🍄', tags: '버섯 mushroom' },
      { char: '🌰', tags: '밤 chestnut' },
      { char: '🐚', tags: '조개 shell' },
      { char: '🕸️', tags: '거미줄 web' }
    ]
  },
  {
    id: 'food',
    name: '음식',
    icon: '🍔',
    emojis: [
      { char: '🍏', tags: '풋사과 아오리 apple' },
      { char: '🍎', tags: '사과 apple' },
      { char: '🍐', tags: '배 pear' },
      { char: '🍊', tags: '귤 오렌지 orange mandarin' },
      { char: '🍋', tags: '레몬 lemon' },
      { char: '🍌', tags: '바나나 banana' },
      { char: '🍉', tags: '수박 watermelon' },
      { char: '🍇', tags: '포도 grape' },
      { char: '🍓', tags: '딸기 strawberry' },
      { char: '🍒', tags: '체리 앵두 cherry' },
      { char: '🍑', tags: '복숭아 peach' },
      { char: '🥭', tags: '망고 mango' },
      { char: '🍍', tags: '파인애플 pineapple' },
      { char: '🥥', tags: '코코넛 coconut' },
      { char: '🥝', tags: '키위 kiwi' },
      { char: '🍅', tags: '토마토 tomato' },
      { char: '🍆', tags: '가지 eggplant' },
      { char: '🥑', tags: '아보카도 avocado' },
      { char: '🥦', tags: '브로콜리 broccoli' },
      { char: '🥬', tags: '상추 배추 샐러드 lettuce' },
      { char: '🥒', tags: '오이 cucumber' },
      { char: '🌶️', tags: '고추 매운 hot pepper spicy' },
      { char: '🌽', tags: '옥수수 corn' },
      { char: '🥕', tags: '당근 carrot' },
      { char: '🥔', tags: '감자 potato' },
      { char: '🍠', tags: '고구마 sweet potato' },
      { char: '🥐', tags: '크로와상 빵 croissant bread' },
      { char: '🥯', tags: '베이글 빵 bagel' },
      { char: '🍞', tags: '식빵 빵 bread' },
      { char: '🥖', tags: '바게트 빵 baguette' },
      { char: '🧀', tags: '치즈 cheese' },
      { char: '🥚', tags: '계란 달걀 egg' },
      { char: '🍳', tags: '계란후라이 요리 egg fry' },
      { char: '🥞', tags: '팬케이크 pancake' },
      { char: '🧇', tags: '와플 waffle' },
      { char: '🥓', tags: '베이컨 삼겹살 bacon' },
      { char: '🥩', tags: '스테이크 고기 meat steak' },
      { char: '🍗', tags: '닭다리 치킨 chicken' },
      { char: '🍖', tags: '갈비 고기 meat' },
      { char: '🌭', tags: '핫도그 hotdog' },
      { char: '🍔', tags: '햄버거 버거 burger hamburger' },
      { char: '🍟', tags: '감자튀김 감튀 french fries' },
      { char: '🍕', tags: '피자 pizza' },
      { char: '🥪', tags: '샌드위치 sandwich' },
      { char: '🌮', tags: '타코 taco' },
      { char: '🌯', tags: '부리토 burrito' },
      { char: '🥗', tags: '샐러드 salad' },
      { char: '🍿', tags: '팝콘 popcorn' },
      { char: '🍱', tags: '도시락 bento' },
      { char: '🥟', tags: '만두 dumpling' },
      { char: '🍣', tags: '초밥 스시 sushi' },
      { char: '🍜', tags: '라면 우동 국수 ramen noodle' },
      { char: '🍝', tags: '스파게티 파스타 spaghetti pasta' },
      { char: '🍦', tags: '아이스크림 소프트콘 icecream' },
      { char: '🍩', tags: '도넛 donut' },
      { char: '🍪', tags: '쿠키 과자 cookie' },
      { char: '🎂', tags: '케이크 생일 cake birthday' },
      { char: '🍰', tags: '조각케이크 cake' },
      { char: '🍫', tags: '초콜릿 chocolate' },
      { char: '🍬', tags: '사탕 캔디 candy' },
      { char: '🍭', tags: '롤리팝 막대사탕 lollipop' },
      { char: '🍯', tags: '꿀 허니 honey' },
      { char: '☕', tags: '커피 차 카페 coffee tea' },
      { char: '🍵', tags: '녹차 녹찻잔 tea green' },
      { char: '🍶', tags: '사케 정종 도자기 sake' },
      { char: '🍾', tags: '샴페인 축하 champagne' },
      { char: '🍷', tags: '와인 와인잔 wine' },
      { char: '🍸', tags: '칵테일 cocktail' },
      { char: '🍹', tags: '열대음식 주스 drink' },
      { char: '🍺', tags: '맥주 술 beer' },
      { char: '🍻', tags: '맥주 건배 짠 cheers beer' },
      { char: '🥤', tags: '탄산음료 빨대소다 soda juice' },
      { char: '🧃', tags: '팩주스 음료 juice' },
      { char: '🧉', tags: '마테차 mate' },
      { char: '🧊', tags: '얼음 ice' }
    ]
  },
  {
    id: 'travel',
    name: '여행',
    icon: '✈️',
    emojis: [
      { char: '🚗', tags: '자동차 빨간차 car red' },
      { char: '🚕', tags: '택시 taxi' },
      { char: '🚙', tags: '차 파란차 suv blue' },
      { char: '🚌', tags: '버스 bus' },
      { char: '🚎', tags: '트롤리 버스 trolley' },
      { char: '🏎️', tags: '레이싱카 f1 racing' },
      { char: '🚓', tags: '경찰차 police' },
      { char: '🚑', tags: '구급차 ambulance' },
      { char: '🚒', tags: '소방차 fire' },
      { char: '🚐', tags: '승합차 van' },
      { char: '🚚', tags: '트럭 truck' },
      { char: '🚛', tags: '대형트럭 truck large' },
      { char: '🚜', tags: '트랙터 tractor' },
      { char: '🛵', tags: '스쿠터 오토바이 scooter motor' },
      { char: '🚲', tags: '자전거 bicycle bike' },
      { char: '🛴', tags: '킥보드 scooter kick' },
      { char: '🚨', tags: '사이렌 경보 비상 siren emergency' },
      { char: '🚥', tags: '신호등 traffic light' },
      { char: '⚓', tags: '닻 항구 anchor harbor' },
      { char: '⛵', tags: '돛단배 요트 sailboat yacht' },
      { char: '🛶', tags: '카누 보트 canoe' },
      { char: '🚤', tags: '모터보트 쾌속선 speedboat' },
      { char: '🛳️', tags: '여객선 크루즈 ship cruise' },
      { char: '🚢', tags: '배 선박 ship' },
      { char: '✈️', tags: '비행기 여행 airplane flight' },
      { char: '🛫', tags: '이륙 비행기 takeoff' },
      { char: '🛬', tags: '착륙 비행기 landing' },
      { char: '🪂', tags: '낙하산 패러글라이딩 parachute' },
      { char: '🚁', tags: '헬리콥터 helicopter' },
      { char: '🚀', tags: '로켓 우주선 rocket space' },
      { char: '🛸', tags: 'ufo 외계인 미확인 비행물체 ufo alien' },
      { char: '🌍', tags: '지구 유럽 아프리카 earth' },
      { char: '🌎', tags: '지구 아메리카 earth' },
      { char: '🌏', tags: '지구 아시아 오세아니아 한국 earth asia' },
      { char: '🌐', tags: '인터넷 웹 네트워크 global network' },
      { char: '🗺️', tags: '지도 세계지도 map' },
      { char: '🧭', tags: '나침반 방향 compass' },
      { char: '🏔️', tags: '만년설 산 눈 덮인 mountain snow' },
      { char: '⛰️', tags: '산 봉우리 mountain' },
      { char: '🌋', tags: '화산 분출 volcano' },
      { char: '🗻', tags: '후지산 산 fuji mountain' },
      { char: '🏕️', tags: '캠핑 텐트 야영 camping tent' },
      { char: '🏖️', tags: '해변 파라솔 바다 beach sand' },
      { char: '🏜️', tags: '사막 모래 desert' },
      { char: '🏝️', tags: '무인도 섬 island' },
      { char: '🏞️', tags: '국립공원 계곡 park river' },
      { char: '🏟️', tags: '경기장 체육관 stadium' },
      { char: '🏛️', tags: '그리스 신전 법원 미술관 temple museum' },
      { char: '🏗️', tags: '공사중 크레인 building crane' },
      { char: '🏠', tags: '집 주택 house' },
      { char: '🏡', tags: '정원이 있는 집 house garden' },
      { char: '🏢', tags: '빌딩 사무실 office building' },
      { char: '🏣', tags: '우체국 post office' },
      { char: '🏥', tags: '병원 의원 hospital' },
      { char: '🏦', tags: '은행 bank' },
      { char: '🏨', tags: '호텔 hotel' },
      { char: '🏪', tags: '편의점 convenience store' },
      { char: '🏫', tags: '학교 school' },
      { char: '🏬', tags: '백화점 쇼핑몰 department store' },
      { char: '🏭', tags: '공장 팩토리 factory' },
      { char: '🏯', tags: '일본 성 castle japanese' },
      { char: '🏰', tags: '성 디즈니 castle' },
      { char: '🗼', tags: '도쿄타워 에펠탑 tower' },
      { char: '🗽', tags: '자유의 여신상 statue liberty' },
      { char: '⛪', tags: '교회 성당 church' },
      { char: '🕌', tags: '모스크 이슬람 mosque' },
      { char: '🕍', tags: '시나고그 유대교 synagogue' },
      { char: '⛩️', tags: '신사 도리이 shrine torii' },
      { char: '♨️', tags: '온천 목욕탕 hot spring' }
    ]
  },
  {
    id: 'objects',
    name: '물건',
    icon: '💡',
    emojis: [
      { char: '💻', tags: '노트북 컴퓨터 맥북 laptop computer macbook' },
      { char: '🖥️', tags: '모니터 데스크탑 pc screen desktop' },
      { char: '🖨️', tags: '프린터 인쇄 printer' },
      { char: '⌨️', tags: '키보드 자판 keyboard' },
      { char: '🖱️', tags: '마우스 마우스클릭 mouse' },
      { char: '💽', tags: '미니디스크 md minidisc' },
      { char: '💾', tags: '플로피 디스크 저장 floppy' },
      { char: '💿', tags: '시디 cd' },
      { char: '📀', tags: '디브이디 dvd' },
      { char: '📼', tags: '비디오 테이프 cassette' },
      { char: '📷', tags: '카메라 사진 camera' },
      { char: '📸', tags: '카메라 플래시 camera flash' },
      { char: '📹', tags: '비디오 카메라 촬영 video' },
      { char: '🎥', tags: '영화 카메라 캠코더 movie' },
      { char: 'tv', char: '📺', tags: '텔레비전 티비 tv' },
      { char: '📻', tags: '라디오 radio' },
      { char: '🎙️', tags: '마이크 녹음 스튜디오 mic microphone' },
      { char: '⏱️', tags: '초시계 스톱워치 stopwatch' },
      { char: '⏰', tags: '알람 시계 자명종 clock alarm' },
      { char: '⌛', tags: '모래시계 끝 hourglass' },
      { char: '⏳', tags: '모래시계 진행 hourglass flow' },
      { char: '📡', tags: '안테나 위성 satellite antenna' },
      { char: '🔋', tags: '배터리 건전지 battery' },
      { char: '🔌', tags: '콘센트 플러그 plug' },
      { char: '💡', tags: '전구 아이디어 생각 lightbulb idea' },
      { char: '🔦', tags: '손전등 플래시 flashlight' },
      { char: '🕯️', tags: '양초 촛불 candle' },
      { char: '💸', tags: '돈 날아가는돈 money fly' },
      { char: '💵', tags: '달러 지폐 돈 dollar bill money' },
      { char: '💴', tags: '엔화 지폐 돈 yen bill' },
      { char: '💶', tags: '유로 지폐 돈 euro bill' },
      { char: '💷', tags: '파운드 지폐 돈 pound bill' },
      { char: '🪙', tags: '동전 코인 coin' },
      { char: '💎', tags: '보석 다이아몬드 diamond jewel' },
      { char: '🔧', tags: '렌치 스패너 공구 wrench tool' },
      { char: '🔨', tags: '망치 공구 망치질 hammer tool' },
      { char: '🛠️', tags: '망치 스패너 공구 도구 hammer wrench tools' },
      { char: '⚙️', tags: '톱니바퀴 설정 기어 gear setting' },
      { char: '🧱', tags: '벽돌 brick' },
      { char: '⛓️', tags: '쇠사슬 체인 chain' },
      { char: '🔫', tags: '물총 권총 총 gun pistol water' },
      { char: '💣', tags: '폭탄 터짐 bomb' },
      { char: '🧨', tags: '폭죽 폭탄 firecracker' },
      { char: '🛡️', tags: '방패 보호 보안 shield guard' },
      { char: '🔑', tags: '열쇠 키 key' },
      { char: '🗝️', tags: '오래된 열쇠 key old' },
      { char: '📦', tags: '상자 박스 택배 package box' },
      { char: '🏷️', tags: '태그 라벨 가격표 tag label' },
      { char: '✉️', tags: '편지 봉투 메일 email envelope' },
      { char: '📨', tags: '수신 메일 수신함 inbox' },
      { char: '📊', tags: '차트 통계 그래프 chart bar' },
      { char: '📈', tags: '우상향 그래프 차트 chart up trend' },
      { char: '📉', tags: '우하향 그래프 차트 chart down trend' },
      { char: '📅', tags: '달력 일정 캘린더 calendar date' },
      { char: '📆', tags: '낱장 달력 일정 calendar' },
      { char: '📋', tags: '클립보드 문서 결재 clipboard' },
      { char: '📌', tags: '핀 압정 고정 pin pushpin' },
      { char: '📍', tags: '지도 핀 위치 pin location' },
      { char: '📎', tags: '클립 종이클립 clip' },
      { char: '📝', tags: '노트 메모 필기 연필 memo write pencil' },
      { char: '🔒', tags: '잠금 자물쇠 보안 lock' },
      { char: '🔓', tags: '잠금 해제 자물쇠 unlock' },
      { char: '🔏', tags: '펜 자물쇠 서명 sign lock' },
      { char: '🔐', tags: '열쇠 자물쇠 보안 lock key' },
      { char: '❤️', tags: '하트 빨간하트 사랑 heart love red' },
      { char: '🧡', tags: '주황하트 heart orange' },
      { char: '💛', tags: '노란하트 heart yellow' },
      { char: '💚', tags: '초록하트 heart green' },
      { char: '💙', tags: '파란하트 heart blue' },
      { char: '💜', tags: '보라하트 heart purple' },
      { char: '🖤', tags: '검은하트 heart black' },
      { char: '🤍', tags: '하얀하트 heart white' },
      { char: '🤎', tags: '갈색하트 heart brown' },
      { char: '💯', tags: '백점 만점 최고 100 score' },
      { char: '💥', tags: '폭발 쾅 충격 collision burst' },
      { char: '✨', tags: '반짝반짝 별 반짝 sparkles' },
      { char: '🔥', tags: '불 화재 인기 뜨거움 fire hot' },
      { char: '⚠️', tags: '주의 경고 위험 warning' },
      { char: '⛔', tags: '진입금지 금지 no entry' },
      { char: '🚫', tags: '금지 제한 forbidden' },
      { char: '❌', tags: '엑스 틀림 오답 cross x' },
      { char: '⭕', tags: '동그라미 정답 맞춤 circle o' }
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
    if (!emojiDropdown.classList.contains('hidden') && !btnEmoji.contains(e.target) && !emojiDropdown.contains(e.target)) {
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



