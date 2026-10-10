<template>
  <aside 
    class="folder-sidebar" 
    :class="{ 'is-collapsed': !isOpen }"
    :style="isOpen ? { width: `${sidebarWidth}px` } : {}"
  >
    <!-- Collapsed Floating Tab (When Closed) -->
    <button 
      v-if="!isOpen" 
      class="sidebar-expand-tab" 
      @click="$emit('toggle-open')" 
      title="展开文件夹目录 (快捷键 Cmd+B)"
      aria-label="展开文件夹目录"
    >
      <ChevronRight class="tab-icon" />
      <span class="tab-badge" v-if="folder?.total_files">{{ folder.total_files }}</span>
    </button>

    <!-- Expanded Sidebar Body -->
    <div v-show="isOpen" class="sidebar-inner" :style="{ width: `${sidebarWidth}px` }">
      <!-- Folder Header -->
      <div class="sidebar-header">
        <div class="folder-title-row">
          <div class="folder-icon-box"><Folder class="folder-icon" /></div>
          <div class="folder-title-info" :title="folder?.path">
            <span class="folder-name">{{ folder?.name || '文件夹目录' }}</span>
            <span class="folder-count">{{ filteredFiles.length }} / {{ folder?.total_files || 0 }} 篇文档</span>
          </div>
        </div>

        <div class="header-action-group">
          <button 
            class="header-icon-btn" 
            @click="$emit('reload-folder')" 
            title="刷新文件夹"
            aria-label="刷新文件夹"
          >
            <RefreshCw class="header-icon" />
          </button>
          <button 
            class="header-icon-btn" 
            @click="$emit('toggle-open')" 
            title="折叠侧边栏 (Cmd+B)"
            aria-label="折叠侧边栏"
          >
            <ChevronLeft class="header-icon" />
          </button>
        </div>
      </div>

      <!-- Quick Search Bar -->
      <div class="search-box">
        <Search class="search-icon" />
        <input 
          v-model="searchQuery" 
          type="text" 
          placeholder="快速搜索文档..." 
          class="search-input"
          aria-label="在文件夹内搜索文档"
        />
        <button 
          v-if="searchQuery" 
          class="clear-search-btn" 
          @click="searchQuery = ''"
          title="清除搜索"
          aria-label="清除搜索"
        ><X class="clear-search-icon" /></button>
      </div>

      <!-- Category Filter Tabs (Wrapping neatly) -->
      <div class="filter-pills">
        <button 
          class="pill-btn" 
          :class="{ active: activeFilter === 'all' }"
          @click="activeFilter = 'all'"
        >全部</button>
        <button 
          class="pill-btn" 
          :class="{ active: activeFilter === 'pdf' }"
          @click="activeFilter = 'pdf'"
        >PDF</button>
        <button 
          class="pill-btn" 
          :class="{ active: activeFilter === 'spreadsheet' }"
          @click="activeFilter = 'spreadsheet'"
        >表格</button>
        <button 
          class="pill-btn" 
          :class="{ active: activeFilter === 'docx' }"
          @click="activeFilter = 'docx'"
        >Word</button>
        <button 
          class="pill-btn" 
          :class="{ active: activeFilter === 'pptx' }"
          @click="activeFilter = 'pptx'"
        >PPT</button>
        <button 
          class="pill-btn" 
          :class="{ active: activeFilter === 'code' }"
          @click="activeFilter = 'code'"
        >代码</button>
        <button 
          class="pill-btn" 
          :class="{ active: activeFilter === 'text' }"
          @click="activeFilter = 'text'"
        >文本</button>
      </div>

      <!-- Document List -->
      <div class="file-list-container">
        <div v-if="filteredFiles.length === 0" class="empty-list">
          <SearchX class="empty-icon" />
          <span class="empty-text">未找到匹配的文档</span>
        </div>

        <div 
          v-for="file in filteredFiles" 
          :key="file.path"
          class="file-item"
          :class="{ 'is-active': isFileActive(file) }"
          role="button"
          tabindex="0"
          @click="$emit('select-file', file)"
          @keydown.enter.prevent="$emit('select-file', file)"
          @keydown.space.prevent="$emit('select-file', file)"
          :title="file.rel_path || file.name"
        >
          <div class="file-type-icon" :class="file.doc_type">
            {{ getFileTypeBadge(file.extension) }}
          </div>

          <div class="file-details">
            <div class="file-name">{{ file.name }}</div>
            <div class="file-sub">
              <span class="file-size">{{ formatSize(file.size) }}</span>
              <span v-if="file.rel_path && file.rel_path !== file.name" class="file-relpath">
                {{ file.rel_path }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Sidebar Footer (Switch folder or close folder) -->
      <div class="sidebar-footer">
        <button class="footer-action-btn" @click="$emit('open-new-folder')">
          <FolderSearch class="btn-icon" />
          切换文件夹
        </button>
        <button class="footer-action-btn close-folder" @click="$emit('close-folder')" title="退出文件夹模式">
          关闭
        </button>
      </div>

      <!-- Resizable Drag Handle on Right Border -->
      <div 
        class="sidebar-resizer" 
        @mousedown="startResize"
        title="拖拽调节侧边栏宽度"
      ></div>
    </div>
  </aside>
</template>

<script setup>
import { ref, computed, onUnmounted } from 'vue';
import {
  ChevronRight,
  ChevronLeft,
  Folder,
  FolderSearch,
  RefreshCw,
  Search,
  SearchX,
  X
} from 'lucide-vue-next';

const props = defineProps({
  folder: {
    type: Object,
    default: null
  },
  currentDoc: {
    type: Object,
    default: null
  },
  isOpen: {
    type: Boolean,
    default: true
  }
});

defineEmits(['select-file', 'toggle-open', 'open-new-folder', 'reload-folder', 'close-folder']);

const searchQuery = ref('');
const activeFilter = ref('all');
const sidebarWidth = ref(270);
const isResizing = ref(false);

let detachResize = null;

function startResize(e) {
  e.preventDefault();
  isResizing.value = true;
  // Move the resizer above the content while dragging so it stays grabbable
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
  const startX = e.clientX;
  const startW = sidebarWidth.value;

  function onMouseMove(ev) {
    if (!isResizing.value) return;
    const diff = ev.clientX - startX;
    sidebarWidth.value = Math.max(190, Math.min(480, startW + diff));
  }

  function onMouseUp() {
    isResizing.value = false;
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
  // If the pointer is released outside the window we still get no mouseup —
  // without this the sidebar would stay stuck in resizing mode forever.
  window.addEventListener('blur', onMouseUp);
  detachResize = detach;
}

onUnmounted(() => {
  if (typeof detachResize === 'function') detachResize();
});

function isFileActive(file) {
  if (!props.currentDoc) return false;
  return props.currentDoc.path === file.path;
}

function getFileTypeBadge(ext) {
  const e = ext?.toLowerCase() || '';
  switch (e) {
    case 'pdf': return 'PDF';
    case 'xlsx':
    case 'xls':
    case 'csv': return 'XLS';
    case 'docx': return 'DOC';
    case 'pptx': return 'PPT';
    case 'md':
    case 'markdown': return 'MD';
    case 'json': return '{ }';
    case 'js':
    case 'ts':
    case 'jsx':
    case 'tsx':
    case 'py':
    case 'rs':
    case 'go':
    case 'java':
    case 'c':
    case 'cpp':
    case 'html':
    case 'css':
    case 'sql':
    case 'sh':
    case 'yaml':
    case 'yml':
    case 'xml': return '</>';
    default: return 'TXT';
  }
}

function formatSize(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

const filteredFiles = computed(() => {
  if (!props.folder?.files) return [];
  let list = props.folder.files;

  // Filter by category
  if (activeFilter.value !== 'all') {
    if (activeFilter.value === 'text') {
      list = list.filter(f => f.doc_type === 'text');
    } else if (activeFilter.value === 'code') {
      list = list.filter(f => f.doc_type === 'code');
    } else {
      list = list.filter(f => f.doc_type === activeFilter.value);
    }
  }

  // Filter by search query
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase();
    list = list.filter(f => 
      f.name.toLowerCase().includes(q) || 
      (f.rel_path && f.rel_path.toLowerCase().includes(q))
    );
  }

  return list;
});
</script>

<style scoped>
.folder-sidebar {
  height: 100%;
  background: #FFFFFF;
  border-right: 1px solid #E2E8F0;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  position: relative;
  user-select: none;
  z-index: 20;
}

.folder-sidebar.is-collapsed {
  width: 0 !important;
  border-right: none;
}

/* Floating Expand Tab when collapsed */
.sidebar-expand-tab {
  position: absolute;
  top: 12px;
  left: 12px;
  width: 32px;
  height: 32px;
  background: #FFFFFF;
  border: 1px solid #CBD5E1;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 50;
  transition: all 0.15s ease;
}

.sidebar-expand-tab:hover {
  background: #F8FAFC;
  border-color: #94A3B8;
  transform: translateX(2px);
}

.tab-icon {
  width: 16px;
  height: 16px;
  color: #475569;
}

.tab-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  background: #2563EB;
  color: #FFFFFF;
  font-size: 10px;
  font-weight: 700;
  padding: 1px 4px;
  border-radius: 8px;
  line-height: 1.2;
}

.sidebar-inner {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

.sidebar-header {
  padding: 12px 14px 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #F1F5F9;
}

.folder-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex: 1;
}

.folder-icon-box {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: rgba(37, 99, 235, 0.09);
  color: #2563EB;
  flex-shrink: 0;
}

.folder-icon {
  width: 16px;
  height: 16px;
}

.folder-title-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.folder-name {
  font-size: 13px;
  font-weight: 700;
  color: #0F172A;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.folder-count {
  font-size: 11px;
  color: #94A3B8;
}

.header-action-group {
  display: flex;
  align-items: center;
  gap: 2px;
}

.header-icon-btn {
  background: none;
  border: none;
  padding: 4px 6px;
  border-radius: 6px;
  color: #64748B;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.12s;
}

.header-icon-btn:hover {
  background: #F1F5F9;
  color: #0F172A;
}

.header-icon {
  width: 14px;
  height: 14px;
}

.header-icon-btn:focus-visible,
.footer-action-btn:focus-visible,
.pill-btn:focus-visible,
.sidebar-expand-tab:focus-visible,
.clear-search-btn:focus-visible,
.file-item:focus-visible {
  outline: 2px solid #2563EB;
  outline-offset: 1px;
}

/* Search Box */
.search-box {
  padding: 8px 12px;
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 20px;
  width: 13px;
  height: 13px;
  color: #94A3B8;
}

.search-input {
  width: 100%;
  height: 28px;
  padding: 0 24px 0 28px;
  font-size: 11.5px;
  background: #F1F5F9;
  border: 1px solid transparent;
  border-radius: 6px;
  color: #1E293B;
  outline: none;
  transition: all 0.15s;
}

.search-input:focus {
  background: #FFFFFF;
  border-color: #CBD5E1;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.1);
}

.clear-search-btn {
  position: absolute;
  right: 16px;
  background: none;
  border: none;
  color: #94A3B8;
  cursor: pointer;
  padding: 3px;
  border-radius: 4px;
  display: flex;
  align-items: center;
}

.clear-search-btn:hover {
  color: #475569;
}

.clear-search-icon {
  width: 13px;
  height: 13px;
}

/* Category Filter Pills */
.filter-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 4px 12px 8px;
  border-bottom: 1px solid #F1F5F9;
}

.pill-btn {
  padding: 3px 8px;
  font-size: 11px;
  font-weight: 500;
  border-radius: 5px;
  border: 1px solid transparent;
  background: #F8FAFC;
  color: #64748B;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.12s;
}

.pill-btn:hover {
  background: #F1F5F9;
  color: #1E293B;
}

.pill-btn.active {
  background: #0F172A;
  color: #FFFFFF;
  font-weight: 600;
}

/* File List */
.file-list-container {
  flex: 1;
  overflow-y: auto;
  padding: 6px 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.file-list-container::-webkit-scrollbar {
  width: 4px;
}
.file-list-container::-webkit-scrollbar-thumb {
  background: #CBD5E1;
  border-radius: 4px;
}

.empty-list {
  padding: 40px 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: #94A3B8;
  font-size: 12px;
}

.empty-icon {
  width: 26px;
  height: 26px;
  color: #CBD5E1;
  stroke-width: 1.6;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.12s ease;
  position: relative;
}

.file-item:hover {
  background: #F8FAFC;
}

.file-item.is-active {
  background: rgba(37, 99, 235, 0.08);
}

.file-item.is-active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 6px;
  bottom: 6px;
  width: 3px;
  background: #2563EB;
  border-radius: 2px;
}

.file-type-icon {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  font-weight: 800;
  flex-shrink: 0;
  letter-spacing: -0.3px;
}

.file-type-icon.pdf {
  background: #FEE2E2;
  color: #DC2626;
}

.file-type-icon.spreadsheet {
  background: #DCFCE7;
  color: #16A34A;
}

.file-type-icon.docx {
  background: #DBEAFE;
  color: #2563EB;
}

.file-type-icon.pptx {
  background: #FFEDD5;
  color: #EA580C;
}

.file-type-icon.markdown {
  background: #F3E8FF;
  color: #7C3AED;
}

.file-type-icon.text {
  background: #F1F5F9;
  color: #475569;
}

.file-details {
  flex: 1;
  min-width: 0;
}

.file-name {
  font-size: 12px;
  font-weight: 500;
  color: #1E293B;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
}

.file-item.is-active .file-name {
  font-weight: 600;
  color: #2563EB;
}

.file-sub {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10.5px;
  color: #94A3B8;
  margin-top: 2px;
}

.file-relpath {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 140px;
}

/* Sidebar Footer */
.sidebar-footer {
  padding: 8px 12px;
  border-top: 1px solid #F1F5F9;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  background: #FAFAFA;
}

.footer-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 8px;
  font-size: 11.5px;
  color: #475569;
  background: #FFFFFF;
  border: 1px solid #E2E8F0;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.12s;
}

.footer-action-btn:hover {
  background: #F1F5F9;
  color: #0F172A;
  border-color: #CBD5E1;
}

.footer-action-btn.close-folder {
  color: #94A3B8;
  border-color: transparent;
  background: none;
}

.footer-action-btn.close-folder:hover {
  color: #DC2626;
  background: #FEE2E2;
}

.btn-icon {
  width: 13px;
  height: 13px;
}

/* Resizable Drag Handle */
.sidebar-resizer {
  position: absolute;
  top: 0;
  right: -3px;
  width: 6px;
  height: 100%;
  cursor: col-resize;
  z-index: 50;
}

.sidebar-resizer:hover {
  background: rgba(37, 99, 235, 0.4);
}

/* Touch/trackpad users get a wider, always-visible grab affordance */
@media (pointer: coarse) {
  .sidebar-resizer { width: 12px; right: -6px; }
}
</style>
