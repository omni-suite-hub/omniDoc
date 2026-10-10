<template>
  <div class="docx-container">
    <!-- Top Floating Zoom & Fit Toolbar -->
    <div class="docx-toolbar">
      <div class="toolbar-pill">
        <button class="tool-btn" @click="zoomOut" :disabled="zoom <= 50" title="缩小 (-)" aria-label="缩小">
          <ZoomOut class="tool-icon" />
        </button>

        <button class="zoom-display" @click="resetZoom" title="点击恢复 100%" aria-label="恢复原始大小">{{ zoom }}%</button>

        <button class="tool-btn" @click="zoomIn" :disabled="zoom >= 200" title="放大 (+)" aria-label="放大">
          <ZoomIn class="tool-icon" />
        </button>

        <div class="tool-divider"></div>

        <button class="tool-btn text-btn" @click="resetZoom" title="适应原尺寸 100%">
          <span>100%</span>
        </button>

        <button class="tool-btn text-btn" @click="fitWidth" title="适应页面宽度">
          <span>适宽</span>
        </button>
      </div>
    </div>

    <!-- Scrollable Document Viewport -->
    <div class="docx-viewport" ref="viewportRef">
      <div v-if="renderError" class="docx-error-card" role="alert">
        <div class="error-icon-box"><TriangleAlert class="error-icon" /></div>
        <div class="error-title">Word 文档解析失败</div>
        <div class="error-desc">{{ renderError }}</div>
      </div>
      <!--
        BUG FIX: `transform: scale()` does not affect layout size, so at zoom<100%
        the scroll container kept the full unscaled height and left a large blank
        area at the bottom (and at zoom>100% the content was clipped).
        We now reserve the scaled footprint with a spacer element.
      -->
      <div class="docx-scale-frame" :style="{ height: `${scaledHeight}px` }">
        <div 
          class="docx-canvas-wrapper" 
          :style="{ transform: `scale(${zoom / 100})`, transformOrigin: 'top left' }"
        >
          <div ref="docContainer" class="docx-target selectable-content"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { renderAsync } from 'docx-preview';
import { ZoomIn, ZoomOut, ScanLine, TriangleAlert, RefreshCw } from 'lucide-vue-next';

const props = defineProps({
  doc: {
    type: Object,
    required: true
  }
});

const docContainer = ref(null);
const viewportRef = ref(null);
const zoom = ref(100);
const naturalHeight = ref(0);
const renderError = ref('');

// Height the scaled content actually occupies, so the scrollbar is honest
const scaledHeight = computed(() => Math.round(naturalHeight.value * (zoom.value / 100)));

let resizeObserver = null;

function measure() {
  if (!docContainer.value) return;
  // docx-preview (with inWrapper) nests content as
  //   .docx-target > .docx-wrapper > section.docx
  // `.docx-target` is a plain block wrapper and reports 0 height, so we must
  // measure the innermost rendered node that actually has content.
  const inner =
    docContainer.value.querySelector('section.docx') ||
    docContainer.value.querySelector('.docx-wrapper') ||
    docContainer.value.firstElementChild;
  if (!inner) return;
  const h = inner.getBoundingClientRect().height || inner.scrollHeight;
  if (h > 0) naturalHeight.value = h;
}

async function renderDocx(buffer) {
  await nextTick();
  if (!docContainer.value) return;

  renderError.value = '';
  naturalHeight.value = 0;
  docContainer.value.innerHTML = '';
  try {
    await renderAsync(buffer, docContainer.value, null, {
      className: 'docx',
      inWrapper: true,
      ignoreWidth: false,
      ignoreHeight: false,
      ignoreFonts: false,
      breakPages: true,
      ignoreLastRenderedPageBreak: false,
      experimental: false,
      trimXml: true
    });
    await nextTick();
    measure();
  } catch (err) {
    console.error('Failed to render DOCX with docx-preview:', err);
    // Never inject the raw error message into innerHTML — it comes from the file
    renderError.value = err?.message || '未知解析错误';
  }
}

function zoomIn() {
  if (zoom.value < 200) {
    zoom.value = Math.min(200, zoom.value + 15);
  }
}

function zoomOut() {
  if (zoom.value > 50) {
    zoom.value = Math.max(50, zoom.value - 15);
  }
}

function resetZoom() {
  zoom.value = 100;
}

function fitWidth() {
  if (!viewportRef.value || !docContainer.value) return;
  const viewportWidth = viewportRef.value.clientWidth - 80;
  const inner =
    docContainer.value.querySelector('section.docx') ||
    docContainer.value.firstElementChild;
  const docWidth = inner?.getBoundingClientRect().width || 800;
  if (docWidth > 0) {
    const targetZoom = Math.round((viewportWidth / docWidth) * 100);
    zoom.value = Math.min(160, Math.max(60, targetZoom));
  }
}

onMounted(() => {
  if (docContainer.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => measure());
    resizeObserver.observe(docContainer.value);
  }
  // docx-preview renders asynchronously; re-measure once it has settled
  setTimeout(measure, 120);
  setTimeout(measure, 400);
});

onUnmounted(() => {
  if (resizeObserver) resizeObserver.disconnect();
});

watch(
  () => props.doc,
  (newDoc) => {
    if (newDoc && newDoc.buffer) {
      renderDocx(newDoc.buffer);
    }
  },
  { immediate: true }
);
</script>

<style scoped>
.docx-container {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 48px);
  background: #E2E8F0;
  position: relative;
  overflow: hidden;
}

.docx-toolbar {
  position: absolute;
  top: 14px;
  right: 20px;
  z-index: 50;
  display: flex;
  align-items: center;
}

.toolbar-pill {
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(255, 255, 255, 0.94);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(203, 213, 225, 0.9);
  padding: 4px 8px;
  border-radius: 20px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
}

.tool-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 6px;
  border-radius: 4px;
  color: #475569;
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
  font-size: 11px;
  font-weight: 600;
  padding: 2px 7px;
}

.tool-icon {
  width: 14px;
  height: 14px;
}

.zoom-display {
  font-family: var(--font-mono);
  font-size: 11.5px;
  font-weight: 600;
  color: #1E293B;
  min-width: 40px;
  text-align: center;
  cursor: pointer;
}

.tool-divider {
  width: 1px;
  height: 14px;
  background: #CBD5E1;
  margin: 0 3px;
}

.docx-viewport {
  flex: 1;
  overflow-y: auto;
  padding: 40px 20px 80px;
  display: flex;
  justify-content: center;
}

.docx-scale-frame {
  position: relative;
  width: 100%;
  display: flex;
  justify-content: center;
}

.docx-canvas-wrapper {
  transition: transform 0.15s ease-out;
  display: flex;
  justify-content: center;
  transform-origin: top left;
}

.zoom-display {
  background: none;
  border: none;
}

.zoom-display:focus-visible {
  outline: 2px solid #2563EB;
  outline-offset: 1px;
  border-radius: 3px;
}

.docx-error-card {
  background: #FFFFFF;
  border: 1px solid #FCA5A5;
  border-radius: 12px;
  padding: 28px 36px;
  text-align: center;
  color: #991B1B;
  max-width: 420px;
  box-shadow: 0 12px 30px -10px rgba(220, 38, 38, 0.2);
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

.docx-target {
  min-width: 794px; /* Standard A4 width in px at 96 DPI */
  max-width: 900px;
}

:deep(.render-error) {
  background: #FEF2F2;
  color: #991B1B;
  padding: 20px;
  border-radius: 8px;
  border: 1px solid #FCA5A5;
  font-size: 13px;
}
</style>
