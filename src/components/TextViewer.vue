<template>
  <div class="code-viewer-container">
    <!-- Top Controls Toolbar -->
    <div class="code-toolbar">
      <div class="toolbar-left">
        <!-- Language Identification Badge -->
        <div class="lang-badge" :style="{ backgroundColor: langBadgeBg, color: langBadgeColor }">
          <span class="lang-dot" :style="{ backgroundColor: langBadgeColor }"></span>
          <span class="lang-name">{{ detectedLanguageLabel }}</span>
        </div>

        <div class="meta-divider"></div>

        <span class="meta-tag">编码: <strong>{{ doc?.encoding || 'UTF-8' }}</strong></span>
        <span class="meta-tag">行数: <strong>{{ lines.length }}</strong></span>
        <span class="meta-tag">字符: <strong>{{ doc?.chars || doc?.content?.length || 0 }}</strong></span>
      </div>

      <div class="toolbar-right">
        <!-- Search In Code -->
        <div class="code-search-wrapper">
          <Search class="search-icon" />
          <input
            v-model="searchQuery"
            type="text"
            class="code-search-input"
            placeholder="搜索代码或文本..."
          />
          <span v-if="searchMatchesCount > 0" class="search-badge">
            {{ searchMatchesCount }} 处
          </span>
        </div>

        <!-- Line Numbers Toggle -->
        <button 
          class="ctrl-toggle-btn"
          :class="{ active: showLineNumbers }"
          @click="showLineNumbers = !showLineNumbers"
          title="切换行号显示"
        >
          <Hash class="ctrl-icon" />
          <span>行号</span>
        </button>

        <!-- Word Wrap Toggle -->
        <button 
          class="ctrl-toggle-btn"
          :class="{ active: wordWrap }"
          @click="wordWrap = !wordWrap"
          title="切换自动换行"
        >
          <WrapText class="ctrl-icon" />
          <span>自动换行</span>
        </button>

        <!-- Font Size Adjuster -->
        <div class="font-size-group">
          <button class="font-btn" @click="fontSize = Math.max(12, fontSize - 1)" title="减小字号" aria-label="减小字号">A−</button>
          <span class="font-size-label">{{ fontSize }}px</span>
          <button class="font-btn" @click="fontSize = Math.min(22, fontSize + 1)" title="增大字号" aria-label="增大字号">A+</button>
        </div>

        <!-- Copy Full Content -->
        <button 
          class="copy-btn" 
          @click="handleCopyFull"
          :title="copied ? '已复制！' : '复制全文'"
        >
          <Check v-if="copied" class="btn-icon check" />
          <Copy v-else class="btn-icon" />
          <span>{{ copied ? '已复制' : '复制' }}</span>
        </button>
      </div>
    </div>

    <!-- Code Body with Gutter and Syntax Highlighting -->
    <div class="code-viewport" :class="{ 'wrap-mode': wordWrap }">
      <div class="code-inner" :style="{ fontSize: `${fontSize}px` }">
        <div class="code-table">
          <div 
            v-for="(lineItem, idx) in highlightedLines" 
            :key="idx" 
            class="code-line-row"
            :class="{ 'has-match': isLineMatched(lineItem.raw) }"
          >
            <!-- Gutter Number -->
            <div v-if="showLineNumbers" class="line-gutter">
              {{ idx + 1 }}
            </div>
            <!-- Highlighted Content -->
            <div 
              class="line-content selectable-content hljs"
              v-html="renderLineHtml(lineItem)"
            ></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import hljs from 'highlight.js';
import { Search, Hash, WrapText, Copy, Check } from 'lucide-vue-next';

const props = defineProps({
  doc: {
    type: Object,
    default: () => ({})
  }
});

const showLineNumbers = ref(true);
const wordWrap = ref(true);
const fontSize = ref(13.5);
const searchQuery = ref('');
const copied = ref(false);

const rawContent = computed(() => props.doc?.content || '');

const lines = computed(() => {
  if (!rawContent.value) return [];
  return rawContent.value.split('\n');
});

// Extension to Language Mapping & Presentation
const LANG_MAP = {
  js: { id: 'javascript', label: 'JavaScript', color: '#F59E0B' },
  mjs: { id: 'javascript', label: 'JavaScript', color: '#F59E0B' },
  cjs: { id: 'javascript', label: 'JavaScript', color: '#F59E0B' },
  jsx: { id: 'javascript', label: 'React JSX', color: '#06B6D4' },
  ts: { id: 'typescript', label: 'TypeScript', color: '#3178C6' },
  mts: { id: 'typescript', label: 'TypeScript', color: '#3178C6' },
  cts: { id: 'typescript', label: 'TypeScript', color: '#3178C6' },
  tsx: { id: 'typescript', label: 'React TSX', color: '#3178C6' },
  vue: { id: 'html', label: 'Vue SFC', color: '#41B883' },
  py: { id: 'python', label: 'Python', color: '#3776AB' },
  pyw: { id: 'python', label: 'Python', color: '#3776AB' },
  rs: { id: 'rust', label: 'Rust', color: '#E5533D' },
  go: { id: 'go', label: 'Go', color: '#00ADD8' },
  java: { id: 'java', label: 'Java', color: '#B07219' },
  kt: { id: 'kotlin', label: 'Kotlin', color: '#A97BFF' },
  kts: { id: 'kotlin', label: 'Kotlin', color: '#A97BFF' },
  c: { id: 'c', label: 'C', color: '#555555' },
  cpp: { id: 'cpp', label: 'C++', color: '#F34B7D' },
  cc: { id: 'cpp', label: 'C++', color: '#F34B7D' },
  cxx: { id: 'cpp', label: 'C++', color: '#F34B7D' },
  h: { id: 'c', label: 'C/C++ Header', color: '#555555' },
  hpp: { id: 'cpp', label: 'C++ Header', color: '#F34B7D' },
  cs: { id: 'csharp', label: 'C#', color: '#178600' },
  html: { id: 'html', label: 'HTML', color: '#E34F26' },
  htm: { id: 'html', label: 'HTML', color: '#E34F26' },
  css: { id: 'css', label: 'CSS', color: '#1572B6' },
  scss: { id: 'scss', label: 'SCSS', color: '#CF649A' },
  less: { id: 'less', label: 'Less', color: '#1D365D' },
  json: { id: 'json', label: 'JSON', color: '#D97706' },
  yaml: { id: 'yaml', label: 'YAML', color: '#CB171E' },
  yml: { id: 'yaml', label: 'YAML', color: '#CB171E' },
  toml: { id: 'ini', label: 'TOML', color: '#9C4221' },
  xml: { id: 'xml', label: 'XML', color: '#0060AC' },
  sql: { id: 'sql', label: 'SQL', color: '#E38C00' },
  sh: { id: 'bash', label: 'Shell / Bash', color: '#89E051' },
  bash: { id: 'bash', label: 'Bash', color: '#89E051' },
  zsh: { id: 'bash', label: 'Zsh', color: '#89E051' },
  php: { id: 'php', label: 'PHP', color: '#4F5D95' },
  swift: { id: 'swift', label: 'Swift', color: '#F05138' },
  rb: { id: 'ruby', label: 'Ruby', color: '#701516' },
  lua: { id: 'lua', label: 'Lua', color: '#000080' },
  log: { id: '', label: '系统日志', color: '#64748B' },
  txt: { id: '', label: '纯文本', color: '#64748B' }
};

// Detect programming language and display info
const detectedInfo = computed(() => {
  const ext = (props.doc?.extension || '').toLowerCase();
  if (LANG_MAP[ext]) {
    return LANG_MAP[ext];
  }

  // Auto-detection via highlight.js if unknown
  if (rawContent.value && rawContent.value.length > 10) {
    try {
      const auto = hljs.highlightAuto(rawContent.value.slice(0, 3000));
      if (auto.language && auto.relevance > 4) {
        return {
          id: auto.language,
          label: auto.language.toUpperCase(),
          color: '#2563EB'
        };
      }
    } catch (e) {}
  }

  return { id: '', label: props.doc?.label || '纯文本', color: '#64748B' };
});

const detectedLanguageLabel = computed(() => detectedInfo.value.label);
const langBadgeColor = computed(() => detectedInfo.value.color || '#2563EB');
const langBadgeBg = computed(() => {
  const c = detectedInfo.value.color || '#2563EB';
  return `${c}1A`; // 10% opacity
});

// Precompute highlighted lines for performance and line numbering
const highlightedLines = computed(() => {
  if (!rawContent.value) return [];
  const langId = detectedInfo.value.id;

  try {
    let highlightedAll = '';
    if (langId && hljs.getLanguage(langId)) {
      highlightedAll = hljs.highlight(rawContent.value, { language: langId }).value;
    } else {
      highlightedAll = rawContent.value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    const hlLines = highlightedAll.split('\n');
    return lines.value.map((raw, idx) => ({
      raw,
      html: hlLines[idx] || ''
    }));
  } catch (e) {
    return lines.value.map(raw => ({
      raw,
      html: raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    }));
  }
});

const searchMatchesCount = computed(() => {
  if (!searchQuery.value.trim()) return 0;
  const q = searchQuery.value.trim().toLowerCase();
  let count = 0;
  for (const line of lines.value) {
    let pos = 0;
    const lower = line.toLowerCase();
    while ((pos = lower.indexOf(q, pos)) !== -1) {
      count++;
      pos += q.length;
    }
  }
  return count;
});

function isLineMatched(line) {
  if (!searchQuery.value.trim()) return false;
  return line.toLowerCase().includes(searchQuery.value.trim().toLowerCase());
}

/**
 * Inject <mark> into already-escaped highlight.js HTML WITHOUT corrupting it.
 *
 * The naive approach (html.replace(regex, '<mark>$1</mark>')) breaks as soon as
 * the query matches text inside an HTML entity or a tag attribute, e.g. searching
 * "lt;" turns `&lt;div&gt;` into `&<mark>lt;</mark>div&gt;` — which re-parses as a
 * bogus tag and destroys the line.
 *
 * Instead we walk the html and only inject into text nodes (outside of `<...>`),
 * matching against the *unescaped* text, then re-emit escaped.
 */
function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function highlightTextSegment(segment, q) {
  // segment is plain, unescaped text
  const lower = segment.toLowerCase();
  const needle = q.toLowerCase();
  let out = '';
  let pos = 0;
  let idx;
  while ((idx = lower.indexOf(needle, pos)) !== -1) {
    out += escapeHtml(segment.slice(pos, idx));
    out += '<mark class="code-match">' + escapeHtml(segment.slice(idx, idx + needle.length)) + '</mark>';
    pos = idx + needle.length;
  }
  out += escapeHtml(segment.slice(pos));
  return out;
}

function renderLineHtml(lineItem) {
  const html = lineItem.html || '';
  if (!searchQuery.value.trim()) {
    return html || '&nbsp;';
  }

  const q = searchQuery.value.trim();
  if (!q) return html || '&nbsp;';

  try {
    let out = '';
    let last = 0;
    // Match either an HTML tag (leave untouched) or a text run between tags
    const tagOrText = /<\/?[a-zA-Z][^>]*>|([^<]+)/g;
    let m;
    while ((m = tagOrText.exec(html)) !== null) {
      if (m[1] !== undefined) {
        // Text run: decode entities so the search sees what the user actually sees
        const decoded = m[1]
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&amp;/g, '&');
        out += html.slice(last, m.index) + highlightTextSegment(decoded, q);
      }
      last = tagOrText.lastIndex;
    }
    out += html.slice(last);
    return out || '&nbsp;';
  } catch (e) {
    return html || '&nbsp;';
  }
}

async function handleCopyFull() {
  if (!rawContent.value) return;
  try {
    await navigator.clipboard.writeText(rawContent.value);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 1800);
  } catch (e) {}
}
</script>

<style scoped>
.code-viewer-container {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 48px);
  background: #0D1117;
  overflow: hidden;
}

/* Toolbar */
.code-toolbar {
  height: 42px;
  background: #161B22;
  border-bottom: 1px solid #30363D;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px;
  flex-shrink: 0;
  user-select: none;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.lang-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  font-weight: 700;
  padding: 3px 9px;
  border-radius: 6px;
  letter-spacing: 0.3px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.lang-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.meta-divider {
  width: 1px;
  height: 14px;
  background: #30363D;
}

.meta-tag {
  font-size: 11.5px;
  color: #8B949E;
}

.meta-tag strong {
  color: #E6EDF3;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.code-search-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 7px;
  width: 13px;
  height: 13px;
  color: #8B949E;
}

.code-search-input {
  font-family: inherit;
  font-size: 11.5px;
  padding: 3px 8px 3px 24px;
  border-radius: 5px;
  border: 1px solid #30363D;
  background: #0D1117;
  color: #E6EDF3;
  outline: none;
  width: 150px;
  transition: all 0.15s;
}

.code-search-input:focus {
  border-color: #58A6FF;
  width: 190px;
}

.search-badge {
  position: absolute;
  right: 6px;
  font-size: 10px;
  color: #58A6FF;
  font-weight: 600;
}

.ctrl-toggle-btn {
  font-size: 11.5px;
  font-weight: 500;
  color: #8B949E;
  background: #21262D;
  border: 1px solid #30363D;
  padding: 3px 9px;
  border-radius: 5px;
  transition: all 0.12s;
}

.ctrl-toggle-btn:hover {
  background: #30363D;
  color: #E6EDF3;
}

.ctrl-toggle-btn.active {
  background: rgba(88, 166, 255, 0.15);
  color: #58A6FF;
  border-color: rgba(88, 166, 255, 0.4);
  font-weight: 600;
}

.font-size-group {
  display: flex;
  align-items: center;
  background: #21262D;
  border: 1px solid #30363D;
  border-radius: 5px;
  overflow: hidden;
}

.font-btn {
  padding: 2px 7px;
  font-size: 11px;
  font-weight: 600;
  color: #8B949E;
}

.font-btn:hover {
  background: #30363D;
  color: #E6EDF3;
}

.font-size-label {
  font-family: var(--font-mono);
  font-size: 11px;
  padding: 0 4px;
  color: #8B949E;
}

.copy-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: #238636;
  color: #FFFFFF;
  font-size: 11.5px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 5px;
  transition: all 0.12s;
}

.copy-btn:hover {
  background: #2EA043;
}

.btn-icon {
  width: 12px;
  height: 12px;
}

/* Viewport */
.code-viewport {
  flex: 1;
  overflow: auto;
  background: #0D1117;
  font-family: var(--font-mono);
  line-height: 1.6;
}

.code-inner {
  min-width: 100%;
  display: inline-block;
  padding: 16px 0 60px;
}

.code-table {
  display: flex;
  flex-direction: column;
}

.code-line-row {
  display: flex;
  min-height: 22px;
}

.code-line-row:hover {
  background: rgba(255, 255, 255, 0.04);
}

.code-line-row.has-match {
  background: rgba(234, 179, 8, 0.15);
}

.line-gutter {
  width: 56px;
  min-width: 56px;
  padding-right: 14px;
  text-align: right;
  color: #484F58;
  font-size: 12px;
  user-select: none;
  -webkit-user-select: none;
  border-right: 1px solid #21262D;
}

.line-content {
  padding-left: 16px;
  padding-right: 24px;
  color: #E6EDF3;
  white-space: pre;
  background: transparent !important;
}

.wrap-mode .line-content {
  white-space: pre-wrap;
  word-break: break-all;
}

:deep(.code-match) {
  background: #F2CC60;
  color: #1F2328;
  border-radius: 2px;
  padding: 0 1px;
}
</style>
