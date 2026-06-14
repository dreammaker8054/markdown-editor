import { marked } from 'marked';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js';

const editor = document.getElementById('editor');
const preview = document.getElementById('preview');
const btnEdit = document.getElementById('btn-edit');
const btnPreview = document.getElementById('btn-preview');
const btnSplit = document.getElementById('btn-split');
const editorContainer = document.getElementById('editor-container');

// Configure marked with highlight.js
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
const defaultContent = `# 미니멀리즘의 예술

글쓰기는 단순히 공간을 채우는 것이 아닙니다. 그것은 공허함 속에서 의미를 **조각해내는** 과정입니다. 인터페이스를 걷어내면 비로소 단어들이 숨을 쉬기 시작합니다.

## 핵심 원칙

* 핵심 메시지에 집중하세요.
* 불필요한 형용사를 제거하세요.
* 독자의 지성을 믿으세요.

> "단순함은 궁극의 정교함이다."
> — 레오나르도 다 빈치

더 깊은 영감을 원하신다면 [아카이브](#)를 방문하여 딥 워크와 창의적 흐름에 대해 알아보세요.`;

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

// Event listeners
editor.addEventListener('input', updatePreview);

// Mode Toggle
function setMode(mode) {
  const activeClass = "px-3 py-1 text-sm font-medium bg-white shadow-sm rounded-md text-on-surface";
  const inactiveClass = "px-3 py-1 text-sm font-medium text-outline hover:text-on-surface transition-colors";

  if(btnEdit) btnEdit.className = mode === 'edit' ? activeClass : inactiveClass;
  if(btnPreview) btnPreview.className = mode === 'preview' ? activeClass : inactiveClass;
  if(btnSplit) btnSplit.className = mode === 'split' ? activeClass : inactiveClass;

  if (mode === 'edit') {
    editor.classList.remove('hidden');
    preview.classList.add('hidden');
    editorContainer.classList.remove('max-w-6xl');
    editorContainer.classList.add('max-w-3xl');
  } else if (mode === 'preview') {
    editor.classList.add('hidden');
    preview.classList.remove('hidden');
    editorContainer.classList.remove('max-w-6xl');
    editorContainer.classList.add('max-w-3xl');
    updatePreview();
  } else if (mode === 'split') {
    editor.classList.remove('hidden');
    preview.classList.remove('hidden');
    editorContainer.classList.remove('max-w-3xl');
    editorContainer.classList.add('max-w-6xl');
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
      setMode('edit');
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
      const start = editor.selectionStart;
      const end = editor.selectionEnd;
      editor.value = editor.value.substring(0, start) + insert + editor.value.substring(end);
      editor.focus();
      editor.selectionStart = start + insert.length;
      editor.selectionEnd = start + insert.length;
      updatePreview();
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
