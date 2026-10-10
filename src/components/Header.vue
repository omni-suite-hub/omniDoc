<template>
  <header class="app-header" data-tauri-drag-region>
    <!-- Left Section: Window Inset Spacer + File Info -->
    <div class="header-left" data-tauri-drag-region>
      <!-- Sidebar Toggle (if folder loaded) -->
      <button 
        v-if="folder" 
        class="sidebar-toggle-btn" 
        :class="{ active: isSidebarOpen }"
        @click="$emit('toggle-sidebar')"
        :title="isSidebarOpen ? '收起目录列表 (Cmd+B)' : '展开目录列表 (Cmd+B)'"
        :aria-label="isSidebarOpen ? '收起目录列表' : '展开目录列表'"
        :aria-expanded="isSidebarOpen"
      >
        <PanelLeftClose v-if="isSidebarOpen" class="sidebar-icon" />
        <PanelLeftOpen v-else class="sidebar-icon" />
      </button>

      <!-- App Logo & Home Button -->
      <button class="logo-badge" @click="$emit('go-home')" title="返回欢迎主页" aria-label="返回欢迎主页">
        <img src="/logo.png" class="logo-img" alt="" />
        <span class="logo-title">OmniDoc</span>
      </button>

      <!-- Current Document Meta -->
      <div v-if="doc" class="doc-meta-container">
        <span class="meta-separator">/</span>
        <div class="doc-type-pill" :style="{ backgroundColor: badgeBgColor, color: badgeColor }">
          {{ doc.langLabel || doc.label || doc.extension?.toUpperCase() }}
        </div>
        <span class="doc-filename" :title="doc.path || doc.name">
          {{ doc.name }}
        </span>
        <span class="doc-size-tag">{{ doc.sizeFormatted }}</span>
        <span v-if="doc.encoding" class="doc-encoding-tag">{{ doc.encoding }}</span>
      </div>

      <!-- Current Folder Meta -->
      <div v-else-if="folder" class="doc-meta-container">
        <span class="meta-separator">/</span>
        <div class="folder-header-badge">
          <Folder class="folder-badge-icon" />
          <span>{{ folder.name }} ({{ folder.total_files }} 篇文档)</span>
        </div>
      </div>
    </div>

    <!-- Right Section: Actions Toolbar -->
    <div class="header-actions">
      <!-- Update Available Pill (If update found) -->
      <button 
        v-if="hasUpdate" 
        class="update-cta-pill" 
        @click="$emit('open-about')"
        title="发现新版本，点击查看与下载"
      >
        <span class="update-pulse-dot"></span>
        <span>新版本可用</span>
      </button>

      <!-- Open File -->
      <button class="action-btn icon-btn" @click="$emit('open-file')" title="打开文件 (Cmd+O)" aria-label="打开文件">
        <FilePlus class="btn-icon" />
      </button>

      <!-- Open Folder -->
      <button class="action-btn icon-btn" @click="$emit('open-folder')" title="打开文件夹 (Cmd+Shift+O)" aria-label="打开文件夹">
        <FolderPlus class="btn-icon" />
      </button>

      <!-- Set as Default App -->
      <button class="action-btn icon-btn" @click="$emit('open-default-settings')" title="默认打开应用设置" aria-label="默认打开应用设置">
        <Settings class="btn-icon" />
      </button>

      <!-- About & Version Info -->
      <button class="action-btn icon-btn" @click="$emit('open-about')" title="关于 OmniDoc 与检查更新" aria-label="关于与检查更新">
        <Info class="btn-icon" />
      </button>

      <!-- Copy Content Button (if doc active) -->
      <button 
        v-if="doc" 
        class="action-btn icon-btn" 
        @click="$emit('copy-content')"
        :title="copied ? '已复制！' : '复制文档内容'"
        :aria-label="copied ? '已复制' : '复制文档内容'"
      >
        <Check v-if="copied" class="btn-icon check" />
        <Copy v-else class="btn-icon" />
      </button>

      <!-- Return Home Button -->
      <button v-if="doc || folder" class="action-btn icon-btn" @click="$emit('go-home')" title="返回主页" aria-label="返回主页">
        <House class="btn-icon" />
      </button>
    </div>
  </header>
</template>

<script setup>
import { computed } from 'vue';
import {
  PanelLeftClose,
  PanelLeftOpen,
  Folder,
  FilePlus,
  FolderPlus,
  Settings,
  Info,
  Copy,
  Check,
  House
} from 'lucide-vue-next';

const props = defineProps({
  doc: {
    type: Object,
    default: null
  },
  folder: {
    type: Object,
    default: null
  },
  isSidebarOpen: {
    type: Boolean,
    default: true
  },
  copied: {
    type: Boolean,
    default: false
  },
  hasUpdate: {
    type: Boolean,
    default: false
  }
});

defineEmits([
  'open-file',
  'open-folder',
  'toggle-sidebar',
  'go-home',
  'copy-content',
  'open-default-settings',
  'open-about'
]);

const badgeColor = computed(() => {
  if (!props.doc) return '#2563EB';
  const type = props.doc.type;
  if (type === 'pdf') return '#DC2626';
  if (type === 'spreadsheet') return '#059669';
  if (type === 'pptx') return '#EA580C';
  if (type === 'markdown') return '#7C3AED';
  if (type === 'docx') return '#2563EB';
  if (type === 'code') return '#D97706';
  return '#475569';
});

const badgeBgColor = computed(() => {
  if (!props.doc) return 'rgba(37, 99, 235, 0.1)';
  const type = props.doc.type;
  if (type === 'pdf') return 'rgba(220, 38, 38, 0.12)';
  if (type === 'spreadsheet') return 'rgba(5, 150, 105, 0.12)';
  if (type === 'pptx') return 'rgba(234, 88, 12, 0.12)';
  if (type === 'markdown') return 'rgba(124, 58, 237, 0.12)';
  if (type === 'docx') return 'rgba(37, 99, 235, 0.12)';
  if (type === 'code') return 'rgba(217, 119, 6, 0.12)';
  return 'rgba(71, 85, 105, 0.12)';
});
</script>

<style scoped>
.app-header {
  height: 48px;
  background: #FFFFFF;
  border-bottom: 1px solid #E2E8F0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px 0 78px; /* 78px leaves space for macOS traffic lights */
  user-select: none;
  position: relative;
  z-index: 100;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex: 1;
}

.sidebar-toggle-btn {
  background: none;
  border: 1px solid #E2E8F0;
  padding: 4px 6px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #64748B;
  transition: all 0.15s;
}

.sidebar-toggle-btn:hover {
  background: #F1F5F9;
  color: #0F172A;
  border-color: #CBD5E1;
}

.sidebar-toggle-btn.active {
  background: rgba(37, 99, 235, 0.08);
  color: #2563EB;
  border-color: rgba(37, 99, 235, 0.3);
}

.sidebar-icon {
  width: 15px;
  height: 15px;
}

.logo-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 8px;
  background: transparent;
  border: none;
  transition: background-color 0.15s;
}

.logo-badge:hover {
  background: #F1F5F9;
}

.logo-badge:focus-visible {
  outline: 2px solid #2563EB;
  outline-offset: 1px;
}

.logo-img {
  width: 22px;
  height: 22px;
  border-radius: 5px;
  object-fit: contain;
}

.logo-title {
  font-size: 14px;
  font-weight: 800;
  color: #0F172A;
  letter-spacing: -0.3px;
}

.doc-meta-container {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.meta-separator {
  color: #CBD5E1;
  font-size: 13px;
}

.doc-type-pill {
  font-size: 10.5px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 5px;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  flex-shrink: 0;
}

.folder-header-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11.5px;
  font-weight: 600;
  color: #475569;
  background: #F1F5F9;
  padding: 3px 8px;
  border-radius: 5px;
}

.folder-badge-icon {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
}

.doc-filename {
  font-size: 13.5px;
  font-weight: 700;
  color: #0F172A;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 500px;
}

.doc-size-tag,
.doc-encoding-tag {
  font-size: 10.5px;
  color: #94A3B8;
  background: #F8FAFC;
  border: 1px solid #E2E8F0;
  padding: 1px 6px;
  border-radius: 4px;
  flex-shrink: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.update-cta-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #EFF6FF;
  border: 1px solid #BFDBFE;
  color: #2563EB;
  font-size: 11.5px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.update-cta-pill:hover {
  background: #DBEAFE;
}

.update-pulse-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #2563EB;
  animation: pulse 1.5s infinite;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 30px;
  padding: 0 10px;
  font-size: 12px;
  font-weight: 500;
  border-radius: 6px;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.action-btn.icon-btn {
  width: 32px;
  height: 30px;
  padding: 0;
  justify-content: center;
  background: #F8FAFC;
  color: #475569;
  border: 1px solid #E2E8F0;
  border-radius: 7px;
}

.action-btn.icon-btn:hover {
  background: #F1F5F9;
  color: #0F172A;
  border-color: #CBD5E1;
}

.action-btn.icon-btn .btn-icon {
  width: 15px;
  height: 15px;
}

.btn-icon.check {
  color: #10B981;
}

/* Visible keyboard focus for every icon-only control */
.action-btn:focus-visible,
.sidebar-toggle-btn:focus-visible,
.update-cta-pill:focus-visible {
  outline: 2px solid #2563EB;
  outline-offset: 1px;
}
</style>
