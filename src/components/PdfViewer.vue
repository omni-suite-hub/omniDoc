<template>
  <div class="pdf-container">
    <!-- Top Control Bar -->
    <div class="pdf-toolbar">
      <div class="toolbar-left">
        <button 
          class="nav-btn" 
          :disabled="currentPage <= 1 || isRendering"
          @click="prevPage" 
          title="上一页 (← / PageUp)"
        >
          <ChevronLeft class="tool-icon" />
          <span>上一页</span>
        </button>

        <div class="page-counter">
          <input 
            v-model.number="pageInput" 
            type="number" 
            min="1" 
            :max="totalPages"
            class="page-input"
            @change="goToPageInput"
            @keydown.enter="goToPageInput"
          />
          <span class="slash">/</span>
          <span class="total-pages">{{ totalPages }}</span>
        </div>

        <button 
          class="nav-btn" 
          :disabled="currentPage >= totalPages || isRendering"
          @click="nextPage" 
          title="下一页 (→ / Space / PageDown)"
        >
          <span>下一页</span>
          <ChevronRight class="tool-icon" />
        </button>
      </div>

      <div class="toolbar-right">
        <!-- Fit Width -->
        <button class="tool-btn text-btn" @click="fitWidth" title="自适应窗口宽度">
          <ScanLine class="tool-icon" />
          <span>适宽</span>
        </button>

        <!-- 100% Reset -->
        <button class="tool-btn text-btn" @click="resetZoom" title="实际大小 100%">
          <span>100%</span>
        </button>

        <div class="tool-divider"></div>

        <!-- Zoom Controls -->
        <button class="tool-btn" @click="zoomOut" :disabled="scale <= 0.5" title="缩小 (-)">
          <ZoomOut class="tool-icon" />
        </button>

        <span class="zoom-text">{{ Math.round(scale * 100) }}%</span>

        <button class="tool-btn" @click="zoomIn" :disabled="scale >= 3.0" title="放大 (+)">
          <ZoomIn class="tool-icon" />
        </button>
      </div>
    </div>

    <!-- Main Viewport Area -->
    <div class="pdf-main-body" ref="mainBodyRef">
      <!-- Left Page Filmstrip Sidebar -->
      <div 
        v-if="totalPages > 1" 
        class="pdf-sidebar"
        :style="{ width: `${sidebarWidth}px` }"
      >
        <div 
          v-for="p in totalPages" 
          :key="p"
          class="pdf-thumb-item"
          :class="{ active: currentPage === p }"
          @click="goToPage(p)"
        >
          <div class="thumb-page-num">{{ p }}</div>
          <div class="thumb-page-card">
            <canvas :ref="el => setThumbCanvasRef(p, el)" class="thumb-canvas"></canvas>
            <span v-if="!renderedThumbs[p]" class="thumb-mini-label">第 {{ p }} 页</span>
          </div>
        </div>

        <!-- Sidebar Resizer Handle -->
        <div 
          class="sidebar-resizer" 
          @mousedown="startResizeSidebar"
          title="拖拽调节侧边栏宽度"
        ></div>
      </div>

      <!-- Center Document Stage -->
      <div class="pdf-stage" ref="stageRef" @wheel="handleWheel">
        <div class="canvas-scroll-wrapper">
        <div 
          v-if="loadError" 
          class="pdf-error-card" 
          role="alert"
        >
          <div class="error-icon-box">
            <TriangleAlert class="error-icon" />
          </div>
          <div class="error-title">PDF 加载提示</div>
          <div class="error-desc">{{ loadError }}</div>
          <button class="error-retry-btn" @click="retryLoad">
            <RefreshCw class="btn-icon" />
            <span>重试</span>
          </button>
        </div>
          <div v-else class="canvas-shadow-card">
            <canvas ref="pdfCanvasRef" class="pdf-canvas"></canvas>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
// ES2024 polyfills (Map.getOrInsert*, Math.sumPrecise) must be installed
// before pdf.js loads — see src/utils/polyfills.js
import '../utils/polyfills.js';
import { ref, shallowRef, markRaw, watch, onMounted, onUnmounted, nextTick } from 'vue';
import * as pdfjsLib from 'pdfjs-dist';
import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  ScanLine,
  TriangleAlert,
  RefreshCw
} from 'lucide-vue-next';

// Register the worker properly.
//
// BUG: the old code did `import * as pdfWorker from '.../pdf.worker.min.mjs'`
// and assigned it to `globalThis.pdfjsWorker` — pdf.js never reads that global,
// so `GlobalWorkerOptions.workerSrc` stayed unset. Depending on the pdf.js
// version this either threw "No GlobalWorkerOptions.workerSrc specified" or
// silently degraded to a fake worker running on the main thread.
// Vite's `?worker` suffix emits a real Worker constructor, which is what
// pdf.js expects. (Tauri serves the app over a custom protocol, so a CDN
// workerSrc is not an option.)
pdfjsLib.GlobalWorkerOptions.workerPort = new PdfWorker();

const props = defineProps({
  doc: {
    type: Object,
    required: true
  }
});

// CRITICAL: must be shallowRef + markRaw.
// pdf.js classes rely on ES private fields (e.g. #pagesNumber). Vue's deep reactive
// Proxy wraps them, and private-field access through a Proxy throws
// "Cannot read private member #pagesNumber" — which silently blanks every page.
const pdfDoc = shallowRef(null);
const totalPages = ref(1);
const currentPage = ref(1);
const pageInput = ref(1);
const scale = ref(1.15);
const isRendering = ref(false);
const loadError = ref('');

const sidebarWidth = ref(130);
const isResizingSidebar = ref(false);

const pdfCanvasRef = ref(null);
const stageRef = ref(null);
const mainBodyRef = ref(null);
const thumbCanvasRefs = shallowRef({});
const renderedThumbs = ref({});

let currentRenderTask = null;
let currentBufferCopy = null;

function setThumbCanvasRef(pageIndex, el) {
  if (el) {
    thumbCanvasRefs.value[pageIndex] = el;
  }
}

async function loadPdfBuffer(buffer) {
  loadError.value = '';
  try {
    if (currentRenderTask) {
      try { currentRenderTask.cancel(); } catch (e) {}
      currentRenderTask = null;
    }

    // Destroy previous document to release the worker + page cache
    if (pdfDoc.value) {
      try { await pdfDoc.value.destroy(); } catch (e) {}
      pdfDoc.value = null;
    }

    // Keep an independent slice of array buffer so transfer doesn't detach caller buffer
    const uint8 = new Uint8Array(buffer).slice();
    currentBufferCopy = uint8;

    const loadingTask = pdfjsLib.getDocument({
      data: uint8,
      cMapUrl: '/pdfjs/cmaps/',
      cMapPacked: true,
      standardFontDataUrl: '/pdfjs/standard_fonts/',
      enableXfa: false,
      isEvalSupported: false,
      useSystemFonts: true
    });

    pdfDoc.value = markRaw(await loadingTask.promise);
    totalPages.value = pdfDoc.value.numPages || 1;
    currentPage.value = 1;
    pageInput.value = 1;
    renderedThumbs.value = {};

    await renderPage(1);

    // After first page is rendered cleanly, asynchronously render thumbnails
    renderThumbnails();
  } catch (err) {
    console.error('Failed to load PDF:', err);
    loadError.value = err.message || '文档解析失败';
  }
}

async function renderPage(num) {
  if (!pdfDoc.value) return;
  await nextTick();

  const canvas = pdfCanvasRef.value;
  if (!canvas) return;

  // Cancel any ongoing rendering task safely
  if (currentRenderTask) {
    try {
      currentRenderTask.cancel();
    } catch (e) {}
    currentRenderTask = null;
  }

  isRendering.value = true;

  try {
    const page = await pdfDoc.value.getPage(num);
    const dpr = window.devicePixelRatio || 1;

    // Calculate CSS viewport and high-DPI canvas viewport
    const unscaledViewport = page.getViewport({ scale: scale.value });
    const scaledViewport = page.getViewport({ scale: scale.value * dpr });

    canvas.width = Math.floor(scaledViewport.width);
    canvas.height = Math.floor(scaledViewport.height);
    canvas.style.width = `${Math.floor(unscaledViewport.width)}px`;
    canvas.style.height = `${Math.floor(unscaledViewport.height)}px`;

    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const renderContext = {
      canvasContext: ctx,
      viewport: scaledViewport
    };

    currentRenderTask = page.render(renderContext);
    await currentRenderTask.promise;
    loadError.value = '';
  } catch (err) {
    if (err?.name !== 'RenderingCancelledException') {
      console.warn('PDF page render error:', err);
      // Surface to the user instead of silently leaving a blank canvas
      loadError.value = err?.message || '页面渲染失败';
    }
  } finally {
    isRendering.value = false;
    currentRenderTask = null;
  }
}

async function renderThumbnails() {
  if (!pdfDoc.value) return;
  await nextTick();

  // Capture the document instance so a concurrent file switch aborts the loop
  const doc = pdfDoc.value;

  for (let p = 1; p <= totalPages.value; p++) {
    if (pdfDoc.value !== doc) return;

    const canvas = thumbCanvasRefs.value[p];
    if (!canvas) continue;

    try {
      const page = await doc.getPage(p);
      const viewport = page.getViewport({ scale: 0.2 });
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);

      const ctx = canvas.getContext('2d', { alpha: false });
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({
        canvasContext: ctx,
        viewport
      }).promise;
      renderedThumbs.value = { ...renderedThumbs.value, [p]: true };
      // Yield to the event loop so the UI stays responsive on long documents
      await new Promise(r => setTimeout(r, 0));
    } catch (e) {
      // Ignore cancelled or minor thumbnail render error
    }
  }
}

function prevPage() {
  if (currentPage.value > 1) {
    currentPage.value--;
    pageInput.value = currentPage.value;
    renderPage(currentPage.value);
  }
}

function nextPage() {
  if (currentPage.value < totalPages.value) {
    currentPage.value++;
    pageInput.value = currentPage.value;
    renderPage(currentPage.value);
  }
}

function goToPage(p) {
  currentPage.value = p;
  pageInput.value = p;
  renderPage(p);
}

function goToPageInput() {
  let p = Math.max(1, Math.min(totalPages.value, pageInput.value || 1));
  goToPage(p);
}

function retryLoad() {
  if (currentBufferCopy) {
    loadPdfBuffer(currentBufferCopy.buffer.slice(
      currentBufferCopy.byteOffset,
      currentBufferCopy.byteOffset + currentBufferCopy.byteLength
    ));
  }
}

function zoomIn() {
  if (scale.value < 3.0) {
    scale.value = Math.min(3.0, +(scale.value + 0.15).toFixed(2));
    renderPage(currentPage.value);
  }
}

function zoomOut() {
  if (scale.value > 0.5) {
    scale.value = Math.max(0.5, +(scale.value - 0.15).toFixed(2));
    renderPage(currentPage.value);
  }
}

function resetZoom() {
  scale.value = 1.0;
  renderPage(currentPage.value);
}

async function fitWidth() {
  if (!stageRef.value || !pdfDoc.value) return;
  try {
    const page = await pdfDoc.value.getPage(currentPage.value);
    const vp = page.getViewport({ scale: 1 });
    const availableWidth = stageRef.value.clientWidth - 64;
    if (availableWidth > 200 && vp.width > 0) {
      const targetScale = +(availableWidth / vp.width).toFixed(2);
      scale.value = Math.max(0.6, Math.min(2.5, targetScale));
      renderPage(currentPage.value);
    }
  } catch (e) {}
}

// Sidebar Resizing
function startResizeSidebar(e) {
  isResizingSidebar.value = true;
  const startX = e.clientX;
  const startW = sidebarWidth.value;

  function onMouseMove(ev) {
    if (!isResizingSidebar.value) return;
    const diff = ev.clientX - startX;
    sidebarWidth.value = Math.max(100, Math.min(260, startW + diff));
  }

  function onMouseUp() {
    isResizingSidebar.value = false;
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  }

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
}

function handleKeyDown(e) {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) {
    return;
  }
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
    e.preventDefault();
    nextPage();
  } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
    e.preventDefault();
    prevPage();
  }
}

/**
 * Mouse wheel behaviour.
 *
 * Two distinct needs:
 *  - When the whole page already fits on screen there is nothing to scroll,
 *    so the wheel flips pages instead (this is what Preview.app does).
 *  - When content overflows, we let the container scroll natively and only
 *    flip once the user reaches the top/bottom edge.
 */
function handleWheel(e) {
  if (isRendering.value || totalPages.value <= 1) return;
  const stage = stageRef.value;
  if (!stage) return;

  const canScrollUp = stage.scrollTop > 1;
  const canScrollDown = stage.scrollTop + stage.clientHeight < stage.scrollHeight - 1;
  const hasScrollableContent = stage.scrollHeight > stage.clientHeight + 2;

  // Content fits entirely -> always treat the wheel as page navigation
  if (!hasScrollableContent) {
    e.preventDefault();
    if (e.deltaY > 0) nextPage();
    else prevPage();
    return;
  }

  // At the edges, hand the wheel over to page navigation
  if ((e.deltaY < 0 && !canScrollUp) || (e.deltaY > 0 && !canScrollDown)) {
    e.preventDefault();
    if (e.deltaY > 0) nextPage();
    else prevPage();
  }
}

watch(
  () => props.doc,
  (newDoc) => {
    if (newDoc && newDoc.buffer) {
      loadPdfBuffer(newDoc.buffer);
    }
  },
  { immediate: true }
);

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
  if (currentRenderTask) {
    try { currentRenderTask.cancel(); } catch (e) {}
  }
  // Release the pdf.js worker and page cache
  if (pdfDoc.value) {
    try { pdfDoc.value.destroy(); } catch (e) {}
    pdfDoc.value = null;
  }
});
</script>

<style scoped>
.pdf-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #E2E8F0;
  overflow: hidden;
}

/* Toolbar */
.pdf-toolbar {
  height: 42px;
  background: #F8FAFC;
  border-bottom: 1px solid #CBD5E1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px;
  flex-shrink: 0;
  z-index: 50;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.nav-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11.5px;
  font-weight: 600;
  color: #334155;
  background: #FFFFFF;
  border: 1px solid #CBD5E1;
  padding: 4px 9px;
  border-radius: 5px;
  cursor: pointer;
  transition: all 0.12s;
}

.nav-btn:hover:not(:disabled) {
  background: #F1F5F9;
  color: #DC2626;
  border-color: #94A3B8;
}

.nav-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.page-counter {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 600;
  color: #0F172A;
}

.page-input {
  width: 44px;
  text-align: center;
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  padding: 2px 4px;
  border-radius: 4px;
  border: 1px solid #CBD5E1;
  outline: none;
}

.page-input:focus {
  border-color: #DC2626;
}

.slash {
  color: #94A3B8;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.tool-btn {
  display: inline-flex;
  align-items: center;
  padding: 4px 6px;
  border-radius: 4px;
  color: #475569;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.12s;
}

.tool-btn:hover:not(:disabled) {
  background: #F1F5F9;
  color: #0F172A;
}

.tool-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.tool-btn.text-btn {
  font-size: 11.5px;
  font-weight: 600;
  padding: 3px 8px;
  border: 1px solid #CBD5E1;
  background: #FFFFFF;
}

.tool-icon {
  width: 14px;
  height: 14px;
}

.zoom-text {
  font-size: 11.5px;
  font-weight: 600;
  color: #1E293B;
  min-width: 44px;
  text-align: center;
}

.tool-divider {
  width: 1px;
  height: 14px;
  background: #CBD5E1;
  margin: 0 4px;
}

/* Main Body */
.pdf-main-body {
  flex: 1;
  display: flex;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  position: relative;
}

/* Sidebar */
.pdf-sidebar {
  background: #FFFFFF;
  border-right: 1px solid #CBD5E1;
  overflow-y: auto;
  padding: 12px 8px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex-shrink: 0;
  position: relative;
}

.pdf-thumb-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}

.thumb-page-num {
  font-size: 10px;
  font-weight: 600;
  color: #64748B;
}

.thumb-page-card {
  width: 100%;
  aspect-ratio: 0.707;
  background: #FFFFFF;
  border: 1.5px solid #CBD5E1;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  transition: all 0.15s ease;
  overflow: hidden;
  position: relative;
}

.thumb-canvas {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #FFFFFF;
}

.thumb-mini-label {
  font-size: 10px;
  color: #94A3B8;
  position: absolute;
}

.pdf-thumb-item:hover .thumb-page-card {
  border-color: #94A3B8;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
}

.pdf-thumb-item.active .thumb-page-card {
  border-color: #DC2626;
  box-shadow: 0 0 0 2px rgba(220, 38, 38, 0.25);
}

.pdf-thumb-item.active .thumb-page-num {
  color: #DC2626;
}

/* Resizer Handle */
.sidebar-resizer {
  position: absolute;
  top: 0;
  right: -3px;
  width: 6px;
  height: 100%;
  cursor: col-resize;
  z-index: 20;
}

.sidebar-resizer:hover {
  background: rgba(37, 99, 235, 0.4);
}

/* Stage */
.pdf-stage {
  flex: 1;
  /* BUG FIX: was `overflow: auto` inside a flex row whose sibling had no
     min-width:0, and the inner wrapper used `min-width:100%`, so the scroll
     area never became scrollable and the wheel did nothing over the canvas.
     Now the stage is a real scroll container with both axes enabled. */
  overflow: auto;
  overscroll-behavior: contain;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 24px 20px 40px;
}

.canvas-scroll-wrapper {
  display: flex;
  justify-content: center;
  min-width: min-content;
}

.canvas-shadow-card {
  background: #FFFFFF;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.04);
  border-radius: 4px;
  display: flex;
  overflow: hidden;
}

.pdf-canvas {
  display: block;
  background: #FFFFFF;
}

.pdf-error-card {
  background: #FFFFFF;
  border: 1px solid #FCA5A5;
  border-radius: 12px;
  padding: 28px 36px;
  text-align: center;
  color: #991B1B;
  max-width: 420px;
  margin: 40px auto;
  box-shadow: var(--shadow-md);
}

.error-icon-box {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: #FEF2F2;
  color: #DC2626;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 10px;
}

.error-icon {
  width: 20px;
  height: 20px;
}

.error-title {
  font-weight: 700;
  font-size: 15px;
  margin-bottom: 6px;
}

.error-desc {
  font-size: 13px;
  color: #64748B;
  line-height: 1.5;
  word-break: break-word;
}

.error-retry-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-top: 14px;
  padding: 5px 14px;
  font-size: 12px;
  font-weight: 600;
  color: #FFFFFF;
  background: #DC2626;
  border: none;
  border-radius: 7px;
  cursor: pointer;
  transition: background 0.15s;
}

.error-retry-btn:hover {
  background: #B91C1C;
}

.btn-icon {
  width: 13px;
  height: 13px;
}
</style>
