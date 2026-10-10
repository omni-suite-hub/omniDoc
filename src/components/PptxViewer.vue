<template>
  <div class="pptx-container" :class="{ 'fullscreen-mode': isFullscreen }">
    <!-- Left Filmstrip / Thumbnails Sidebar -->
    <div 
      v-if="!isFullscreen" 
      class="filmstrip-sidebar" 
      :style="{ width: `${sidebarWidth}px` }"
    >
      <div class="sidebar-header">
        <span class="sidebar-title">幻灯片 ({{ slides.length }} 页)</span>
      </div>

      <div class="thumbnails-list">
        <div
          v-for="(slide, idx) in slides"
          :key="idx"
          class="thumb-item"
          :class="{ active: currentSlideIndex === idx }"
          @click="goToSlide(idx)"
        >
          <div class="thumb-index">{{ idx + 1 }}</div>
          <div 
            class="thumb-card" 
            :style="{ 
              backgroundColor: slide.background || '#FFFFFF',
              borderColor: currentSlideIndex === idx ? '#EA580C' : (slide.isDark ? '#334155' : '#CBD5E1')
            }"
          >
            <div class="thumb-inner">
              <div 
                class="thumb-slide-title" 
                :style="{ color: slide.isDark ? '#F8FAFC' : '#0F172A' }"
              >
                {{ slide.title || `第 ${idx + 1} 页` }}
              </div>
              <div class="thumb-slide-lines">
                <span 
                  class="mock-line" 
                  :style="{ backgroundColor: slide.isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.12)' }"
                ></span>
                <span 
                  class="mock-line short" 
                  :style="{ backgroundColor: slide.isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)' }"
                ></span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Resizable Drag Handle on Right Border -->
      <div 
        class="filmstrip-resizer" 
        @mousedown="startResizeSidebar"
        title="拖拽调节侧边栏宽度"
      ></div>
    </div>

    <!-- Main Stage Viewport -->
    <div class="stage-viewport" ref="stageViewportRef" @wheel="handleWheel">
      <!-- Fullscreen Exit Floating Button -->
<button v-if="isFullscreen" class="exit-fullscreen-btn" @click="toggleFullscreen">
        <X class="exit-icon" />
        <span>退出全屏</span>
        <kbd class="exit-kbd">ESC</kbd>
      </button>

      <!-- Parse Error State -->
      <div v-if="parseError" class="pptx-error-card" role="alert">
        <div class="error-icon-box"><TriangleAlert class="error-icon" /></div>
        <div class="error-title">无法预览此演示文稿</div>
        <div class="error-desc">{{ parseError }}</div>
      </div>

      <!-- Active Slide Stage Container (Scales fixed 1280x720 canvas) -->
      <div 
        v-else-if="activeSlide" 
        class="slide-stage-outer"
        :style="{
          width: `${Math.round(baseWidth * scale)}px`,
          height: `${Math.round(baseHeight * scale)}px`
        }"
      >
        <div 
          class="slide-canvas-card" 
          :style="{ 
            width: `${baseWidth}px`,
            height: `${baseHeight}px`,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            backgroundColor: activeSlide.background || '#FFFFFF'
          }"
        >
          <!-- Elements inside the slide -->
          <div 
            v-for="(elem, eIdx) in activeSlide.elements" 
            :key="eIdx"
            class="slide-element"
            :style="getElementStyle(elem)"
          >
            <!-- Case 1: Image / SVG -->
            <img 
              v-if="elem.type === 'image'" 
              :src="elem.src" 
              class="slide-img" 
              draggable="false"
              alt=""
            />

            <!-- Case 1b: Hairline divider / decorative bar.
                 These shapes are ~1px tall in the source deck; rendering them
                 at their declared (stretched) height produced huge slabs. -->
            <div
              v-else-if="elem.type === 'bar'"
              class="slide-bar"
            ></div>

            <!-- Case 2: Text Box -->
            <div 
              v-else-if="elem.paragraphs && elem.paragraphs.length > 0" 
              class="slide-textbox"
              :style="textBoxStyle(elem)"
            >
              <div 
                v-for="(p, pIdx) in elem.paragraphs" 
                :key="pIdx"
                class="slide-para"
                :class="{ 'is-bullet': p.isBullet && !p.bulletDisabled }"
                :style="paraStyle(p, elem)"
              >
                <span 
                  v-for="(r, rIdx) in p.runs" 
                  :key="rIdx"
                  class="slide-run"
                  :style="runStyle(r, { ...p, ...paraStyle(p, elem) })"
                >{{ r.text }}</span>
              </div>
            </div>
          </div>

          <div v-if="activeSlide.elements.length === 0" class="empty-slide-placeholder">
            <h3 :style="{ color: activeSlide.isDark ? '#F8FAFC' : '#0F172A' }">{{ activeSlide.title }}</h3>
            <p :style="{ color: activeSlide.isDark ? '#94A3B8' : '#64748B' }">（空幻灯片页面）</p>
          </div>
        </div>
      </div>

      <!-- Floating Slide Controller Pill -->
      <div class="floating-controller">
        <button 
          class="ctrl-btn" 
          :disabled="currentSlideIndex === 0"
          @click="prevSlide"
          title="上一页 (← / PageUp)"
        >
<ChevronLeft class="ctrl-icon" />
          <span class="ctrl-text">上一页</span>
        </button>

        <div class="slide-counter-badge">
          <span class="cur-num">{{ currentSlideIndex + 1 }}</span>
          <span class="slash">/</span>
          <span class="total-num">{{ slides.length }}</span>
        </div>

        <button 
          class="ctrl-btn" 
          :disabled="currentSlideIndex >= slides.length - 1"
          @click="nextSlide"
          title="下一页 (→ / Space / PageDown)"
        >
<span class="ctrl-text">下一页</span>
          <ChevronRight class="ctrl-icon" />
        </button>

        <div class="ctrl-divider"></div>

        <button class="ctrl-btn fullscreen" @click="toggleFullscreen" title="全屏放映预览 (F)">
<Minimize v-if="isFullscreen" class="ctrl-icon" />
          <Maximize v-else class="ctrl-icon" />
          <span class="ctrl-text">{{ isFullscreen ? '窗口化' : '放映' }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { parsePptx } from '../utils/pptxParser.js';
import { ChevronLeft, ChevronRight, Maximize, Minimize, X, TriangleAlert } from 'lucide-vue-next';

const props = defineProps({
  doc: {
    type: Object,
    required: true
  }
});

const slides = ref([]);
const parseError = ref('');
const currentSlideIndex = ref(0);
const isFullscreen = ref(false);
const sidebarWidth = ref(210);
const isResizingSidebar = ref(false);

const stageViewportRef = ref(null);
const viewportWidth = ref(1000);
const viewportHeight = ref(600);

let resizeObserver = null;

const activeSlide = computed(() => {
  return slides.value[currentSlideIndex.value] || null;
});

const baseWidth = ref(1280);
const baseHeight = computed(() => {
  if (activeSlide.value && activeSlide.value.aspectRatio) {
    return Math.round(1280 / activeSlide.value.aspectRatio);
  }
  return 720;
});

const scale = computed(() => {
  // ResizeObserver's contentRect EXCLUDES padding, so the usable box is
  // already exactly what we get — subtracting the padding again (the earlier
  // code did `- 64` here) shrank the slide by 32px and left a dead strip.
  const maxW = Math.max(200, viewportWidth.value);
  const maxH = Math.max(150, viewportHeight.value);
  const scaleX = maxW / baseWidth.value;
  const scaleY = maxH / baseHeight.value;
  return Math.max(0.15, Math.min(2.0, Math.min(scaleX, scaleY)));
});

/**
 * Wheel over the slide area flips pages — the slide always fits, so there is
 * nothing to scroll. Native scrolling still works if the window is tiny.
 */
function handleWheel(e) {
  if (slides.value.length <= 1) return;
  const stage = stageViewportRef.value;
  if (!stage) return;

  const hasScrollableContent = stage.scrollHeight > stage.clientHeight + 2;
  if (!hasScrollableContent) {
    e.preventDefault();
    if (e.deltaY > 0) nextSlide();
    else prevSlide();
  }
}

/**
 * Inline style for a single text run.
 *
 * BUG FIX: the old template hard-coded `1.333` as the pt→px factor and always
 * emitted 700/400. Two problems:
 *  - The slide canvas is a fixed 1280-unit design space, so scaling must be
 *    relative to that baseline, not the browser default (16px = 12pt).
 *  - Real decks use 600/700 for semibold; snapping everything to 700 made
 *    bold text look heavier than the original.
 *
 * PowerPoint's default body size is 18pt on a 960pt-wide design grid; our
 * canvas is 1280 units wide, so the factor is 1280/960. The previous 1.333
 * (i.e. 960/720) rendered body text noticeably too large relative to titles.
 */
const PT_TO_PX = 1280 / 960;

function runStyle(run, para) {
  const sizePt = run.sizePt || 18;
  // <a:normAutofit fontScale="..."/> shrinks text to fit its box in PowerPoint.
  const scale = para?.fontScale || 1;
  const fontSize = Math.max(6, Math.round(sizePt * PT_TO_PX * scale));

  const weight = run.bold ? (run.boldWeight || 700) : 400;
  const isTitle = sizePt >= 28;

  // lnSpcReduction compounds with the paragraph's own line spacing
  const baseLh = para?.lineHeight || (isTitle ? 1.25 : 1.5);
  const lh = Math.max(0.75, baseLh * (1 - (para?.lnSpcReduction || 0)));
  // Build the font stack from the deck's own typefaces. The East-Asian face
  // must come first so CJK glyphs do not fall through to a Latin fallback.
  const stack = [];
  const add = (f) => {
    if (f && f !== '+mj-lt' && f !== '+mn-lt' && !stack.includes(f)) stack.push(`"${f}"`);
  };
  add(run.eaFont);
  add(run.latinFont);
  if (!stack.length) {
    add('PingFang SC');
    add('Microsoft YaHei');
    add('-apple-system');
    add('Helvetica Neue');
  } else {
    // Always keep a CJK fallback available
    add('PingFang SC');
    add('Microsoft YaHei');
    add('-apple-system');
    add('Helvetica Neue');
  }

  return {
    fontWeight: String(weight),
    fontStyle: run.italic ? 'italic' : 'normal',
    textDecoration: run.underline ? 'underline' : 'none',
    fontSize: `${fontSize}px`,
    color: run.color || (activeSlide.value?.isDark ? '#F8FAFC' : '#0F172A'),
    lineHeight: lh,
    letterSpacing: isTitle ? '-0.015em' : '0',
    fontFamily: stack.join(', ')
  };
}

/**
 * Text box container style: applies the deck's real insets and wrap mode.
 * `wrap="none"` means PowerPoint does not wrap at all — we honour it so
 * single-line labels stay on one line, which is what the original looks like.
 */
function textBoxStyle(elem) {
  const base = insetStyle(elem);
  const nowrap = elem.wrap === 'none';
  return {
    ...base,
    whiteSpace: nowrap ? 'nowrap' : 'pre-wrap',
    wordBreak: nowrap ? 'normal' : 'break-word',
    // Honour <a:bodyPr anchor="..."/> (vertical alignment inside the box)
    justifyContent: elem.anchor || 'flex-start'
  };
}

/** Paragraph-level style: alignment + the fontScale/lnSpcReduction from autofit. */
function paraStyle(p, elem) {
  return {
    textAlign: p.align || 'left',
    fontScale: elem?.fontScale || 1,
    lnSpcReduction: elem?.lnSpcReduction || 0
  };
}

/**
 * Convert EMU box insets to pixels for the current canvas scale.
 * PowerPoint's defaults are 0.1" left/right and 0.05" top/bottom.
 */
function insetStyle(elem) {
  const bw = baseWidth.value;
  const i = elem.insets;
  if (!i) return {};
  // 914400 EMU per inch; the canvas maps 960pt design width -> baseWidth px
  const emuToPx = bw / (960 * 12700);
  return {
    paddingLeft: `${Math.max(0, (i.l || 0) * emuToPx)}px`,
    paddingRight: `${Math.max(0, (i.r || 0) * emuToPx)}px`,
    paddingTop: `${Math.max(0, (i.t || 0) * emuToPx)}px`,
    paddingBottom: `${Math.max(0, (i.b || 0) * emuToPx)}px`
  };
}

function getElementStyle(elem) {
  const bw = baseWidth.value;
  const bh = baseHeight.value;
  const style = {
    position: 'absolute',
    left: `${Math.round(elem.x * bw)}px`,
    top: `${Math.round(elem.y * bh)}px`,
    width: `${Math.round(elem.w * bw)}px`,
    height: elem.h ? `${Math.round(elem.h * bh)}px` : 'auto',
    boxSizing: 'border-box'
  };

  // Hairline dividers: draw as a rule of the declared thickness instead of a
  // stretched box, otherwise a ~1px shape becomes a giant grey slab.
  if (elem.type === 'bar') {
    style.height = `${Math.max(1, Math.round((elem.barThickness || 0.002) * bh))}px`;
    style.backgroundColor = elem.shapeFill || elem.shapeBorder || '#D8D7D0';
    style.border = 'none';
    style.overflow = 'visible';
    style.zIndex = 100 + (elem.zIndex || 0);
    return style;
  }

  if (elem.shapeFill) {
    style.backgroundColor = elem.shapeFill;
  }
  if (elem.shapeBorder) {
    style.border = `1px solid ${elem.shapeBorder}`;
  }

  // BUG FIX (stacking): we let text boxes grow past their declared height so
  // long copy is never clipped. PowerPoint instead relies on paint order, so
  // a shape that follows a text box in <p:spTree> is painted over it — and our
  // grown box ended up underneath decorative bands and got hidden.
  // Text therefore always paints above decorations, while preserving the
  // authored order among decorations themselves.
  const hasText = elem.paragraphs && elem.paragraphs.length > 0;
  style.zIndex = hasText ? 10000 + (elem.zIndex || 0) : (elem.zIndex || 0);

  // Text boxes must not clip their own content.
  if (hasText) {
    style.height = 'auto';
    style.minHeight = elem.h ? `${Math.round(elem.h * bh)}px` : 'auto';
    style.overflow = 'visible';
  } else {
    style.overflow = 'hidden';
  }

  return style;
}

let detachResize = null;

function startResizeSidebar(e) {
  e.preventDefault();
  isResizingSidebar.value = true;
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
  const startX = e.clientX;
  const startW = sidebarWidth.value;

  function onMouseMove(ev) {
    if (!isResizingSidebar.value) return;
    const diff = ev.clientX - startX;
    sidebarWidth.value = Math.max(150, Math.min(420, startW + diff));
  }

  function onMouseUp() {
    isResizingSidebar.value = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    detach();
  }

  function detach() {
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
    window.removeEventListener('blur', onMouseUp);
    detachResize = null;
  }

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('blur', onMouseUp);
  detachResize = detach;
}

async function loadPptxBuffer(buffer) {
  parseError.value = '';
  try {
    const res = await parsePptx(buffer);
    slides.value = res.slides;
    currentSlideIndex.value = 0;
    // Don't leave the user staring at an empty stage
    if (!res.slides || res.slides.length === 0) {
      parseError.value = '该演示文稿中没有可解析的幻灯片，可能已损坏或使用了不受支持的格式。';
    }
  } catch (err) {
    console.error('Failed to parse PPTX:', err);
    parseError.value = err?.message || 'PPT 解析失败，文件可能已损坏。';
  }
}

function prevSlide() {
  if (currentSlideIndex.value > 0) {
    currentSlideIndex.value--;
  }
}

function nextSlide() {
  if (currentSlideIndex.value < slides.value.length - 1) {
    currentSlideIndex.value++;
  }
}

function goToSlide(idx) {
  currentSlideIndex.value = idx;
}

function toggleFullscreen() {
  isFullscreen.value = !isFullscreen.value;
}

function handleKeyDown(e) {
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
    e.preventDefault();
    nextSlide();
  } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
    e.preventDefault();
    prevSlide();
  } else if (e.key === 'Escape') {
    if (isFullscreen.value) {
      isFullscreen.value = false;
    }
  } else if (e.key.toLowerCase() === 'f' && !e.metaKey && !e.ctrlKey) {
    toggleFullscreen();
  }
}

watch(
  () => props.doc,
  (newDoc) => {
    if (newDoc && newDoc.buffer) {
      loadPptxBuffer(newDoc.buffer);
    }
  },
  { immediate: true }
);

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);

  if (stageViewportRef.value) {
    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect) {
          viewportWidth.value = entry.contentRect.width;
          viewportHeight.value = entry.contentRect.height;
        }
      }
    });
    resizeObserver.observe(stageViewportRef.value);
  }
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
  if (resizeObserver) {
    resizeObserver.disconnect();
  }
  if (typeof detachResize === 'function') detachResize();
});
</script>

<style scoped>
.pptx-container {
  display: flex;
  height: 100%;
  min-height: 0;
  background: #F1F5F9;
  user-select: none;
  -webkit-user-select: none;
  overflow: hidden;
  position: relative;
}

.pptx-container.fullscreen-mode {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 1000;
  background: #090D16;
}

/* Left Filmstrip Sidebar */
.filmstrip-sidebar {
  background: #FFFFFF;
  border-right: 1px solid #E2E8F0;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  position: relative;
}

.sidebar-header {
  height: 42px;
  padding: 0 14px;
  display: flex;
  align-items: center;
  border-bottom: 1px solid #E2E8F0;
  background: #F8FAFC;
}

.sidebar-title {
  font-size: 12px;
  font-weight: 600;
  color: #64748B;
}

.thumbnails-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.thumb-item {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.thumb-index {
  font-size: 11px;
  font-weight: 600;
  color: #94A3B8;
  width: 18px;
  text-align: right;
  flex-shrink: 0;
}

.thumb-card {
  flex: 1;
  aspect-ratio: 16/9;
  background: #FFFFFF;
  border: 1.5px solid #CBD5E1;
  border-radius: 6px;
  padding: 6px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
  overflow: hidden;
}

.thumb-item:hover .thumb-card {
  transform: scale(1.02);
}

.thumb-item.active .thumb-card {
  border-color: #EA580C !important;
  box-shadow: 0 0 0 2px rgba(234, 88, 12, 0.35);
  transform: scale(1.03);
}

.thumb-inner {
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.thumb-slide-title {
  font-size: 8.5px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.2;
}

.thumb-slide-lines {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.mock-line {
  height: 2px;
  border-radius: 1px;
  width: 80%;
}

.mock-line.short {
  width: 50%;
}

/* Sidebar Resizer Handle */
.filmstrip-resizer {
  position: absolute;
  top: 0;
  right: -3px;
  width: 6px;
  height: 100%;
  cursor: col-resize;
  z-index: 20;
  transition: background 0.15s;
}

.filmstrip-resizer:hover {
  background: #CBD5E1;
}

/* Stage Viewport */
.stage-viewport {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 16px;
  position: relative;
  /* BUG FIX: `overflow: hidden` made the wheel a no-op over the slide.
     Auto now lets the wheel scroll both axes. */
  overflow: auto;
  overscroll-behavior: contain;
}

.exit-fullscreen-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  background: rgba(255, 255, 255, 0.14);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.18);
  color: #FFFFFF;
  font-size: 12px;
  font-weight: 500;
  padding: 7px 13px;
  border-radius: 20px;
  z-index: 100;
  transition: background 0.15s;
}

.exit-icon {
  width: 14px;
  height: 14px;
}

.exit-kbd {
  font-family: var(--font-mono);
  font-size: 9.5px;
  padding: 1px 5px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.16);
  letter-spacing: 0.4px;
}

.pptx-error-card {
  background: #FFFFFF;
  border: 1px solid #FCA5A5;
  border-radius: 12px;
  padding: 30px 38px;
  text-align: center;
  color: #991B1B;
  max-width: 430px;
  box-shadow: 0 12px 30px -10px rgba(220, 38, 38, 0.18);
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
}

.exit-fullscreen-btn:hover {
  background: rgba(255, 255, 255, 0.25);
}

/* Scaled Stage Container */
.slide-stage-outer {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.slide-canvas-card {
  position: absolute;
  top: 0;
  left: 0;
  border-radius: 8px;
  box-shadow: 0 15px 35px -5px rgba(0, 0, 0, 0.15), 0 5px 15px rgba(0, 0, 0, 0.08);
  overflow: hidden;
  will-change: transform;
}

.fullscreen-mode .slide-canvas-card {
  box-shadow: 0 25px 60px rgba(0, 0, 0, 0.6);
}

.slide-element {
  position: absolute;
}

.slide-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
}

.slide-textbox {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  /* `wrap="none"` boxes must be allowed to bleed slightly (PowerPoint does the
     same), but never past the slide itself. */
  max-width: 100%;
}

.slide-bar {
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.slide-para {
  margin-bottom: 0.35em;
  line-height: 1.55;
}

.slide-para:last-child {
  margin-bottom: 0;
}

/* PowerPoint bullets are real glyphs, not list markers — the parser already
   keeps the "•" in the text, so only add the hanging indent. */
.slide-para.is-bullet {
  padding-left: 1.15em;
  text-indent: -1.15em;
}

.slide-run {
  /* BUG FIX: the previous stack listed Latin faces first and only reached
     "PingFang SC" at the very end. On macOS the Latin faces always resolve, so
     CJK glyphs fell through to a mismatched fallback and the mixed
     Chinese/Latin lines looked visibly out of place.
     Putting the CJK faces first makes the browser pick per-glyph, which is what
     PowerPoint/Keynote do. */
  font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei",
               "Heiti SC", -apple-system, BlinkMacSystemFont,
               "Helvetica Neue", "Segoe UI", sans-serif;
  /* Keep CJK punctuation from collapsing and avoid runaway spacing */
  text-spacing-trim: normal;
  word-break: normal;
  overflow-wrap: break-word;
}

.empty-slide-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
}

/* Floating Slide Controller Pill */
.floating-controller {
  position: absolute;
  bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.94);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(226, 232, 240, 0.9);
  padding: 6px 12px;
  border-radius: 30px;
  box-shadow: 0 8px 24px -4px rgba(0, 0, 0, 0.1), 0 2px 6px rgba(0, 0, 0, 0.04);
  z-index: 50;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.fullscreen-mode .floating-controller {
  background: rgba(30, 41, 59, 0.85);
  border-color: rgba(255, 255, 255, 0.1);
  color: #FFFFFF;
}

.ctrl-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  color: #334155;
  transition: all 0.12s;
  background: transparent;
  border: none;
  cursor: pointer;
}

.fullscreen-mode .ctrl-btn {
  color: #F1F5F9;
}

.ctrl-btn:hover:not(:disabled) {
  background: #F1F5F9;
  color: #EA580C;
}

.fullscreen-mode .ctrl-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.15);
  color: #FFFFFF;
}

.ctrl-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.ctrl-btn:focus-visible,
.exit-fullscreen-btn:focus-visible {
  outline: 2px solid #2563EB;
  outline-offset: 2px;
}

.ctrl-icon {
  width: 14px;
  height: 14px;
}

.slide-counter-badge {
  display: flex;
  align-items: center;
  gap: 3px;
  font-family: var(--font-mono, monospace);
  font-size: 12.5px;
  font-weight: 700;
  padding: 0 6px;
  color: #0F172A;
}

.fullscreen-mode .slide-counter-badge {
  color: #FFFFFF;
}

.slide-counter-badge .slash {
  color: #94A3B8;
}

.ctrl-divider {
  width: 1px;
  height: 16px;
  background: #CBD5E1;
  margin: 0 2px;
}

.fullscreen-mode .ctrl-divider {
  background: rgba(255, 255, 255, 0.2);
}
</style>
