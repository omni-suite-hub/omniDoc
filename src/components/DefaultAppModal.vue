<template>
  <div class="modal-backdrop" @click.self="$emit('close')">
    <div class="modal-card">
      <div class="modal-header">
        <div class="header-title-group">
<div class="modal-badge-icon">
            <Settings class="badge-icon" />
          </div>
          <div>
            <h3 class="modal-title">默认打开方式设置</h3>
            <p class="modal-subtitle">点击右侧按钮，macOS 将弹出系统确认窗口，确认即可秒开</p>
          </div>
        </div>
<button class="close-btn" @click="$emit('close')" title="关闭" aria-label="关闭">
          <X class="close-icon" />
        </button>
      </div>

      <div class="modal-body">
        <div v-if="loadingStatus" class="loading-state">
          <div class="mini-spinner"></div>
          <span>正在读取系统文件关联...</span>
        </div>

        <div v-else class="types-list">
          <div 
            v-for="item in appTypes" 
            :key="item.category"
            class="type-row"
            :class="{ 'is-current-default': item.is_default }"
          >
<div class="type-icon-box" :class="item.category">
              <component :is="getTypeIcon(item.category)" class="type-icon" />
            </div>

            <div class="type-info">
              <div class="type-name-row">
                <span class="type-name">{{ item.name }}</span>
                <span class="type-exts">({{ item.extensions.join(' / ') }})</span>
              </div>
              <div class="type-status-row">
                <span v-if="item.is_default" class="status-badge active">
                  <CircleCheck class="status-check" />
                  已设为默认打开
                </span>
                <span v-else class="status-badge normal">
                  <span class="status-dot gray"></span>
                  当前默认：{{ item.current_app_name || '系统默认' }}
                </span>
              </div>
            </div>

            <div class="type-action">
              <div v-if="item.is_default" class="done-action-group">
<span class="done-badge">
                  <Check class="check-icon" />
                  已是默认
                </span>
                <button 
                  class="action-btn cancel-btn"
                  :disabled="settingCategory === item.category"
                  @click="handleResetDefault(item)"
                  title="恢复为系统自带软件打开"
                >
                  <span v-if="settingCategory === item.category">恢复中...</span>
                  <span v-else>取消默认</span>
                </button>
              </div>
              <button 
                v-else
                class="action-btn primary"
                :disabled="settingCategory === item.category"
                @click="handleSetDefault(item)"
              >
                <span v-if="settingCategory === item.category">确认中...</span>
                <span v-else>设为默认</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="sys-settings-btn" @click="handleOpenSysSettings">
          <ExternalLink class="link-icon" />
          前往系统设置
        </button>
        <button class="confirm-btn" @click="$emit('close')">完成</button>
      </div>
    </div>

    <!-- Inline result feedback: the OS dialog closing is not confirmation that
         the setting actually changed, so we report the real outcome. -->
    <transition name="toast">
      <div v-if="toastMessage" class="modal-toast" :class="{ error: toastMessage.startsWith('操作失败') }" role="status">
        <CircleCheck v-if="!toastMessage.startsWith('操作失败')" class="toast-icon" />
        <TriangleAlert v-else class="toast-icon" />
        <span>{{ toastMessage }}</span>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import {
  Settings,
  X,
  Check,
  CircleCheck,
  ExternalLink,
  TriangleAlert,
  FileText,
  Table,
  ScrollText,
  Presentation,
  FileCode,
  Braces
} from 'lucide-vue-next';
import { 
  checkDefaultApps, 
  setDefaultAppForCategory, 
  resetDefaultAppForCategory, 
  openSystemSettings 
} from '../utils/fileHandler.js';

const emit = defineEmits(['close']);

const loadingStatus = ref(true);
const settingCategory = ref(null);
const appTypes = ref([]);

const TYPE_ICONS = {
  pdf: FileText,
  excel: Table,
  word: ScrollText,
  pptx: Presentation,
  markdown: FileCode,
  text: Braces
};

function getTypeIcon(category) {
  return TYPE_ICONS[category] || FileText;
}

async function refreshStatus() {
  try {
    const list = await checkDefaultApps();
    if (list && list.length > 0) {
      appTypes.value = list;
    }
  } catch (e) {
    console.error('Failed to query default apps:', e);
  } finally {
    loadingStatus.value = false;
  }
}

/**
 * BUG FIX: this used to `setTimeout(..., 1200)` before refreshing, which made
 * every set/reset feel sluggish and left the button stuck in its pending state
 * for over a second even after the OS dialog closed. We now refresh as soon as
 * the command resolves, with one short grace period so Launch Services has
 * time to commit the change.
 */
async function applyAndRefresh(item, action) {
  settingCategory.value = item.category;
  try {
    await action(item.category);
    await new Promise(r => setTimeout(r, 260));
    await refreshStatus();
    showResultToast(item, true);
  } catch (e) {
    console.warn('Default app operation failed:', e);
    await refreshStatus();
    showResultToast(item, false, e?.message);
  } finally {
    settingCategory.value = null;
  }
}

const toastMessage = ref('');
let toastTimer = null;

function showResultToast(item, ok, detail = '') {
  const actionName = item.name;
  toastMessage.value = ok
    ? `已${item._actionLabel || '完成设置'}：${actionName}`
    : `操作失败：${actionName}${detail ? ' — ' + detail : ''}`;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastMessage.value = ''; }, 2600);
}

function handleSetDefault(item) {
  item._actionLabel = '设为默认打开';
  return applyAndRefresh(item, setDefaultAppForCategory);
}

function handleResetDefault(item) {
  item._actionLabel = '取消默认设置';
  return applyAndRefresh(item, resetDefaultAppForCategory);
}

async function handleOpenSysSettings() {
  await openSystemSettings();
}

onMounted(() => {
  refreshStatus();
});
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.15s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal-card {
  position: relative;
  width: 92%;
  max-width: 580px;
  background: #FFFFFF;
  border-radius: 18px;
  box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.06);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: scaleUp 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes scaleUp {
  from { transform: scale(0.96); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.modal-header {
  padding: 20px 24px 16px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  border-bottom: 1px solid #F1F5F9;
}

.header-title-group {
  display: flex;
  align-items: center;
  gap: 14px;
}

.modal-badge-icon {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: #EFF6FF;
  color: #2563EB;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.badge-icon {
  width: 20px;
  height: 20px;
}

.close-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 5px;
  border-radius: 6px;
  color: #94A3B8;
  display: flex;
  align-items: center;
  transition: all 0.14s;
}

.close-icon {
  width: 18px;
  height: 18px;
}

.close-btn:hover {
  background: #F1F5F9;
  color: #0F172A;
}

.close-btn:focus-visible,
.action-btn:focus-visible,
.sys-settings-btn:focus-visible,
.confirm-btn:focus-visible {
  outline: 2px solid #2563EB;
  outline-offset: 2px;
}

.status-check {
  width: 13px;
  height: 13px;
  color: #059669;
}

.type-icon {
  width: 19px;
  height: 19px;
}

.modal-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: #0F172A;
  letter-spacing: -0.2px;
}

.modal-subtitle {
  margin: 3px 0 0;
  font-size: 12px;
  color: #64748B;
}

.modal-body {
  padding: 16px 24px;
  max-height: 480px;
  overflow-y: auto;
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 40px 0;
  color: #64748B;
  font-size: 13px;
}

.mini-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid #E2E8F0;
  border-top-color: #2563EB;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.types-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.type-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 14px;
  background: #F8FAFC;
  border: 1px solid #E2E8F0;
  border-radius: 12px;
  transition: all 0.15s ease;
}

.type-row:hover {
  background: #F1F5F9;
  border-color: #CBD5E1;
}

.type-row.is-current-default {
  background: rgba(16, 185, 129, 0.04);
  border-color: rgba(16, 185, 129, 0.25);
}

.type-icon-box {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #FFFFFF;
  border: 1px solid #E2E8F0;
  flex-shrink: 0;
}

.type-icon-box.pdf { color: #DC2626; background: #FEF2F2; border-color: #FECACA; }
.type-icon-box.excel { color: #059669; background: #ECFDF5; border-color: #A7F3D0; }
.type-icon-box.word { color: #2563EB; background: #EFF6FF; border-color: #BFDBFE; }
.type-icon-box.pptx { color: #EA580C; background: #FFF7ED; border-color: #FED7AA; }
.type-icon-box.markdown { color: #7C3AED; background: #F5F3FF; border-color: #DDD6FE; }
.type-icon-box.text { color: #475569; background: #F8FAFC; border-color: #E2E8F0; }

.type-info {
  flex: 1;
  min-width: 0;
}

.type-name-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 2px;
}

.type-name {
  font-size: 13.5px;
  font-weight: 600;
  color: #1E293B;
}

.type-exts {
  font-size: 11.5px;
  color: #94A3B8;
  font-family: monospace;
}

.type-status-row {
  display: flex;
  align-items: center;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11.5px;
}

.status-badge.active {
  color: #059669;
  font-weight: 500;
}

.status-badge.normal {
  color: #64748B;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.status-dot.green {
  background: #10B981;
  box-shadow: 0 0 6px rgba(16, 185, 129, 0.4);
}

.status-dot.gray {
  background: #94A3B8;
}

.type-action {
  flex-shrink: 0;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 14px;
  font-size: 12.5px;
  font-weight: 600;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  transition: all 0.15s ease;
}

.action-btn.primary {
  background: #2563EB;
  color: #FFFFFF;
  box-shadow: 0 2px 6px rgba(37, 99, 235, 0.2);
}

.action-btn.primary:hover:not(:disabled) {
  background: #1D4ED8;
  transform: translateY(-1px);
}

.action-btn.primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.done-action-group {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.done-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 600;
  color: #059669;
  background: rgba(16, 185, 129, 0.1);
  padding: 4px 8px;
  border-radius: 6px;
}

.action-btn.cancel-btn {
  background: #F1F5F9;
  color: #64748B;
  border: 1px solid #CBD5E1;
  padding: 5px 10px;
  font-size: 11.5px;
}

.action-btn.cancel-btn:hover:not(:disabled) {
  background: #FEE2E2;
  color: #DC2626;
  border-color: #FCA5A5;
}

.action-btn.cancel-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.check-icon {
  width: 14px;
  height: 14px;
}

.modal-footer {
  padding: 14px 24px;
  border-top: 1px solid #F1F5F9;
  background: #FAFAFA;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sys-settings-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  font-size: 12.5px;
  color: #64748B;
  cursor: pointer;
  padding: 6px 10px;
  border-radius: 6px;
  transition: all 0.15s;
}

.sys-settings-btn:hover {
  background: #E2E8F0;
  color: #1E293B;
}

.link-icon {
  width: 13px;
  height: 13px;
}

.confirm-btn {
  padding: 7px 20px;
  background: #0F172A;
  color: #FFFFFF;
  font-size: 13px;
  font-weight: 600;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  transition: all 0.15s;
}

.confirm-btn:hover {
  background: #334155;
}

/* Result toast */
.modal-toast {
  position: absolute;
  left: 50%;
  bottom: 74px;
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  gap: 7px;
  background: rgba(15, 23, 42, 0.94);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  color: #FFFFFF;
  font-size: 12.5px;
  font-weight: 500;
  padding: 9px 16px;
  border-radius: 10px;
  box-shadow: 0 12px 28px -8px rgba(0, 0, 0, 0.4);
  z-index: 20;
  pointer-events: none;
  max-width: 88%;
  text-align: left;
}

.modal-toast.error {
  background: rgba(185, 28, 28, 0.95);
}

.toast-icon {
  width: 15px;
  height: 15px;
  flex-shrink: 0;
  color: #34D399;
}

.modal-toast.error .toast-icon {
  color: #FCA5A5;
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.22s cubic-bezier(0.16, 1, 0.3, 1), transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, 8px);
}

/* Buttons must not feel stuck: show an explicit spinner while the OS dialog is up */
.type-action .action-btn[disabled] {
  cursor: progress;
}
</style>
