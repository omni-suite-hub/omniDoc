<template>
  <div 
    class="app-container"
    @dragenter.prevent="handleGlobalDragEnter"
    @dragover.prevent="handleGlobalDragOver"
    @dragleave.prevent="handleGlobalDragLeave"
    @drop.prevent="handleGlobalDrop"
  >
    <!-- Hidden File Input for Native Dialog Fallback -->
    <input 
      ref="fileInputRef"
      type="file" 
      class="hidden-file-input"
      accept=".md,.markdown,.txt,.log,.json,.csv,.xlsx,.xls,.docx,.pptx,.pdf,.js,.ts,.jsx,.tsx,.py,.rs,.go,.java,.c,.cpp,.h,.hpp,.html,.css,.sql,.sh,.yaml,.yml,.xml,.toml,.vue"
      @change="handleFileInputChange"
    />

    <!-- App Header Bar -->
    <Header
      :doc="currentDoc"
      :folder="currentFolder"
      :is-sidebar-open="isSidebarOpen"
      :copied="showCopyToast"
      :has-update="hasUpdate"
      @open-file="handleOpenFile"
      @open-folder="handleOpenFolder"
      @toggle-sidebar="isSidebarOpen = !isSidebarOpen"
      @go-home="handleGoHome"
      @copy-content="handleCopyContent"
      @open-default-settings="showDefaultModal = true"
      @open-about="showAboutModal = true"
    />

    <!-- Main Workspace Area -->
    <div class="app-workspace">
      <!-- Left Folder Sidebar (When Folder is Open) -->
      <FolderSidebar
        v-if="currentFolder"
        :folder="currentFolder"
        :current-doc="currentDoc"
        :is-open="isSidebarOpen"
        @select-file="handleSelectFolderFile"
        @toggle-open="isSidebarOpen = !isSidebarOpen"
        @open-new-folder="handleOpenFolder"
        @reload-folder="handleReloadFolder"
        @close-folder="handleCloseFolder"
      />

      <!-- Main Content Area -->
      <main class="main-content">
        <!-- Loading Overlay -->
        <div v-if="isLoading" class="loading-overlay">
          <div class="spinner"></div>
          <div class="loading-text">{{ loadingMessage || '正在极速载入文档...' }}</div>
        </div>

        <!-- Welcome / Drop Home View with Recent History -->
        <WelcomeView
          v-if="!currentDoc && !isLoading"
          ref="welcomeViewRef"
          @open-file="handleOpenFile"
          @open-folder="handleOpenFolder"
          @file-dropped="handleFileDropped"
          @open-recent="handleOpenRecentFile"
        />

        <!-- Document Viewers -->
        <template v-else-if="currentDoc && !isLoading">
          <!-- PDF Document -->
          <PdfViewer
            v-if="currentDoc.type === 'pdf'"
            :doc="currentDoc"
          />

          <!-- Spreadsheet: Excel / CSV -->
          <SpreadsheetViewer
            v-else-if="currentDoc.type === 'spreadsheet'"
            :doc="currentDoc"
          />

          <!-- Presentation: PowerPoint PPTX -->
          <PptxViewer
            v-else-if="currentDoc.type === 'pptx'"
            :doc="currentDoc"
          />

          <!-- Word Document: DOCX -->
          <DocxViewer
            v-else-if="currentDoc.type === 'docx'"
            :doc="currentDoc"
          />

          <!-- Markdown Article -->
          <MarkdownViewer
            v-else-if="currentDoc.type === 'markdown'"
            :doc="currentDoc"
          />

          <!-- Source Code & Plain Text / Log / JSON -->
          <TextViewer
            v-else-if="currentDoc.type === 'text' || currentDoc.type === 'code'"
            :doc="currentDoc"
          />
        </template>
      </main>
    </div>

    <!-- Global Drag Overlay Indicator -->
    <div v-if="isGlobalDragging" class="global-drag-curtain">
      <div class="drag-box">
        <div class="drag-icon-ring">
          <FolderDown class="drag-icon" />
        </div>
        <div class="drag-text">松开即可预览文档或整个文件夹</div>
        <div class="drag-hint">支持 PDF / Office / Markdown / 代码 / 纯文本</div>
      </div>
    </div>

    <!-- Default App Setting Modal -->
    <DefaultAppModal
      v-if="showDefaultModal"
      @close="showDefaultModal = false"
    />

    <!-- About App & Update Checker Modal -->
    <AboutModal
      v-if="showAboutModal"
      :update-info="updateInfo"
      @close="showAboutModal = false"
      @update-found="handleUpdateFound"
    />

    <!-- Toast Notification -->
    <transition name="fade">
      <div v-if="toastMessage" class="app-toast">
        {{ toastMessage }}
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { FolderDown } from 'lucide-vue-next';

import Header from './components/Header.vue';
import WelcomeView from './components/WelcomeView.vue';
import FolderSidebar from './components/FolderSidebar.vue';
import PdfViewer from './components/PdfViewer.vue';
import SpreadsheetViewer from './components/SpreadsheetViewer.vue';
import PptxViewer from './components/PptxViewer.vue';
import DocxViewer from './components/DocxViewer.vue';
import MarkdownViewer from './components/MarkdownViewer.vue';
import TextViewer from './components/TextViewer.vue';
import DefaultAppModal from './components/DefaultAppModal.vue';
import AboutModal from './components/AboutModal.vue';

import {
  openNativeFileDialog,
  openNativeFolderDialog,
  isPathADirectory,
  readFolderFiles,
  loadDocumentFromPath,
  loadDocumentFromFileObject,
  addRecentFile,
  checkAppUpdate
} from './utils/fileHandler.js';

const fileInputRef = ref(null);
const welcomeViewRef = ref(null);
const currentDoc = ref(null);
const currentFolder = ref(null);
const isSidebarOpen = ref(true);

const isLoading = ref(false);
const loadingMessage = ref('');
const isGlobalDragging = ref(false);
const toastMessage = ref('');
const showCopyToast = ref(false);
const showDefaultModal = ref(false);
const showAboutModal = ref(false);

const hasUpdate = ref(false);
const updateInfo = ref(null);

let unlistenTauriDragDrop = null;
let unlistenFileOpened = null;

function showToast(msg, duration = 2200) {
  toastMessage.value = msg;
  setTimeout(() => {
    if (toastMessage.value === msg) {
      toastMessage.value = '';
    }
  }, duration);
}

function handleUpdateFound(info) {
  hasUpdate.value = true;
  updateInfo.value = info;
  showToast(`发现新版本 v${info.latestVersion}！`);
}

// Open File Action: First tries Tauri native dialog; falls back to hidden input
async function handleOpenFile() {
  try {
    const selectedPath = await openNativeFileDialog();
    if (selectedPath) {
      await openFilePath(selectedPath);
      return;
    }
  } catch (err) {
    console.warn('Tauri dialog failed, using fallback input:', err);
  }

  // Fallback to HTML input
  if (fileInputRef.value) {
    fileInputRef.value.value = '';
    fileInputRef.value.click();
  }
}

// Open Folder Action
async function handleOpenFolder() {
  try {
    const selectedFolderPath = await openNativeFolderDialog();
    if (selectedFolderPath) {
      await openFolderPath(selectedFolderPath);
    }
  } catch (err) {
    console.warn('Open folder dialog failed:', err);
    showToast('打开文件夹失败: ' + err.message);
  }
}

async function openFolderPath(folderPath) {
  loadingMessage.value = '正在扫描目录文档...';
  isLoading.value = true;
  try {
    const folderPayload = await readFolderFiles(folderPath);
    currentFolder.value = folderPayload;
    isSidebarOpen.value = true;

    if (folderPayload.files && folderPayload.files.length > 0) {
      showToast(`已载入文件夹「${folderPayload.name}」(${folderPayload.total_files} 篇文档)`);
      // Automatically open the first document in the folder
      await openFilePath(folderPayload.files[0].path);
    } else {
      showToast(`已载入文件夹「${folderPayload.name}」，未发现支持的文档`, 3000);
    }
  } catch (err) {
    console.error('Failed to open folder:', err);
    showToast(`打开文件夹失败: ${err.message}`, 3000);
  } finally {
    isLoading.value = false;
    loadingMessage.value = '';
  }
}

async function openFilePath(path) {
  loadingMessage.value = '正在极速载入文档...';
  isLoading.value = true;
  try {
    const doc = await loadDocumentFromPath(path);
    currentDoc.value = doc;
    addRecentFile(doc);
    if (welcomeViewRef.value?.refreshRecent) {
      welcomeViewRef.value.refreshRecent();
    }
    showToast(`已打开 ${doc.name}`);
  } catch (err) {
    console.error('Failed to open file path:', err);
    showToast(`打开失败: ${err.message}`, 3000);
  } finally {
    isLoading.value = false;
    loadingMessage.value = '';
  }
}

async function handleOpenRecentFile(item) {
  if (item && item.path) {
    await openFilePath(item.path);
  }
}

async function handleSelectFolderFile(fileItem) {
  await openFilePath(fileItem.path);
}

async function handleReloadFolder() {
  if (currentFolder.value?.path) {
    await openFolderPath(currentFolder.value.path);
  }
}

function handleCloseFolder() {
  currentFolder.value = null;
  currentDoc.value = null;
  isSidebarOpen.value = false;
  showToast('已关闭文件夹');
}

async function handleFileInputChange(e) {
  const files = e.target.files;
  if (files && files.length > 0) {
    await handleFileDropped(files[0]);
  }
}

async function handleFileDropped(file) {
  isLoading.value = true;
  try {
    const doc = await loadDocumentFromFileObject(file);
    currentDoc.value = doc;
    addRecentFile(doc);
    if (welcomeViewRef.value?.refreshRecent) {
      welcomeViewRef.value.refreshRecent();
    }
    showToast(`已加载 ${doc.name}`);
  } catch (err) {
    console.error('Failed to load file object:', err);
    showToast(`打开失败: ${err.message}`, 3000);
  } finally {
    isLoading.value = false;
  }
}

// BUG FIX: this used to only clear currentDoc, leaving currentFolder set — so
// "back to home" kept the folder sidebar on screen, covering the welcome page
// and leaving the header showing the folder badge.
function handleGoHome() {
  currentDoc.value = null;
  if (currentFolder.value) {
    currentFolder.value = null;
    isSidebarOpen.value = false;
  }
}

async function handleCopyContent() {
  if (!currentDoc.value) return;

  if (currentDoc.value.content) {
    try {
      await navigator.clipboard.writeText(currentDoc.value.content);
      showCopyToast.value = true;
      showToast('已复制文档全文到剪贴板！');
      setTimeout(() => {
        showCopyToast.value = false;
      }, 1800);
    } catch (e) {
      showToast('复制失败');
    }
  } else {
    showToast('该格式支持在界面内直接框选复制');
  }
}

// HTML5 Drag & Drop Fallback (browser dev mode; Tauri uses the native event)
//
// BUG FIX: the old counter incremented on every `dragover` (which fires dozens
// of times per second) but only decremented once per `dragleave`. Dragging out
// of the window left the counter permanently > 0, so the "release to open"
// curtain got stuck on screen forever. We now key off the dragenter/dragleave
// pair (which are balanced) and add a safety timeout.
let dragDepth = 0;
let dragResetTimer = null;

function scheduleDragReset() {
  if (dragResetTimer) clearTimeout(dragResetTimer);
  dragResetTimer = setTimeout(() => {
    dragDepth = 0;
    isGlobalDragging.value = false;
  }, 300);
}

function handleGlobalDragOver(e) {
  // Only react to actual file drags, not text selection
  if (e.dataTransfer?.types && !Array.from(e.dataTransfer.types).includes('Files')) return;
  scheduleDragReset();
  if (dragDepth === 0) isGlobalDragging.value = true;
}

function handleGlobalDragEnter(e) {
  if (e.dataTransfer?.types && !Array.from(e.dataTransfer.types).includes('Files')) return;
  dragDepth++;
  scheduleDragReset();
  isGlobalDragging.value = true;
}

function handleGlobalDragLeave(e) {
  scheduleDragReset();
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) {
    isGlobalDragging.value = false;
  }
}

async function handleGlobalDrop(e) {
  isGlobalDragging.value = false;
  dragDepth = 0;
  if (dragResetTimer) clearTimeout(dragResetTimer);
  if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
    await handleFileDropped(e.dataTransfer.files[0]);
  }
}

// Keyboard shortcuts (Cmd+O: Open File, Cmd+Shift+O: Open Folder, Cmd+B: Toggle Sidebar)
function handleGlobalKeyDown(e) {
  // Don't hijack shortcuts while the user is typing in a field
  const t = e.target;
  const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
  // Cmd+B in a rich-text / sidebar search field means nothing to us
  if (typing && !(e.metaKey || e.ctrlKey)) return;
  if (typing && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') return;

  if ((e.metaKey || e.ctrlKey)) {
    if (e.key.toLowerCase() === 'o') {
      e.preventDefault();
      if (e.shiftKey) {
        handleOpenFolder();
      } else {
        handleOpenFile();
      }
    } else if (e.key.toLowerCase() === 'b') {
      if (currentFolder.value) {
        e.preventDefault();
        isSidebarOpen.value = !isSidebarOpen.value;
      }
    }
  }
}

// Native Tauri Drag and Drop Listener & Launch Argument Check
onMounted(async () => {
  window.addEventListener('keydown', handleGlobalKeyDown);

  // Background check for updates
  try {
    const res = await checkAppUpdate();
    if (res && res.hasUpdate) {
      hasUpdate.value = true;
      updateInfo.value = res;
    }
  } catch (e) {}

  // 1. Setup Tauri native drag-and-drop listener (Intercepts Finder dragging files or folders!)
  try {
    const webview = getCurrentWebview();
    if (webview && typeof webview.onDragDropEvent === 'function') {
      unlistenTauriDragDrop = await webview.onDragDropEvent(async (event) => {
        if (event.payload.type === 'over' || event.payload.type === 'enter') {
          isGlobalDragging.value = true;
        } else if (event.payload.type === 'drop') {
          isGlobalDragging.value = false;
          if (event.payload.paths && event.payload.paths.length > 0) {
            const targetPath = event.payload.paths[0];
            const isDir = await isPathADirectory(targetPath);
            if (isDir) {
              await openFolderPath(targetPath);
            } else {
              await openFilePath(targetPath);
            }
          }
        } else if (event.payload.type === 'leave') {
          isGlobalDragging.value = false;
        }
      });
    }
  } catch (err) {
    console.warn('Native drag-drop event setup skipped (running in browser):', err);
  }

  // 2. Listen to warm-start system file opening events (Double-click in Finder while OmniDoc is running!)
  try {
    unlistenFileOpened = await listen('file-opened', async (event) => {
      const incomingPath = event.payload;
      if (incomingPath) {
        const isDir = await isPathADirectory(incomingPath);
        if (isDir) {
          await openFolderPath(incomingPath);
        } else {
          await openFilePath(incomingPath);
        }
      }
    });
  } catch (err) {
    console.warn('file-opened listener setup skipped:', err);
  }

  // 3. Check cold-start launch file (Double-click in Finder while OmniDoc is closed!)
  try {
    const launchFile = await invoke('get_launch_file');
    if (launchFile) {
      const isDir = await isPathADirectory(launchFile);
      if (isDir) {
        await openFolderPath(launchFile);
      } else {
        await openFilePath(launchFile);
      }
    }
  } catch (err) {
    // Ignore in browser dev mode
  }
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeyDown);
  if (typeof unlistenTauriDragDrop === 'function') {
    unlistenTauriDragDrop();
  }
  if (typeof unlistenFileOpened === 'function') {
    unlistenFileOpened();
  }
});
</script>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
  background: #F4F6FB;
  overflow: hidden;
  position: relative;
}

.hidden-file-input {
  display: none;
}

.app-workspace {
  flex: 1;
  display: flex;
  min-height: 0;
  overflow: hidden;
  position: relative;
}

.main-content {
  flex: 1;
  min-width: 0;
  min-height: 0;
  height: 100%;
  position: relative;
  overflow: hidden;
  background: #F4F6FB;
}

/* Loading Overlay */
.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.88);
  backdrop-filter: blur(4px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  z-index: 500;
  animation: fadeIn 0.15s ease-out;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #E2E8F0;
  border-top-color: #2563EB;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  font-size: 13.5px;
  font-weight: 500;
  color: #475569;
}

/* Global Drag Curtain */
.global-drag-curtain {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(37, 99, 235, 0.12);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  pointer-events: none;
  animation: fadeIn 0.12s ease-out;
}

.drag-box {
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  padding: 36px 52px;
  border-radius: 24px;
  border: 2px dashed #2563EB;
  box-shadow:
    0 30px 60px -12px rgba(37, 99, 235, 0.35),
    0 0 0 1px rgba(255, 255, 255, 0.6);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  animation: dragFloat 2s ease-in-out infinite alternate;
}

@keyframes dragFloat {
  from { transform: translateY(0) scale(1); }
  to   { transform: translateY(-6px) scale(1.02); }
}

.drag-icon-ring {
  width: 60px;
  height: 60px;
  border-radius: 20px;
  background: linear-gradient(145deg, #EFF6FF 0%, #DBEAFE 100%);
  border: 1px solid rgba(37, 99, 235, 0.18);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 6px;
}

.drag-icon {
  width: 28px;
  height: 28px;
  color: #2563EB;
}

.drag-text {
  font-size: 17px;
  font-weight: 700;
  color: #0F172A;
  letter-spacing: -0.2px;
}

.drag-hint {
  font-size: 12px;
  color: #64748B;
}

/* App Toast */
.app-toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(15, 23, 42, 0.92);
  backdrop-filter: blur(8px);
  color: #FFFFFF;
  padding: 8px 18px;
  border-radius: 20px;
  font-size: 12.5px;
  font-weight: 500;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.25);
  z-index: 2000;
  pointer-events: none;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s, transform 0.2s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translate(-50%, 10px);
}
</style>
