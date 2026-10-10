<template>
  <div class="spreadsheet-container" @mouseup="handleMouseUp">
    <!-- Top Control Bar: Sheet Tabs & Quick Search -->
    <div class="sheet-toolbar">
      <!-- Sheet Tabs -->
      <div class="sheet-tabs">
        <button
          v-for="(sheetName, idx) in sheetNames"
          :key="sheetName"
          class="sheet-tab"
          :class="{ active: currentSheetIndex === idx }"
          @click="selectSheet(idx)"
        >
          <Table class="sheet-tab-icon" />
          <span class="sheet-tab-name">{{ sheetName }}</span>
        </button>
      </div>

      <!-- Search Box & Actions -->
      <div class="toolbar-actions">
        <div class="search-input-wrapper">
          <Search class="search-icon" />
          <input
            v-model="searchQuery"
            type="text"
            class="search-input"
            placeholder="搜索表格内容..."
          />
          <span v-if="searchMatchesCount > 0" class="match-count-badge">
            {{ searchMatchesCount }} 处匹配
          </span>
        </div>

        <button 
          v-if="hasSelection" 
          class="copy-sel-btn" 
          @click="copySelectedCells" 
          :title="copied ? '已复制！' : '复制选区内容 (Cmd+C)'"
        >
          <Check v-if="copied" class="copy-icon" />
          <Copy v-else class="copy-icon" />
          <span>{{ copied ? '已复制' : '复制选区' }}</span>
        </button>
      </div>
    </div>

    <!-- Main Grid Viewport -->
    <div v-if="parseError" class="sheet-error-card" role="alert">
      <div class="error-icon-box"><TriangleAlert class="error-icon" /></div>
      <div class="error-title">无法预览此表格</div>
      <div class="error-desc">{{ parseError }}</div>
    </div>

    <div v-else 
      class="grid-viewport" 
      ref="gridRef"
      @mousemove="handleGridMouseMove"
    >
      <table class="excel-table">
        <thead>
          <tr>
            <!-- Corner Cell: click clears the selection -->
            <th class="corner-header" @click="handleCornerClick" title="清除选择">
              #
            </th>
            <!-- Column Letters (A, B, C...) -->
            <th
              v-for="c in colCount"
              :key="c"
              class="col-header"
              :class="{ 'header-highlight': isColSelected(c - 1) }"
              @click="handleColHeaderClick(c - 1, $event)"
              :title="`点击选中整列 ${getColLetter(c - 1)}`"
            >
              {{ getColLetter(c - 1) }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rowCount" :key="r">
            <!-- Row Numbers (1, 2, 3...) -->
            <th 
              class="row-header"
              :class="{ 'header-highlight': isRowSelected(r - 1) }"
              @click="handleRowHeaderClick(r - 1, $event)"
              :title="`点击选中整行 ${r}`"
            >
              {{ r }}
            </th>
            <!-- Data Cells -->
            <td
              v-for="c in colCount"
              :key="c"
              class="data-cell"
              :data-r="r - 1"
              :data-c="c - 1"
              :class="{
                'cell-selected': isCellSelected(r - 1, c - 1),
                'cell-anchor': isCellAnchor(r - 1, c - 1),
                'cell-match': isCellSearchMatch(r - 1, c - 1),
                'cell-numeric': isCellNumeric(r - 1, c - 1)
              }"
              @mousedown="handleCellMouseDown(r - 1, c - 1, $event)"
              @dblclick="handleCellDoubleClick(r - 1)"
            >
              {{ getCellDisplayValue(r - 1, c - 1) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Live Statistics Bar (实时求和算盘) -->
    <div class="stats-bar">
      <div class="stats-left">
        <span class="grid-info-tag">当前工作表: {{ activeSheetName }} ({{ rowCount }}行 × {{ colCount }}列)</span>
        <span v-if="hasSelection" class="selection-tag">
          <Crosshair class="selection-tag-icon" />
          <span>{{ activeCellLabel }}</span>
          <span v-if="extraRects.length" class="selection-extra">+{{ extraRects.length }} 块</span>
        </span>
      </div>

      <!-- Live Selection Math Calculation -->
      <div v-if="selectionStats" class="stats-cards">
        <div class="stat-pill count">
          <span class="stat-label">计数</span>
          <span class="stat-val">{{ selectionStats.count }}</span>
        </div>

        <div v-if="selectionStats.numCount > 0" class="stat-pill sum">
          <span class="stat-label">求和 (SUM)</span>
          <span class="stat-val highlight">{{ formatNumber(selectionStats.sum) }}</span>
        </div>

        <div v-if="selectionStats.numCount > 0" class="stat-pill avg">
          <span class="stat-label">平均值 (AVG)</span>
          <span class="stat-val">{{ formatNumber(selectionStats.avg) }}</span>
        </div>

        <div v-if="selectionStats.numCount > 1" class="stat-pill min-max">
          <span class="stat-label">极值</span>
          <span class="stat-val min">Min: {{ formatNumber(selectionStats.min) }}</span>
          <span class="stat-val max">Max: {{ formatNumber(selectionStats.max) }}</span>
        </div>
      </div>

      <div v-else class="stats-hint">
        <Lightbulb class="hint-icon" />
        <span>按住鼠标在表格中拖拽框选多个单元格，可实时自动计算求和、平均值与极值</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import * as XLSX from 'xlsx';
import { Search, Copy, Check, Table, Lightbulb, TriangleAlert, Crosshair } from 'lucide-vue-next';

const props = defineProps({
  doc: {
    type: Object,
    default: () => ({})
  }
});

const emit = defineEmits(['stats-updated']);

const workbook = ref(null);
const sheetNames = ref([]);
const currentSheetIndex = ref(0);
const rawSheetData = ref([]);
const searchQuery = ref('');
const copied = ref(false);
const parseError = ref('');
const gridRef = ref(null);

// ---------- Selection state ----------
//
// BUG FIX: selection relied on each cell's @mouseenter. Browsers only fire
// mouseenter when the pointer actually enters an element, so a fast flick
// (one mousemove covering many rows) only ever registered the last cell —
// dragging quickly selected 1 cell instead of the whole range.
// We now resolve the cell under the cursor from `mousemove` coordinates via
// elementFromPoint, so every intermediate cell is registered regardless of
// pointer speed.
const isMouseDown = ref(false);
const selAnchor = ref(null);  // { r, c } where the drag started
const selEnd = ref(null);     // { r, c } current pointer cell

// Extra selected ranges for Cmd (⌘) multi-select: Array<{minR,maxR,minC,maxC}>
const extraRects = ref([]);
// Whole-row / whole-column mode toggled by clicking the headers
const wholeRows = ref([]);    // array of row indices
const wholeCols = ref([]);    // array of col indices

function makeRect(a, b) {
  return {
    minR: Math.min(a.r, b.r), maxR: Math.max(a.r, b.r),
    minC: Math.min(a.c, b.c), maxC: Math.max(a.c, b.c)
  };
}

const selBox = computed(() => {
  if (!selAnchor.value || !selEnd.value) return null;
  return makeRect(selAnchor.value, selEnd.value);
});

/** Every active rectangle, including Cmd-added ones. */
const allRects = computed(() => {
  const rects = [];
  if (selBox.value) rects.push(selBox.value);
  rects.push(...extraRects.value);
  for (const r of wholeRows.value) rects.push({ minR: r, maxR: r, minC: 0, maxC: Math.max(0, colCount.value - 1) });
  for (const c of wholeCols.value) rects.push({ minR: 0, maxR: Math.max(0, rowCount.value - 1), minC: c, maxC: c });
  return rects;
});

const hasSelection = computed(() => allRects.value.length > 0);

const activeCellLabel = computed(() => {
  const b = selBox.value;
  if (!b) return '';
  const p1 = `${getColLetter(b.minC)}${b.minR + 1}`;
  const p2 = `${getColLetter(b.maxC)}${b.maxR + 1}`;
  return p1 === p2 ? p1 : `${p1}:${p2}`;
});

const activeSheetName = computed(() => {
  return sheetNames.value[currentSheetIndex.value] || '';
});

const rowCount = computed(() => rawSheetData.value.length);
const colCount = computed(() => {
  if (rawSheetData.value.length === 0) return 0;
  return Math.max(...rawSheetData.value.map(row => row ? row.length : 0));
});

// Helper to convert index 0 -> 'A', 25 -> 'Z', 26 -> 'AA'
function getColLetter(idx) {
  let letter = '';
  while (idx >= 0) {
    letter = String.fromCharCode((idx % 26) + 65) + letter;
    idx = Math.floor(idx / 26) - 1;
  }
  return letter;
}

function getCellRawValue(r, c) {
  if (!rawSheetData.value[r]) return undefined;
  return rawSheetData.value[r][c];
}

function getCellDisplayValue(r, c) {
  const val = getCellRawValue(r, c);
  if (val === undefined || val === null) return '';
  return String(val);
}

function isCellNumeric(r, c) {
  const val = getCellRawValue(r, c);
  if (typeof val === 'number') return true;
  if (typeof val === 'string' && val.trim() !== '' && !isNaN(Number(val.replace(/,/g, '')))) return true;
  return false;
}

function inRect(rect, r, c) {
  return r >= rect.minR && r <= rect.maxR && c >= rect.minC && c <= rect.maxC;
}

function isCellSelected(r, c) {
  return allRects.value.some(rect => inRect(rect, r, c));
}

function isCellAnchor(r, c) {
  return !!selAnchor.value && selAnchor.value.r === r && selAnchor.value.c === c;
}

function isRowSelected(r) {
  return allRects.value.some(rect => r >= rect.minR && r <= rect.maxR);
}

function isColSelected(c) {
  return allRects.value.some(rect => c >= rect.minC && c <= rect.maxC);
}

// Search matching
const searchMatchesCount = computed(() => {
  if (!searchQuery.value.trim()) return 0;
  let count = 0;
  const q = searchQuery.value.trim().toLowerCase();
  for (let r = 0; r < rowCount.value; r++) {
    for (let c = 0; c < colCount.value; c++) {
      const v = getCellDisplayValue(r, c).toLowerCase();
      if (v.includes(q)) count++;
    }
  }
  return count;
});

function isCellSearchMatch(r, c) {
  if (!searchQuery.value.trim()) return false;
  const q = searchQuery.value.trim().toLowerCase();
  const v = getCellDisplayValue(r, c).toLowerCase();
  return v.includes(q);
}

// Real-time Calculation for Selected Cells (across every active rectangle)
const selectionStats = computed(() => {
  const rects = allRects.value;
  if (rects.length === 0) return null;

  let count = 0;
  const numbers = [];
  // A cell can belong to several Cmd-blocks; only tally it once
  const seen = new Set();

  for (const { minR, maxR, minC, maxC } of rects) {
    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        const key = r * 100000 + c;
        if (seen.has(key)) continue;
        seen.add(key);
        count++;
        const val = getCellRawValue(r, c);
        if (val !== undefined && val !== null) {
          if (typeof val === 'number') {
            numbers.push(val);
          } else if (typeof val === 'string') {
            // Remove comma separator and test
            const clean = val.replace(/,/g, '').trim();
            if (clean !== '' && !isNaN(Number(clean))) {
              numbers.push(Number(clean));
            }
          }
        }
      }
    }
  }

  if (count === 0) return null;

  const numCount = numbers.length;
  // NOTE: never use Math.max(...numbers) — spreading >~125k elements throws
  // "RangeError: Maximum call stack size exceeded" and kills the whole viewer.
  const sum = numbers.reduce((a, b) => a + b, 0);
  const avg = numCount > 0 ? sum / numCount : 0;
  let max = 0;
  let min = 0;
  if (numCount > 0) {
    max = numbers[0];
    min = numbers[0];
    for (let i = 1; i < numCount; i++) {
      const v = numbers[i];
      if (v > max) max = v;
      if (v < min) min = v;
    }
  }

  return {
    count,
    numCount,
    sum,
    avg,
    max,
    min
  };
});

function formatNumber(num) {
  if (num === undefined || num === null) return '0';
  if (Math.abs(num) >= 10000 || !Number.isInteger(num)) {
    return num.toLocaleString('zh-CN', { maximumFractionDigits: 2 });
  }
  return num.toString();
}

// ---------- Selection events ----------

/**
 * Resolve the cell under a viewport point.
 *
 * Two bugs this replaces:
 *  1. The original used per-cell @mouseenter. Browsers only fire mouseenter
 *     when the pointer truly enters an element, so a fast flick registered
 *     just the last cell — dragging quickly selected 1 cell instead of a range.
 *  2. A first attempt used elementFromPoint directly, which returns null when
 *     the pointer sits on a gap, a scrollbar, or outside the window entirely.
 *  3. A second attempt assumed a uniform cell width, but column widths follow
 *     the content (measured: 600 / 100 / 133 / 80 px), so the arithmetic gave
 *     the wrong column.
 *
 * The robust approach: hit-test the point, then walk up to the nearest element
 * carrying data-r/data-c. If the point misses entirely, fall back to a
 * binary search over the rendered rows.
 */
function cellAtPoint(x, y) {
  const grid = gridRef.value;
  if (!grid) return null;

  const direct = document.elementFromPoint(x, y);
  if (direct) {
    const cell = direct.closest('[data-r][data-c]');
    if (cell) {
      return { r: Number(cell.getAttribute('data-r')), c: Number(cell.getAttribute('data-c')) };
    }
  }

  // Missed (gaps, scrollbars, off-window): locate the row by vertical
  // position, then the column within that row.
  const rows = grid.querySelectorAll('tbody tr');
  if (rows.length === 0) return null;

  let lo = 0;
  let hi = rows.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const rb = rows[mid].getBoundingClientRect();
    if (y < rb.top) {
      hi = mid - 1;
    } else if (y > rb.bottom) {
      lo = mid + 1;
    } else {
      found = mid;
      break;
    }
  }
  if (found === -1) found = y < rows[0].getBoundingClientRect().top ? 0 : rows.length - 1;

  const rowCells = rows[found].querySelectorAll('[data-c]');
  if (rowCells.length === 0) return null;

  // Columns within the row are uniform, so a linear/binary scan is safe here
  let clo = 0;
  let chi = rowCells.length - 1;
  let cFound = 0;
  while (clo <= chi) {
    const cmid = (clo + chi) >> 1;
    const cb = rowCells[cmid].getBoundingClientRect();
    if (x < cb.left) {
      chi = cmid - 1;
    } else if (x > cb.right) {
      clo = cmid + 1;
    } else {
      cFound = cmid;
      break;
    }
  }
  if (x < rowCells[0].getBoundingClientRect().left) cFound = 0;
  else if (x > rowCells[rowCells.length - 1].getBoundingClientRect().right) {
    cFound = rowCells.length - 1;
  }

  return { r: found, c: Number(rowCells[cFound].getAttribute('data-c')) };
}

function clearSelection() {
  selAnchor.value = null;
  selEnd.value = null;
  extraRects.value = [];
  wholeRows.value = [];
  wholeCols.value = [];
}

function handleCellMouseDown(r, c, e) {
  if (e.button !== 0) return; // Left button only
  e.preventDefault();

  const mod = e.metaKey || e.ctrlKey;

  if (e.shiftKey && selAnchor.value) {
    // Shift extends from the existing anchor
    selEnd.value = { r, c };
    extraRects.value = [];
    return;
  }

  if (mod) {
    // Cmd/Ctrl toggles an extra block without losing the others
    const rect = makeRect({ r, c }, { r, c });
    const idx = extraRects.value.findIndex(x => x.minR === rect.minR && x.minC === rect.minC);
    if (idx !== -1) {
      extraRects.value = extraRects.value.filter((_, i) => i !== idx);
    } else {
      extraRects.value = [...extraRects.value, rect];
    }
    selAnchor.value = { r, c };
    selEnd.value = { r, c };
    return;
  }

  // Plain click starts a fresh drag
  isMouseDown.value = true;
  wholeRows.value = [];
  wholeCols.value = [];
  extraRects.value = [];
  selAnchor.value = { r, c };
  selEnd.value = { r, c };
}

/**
 * Core fix: track the pointer on mousemove instead of relying on per-cell
 * mouseenter, so a fast flick still walks every intermediate cell.
 *
 * Also auto-scrolls when the pointer approaches an edge, so a sheet wider or
 * taller than the window can be dragged beyond the visible area.
 */
let autoScrollRaf = null;
let autoScrollDx = 0;
let autoScrollDy = 0;

function stopAutoScroll() {
  if (autoScrollRaf) cancelAnimationFrame(autoScrollRaf);
  autoScrollRaf = null;
  autoScrollDx = 0;
  autoScrollDy = 0;
}

function runAutoScroll() {
  const vp = gridRef.value;
  if (!vp || (!autoScrollDx && !autoScrollDy)) {
    stopAutoScroll();
    return;
  }
  vp.scrollLeft += autoScrollDx;
  vp.scrollTop += autoScrollDy;
  // The grid just moved under a stationary pointer, so re-resolve the cell
  updateSelectionFromEvent(lastPointer.x, lastPointer.y);
  autoScrollRaf = requestAnimationFrame(runAutoScroll);
}

const lastPointer = { x: 0, y: 0 };

function updateSelectionFromEvent(x, y) {
  const hit = cellAtPoint(x, y);
  if (hit) selEnd.value = hit;
}

function handleGridMouseMove(e) {
  lastPointer.x = e.clientX;
  lastPointer.y = e.clientY;

  if (!isMouseDown.value) return;
  updateSelectionFromEvent(e.clientX, e.clientY);

  // Edge auto-scroll
  const vp = gridRef.value;
  if (!vp) return;
  const rect = vp.getBoundingClientRect();
  const EDGE = 40;
  const speed = 14;

  autoScrollDx = e.clientX < rect.left + EDGE
    ? -speed
    : e.clientX > rect.right - EDGE ? speed : 0;
  autoScrollDy = e.clientY < rect.top + EDGE
    ? -speed
    : e.clientY > rect.bottom - EDGE ? speed : 0;

  if (autoScrollDx || autoScrollDy) {
    if (!autoScrollRaf) autoScrollRaf = requestAnimationFrame(runAutoScroll);
  } else {
    stopAutoScroll();
  }
}

/** Double-click selects the whole row (Excel behaviour). */
function handleCellDoubleClick(r) {
  wholeRows.value = [r];
  wholeCols.value = [];
  extraRects.value = [];
  selAnchor.value = { r, c: 0 };
  selEnd.value = { r, c: Math.max(0, colCount.value - 1) };
}

function handleRowHeaderClick(r, e) {
  const mod = e.metaKey || e.ctrlKey;
  if (!mod) {
    wholeCols.value = [];
    extraRects.value = [];
    selAnchor.value = { r, c: 0 };
    selEnd.value = { r, c: Math.max(0, colCount.value - 1) };
  }
  if (wholeRows.value.includes(r) && mod) {
    wholeRows.value = wholeRows.value.filter(x => x !== r);
  } else if (!wholeRows.value.includes(r)) {
    wholeRows.value = [...wholeRows.value, r];
  }
}

function handleColHeaderClick(c, e) {
  const mod = e.metaKey || e.ctrlKey;
  if (!mod) {
    wholeRows.value = [];
    extraRects.value = [];
    selAnchor.value = { r: 0, c };
    selEnd.value = { r: Math.max(0, rowCount.value - 1), c };
  }
  if (wholeCols.value.includes(c) && mod) {
    wholeCols.value = wholeCols.value.filter(x => x !== c);
  } else if (!wholeCols.value.includes(c)) {
    wholeCols.value = [...wholeCols.value, c];
  }
}

function handleCornerClick() {
  clearSelection();
}

function handleMouseUp() {
  isMouseDown.value = false;
  // Always stop edge auto-scrolling, even if the pointer was released
  // outside the grid (the container's mouseup may not fire at all).
  stopAutoScroll();
}

// Copy every selected range to TSV (blocks separated by a blank line)
async function copySelectedCells() {
  if (allRects.value.length === 0) return;
  const blocks = [];

  for (const { minR, maxR, minC, maxC } of allRects.value) {
    const rows = [];
    for (let r = minR; r <= maxR; r++) {
      const row = [];
      for (let c = minC; c <= maxC; c++) {
        row.push(getCellDisplayValue(r, c));
      }
      rows.push(row.join('\t'));
    }
    blocks.push(rows.join('\n'));
  }

  const tsv = blocks.join('\n\n');
  try {
    await navigator.clipboard.writeText(tsv);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 1800);
  } catch (err) {
    console.error('Copy failed:', err);
  }
}

// Global Keyboard Handler: copy + arrow-key navigation
function handleKeyDown(e) {
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) {
    return;
  }

  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'c' && hasSelection.value) {
    // Must preventDefault, otherwise the native copy also fires and races our
    // clipboard write (grid is user-select:none, so the result is nondeterministic).
    e.preventDefault();
    copySelectedCells();
    return;
  }

  // Escape clears the selection
  if (e.key === 'Escape') {
    clearSelection();
    return;
  }

  // Arrow keys move a single-cell cursor (Excel behaviour)
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
    if (rowCount.value === 0 || colCount.value === 0) return;
    e.preventDefault();

    const cur = selEnd.value || { r: 0, c: 0 };
    const extend = e.shiftKey;
    const step = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];

    const r = Math.max(0, Math.min(rowCount.value - 1, cur.r + step[0]));
    const c = Math.max(0, Math.min(colCount.value - 1, cur.c + step[1]));

    if (extend && selAnchor.value) {
      selEnd.value = { r, c };
    } else {
      extraRects.value = [];
      wholeRows.value = [];
      wholeCols.value = [];
      selAnchor.value = { r, c };
      selEnd.value = { r, c };
    }
  }
}

// Load Document Buffer
function parseWorkbook(buffer) {
  try {
    // CSV arrives as an already-decoded UTF-8 string (see fileHandler.js);
    // SheetJS wants { type: 'string' } in that case, otherwise 'array'.
    const isText = typeof buffer === 'string';
    const wb = XLSX.read(buffer, isText ? { type: 'string', raw: false } : { type: 'array' });
    workbook.value = wb;
    sheetNames.value = wb.SheetNames;
    currentSheetIndex.value = 0;
    rawSheetData.value = [];
    loadSheetData(0);
  } catch (err) {
    console.error('Failed to read Excel workbook:', err);
    parseError.value = err?.message || '表格解析失败，文件可能已损坏或不是有效的 Excel/CSV。';
  }
}

function selectSheet(idx) {
  currentSheetIndex.value = idx;
  loadSheetData(idx);
  // Clear selection on sheet change (indices point at a different sheet)
  clearSelection();
}

function loadSheetData(idx) {
  if (!workbook.value) return;
  const sheetName = sheetNames.value[idx];
  const worksheet = workbook.value.Sheets[sheetName];
  if (!worksheet) return;

  // Convert to 2D Array of raw values
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
  rawSheetData.value = data;
}

watch(
  () => props.doc,
  (newDoc) => {
    parseError.value = '';
    if (newDoc && newDoc.buffer !== undefined && newDoc.buffer !== null) {
      parseWorkbook(newDoc.buffer);
    }
  },
  { immediate: true }
);

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
  // Release outside the grid must still end the drag, otherwise the selection
  // keeps following the cursor and auto-scroll never stops.
  window.addEventListener('mouseup', handleMouseUp);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('mouseup', handleMouseUp);
  stopAutoScroll();
});
</script>

<style scoped>
.spreadsheet-container {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 48px);
  background: #FFFFFF;
  user-select: none;
  -webkit-user-select: none;
}

/* Sheet Toolbar */
.sheet-toolbar {
  height: 42px;
  background: #F8FAFC;
  border-bottom: 1px solid #E2E8F0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  gap: 12px;
  flex-shrink: 0;
}

.sheet-tabs {
  display: flex;
  align-items: center;
  gap: 4px;
  overflow-x: auto;
  max-width: 65%;
}

.sheet-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 500;
  color: #64748B;
  padding: 5px 11px;
  border-radius: 6px;
  border: 1px solid transparent;
  transition: all 0.15s;
  white-space: nowrap;
}

.sheet-tab:hover {
  background: #F1F5F9;
  color: #1E293B;
}

.sheet-tab.active {
  background: #FFFFFF;
  color: #059669;
  font-weight: 600;
  border-color: #E2E8F0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.sheet-tab-icon {
  width: 13px;
  height: 13px;
  flex-shrink: 0;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.search-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 8px;
  width: 13px;
  height: 13px;
  color: #94A3B8;
}

.search-input {
  font-family: inherit;
  font-size: 12px;
  padding: 4px 10px 4px 26px;
  border-radius: 6px;
  border: 1px solid #CBD5E1;
  background: #FFFFFF;
  outline: none;
  width: 170px;
  transition: all 0.15s;
}

.search-input:focus {
  border-color: #059669;
  width: 210px;
  box-shadow: 0 0 0 2px rgba(5, 150, 105, 0.15);
}

.match-count-badge {
  position: absolute;
  right: 6px;
  font-size: 10px;
  font-weight: 600;
  color: #059669;
  background: rgba(5, 150, 105, 0.1);
  padding: 1px 5px;
  border-radius: 3px;
}

.copy-sel-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11.5px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 6px;
  background: #059669;
  color: #FFFFFF;
  box-shadow: 0 1px 2px rgba(5, 150, 105, 0.2);
  transition: all 0.15s;
}

.copy-sel-btn:hover {
  background: #047857;
}

.copy-icon {
  width: 13px;
  height: 13px;
}

/* Grid Viewport */
.grid-viewport {
  flex: 1;
  overflow: auto;
  position: relative;
  background: #FFFFFF;
}

.excel-table {
  border-collapse: separate;
  border-spacing: 0;
  font-size: 12px;
  table-layout: auto;
  min-width: 100%;
  user-select: none;
  -webkit-user-select: none;
}

.corner-header {
  position: sticky;
  top: 0;
  left: 0;
  z-index: 40;
  background: #F1F5F9;
  color: #64748B;
  font-weight: 600;
  padding: 4px 8px;
  border-right: 1px solid #CBD5E1;
  border-bottom: 1px solid #CBD5E1;
  width: 48px;
  min-width: 48px;
  text-align: center;
}

.col-header {
  position: sticky;
  top: 0;
  z-index: 20;
  background: #F8FAFC;
  color: #475569;
  font-weight: 600;
  font-size: 11.5px;
  padding: 5px 12px;
  border-right: 1px solid #E2E8F0;
  border-bottom: 1px solid #CBD5E1;
  text-align: center;
  min-width: 80px;
}

.row-header {
  position: sticky;
  left: 0;
  z-index: 30;
  background: #F8FAFC;
  color: #64748B;
  font-size: 11px;
  font-weight: 600;
  padding: 4px 8px;
  border-right: 1px solid #CBD5E1;
  border-bottom: 1px solid #E2E8F0;
  text-align: center;
  width: 48px;
  min-width: 48px;
  box-shadow: 1px 0 0 #CBD5E1;
  /* Row/column headers are now clickable, so reset the inherited reset */
  font-weight: 600;
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
}

.row-header:hover,
.col-header:hover,
.corner-header:hover {
  background: #E2E8F0;
  color: #0F172A;
}

.corner-header,
.col-header {
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
}

.row-header:focus-visible,
.col-header:focus-visible,
.corner-header:focus-visible {
  outline: 2px solid #059669;
  outline-offset: -2px;
}

.header-highlight {
  background: rgba(5, 150, 105, 0.15) !important;
  color: #065F46 !important;
  font-weight: 700 !important;
}

.data-cell {
  padding: 6px 12px;
  border-right: 1px solid #E2E8F0;
  border-bottom: 1px solid #E2E8F0;
  color: #1E293B;
  white-space: nowrap;
  cursor: cell;
  background: #FFFFFF;
  user-select: none;
  -webkit-user-select: none;
  transition: background 0.05s;
}

.data-cell.cell-numeric {
  text-align: right;
  font-family: var(--font-mono);
}

.data-cell.cell-selected {
  background: rgba(5, 150, 105, 0.12) !important;
}

.data-cell.cell-anchor {
  outline: 2px solid #059669;
  outline-offset: -2px;
  background: rgba(5, 150, 105, 0.2) !important;
}

.data-cell.cell-match {
  background: #FEF08A !important;
  color: #854D0E !important;
  font-weight: 600;
}

/* Parse error state */
.sheet-error-card {
  margin: auto;
  background: #FFFFFF;
  border: 1px solid #FCA5A5;
  border-radius: 12px;
  padding: 30px 38px;
  text-align: center;
  color: #991B1B;
  max-width: 420px;
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

/* Bottom Live Statistics Bar */
.stats-bar {
  height: 38px;
  background: #F8FAFC;
  border-top: 1px solid #E2E8F0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px;
  flex-shrink: 0;
  z-index: 25;
}

.grid-info-tag {
  font-size: 11.5px;
  color: #64748B;
}

.selection-tag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11.5px;
  font-weight: 600;
  color: #065F46;
  background: rgba(5, 150, 105, 0.1);
  border: 1px solid rgba(5, 150, 105, 0.2);
  padding: 2px 8px;
  border-radius: 5px;
  margin-left: 8px;
  font-family: var(--font-mono);
}

.selection-tag-icon {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
}

.selection-extra {
  font-family: var(--font-sans);
  font-weight: 500;
  color: #047857;
  opacity: 0.85;
}

.stats-cards {
  display: flex;
  align-items: center;
  gap: 8px;
}

.stat-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: #FFFFFF;
  border: 1px solid #E2E8F0;
  padding: 3px 9px;
  border-radius: 6px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
}

.stat-label {
  font-size: 11px;
  color: #64748B;
}

.stat-val {
  font-size: 12px;
  font-weight: 600;
  color: #0F172A;
  font-family: var(--font-mono);
}

.stat-val.highlight {
  color: #059669;
  font-weight: 700;
}

.stat-val.min {
  color: #2563EB;
}

.stat-val.max {
  color: #DC2626;
}

.stats-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  color: #94A3B8;
}

.hint-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}
</style>
