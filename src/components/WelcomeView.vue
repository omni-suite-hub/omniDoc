<template>
  <div 
    class="welcome-container" 
    @dragover.prevent="isDragging = true" 
    @dragleave.prevent="isDragging = false" 
    @drop.prevent="handleDrop"
  >
    <!-- Ambient background layers (depth, not flat white) -->
    <div class="ambient-bg" aria-hidden="true">
      <div class="ambient-orb orb-a"></div>
      <div class="ambient-orb orb-b"></div>
      <div class="ambient-grid"></div>
    </div>

    <!-- Hero Header with Official Logo -->
    <div class="hero-section">
      <div class="app-logo-box">
        <img src="/logo.png" class="hero-logo-img" alt="" />
      </div>
      <h1 class="hero-title">OmniDoc</h1>
      <p class="hero-subtitle">一个窗口，看遍你所有的文档与代码</p>
      <div class="hero-capabilities">
        <span v-for="cap in capabilities" :key="cap.label" class="cap-chip">
          <component :is="cap.icon" class="cap-icon" />
          <span>{{ cap.label }}</span>
        </span>
      </div>
    </div>

    <!-- Interactive Drop Zone -->
    <div 
      class="drop-zone"
      :class="{ 'is-dragging': isDragging }"
      role="button"
      tabindex="0"
      aria-label="拖拽文档到此处，或按回车选择文件"
      @click="$emit('open-file')"
      @keydown.enter.prevent="$emit('open-file')"
      @keydown.space.prevent="$emit('open-file')"
    >
      <!-- Upload Icon -->
      <div class="drop-illustration">
        <div class="icon-bubble">
          <ArrowUpFromLine class="modern-upload-icon" />
        </div>
      </div>

      <div class="drop-title">把文档拖进来，立刻就能看</div>
      <div class="drop-desc">PDF · Excel · Word · PPT · Markdown · 代码源文件 · 纯文本</div>

      <!-- Action Buttons -->
      <div class="drop-btn-row">
        <button class="browse-cta" @click.stop="$emit('open-file')">
          <FilePlus class="folder-icon" />
          <span>选择文档</span>
          <span class="kbd-shortcut">⌘O</span>
        </button>

        <button class="browse-cta secondary" @click.stop="$emit('open-folder')">
          <FolderOpen class="folder-icon" />
          <span>打开文件夹</span>
          <span class="kbd-shortcut secondary">⌘⇧O</span>
        </button>
      </div>
    </div>

    <!-- Recent Documents History Section -->
    <div class="recent-section">
      <div class="section-title-bar">
        <div class="title-with-count">
          <History class="section-title-icon" />
          <span class="section-title">最近打开</span>
          <span v-if="recentList.length > 0" class="recent-count-tag">
            {{ recentList.length }}
          </span>
        </div>

        <button 
          v-if="recentList.length > 0" 
          class="clear-history-btn" 
          @click.stop="handleClearHistory"
          title="清空历史浏览记录"
        >
          <Trash2 class="trash-icon" />
          <span>清空记录</span>
        </button>
      </div>

      <!-- Recent Files Grid -->
      <div v-if="recentList.length > 0" class="recent-grid">
        <div 
          v-for="item in recentList" 
          :key="item.path"
          class="recent-card"
          role="button"
          tabindex="0"
          @click="$emit('open-recent', item)"
          @keydown.enter.prevent="$emit('open-recent', item)"
          :title="item.path"
        >
          <div class="recent-card-left">
            <div class="file-type-badge" :style="{ backgroundColor: getBadgeBg(item), color: getBadgeColor(item) }">
              {{ (item.extension || 'doc').toUpperCase().slice(0, 4) }}
            </div>

            <div class="recent-file-info">
              <div class="recent-file-name">{{ item.name }}</div>
              <div class="recent-file-path">{{ item.path }}</div>
            </div>
          </div>

          <div class="recent-card-right">
            <div class="recent-meta-col">
              <span class="recent-size">{{ item.sizeFormatted }}</span>
              <span class="recent-time">{{ formatTimeAgo(item.lastOpened) }}</span>
            </div>

            <!-- Remove Single History Item -->
            <button 
              class="remove-item-btn" 
              @click.stop="handleRemoveItem(item.path)"
              title="从历史记录中移除"
              :aria-label="`从历史记录中移除 ${item.name}`"
            >
              <X class="remove-icon" />
            </button>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="empty-history-card">
        <div class="empty-illustration">
          <Clock class="empty-icon" />
        </div>
        <div class="empty-title">还没有打开记录</div>
        <div class="empty-desc">拖入文档或点击上方按钮，最近打开的文件会自动出现在这里</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { getRecentFiles, removeRecentFile, clearRecentFiles } from '../utils/fileHandler.js';
import {
  ArrowUpFromLine,
  FilePlus,
  FolderOpen,
  Trash2,
  History,
  Clock,
  X,
  Zap,
  ShieldCheck,
  Layers,
  Gauge
} from 'lucide-vue-next';

const emit = defineEmits([
  'open-file',
  'open-folder',
  'file-dropped',
  'open-recent'
]);

const isDragging = ref(false);
const recentList = ref(getRecentFiles());

const capabilities = [
  { icon: Zap, label: '秒开' },
  { icon: ShieldCheck, label: '纯本地' },
  { icon: Layers, label: '全格式' },
  { icon: Gauge, label: '零广告' }
];

function refreshRecent() {
  recentList.value = getRecentFiles();
}

function handleRemoveItem(path) {
  recentList.value = removeRecentFile(path);
}

function handleClearHistory() {
  clearRecentFiles();
  recentList.value = [];
}

function handleDrop(e) {
  isDragging.value = false;
  if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
    emit('file-dropped', e.dataTransfer.files[0]);
  }
}

function getBadgeColor(item) {
  const ext = (item.extension || '').toLowerCase();
  if (ext === 'pdf') return '#DC2626';
  if (['xlsx', 'xls', 'csv'].includes(ext)) return '#059669';
  if (ext === 'docx') return '#2563EB';
  if (ext === 'pptx') return '#EA580C';
  if (['md', 'markdown'].includes(ext)) return '#7C3AED';
  if (['js', 'ts', 'jsx', 'tsx', 'py', 'rs', 'go', 'java', 'c', 'cpp', 'html', 'css', 'json', 'sql'].includes(ext)) return '#D97706';
  return '#475569';
}

function getBadgeBg(item) {
  const ext = (item.extension || '').toLowerCase();
  if (ext === 'pdf') return 'rgba(220, 38, 38, 0.12)';
  if (['xlsx', 'xls', 'csv'].includes(ext)) return 'rgba(5, 150, 105, 0.12)';
  if (ext === 'docx') return 'rgba(37, 99, 235, 0.12)';
  if (ext === 'pptx') return 'rgba(234, 88, 12, 0.12)';
  if (['md', 'markdown'].includes(ext)) return 'rgba(124, 58, 237, 0.12)';
  if (['js', 'ts', 'jsx', 'tsx', 'py', 'rs', 'go', 'java', 'c', 'cpp', 'html', 'css', 'json', 'sql'].includes(ext)) return 'rgba(217, 119, 6, 0.12)';
  return 'rgba(71, 85, 105, 0.12)';
}

function formatTimeAgo(timestamp) {
  if (!timestamp) return '';
  const now = Date.now();
  const diffSec = Math.floor((now - timestamp) / 1000);

  if (diffSec < 60) return '刚刚';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} 分钟前`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} 小时前`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay} 天前`;
  return new Date(timestamp).toLocaleDateString('zh-CN');
}

defineExpose({
  refreshRecent
});
</script>

<style scoped>
.welcome-container {
  position: relative;
  height: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px 24px 64px;
  isolation: isolate;
}

/* ---------- Ambient background: layered depth instead of flat #F8FAFC ---------- */
.ambient-bg {
  position: fixed;
  inset: 48px 0 0 0;
  z-index: -1;
  overflow: hidden;
  background:
    linear-gradient(180deg, #FBFCFE 0%, #F4F6FB 55%, #EEF2F8 100%);
  pointer-events: none;
}

.ambient-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(70px);
  opacity: 0.5;
}

.orb-a {
  width: 460px;
  height: 460px;
  top: -140px;
  left: 50%;
  transform: translateX(-58%);
  background: radial-gradient(circle, rgba(37, 99, 235, 0.20) 0%, rgba(37, 99, 235, 0) 70%);
}

.orb-b {
  width: 380px;
  height: 380px;
  bottom: -120px;
  right: 6%;
  background: radial-gradient(circle, rgba(124, 58, 237, 0.14) 0%, rgba(124, 58, 237, 0) 70%);
}

.ambient-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(15, 23, 42, 0.028) 1px, transparent 1px),
    linear-gradient(90deg, rgba(15, 23, 42, 0.028) 1px, transparent 1px);
  background-size: 44px 44px;
  mask-image: radial-gradient(ellipse 80% 60% at 50% 30%, #000 40%, transparent 100%);
  -webkit-mask-image: radial-gradient(ellipse 80% 60% at 50% 30%, #000 40%, transparent 100%);
}

/* ---------- Hero ---------- */
.hero-section {
  text-align: center;
  margin-bottom: 30px;
  animation: riseIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
}

@keyframes riseIn {
  from { opacity: 0; transform: translateY(14px); }
  to   { opacity: 1; transform: translateY(0); }
}

.app-logo-box {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 76px;
  height: 76px;
  border-radius: 22px;
  background: linear-gradient(145deg, #FFFFFF 0%, #F4F7FD 100%);
  box-shadow:
    0 18px 40px -12px rgba(37, 99, 235, 0.28),
    0 0 0 1px rgba(226, 232, 240, 0.9),
    inset 0 1px 0 rgba(255, 255, 255, 0.9);
  margin-bottom: 18px;
}

.hero-logo-img {
  width: 56px;
  height: 56px;
  object-fit: contain;
}

.hero-title {
  font-size: 40px;
  font-weight: 800;
  letter-spacing: -1.4px;
  line-height: 1.05;
  color: #0B1220;
  margin-bottom: 8px;
  background: linear-gradient(180deg, #0B1220 0%, #334155 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.hero-subtitle {
  font-size: 15px;
  color: #64748B;
  font-weight: 500;
  letter-spacing: 0.1px;
  margin-bottom: 18px;
}

.hero-capabilities {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex-wrap: wrap;
}

.cap-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 600;
  color: #475569;
  background: rgba(255, 255, 255, 0.75);
  border: 1px solid rgba(226, 232, 240, 0.9);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  padding: 4px 11px;
  border-radius: 999px;
}

.cap-icon {
  width: 13px;
  height: 13px;
  color: #2563EB;
}

/* ---------- Drop Zone ---------- */
.drop-zone {
  width: 100%;
  max-width: 660px;
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border: 1.5px dashed #C7D2E3;
  border-radius: 20px;
  padding: 38px 28px 32px;
  text-align: center;
  cursor: pointer;
  transition: transform 0.24s cubic-bezier(0.16, 1, 0.3, 1),
              border-color 0.24s, box-shadow 0.24s, background 0.24s;
  box-shadow:
    0 1px 2px rgba(15, 23, 42, 0.04),
    0 12px 32px -16px rgba(15, 23, 42, 0.14);
  animation: riseIn 0.55s cubic-bezier(0.16, 1, 0.3, 1) 0.06s both;
}

.drop-zone:hover {
  border-color: #2563EB;
  background: rgba(255, 255, 255, 0.94);
  transform: translateY(-3px);
  box-shadow:
    0 2px 4px rgba(15, 23, 42, 0.04),
    0 22px 48px -18px rgba(37, 99, 235, 0.28);
}

.drop-zone:focus-visible {
  outline: 2px solid #2563EB;
  outline-offset: 3px;
}

.drop-zone.is-dragging {
  border-color: #2563EB;
  background: rgba(239, 246, 255, 0.92);
  transform: scale(1.012);
  box-shadow: 0 0 0 5px rgba(37, 99, 235, 0.13);
}

.drop-illustration {
  margin-bottom: 14px;
  display: flex;
  justify-content: center;
}

.icon-bubble {
  width: 58px;
  height: 58px;
  border-radius: 18px;
  background: linear-gradient(145deg, #EFF6FF 0%, #DBEAFE 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(37, 99, 235, 0.14);
  transition: transform 0.24s cubic-bezier(0.16, 1, 0.3, 1);
}

.drop-zone:hover .icon-bubble {
  transform: translateY(-3px) scale(1.06);
}

.drop-zone.is-dragging .icon-bubble {
  transform: translateY(-4px) scale(1.12);
}

.modern-upload-icon {
  width: 26px;
  height: 26px;
  color: #2563EB;
  stroke-width: 2;
}

.drop-title {
  font-size: 19px;
  font-weight: 700;
  letter-spacing: -0.3px;
  color: #0F172A;
  margin-bottom: 7px;
}

.drop-desc {
  font-size: 13px;
  color: #64748B;
  margin-bottom: 24px;
  line-height: 1.6;
}

.drop-btn-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  flex-wrap: wrap;
}

.browse-cta {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #2563EB;
  color: #FFFFFF;
  font-size: 13.5px;
  font-weight: 600;
  padding: 10px 18px;
  border-radius: 10px;
  border: 1px solid transparent;
  box-shadow: 0 4px 14px -3px rgba(37, 99, 235, 0.4);
  transition: transform 0.16s, background 0.16s, box-shadow 0.16s;
}

.browse-cta:hover {
  background: #1D4ED8;
  transform: translateY(-2px);
  box-shadow: 0 8px 20px -4px rgba(37, 99, 235, 0.5);
}

.browse-cta:active { transform: translateY(0); }

.browse-cta:focus-visible {
  outline: 2px solid #1D4ED8;
  outline-offset: 2px;
}

.browse-cta.secondary {
  background: rgba(255, 255, 255, 0.9);
  color: #1E293B;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05);
  border: 1px solid #CBD5E1;
}

.browse-cta.secondary:hover {
  background: #FFFFFF;
  border-color: #94A3B8;
  box-shadow: 0 4px 12px -3px rgba(15, 23, 42, 0.14);
}

.folder-icon {
  width: 15px;
  height: 15px;
}

.kbd-shortcut {
  font-size: 10.5px;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.22);
  padding: 2px 6px;
  border-radius: 4px;
  letter-spacing: 0.3px;
}

.kbd-shortcut.secondary {
  background: #E2E8F0;
  color: #64748B;
}

/* ---------- Recent ---------- */
.recent-section {
  width: 100%;
  max-width: 660px;
  margin-top: 34px;
  animation: riseIn 0.55s cubic-bezier(0.16, 1, 0.3, 1) 0.12s both;
}

.section-title-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding: 0 4px;
}

.title-with-count {
  display: flex;
  align-items: center;
  gap: 7px;
}

.section-title-icon {
  width: 15px;
  height: 15px;
  color: #64748B;
}

.section-title {
  font-size: 14px;
  font-weight: 700;
  color: #1E293B;
  letter-spacing: -0.1px;
}

.recent-count-tag {
  font-size: 11px;
  font-weight: 700;
  color: #64748B;
  background: #E2E8F0;
  padding: 1px 7px;
  border-radius: 999px;
}

.clear-history-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11.5px;
  font-weight: 500;
  color: #94A3B8;
  padding: 5px 9px;
  border-radius: 7px;
  transition: all 0.14s;
}

.clear-history-btn:hover {
  background: #FEE2E2;
  color: #DC2626;
}

.clear-history-btn:focus-visible {
  outline: 2px solid #DC2626;
  outline-offset: 1px;
}

.trash-icon {
  width: 13px;
  height: 13px;
}

.recent-grid {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.recent-card {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid #E2E8F0;
  border-radius: 12px;
  padding: 10px 13px;
  cursor: pointer;
  transition: transform 0.18s cubic-bezier(0.16, 1, 0.3, 1),
              box-shadow 0.18s, border-color 0.18s, background 0.18s;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
}

.recent-card:hover {
  background: #FFFFFF;
  border-color: #CBD5E1;
  transform: translateX(3px);
  box-shadow: 0 6px 16px -4px rgba(15, 23, 42, 0.1);
}

.recent-card:focus-visible {
  outline: 2px solid #2563EB;
  outline-offset: 1px;
}

.recent-card-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  flex: 1;
}

.file-type-badge {
  font-size: 9.5px;
  font-weight: 800;
  padding: 5px 6px;
  border-radius: 7px;
  letter-spacing: 0.2px;
  flex-shrink: 0;
  min-width: 38px;
  text-align: center;
}

.recent-file-info {
  min-width: 0;
  flex: 1;
}

.recent-file-name {
  font-size: 13px;
  font-weight: 600;
  color: #0F172A;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 2px;
}

.recent-file-path {
  font-size: 11px;
  color: #94A3B8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.recent-card-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.recent-meta-col {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  font-size: 11px;
}

.recent-size {
  color: #64748B;
  font-weight: 500;
}

.recent-time {
  color: #94A3B8;
}

.remove-item-btn {
  width: 24px;
  height: 24px;
  border-radius: 7px;
  background: transparent;
  border: none;
  color: #CBD5E1;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.14s;
  opacity: 0;
}

.recent-card:hover .remove-item-btn,
.remove-item-btn:focus-visible {
  opacity: 1;
}

.remove-item-btn:hover {
  background: #FEE2E2;
  color: #DC2626;
}

.remove-icon {
  width: 14px;
  height: 14px;
}

/* ---------- Empty state ---------- */
.empty-history-card {
  background: rgba(255, 255, 255, 0.55);
  border: 1px dashed #CBD5E1;
  border-radius: 14px;
  padding: 36px 24px;
  text-align: center;
}

.empty-illustration {
  margin-bottom: 10px;
  display: flex;
  justify-content: center;
}

.empty-icon {
  width: 30px;
  height: 30px;
  color: #CBD5E1;
  stroke-width: 1.6;
}

.empty-title {
  font-size: 13.5px;
  font-weight: 600;
  color: #475569;
  margin-bottom: 4px;
}

.empty-desc {
  font-size: 12px;
  color: #94A3B8;
  line-height: 1.6;
}

/* ---------- Responsive ---------- */
@media (max-width: 640px) {
  .welcome-container { padding: 32px 16px 48px; }
  .hero-title { font-size: 32px; }
  .drop-zone { padding: 28px 18px 24px; }
  .drop-title { font-size: 17px; }
  .drop-btn-row { flex-direction: column; align-items: stretch; }
  .browse-cta { justify-content: center; }
  .recent-card-right .recent-meta-col { display: none; }
}

@media (prefers-reduced-motion: reduce) {
  .hero-section,
  .drop-zone,
  .recent-section { animation: none; }
  * { transition-duration: 0.01ms !important; }
}
</style>
