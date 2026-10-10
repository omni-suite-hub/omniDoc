<template>
  <div class="modal-backdrop" @click.self="$emit('close')">
    <div class="about-card">
<button class="close-btn" @click="$emit('close')" title="关闭" aria-label="关闭">
        <X class="close-icon" />
      </button>

      <!-- App Identity Header -->
      <div class="app-identity">
        <div class="logo-box">
          <img src="/logo.png" class="about-logo-img" alt="OmniDoc" />
        </div>
        <h2 class="app-name">OmniDoc</h2>
        <div class="app-tagline">极速万能文档与代码预览器</div>
        <div class="version-tag">
          <span class="v-text">当前版本 v{{ currentVersion }}</span>
          <span v-if="hasUpdate" class="new-dot">有新版本</span>
        </div>
      </div>

      <!-- Update Checker Section -->
      <div class="update-section">
        <div class="update-header-row">
          <div class="update-status-title">
            <span v-if="isChecking" class="status-indicator checking"></span>
            <span v-else-if="isDownloading" class="status-indicator downloading"></span>
            <span v-else-if="hasUpdate" class="status-indicator available"></span>
            <span v-else-if="checkFailed" class="status-indicator unknown"></span>
            <span v-else class="status-indicator latest"></span>

            <span class="status-msg">
              {{ statusMessage }}
            </span>
          </div>

          <button 
            v-if="!isDownloading"
            class="check-btn" 
            :disabled="isChecking"
            @click="handleCheckUpdate"
          >
            <span v-if="isChecking">正在检查...</span>
            <span v-else>检查更新</span>
          </button>
          <button 
            v-else
            class="check-btn"
            @click="handleCancelDownload"
          >
            取消
          </button>
        </div>

        <!-- Update details if available -->
        <div v-if="hasUpdate || isDownloading" class="update-detail-card">
          <div class="detail-version">新版本：v{{ activeUpdateInfo?.latestVersion }} · {{ activeUpdateInfo?.releaseDate }}</div>
          <div class="detail-notes">{{ activeUpdateInfo?.releaseNotes || '性能优化，修复已知问题并提升稳定性。' }}</div>

          <!-- Download progress -->
          <div v-if="isDownloading" class="download-progress-wrap">
            <div class="progress-track" role="progressbar" :aria-valuenow="Math.round(downloadPercent)" aria-valuemin="0" aria-valuemax="100">
              <div class="progress-fill" :style="{ width: downloadPercent + '%' }"></div>
            </div>
            <div class="progress-meta">
              <span>{{ progressLabel }}</span>
              <span v-if="downloadPercent > 0">{{ Math.round(downloadPercent) }}%</span>
            </div>
          </div>

          <!-- Primary action: install in-app when a real binary exists -->
          <button 
            v-if="!isDownloading"
            class="download-cta-btn"
            @click="handleInstallUpdate"
          >
            <Download class="dl-icon" />
            <span>{{ canInstallInApp ? '下载并安装' : '前往下载页' }}</span>
          </button>

          <p v-if="!isDownloading && canInstallInApp" class="install-hint">
            安装将自动完成，应用会重启一次
          </p>
        </div>
      </div>

      <!-- Feature Capabilities Grid -->
      <div class="features-summary">
<div class="feat-box">
          <div class="feat-icon-ring"><Zap class="feat-icon" /></div>
          <div class="feat-title">秒开</div>
          <div class="feat-sub">Rust 内核解析，零广告零弹窗</div>
        </div>
        <div class="feat-box">
          <div class="feat-icon-ring green"><ShieldCheck class="feat-icon" /></div>
          <div class="feat-title">纯本地</div>
          <div class="feat-sub">100% 本地运算，文件绝不上云</div>
        </div>
        <div class="feat-box">
          <div class="feat-icon-ring purple"><Layers class="feat-icon" /></div>
          <div class="feat-title">全格式</div>
          <div class="feat-sub">PDF / Office / MD / 代码</div>
        </div>
      </div>

      <!-- Footer Info -->
      <div class="about-footer">
<div class="tech-stack-info">
          基于 Tauri 2 (Rust) · Vue 3 · PDF.js · Highlight.js 构建
        </div>
        <div class="copyright-info">
          © 2026 OmniDoc. All rights reserved.
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { getVersion } from '@tauri-apps/api/app';
import {
  openExternalUrl,
  checkAppUpdate,
  downloadUpdatePackage,
  installUpdatePackage,
  formatFileSize
} from '../utils/fileHandler.js';
import { X, Download, Zap, ShieldCheck, Layers } from 'lucide-vue-next';

const props = defineProps({
  updateInfo: {
    type: Object,
    default: null
  }
});

const emit = defineEmits(['close', 'check-update', 'update-found']);

/**
 * Read the real version from the running app.
 *
 * BUG FIX: this previously read `window.__TAURI__?.version`, which does not
 * exist in Tauri v2 — that namespace exposes `invoke`, `transformCallback`
 * and event helpers, nothing else. The expression was always undefined, so the
 * modal silently fell back to a hard-coded string and could display a version
 * that had nothing to do with the installed build (it showed v1.2.0 while the
 * app was 1.3.0).
 *
 * `getVersion()` from @tauri-apps/api/app is the supported API and reads
 * CFBundleShortVersionString from the bundle.
 */
const FALLBACK_VERSION = '1.7.0';
const currentVersion = ref(FALLBACK_VERSION);

const isChecking = ref(false);
const hasUpdate = ref(false);
// True when the check could not be completed — shown differently from
// "up to date", because "we don't know" must not look like "all good".
const checkFailed = ref(false);
const statusMessage = ref('OmniDoc 已是最新版本');
const activeUpdateInfo = ref(props.updateInfo || null);

// --- In-app install state ---
const isDownloading = ref(false);
const downloadPercent = ref(0);
const downloadBytes = ref(0);
let cancelRequested = false;

/** A real .dmg asset exists, so we can install without leaving the app. */
const canInstallInApp = computed(
  () => !!(activeUpdateInfo.value?.installerUrl)
);

const progressLabel = computed(() => {
  if (downloadPercent.value >= 100 || downloadBytes.value === 0) {
    return downloadPercent.value >= 100 ? '下载完成，正在安装...' : '正在连接...';
  }
  return `正在下载 ${formatFileSize(downloadBytes.value)}...`;
});

onMounted(async () => {
  try {
    const v = await getVersion();
    if (v) currentVersion.value = v;
  } catch (e) {
    // Browser-only dev mode has no Tauri runtime; keep the fallback
    console.warn('getVersion unavailable:', e);
  }

  if (props.updateInfo?.hasUpdate && props.updateInfo?.latestVersion) {
    hasUpdate.value = true;
    activeUpdateInfo.value = props.updateInfo;
    statusMessage.value = `发现新版本 v${props.updateInfo.latestVersion}`;
  }
});

/**
 * Check for updates and report the *actual* outcome.
 *
 * BUG FIX: the original handler slept 600ms then unconditionally set
 * hasUpdate = true, so the button always claimed an update existed — even
 * with no feed configured, advertising a v1.1.0 that was never released and
 * linking to a repo that did not exist.
 *
 * `checkAppUpdate` returns `{ error }` when the check could not be completed
 * (no releases yet, rate limited, offline). Those are different situations and
 * each gets its own message, so the user is never told "you are up to date"
 * when in fact we simply do not know.
 */
async function handleCheckUpdate() {
  isChecking.value = true;
  checkFailed.value = false;
  statusMessage.value = '正在检查更新...';

  try {
    const res = await checkAppUpdate();

    if (res && res.error) {
      // Could not determine — say why instead of guessing
      checkFailed.value = true;
      statusMessage.value = res.error === '尚未发布任何版本'
        ? '暂无新版本（尚未发布 Release）'
        : `检查未完成：${res.error}`;
    } else if (res && res.hasUpdate) {
      activeUpdateInfo.value = res;
      hasUpdate.value = true;
      statusMessage.value = `发现新版本 v${res.latestVersion}`;
      emit('update-found', res);
    } else {
      hasUpdate.value = false;
      statusMessage.value = '当前已是最新版本';
    }
  } catch (e) {
    checkFailed.value = true;
    statusMessage.value = '检查更新失败，请稍后重试';
  } finally {
    isChecking.value = false;
  }
}

function handleDownload() {
  const url = activeUpdateInfo.value?.downloadUrl;
  if (!url) return;
  openExternalUrl(url);
}

/**
 * Download the new build and install it without leaving the app.
 *
 * Previously this only opened the GitHub release page, which meant the user
 * had to download, mount, and copy the DMG by hand. Now the app does all of
 * that: it downloads to a temp file (with progress), then hands off to a
 * detached installer that waits for us to quit before swapping the bundle.
 */
async function handleInstallUpdate() {
  const info = activeUpdateInfo.value;
  if (!info?.installerUrl) {
    // No binary attached to the release — fall back to the web page.
    handleDownload();
    return;
  }

  cancelRequested = false;
  isDownloading.value = true;
  downloadPercent.value = 0;
  downloadBytes.value = 0;
  statusMessage.value = `正在下载 v${info.latestVersion}...`;

  let dmgPath = null;
  try {
    dmgPath = await downloadUpdatePackage(
      info.installerUrl,
      info.installerName || 'OmniDoc.dmg',
      (p) => {
        if (cancelRequested) return;
        downloadBytes.value = p.downloaded || 0;
        // With an unknown total, curl-style downloads report 0; fall back to
        // a byte-based heuristic so the bar still moves.
        if (p.total > 0) {
          downloadPercent.value = p.percent;
        } else if (info.installerSize > 0) {
          downloadPercent.value = Math.min(
            99,
            ((p.downloaded || 0) / info.installerSize) * 100
          );
        }
      }
    );

    if (cancelRequested) {
      statusMessage.value = '已取消下载';
      isDownloading.value = false;
      return;
    }

    downloadPercent.value = 100;
    statusMessage.value = '正在安装，应用将重启...';

    // This call returns immediately; the app quits a moment later.
    await installUpdatePackage(dmgPath, 'OmniDoc');
  } catch (e) {
    console.error('Update install failed:', e);
    isDownloading.value = false;
    checkFailed.value = true;
    const reason = e && typeof e === 'string' ? e.replace(/^Error:\s*/, '') : '';
    statusMessage.value = reason
      ? `安装失败：${reason}`
      : '安装失败，请前往下载页手动更新';
  }
}

function handleCancelDownload() {
  cancelRequested = true;
  isDownloading.value = false;
  downloadPercent.value = 0;
  downloadBytes.value = 0;
  statusMessage.value = '已取消下载';
}
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  animation: fadeIn 0.15s ease-out;
}

.about-card {
  width: 90%;
  max-width: 460px;
  background: #FFFFFF;
  border-radius: 20px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  padding: 32px 28px 24px;
  position: relative;
  text-align: center;
}

.close-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: none;
  background: #F1F5F9;
  color: #64748B;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.14s;
}

.close-icon {
  width: 16px;
  height: 16px;
}

.close-btn:hover {
  background: #E2E8F0;
  color: #0F172A;
}

.close-btn:focus-visible,
.check-btn:focus-visible,
.download-cta-btn:focus-visible {
  outline: 2px solid #2563EB;
  outline-offset: 2px;
}

.close-btn:hover {
  background: #E2E8F0;
  color: #0F172A;
}

.app-identity {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 22px;
}

.logo-box {
  width: 72px;
  height: 72px;
  border-radius: 18px;
  background: #FFFFFF;
  box-shadow: 0 8px 20px -4px rgba(0, 0, 0, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 14px;
}

.about-logo-img {
  width: 56px;
  height: 56px;
  object-fit: contain;
}

.app-name {
  font-size: 22px;
  font-weight: 800;
  color: #0F172A;
  letter-spacing: -0.5px;
  margin-bottom: 4px;
}

.app-tagline {
  font-size: 13px;
  color: #64748B;
  font-weight: 500;
  margin-bottom: 10px;
}

.version-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #F1F5F9;
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 11.5px;
  font-weight: 600;
  color: #475569;
}

.new-dot {
  background: #DC2626;
  color: #FFFFFF;
  font-size: 9.5px;
  padding: 1px 5px;
  border-radius: 6px;
}

/* Update Section */
.update-section {
  background: #F8FAFC;
  border: 1px solid #E2E8F0;
  border-radius: 12px;
  padding: 14px 16px;
  margin-bottom: 20px;
  text-align: left;
}

.update-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.update-status-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-indicator.latest {
  background: #10B981;
}

.status-indicator.checking {
  background: #3B82F6;
  animation: pulse 1s infinite;
}

.status-indicator.available {
  background: #EA580C;
}

/* "We could not determine" — amber, not green, so it never reads as "up to date" */
.status-indicator.unknown {
  background: #D97706;
}

.status-indicator.downloading {
  background: #2563EB;
  animation: pulse 1.2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}

/* Download progress */
.download-progress-wrap {
  margin-top: 14px;
}

.progress-track {
  height: 6px;
  border-radius: 999px;
  background: #E2E8F0;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #2563EB, #3B82F6);
  transition: width 0.25s ease-out;
}

.progress-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 7px;
  font-size: 11.5px;
  color: #64748B;
}

.install-hint {
  margin: 9px 0 0;
  font-size: 11.5px;
  color: #94A3B8;
  text-align: center;
}

.status-msg {
  font-size: 12.5px;
  font-weight: 600;
  color: #1E293B;
}

.check-btn {
  font-size: 11.5px;
  font-weight: 600;
  color: #2563EB;
  background: #EFF6FF;
  border: 1px solid #BFDBFE;
  padding: 4px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.12s;
}

.check-btn:hover:not(:disabled) {
  background: #DBEAFE;
}

.check-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.update-detail-card {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #E2E8F0;
}

.detail-version {
  font-size: 12px;
  font-weight: 700;
  color: #0F172A;
  margin-bottom: 4px;
}

.detail-notes {
  font-size: 11.5px;
  color: #64748B;
  line-height: 1.4;
  margin-bottom: 10px;
}

.download-cta-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: #2563EB;
  color: #FFFFFF;
  font-size: 12.5px;
  font-weight: 600;
  padding: 8px 14px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
}

.download-cta-btn:hover {
  background: #1D4ED8;
}

.dl-icon {
  width: 14px;
  height: 14px;
}

/* Features Grid */
.features-summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 22px;
}

.feat-box {
  background: #F8FAFC;
  border: 1px solid #F1F5F9;
  border-radius: 12px;
  padding: 14px 10px;
}

.feat-icon-ring {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  margin: 0 auto 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(245, 158, 11, 0.12);
  color: #D97706;
}

.feat-icon-ring.green {
  background: rgba(5, 150, 105, 0.12);
  color: #059669;
}

.feat-icon-ring.purple {
  background: rgba(124, 58, 237, 0.12);
  color: #7C3AED;
}

.feat-icon {
  width: 17px;
  height: 17px;
}

.feat-title {
  font-size: 12px;
  font-weight: 700;
  color: #1E293B;
  margin-bottom: 2px;
}

.feat-sub {
  font-size: 10px;
  color: #94A3B8;
  line-height: 1.3;
}

/* Footer */
.about-footer {
  font-size: 11px;
  color: #94A3B8;
  line-height: 1.6;
}

.tech-stack-info {
  margin-bottom: 2px;
}
</style>
