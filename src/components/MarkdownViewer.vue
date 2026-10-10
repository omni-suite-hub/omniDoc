<template>
  <div class="md-viewer-layout">
    <!-- Main Scrollable Markdown Article -->
    <div class="md-viewport" ref="viewportRef">
      <div class="md-paper-card" :class="{ 'wide-mode': isWideMode }">
        <!-- Top Article Header Info Bar -->
        <div class="md-meta-header">
          <div class="meta-stats">
            <span class="stat-badge">字数: {{ wordCount }}</span>
            <span class="stat-badge">预计阅读: {{ readTimeMin }} 分钟</span>
            <span class="stat-badge">行数: {{ lineCount }}</span>
          </div>

          <div class="meta-actions">
            <!-- Toggle Width Mode -->
            <button 
              class="toolbar-sub-btn" 
              :class="{ active: isWideMode }"
              @click="isWideMode = !isWideMode" 
              :title="isWideMode ? '切换为标准版心 (880px)' : '切换为宽屏展开模式 (适合大表格/宽代码)'"
            >
              <Minimize2 v-if="isWideMode" class="tool-icon" />
              <Maximize2 v-else class="tool-icon" />
              <span>{{ isWideMode ? '紧凑版心' : '宽屏展示' }}</span>
            </button>

            <!-- Toggle Table of Contents -->
            <button 
              v-if="tocItems.length > 0"
              class="toc-toggle-btn" 
              @click="showToc = !showToc" 
              title="切换目录导航"
            >
              <ListTree class="toc-icon" />
              <span>{{ showToc ? '隐藏大纲' : '显示大纲' }}</span>
            </button>
          </div>
        </div>

        <!-- Rendered GitHub / Typora Quality Markdown -->
        <div 
          class="markdown-body selectable-content" 
          v-html="renderedHtml"
          @click="handleContentClick"
        ></div>
      </div>
    </div>

    <!-- Collapsible Table of Contents (TOC) Sidebar -->
    <div 
      v-if="showToc && tocItems.length > 0" 
      class="toc-sidebar"
      :style="{ width: `${tocWidth}px` }"
    >
      <div 
        class="toc-resizer" 
        @mousedown="startResizeToc"
        title="拖拽调节大纲宽度"
      ></div>

      <div class="toc-header">
        <div class="toc-title-box">
          <ListTree class="toc-title-icon" />
          <span class="toc-title">文档大纲 ({{ tocItems.length }})</span>
        </div>
        <button class="close-toc" @click="showToc = false" title="关闭大纲" aria-label="关闭大纲">
          <X class="toc-close-icon" />
        </button>
      </div>

      <div class="toc-list">
        <a
          v-for="(item, idx) in tocItems"
          :key="idx"
          :href="`#${item.id}`"
          class="toc-item"
          :class="[`level-${item.level}`, { active: activeId === item.id }]"
          @click.prevent="scrollToHeading(item.id)"
          :title="item.text"
        >
          <span class="toc-level-indicator"></span>
          <span class="toc-text">{{ item.text }}</span>
        </a>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { marked } from 'marked';
import hljs from 'highlight.js';
import { Maximize2, Minimize2, ListTree, X, ImageOff } from 'lucide-vue-next';

const props = defineProps({
  doc: {
    type: Object,
    default: () => ({})
  }
});

const viewportRef = ref(null);
const showToc = ref(true);
const isWideMode = ref(false);
const activeId = ref('');
const tocWidth = ref(260);
const isResizingToc = ref(false);
let unbindResize = null;

function startResizeToc(e) {
  isResizingToc.value = true;
  const startX = e.clientX;
  const startW = tocWidth.value;

  function onMouseMove(ev) {
    if (!isResizingToc.value) return;
    const diff = startX - ev.clientX; // Leftward drag increases width
    tocWidth.value = Math.max(180, Math.min(480, startW + diff));
  }

  function onMouseUp() {
    isResizingToc.value = false;
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  }

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  unbindResize = onMouseUp;
}

const content = computed(() => props.doc?.content || '');

const wordCount = computed(() => {
  if (!content.value) return 0;
  const cjk = (content.value.match(/[\u4e00-\u9fa5]/g) || []).length;
  const words = (content.value.replace(/[\u4e00-\u9fa5]/g, ' ').match(/\b\w+\b/g) || []).length;
  return cjk + words;
});

const readTimeMin = computed(() => {
  return Math.max(1, Math.ceil(wordCount.value / 350));
});

const lineCount = computed(() => {
  return content.value ? content.value.split('\n').length : 0;
});

// Single source of truth for heading slugs.
//
// BUG FIX: the TOC and the renderer used to keep two independent `headingIndex`
// counters — the TOC counted only depth<=3 while the renderer counted every
// heading. Any document containing an h4/h5/h6 therefore shifted every
// subsequent anchor, so TOC links pointed at non-existent ids and did nothing.
// Both now derive ids from this single ordered walk.
function slugifyHeading(plainText, index) {
  const slug = plainText
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `heading-${slug || 'h'}-${index}`;
}

const headingEntries = computed(() => {
  if (!content.value) return [];
  const entries = [];
  let idx = 0;
  const walk = (list) => {
    for (const token of list) {
      if (token.type === 'heading') {
        idx++;
        const plainText = token.text.replace(/<[^>]*>/g, '').trim();
        entries.push({ id: slugifyHeading(plainText, idx), text: plainText, level: token.depth });
      } else if (token.type === 'blockquote' && Array.isArray(token.tokens)) {
        walk(token.tokens);
      } else if (token.type === 'list' && Array.isArray(token.items)) {
        for (const item of token.items) {
          if (item && Array.isArray(item.tokens)) walk(item.tokens);
        }
      }
    }
  };
  walk(marked.lexer(content.value));
  return entries;
});

// Only levels 1-3 are surfaced in the sidebar, but ids come from the shared
// counter above so anchors always line up.
const tocItems = computed(() => headingEntries.value.filter(h => h.level <= 3));

// High quality custom markdown renderer
const renderedHtml = computed(() => {
  if (!content.value) return '';

  let headingIndex = 0;
  const renderer = new marked.Renderer();

  // Security: escape every text run before it reaches v-html.
  //
  // marked passes inline HTML through verbatim, and the result is injected via
  // v-html — so a Markdown file containing `<script>` or `<img onerror=...>`
  // would execute inside the app webview (verified: raw <script> survived the
  // old pipeline). Escaping at the token level is safer than stripping tags
  // afterwards, because stripping cannot distinguish our own markup from
  // attacker markup once both are in the same string.
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  renderer.html = ({ text }) => esc(text);

  renderer.text = ({ text }) => {
    // Escape, then re-allow the inline formatting marked already produced.
    return esc(text)
      .replace(/&amp;(\w+);/g, '&$1;')
      .replace(/\\([\\`*_{}\[\]()#+\-.!])/g, '$1');
  };

  renderer.codespan = ({ text }) => `<code>${esc(text)}</code>`;

  renderer.link = ({ href, title, text }) => {
    const safeHref = /^(https?:|mailto:|#|\/)/i.test(href || '') ? href : '#';
    const titleAttr = title ? ` title="${esc(title)}"` : '';
    return `<a href="${esc(safeHref)}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`;
  };

  renderer.image = ({ href, title, text }) => {
    // Remote images are blocked: a previewer must not phone home to a tracker.
    return `<span class="md-blocked-image" title="出于隐私考虑，已屏蔽远程图片：${esc(text || href || '')}"><svg class="md-blocked-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M10.733 5.076a1 1 0 0 1 1.527.69l4.27 10.141a1 1 0 0 1-1.498 1.306l-3.42-1.307"/><path d="m22 2-2 2"/><path d="m2 2 20 20"/><path d="M5.454 15.1 3 22.1"/><path d="M9 8.2s1.5-2 4.5-2 4.5 2 4.5 2"/><path d="M4.5 10.5s-1.5 2-1.5 4.5 1.5 4.5 1.5 4.5"/><path d="M19.5 10.5s1.5 2 1.5 4.5-1.5 4.5-1.5 4.5"/></svg><span>${esc(text || '图片')}（已屏蔽远程加载）</span></span>`;
  };

  // Headings with clean IDs for TOC navigation
  renderer.heading = function ({ text, depth }) {
    headingIndex++;
    const plainText = text.replace(/<[^>]*>/g, '').trim();
    const cleanId = slugifyHeading(plainText, headingIndex);
    return `<h${depth} id="${cleanId}">${text}</h${depth}>`;
  };

  // Wrap tables in responsive scroll containers to prevent cell crushing & text vertical stacking
  renderer.table = function (header, body) {
    let html = '';
    if (typeof header === 'object') {
      // In marked v12+, table token is passed as { header, rows }
      const headerHtml = header.header.map(cell => `<th>${esc(cell.text)}</th>`).join('');
      const rowsHtml = header.rows.map(row => `<tr>${row.map(cell => `<td>${esc(cell.text)}</td>`).join('')}</tr>`).join('');
      html = `<thead><tr>${headerHtml}</tr></thead><tbody>${rowsHtml}</tbody>`;
    } else {
      html = `<thead>${header}</thead><tbody>${body}</tbody>`;
    }
    return `<div class="table-scroll-container"><table class="md-styled-table">${html}</table></div>`;
  };

  // Code block with syntax highlighting and copy button
  renderer.code = function ({ text, lang }) {
    let highlighted = '';
    const cleanLang = (lang || '').trim().toLowerCase();
    if (cleanLang && hljs.getLanguage(cleanLang)) {
      try {
        highlighted = hljs.highlight(text, { language: cleanLang }).value;
      } catch (e) {
        highlighted = hljs.highlightAuto(text).value;
      }
    } else {
      try {
        highlighted = hljs.highlightAuto(text).value;
      } catch (e) {
        highlighted = esc(text);
      }
    }

    const displayLang = cleanLang ? cleanLang.toUpperCase() : 'CODE';
    return `
      <div class="code-block-wrapper">
        <div class="code-block-header">
          <span class="code-lang-tag">${esc(displayLang)}</span>
          <button class="copy-code-btn" type="button" data-code="${encodeURIComponent(text)}" title="复制代码">
            <span>复制</span>
          </button>
        </div>
        <pre><code class="hljs ${esc(cleanLang)}">${highlighted}</code></pre>
      </div>
    `;
  };

  return marked.parse(content.value, { 
    renderer,
    gfm: true,
    breaks: true
  });
});

function handleContentClick(e) {
  const copyBtn = e.target.closest('.copy-code-btn');
  if (copyBtn) {
    const raw = copyBtn.getAttribute('data-code');
    if (raw) {
      try {
        const text = decodeURIComponent(raw);
        navigator.clipboard.writeText(text);
        const origText = copyBtn.innerText;
        copyBtn.innerText = '已复制!';
        copyBtn.classList.add('copied');
        setTimeout(() => {
          copyBtn.innerText = origText;
          copyBtn.classList.remove('copied');
        }, 1600);
      } catch (err) {}
    }
  }
}

function scrollToHeading(id) {
  activeId.value = id;
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// Scroll spy: keep the TOC highlight in sync with the viewport.
// Previously activeId only changed on click, so the highlight went stale the
// moment the user scrolled with the mouse wheel.
let spyFrame = null;
function handleScroll() {
  if (spyFrame) return;
  spyFrame = requestAnimationFrame(() => {
    spyFrame = null;
    const viewport = viewportRef.value;
    if (!viewport || tocItems.value.length === 0) return;

    const anchorLine = viewport.getBoundingClientRect().top + 90;
    let current = tocItems.value[0].id;

    for (const item of tocItems.value) {
      const el = document.getElementById(item.id);
      if (!el) continue;
      if (el.getBoundingClientRect().top <= anchorLine) {
        current = item.id;
      } else {
        break;
      }
    }
    if (current !== activeId.value) activeId.value = current;
  });
}

onMounted(async () => {
  await nextTick();
  if (viewportRef.value) {
    viewportRef.value.addEventListener('scroll', handleScroll, { passive: true });
  }
  handleScroll();
});

onUnmounted(() => {
  if (spyFrame) cancelAnimationFrame(spyFrame);
  if (viewportRef.value) {
    viewportRef.value.removeEventListener('scroll', handleScroll);
  }
  if (typeof unbindResize === 'function') unbindResize();
});
</script>

<style scoped>
.md-viewer-layout {
  display: flex;
  height: 100%;
  width: 100%;
  background: #F8FAFC;
  overflow: hidden;
  position: relative;
}

.md-viewport {
  flex: 1;
  height: 100%;
  overflow-y: auto;
  padding: 28px 24px 80px;
  display: flex;
  justify-content: center;
}

.md-paper-card {
  width: 100%;
  max-width: 880px;
  min-height: fit-content;
  background: #FFFFFF;
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: 14px;
  box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.04);
  padding: 36px 44px;
  margin-bottom: 40px;
  transition: max-width 0.2s ease-in-out;
}

.md-paper-card.wide-mode {
  max-width: 1200px;
}

.md-meta-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 16px;
  margin-bottom: 24px;
  border-bottom: 1px solid #E2E8F0;
}

.meta-stats {
  display: flex;
  align-items: center;
  gap: 8px;
}

.stat-badge {
  font-size: 11.5px;
  color: #64748B;
  background: #F1F5F9;
  padding: 3px 8px;
  border-radius: 4px;
  font-weight: 500;
}

.meta-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toolbar-sub-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11.5px;
  font-weight: 500;
  color: #475569;
  background: #F8FAFC;
  border: 1px solid #CBD5E1;
  padding: 3px 9px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.12s;
}

.toolbar-sub-btn:hover {
  background: #F1F5F9;
  color: #0F172A;
  border-color: #94A3B8;
}

.toolbar-sub-btn.active {
  background: rgba(37, 99, 235, 0.08);
  color: #2563EB;
  border-color: rgba(37, 99, 235, 0.35);
  font-weight: 600;
}

.tool-icon {
  width: 12px;
  height: 12px;
}

.toc-toggle-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  font-weight: 600;
  color: #7C3AED;
  background: rgba(124, 58, 237, 0.08);
  padding: 3px 10px;
  border-radius: 6px;
  border: 1px solid rgba(124, 58, 237, 0.2);
  cursor: pointer;
  transition: all 0.15s;
}

.toc-toggle-btn:hover {
  background: rgba(124, 58, 237, 0.15);
}

.toc-icon {
  width: 13px;
  height: 13px;
}

.tool-icon {
  width: 12px;
  height: 12px;
}

.toc-close-icon {
  width: 16px;
  height: 16px;
}

/* TOC Sidebar */
.toc-sidebar {
  height: 100%;
  background: #FFFFFF;
  border-left: 1px solid #E2E8F0;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  padding: 16px 12px;
  box-sizing: border-box;
  position: relative;
  animation: slideInRight 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.toc-resizer {
  position: absolute;
  top: 0;
  left: -3px;
  width: 6px;
  height: 100%;
  cursor: col-resize;
  z-index: 50;
}

.toc-resizer:hover {
  background: rgba(124, 58, 237, 0.4);
}

@keyframes slideInRight {
  from { opacity: 0; transform: translateX(12px); }
  to { opacity: 1; transform: translateX(0); }
}

.toc-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid #E2E8F0;
  flex-shrink: 0;
}

.toc-title-box {
  display: flex;
  align-items: center;
  gap: 6px;
}

.toc-title-icon {
  width: 14px;
  height: 14px;
  color: #7C3AED;
}

.toc-title {
  font-size: 12.5px;
  font-weight: 700;
  color: #0F172A;
}

.close-toc {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #94A3B8;
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 5px;
  transition: all 0.12s;
}

.close-toc:hover {
  color: #0F172A;
  background: #F1F5F9;
}

.toc-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.toc-item {
  display: flex;
  align-items: flex-start;
  flex-shrink: 0;
  min-height: 28px;
  font-size: 12px;
  line-height: 18px;
  color: #64748B;
  text-decoration: none;
  padding: 5px 8px;
  border-radius: 6px;
  transition: background 0.12s, color 0.12s;
}

.toc-level-indicator {
  display: inline-block;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #CBD5E1;
  margin-top: 7px;
  margin-right: 6px;
  flex-shrink: 0;
}

.toc-text {
  flex: 1;
  word-break: break-all;
  white-space: normal;
}

.toc-item:hover {
  background: #F1F5F9;
  color: #0F172A;
}

.toc-item.active {
  background: rgba(124, 58, 237, 0.08);
  color: #7C3AED;
  font-weight: 600;
}

.toc-item.level-1 {
  font-weight: 600;
  color: #1E293B;
  padding-left: 6px;
}

.toc-item.level-2 {
  padding-left: 16px;
}

.toc-item.level-3 {
  padding-left: 26px;
  font-size: 11.5px;
  color: #64748B;
}

/* Deep Styles for Markdown Body Elements */
:deep(.table-scroll-container) {
  width: 100%;
  overflow-x: auto;
  margin: 1.6em 0;
  border: 1px solid #E2E8F0;
  border-radius: 10px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.02);
  background: #FFFFFF;
}

:deep(.md-styled-table) {
  width: 100%;
  min-width: 600px;
  border-collapse: collapse;
  font-size: 13.5px;
  line-height: 1.5;
  text-align: left;
}

:deep(.md-styled-table th),
:deep(.md-styled-table td) {
  padding: 10px 14px;
  border-bottom: 1px solid #E2E8F0;
  border-right: 1px solid #F1F5F9;
  word-break: normal;
}

:deep(.md-styled-table th:last-child),
:deep(.md-styled-table td:last-child) {
  border-right: none;
}

:deep(.md-styled-table th) {
  background: #F8FAFC;
  font-weight: 700;
  color: #1E293B;
  white-space: nowrap;
  font-size: 13px;
  border-bottom: 2px solid #CBD5E1;
}

:deep(.md-styled-table tr:hover td) {
  background: #F8FAFC;
}

:deep(.md-styled-table tr:last-child td) {
  border-bottom: none;
}

:deep(.code-block-wrapper) {
  margin: 1.4em 0;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid #334155;
  background: #0F172A;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

:deep(.code-block-header) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 14px;
  background: #1E293B;
  border-bottom: 1px solid #334155;
}

:deep(.code-lang-tag) {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  color: #94A3B8;
  letter-spacing: 0.5px;
}

:deep(.copy-code-btn) {
  background: rgba(255, 255, 255, 0.1);
  color: #E2E8F0;
  font-size: 11px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  cursor: pointer;
  transition: all 0.15s;
}

:deep(.copy-code-btn:hover) {
  background: rgba(255, 255, 255, 0.2);
  color: #FFFFFF;
}

:deep(.copy-code-btn.copied) {
  background: #059669;
  color: #FFFFFF;
  border-color: #059669;
}

:deep(.code-block-wrapper pre) {
  margin: 0 !important;
  padding: 14px 16px !important;
  background: transparent !important;
  border: none !important;
}

:deep(.code-block-wrapper pre code) {
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.6;
}
</style>
