import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export const SUPPORTED_EXTENSIONS = {
  // Documents
  pdf: { type: 'pdf', label: 'PDF 文档', icon: 'FileText', color: '#DC2626' },
  docx: { type: 'docx', label: 'Word 文档', icon: 'FileText', color: '#2563EB' },
  pptx: { type: 'pptx', label: 'PowerPoint 演示', icon: 'Presentation', color: '#EA580C' },
  xlsx: { type: 'spreadsheet', label: 'Excel 表格', icon: 'Table', color: '#059669' },
  xls: { type: 'spreadsheet', label: 'Excel 表格', icon: 'Table', color: '#059669' },
  csv: { type: 'spreadsheet', label: 'CSV 数据表', icon: 'Table', color: '#059669' },
  md: { type: 'markdown', label: 'Markdown 笔记', icon: 'FileCode', color: '#7C3AED' },
  markdown: { type: 'markdown', label: 'Markdown 笔记', icon: 'FileCode', color: '#7C3AED' },

  // Plain Text & Logs
  txt: { type: 'text', label: '纯文本', icon: 'FileText', color: '#475569' },
  text: { type: 'text', label: '纯文本', icon: 'FileText', color: '#475569' },
  log: { type: 'text', label: '运行日志', icon: 'FileText', color: '#475569' },

  // Code: Web & Scripting
  js: { type: 'code', label: 'JavaScript 脚本', lang: 'javascript', langLabel: 'JavaScript', color: '#F59E0B' },
  mjs: { type: 'code', label: 'JavaScript 模块', lang: 'javascript', langLabel: 'JavaScript', color: '#F59E0B' },
  cjs: { type: 'code', label: 'CommonJS 模块', lang: 'javascript', langLabel: 'JavaScript', color: '#F59E0B' },
  jsx: { type: 'code', label: 'React JSX 组件', lang: 'javascript', langLabel: 'React JSX', color: '#06B6D4' },
  ts: { type: 'code', label: 'TypeScript 源码', lang: 'typescript', langLabel: 'TypeScript', color: '#3178C6' },
  mts: { type: 'code', label: 'TypeScript 模块', lang: 'typescript', langLabel: 'TypeScript', color: '#3178C6' },
  cts: { type: 'code', label: 'TypeScript 模块', lang: 'typescript', langLabel: 'TypeScript', color: '#3178C6' },
  tsx: { type: 'code', label: 'React TSX 组件', lang: 'typescript', langLabel: 'React TSX', color: '#3178C6' },
  vue: { type: 'code', label: 'Vue 单文件组件', lang: 'html', langLabel: 'Vue Component', color: '#41B883' },
  html: { type: 'code', label: 'HTML 网页', lang: 'html', langLabel: 'HTML', color: '#E34F26' },
  htm: { type: 'code', label: 'HTML 网页', lang: 'html', langLabel: 'HTML', color: '#E34F26' },
  css: { type: 'code', label: 'CSS 样式表', lang: 'css', langLabel: 'CSS', color: '#1572B6' },
  scss: { type: 'code', label: 'SCSS 预处理样式', lang: 'scss', langLabel: 'SCSS', color: '#CF649A' },
  sass: { type: 'code', label: 'Sass 样式', lang: 'scss', langLabel: 'Sass', color: '#CF649A' },
  less: { type: 'code', label: 'Less 样式', lang: 'less', langLabel: 'Less', color: '#1D365D' },

  // Code: Systems & Backend
  py: { type: 'code', label: 'Python 脚本', lang: 'python', langLabel: 'Python', color: '#3776AB' },
  pyw: { type: 'code', label: 'Python 脚本', lang: 'python', langLabel: 'Python', color: '#3776AB' },
  rs: { type: 'code', label: 'Rust 源码', lang: 'rust', langLabel: 'Rust', color: '#DEA584' },
  go: { type: 'code', label: 'Go 语言源码', lang: 'go', langLabel: 'Go', color: '#00ADD8' },
  java: { type: 'code', label: 'Java 源码', lang: 'java', langLabel: 'Java', color: '#B07219' },
  kt: { type: 'code', label: 'Kotlin 源码', lang: 'kotlin', langLabel: 'Kotlin', color: '#A97BFF' },
  kts: { type: 'code', label: 'Kotlin 脚本', lang: 'kotlin', langLabel: 'Kotlin', color: '#A97BFF' },
  c: { type: 'code', label: 'C 语言源码', lang: 'c', langLabel: 'C', color: '#555555' },
  cpp: { type: 'code', label: 'C++ 源码', lang: 'cpp', langLabel: 'C++', color: '#F34B7D' },
  cc: { type: 'code', label: 'C++ 源码', lang: 'cpp', langLabel: 'C++', color: '#F34B7D' },
  cxx: { type: 'code', label: 'C++ 源码', lang: 'cpp', langLabel: 'C++', color: '#F34B7D' },
  h: { type: 'code', label: 'C/C++ 头文件', lang: 'c', langLabel: 'Header', color: '#555555' },
  hpp: { type: 'code', label: 'C++ 头文件', lang: 'cpp', langLabel: 'C++ Header', color: '#F34B7D' },
  cs: { type: 'code', label: 'C# 源码', lang: 'csharp', langLabel: 'C#', color: '#178600' },
  php: { type: 'code', label: 'PHP 脚本', lang: 'php', langLabel: 'PHP', color: '#4F5D95' },
  swift: { type: 'code', label: 'Swift 源码', lang: 'swift', langLabel: 'Swift', color: '#F05138' },
  rb: { type: 'code', label: 'Ruby 脚本', lang: 'ruby', langLabel: 'Ruby', color: '#701516' },
  lua: { type: 'code', label: 'Lua 脚本', lang: 'lua', langLabel: 'Lua', color: '#000080' },
  sql: { type: 'code', label: 'SQL 数据库脚本', lang: 'sql', langLabel: 'SQL', color: '#E38C00' },
  sh: { type: 'code', label: 'Shell 脚本', lang: 'bash', langLabel: 'Shell / Bash', color: '#89E051' },
  bash: { type: 'code', label: 'Bash 脚本', lang: 'bash', langLabel: 'Bash', color: '#89E051' },
  zsh: { type: 'code', label: 'Zsh 脚本', lang: 'bash', langLabel: 'Zsh', color: '#89E051' },

  // Data & Configuration
  json: { type: 'code', label: 'JSON 数据', lang: 'json', langLabel: 'JSON', color: '#D97706' },
  yaml: { type: 'code', label: 'YAML 配置文件', lang: 'yaml', langLabel: 'YAML', color: '#CB171E' },
  yml: { type: 'code', label: 'YAML 配置文件', lang: 'yaml', langLabel: 'YAML', color: '#CB171E' },
  toml: { type: 'code', label: 'TOML 配置文件', lang: 'ini', langLabel: 'TOML', color: '#9C4221' },
  xml: { type: 'code', label: 'XML 标记文件', lang: 'xml', langLabel: 'XML', color: '#0060AC' },
  ini: { type: 'code', label: 'INI 配置文件', lang: 'ini', langLabel: 'INI', color: '#6E7681' },
  env: { type: 'code', label: '环境变量配置', lang: 'bash', langLabel: 'ENV Config', color: '#6E7681' },
  conf: { type: 'code', label: '配置文件', lang: 'ini', langLabel: 'Config', color: '#6E7681' }
};

export function formatFileSize(bytes) {
  const n = Number(bytes);
  // BUG FIX: the old version did Math.log(n)/Math.log(1024) unguarded, so any
  // value below 1 byte produced a negative index and rendered "512 undefined".
  if (!Number.isFinite(n) || n <= 0) return '0 B';
  if (n < 1024) return `${Math.round(n)} B`;
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(n) / Math.log(k)), sizes.length - 1);
  return parseFloat((n / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function getFileCategory(filename) {
  if (!filename) return null;
  const ext = filename.split('.').pop().toLowerCase();
  return SUPPORTED_EXTENSIONS[ext] || null;
}

/**
 * Open native OS file dialog via Tauri Rust backend
 */
export async function openNativeFileDialog() {
  try {
    const path = await invoke('open_file_dialog');
    return path;
  } catch (err) {
    console.warn('Native dialog unavailable, falling back:', err);
    return null;
  }
}

/**
 * Open native OS folder dialog via Tauri Rust backend
 */
export async function openNativeFolderDialog() {
  try {
    const path = await invoke('open_folder_dialog');
    return path;
  } catch (err) {
    console.warn('Native folder dialog unavailable:', err);
    return null;
  }
}

/**
 * Check if path is a directory
 */
export async function isPathADirectory(path) {
  try {
    return await invoke('is_directory', { path });
  } catch (e) {
    return false;
  }
}

/**
 * Read folder files recursively
 */
export async function readFolderFiles(folderPath) {
  return await invoke('read_folder_files', { folderPath });
}

/**
 * Query macOS default applications status
 */
export async function checkDefaultApps() {
  try {
    const res = await invoke('check_default_apps');
    return Array.isArray(res) ? res : [];
  } catch (e) {
    console.warn('checkDefaultApps failed:', e);
    return [];
  }
}

/**
 * Set default application for document category
 */
export async function setDefaultAppForCategory(category) {
  return await invoke('set_default_app_for_category', { category });
}

/**
 * Reset default application for document category back to system default
 */
export async function resetDefaultAppForCategory(category) {
  return await invoke('reset_default_app_for_category', { category });
}

/**
 * Open macOS System Settings
 */
export async function openSystemSettings() {
  try {
    await invoke('open_system_settings');
  } catch (e) {
    console.warn('openSystemSettings failed:', e);
  }
}

/**
 * Open an external URL via system default browser
 */
export async function openExternalUrl(url) {
  try {
    await invoke('open_url', { url });
  } catch (e) {
    console.warn('Tauri open_url failed, falling back to window.open:', e);
    window.open(url, '_blank');
  }
}

/**
 * Recent Files History Storage Helpers
 */
const RECENT_STORAGE_KEY = 'omnidoc_recent_documents_v2';
const MAX_RECENT_COUNT = 30;

export function getRecentFiles() {
  try {
    const raw = localStorage.getItem(RECENT_STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (e) {
    console.error('Failed to read recent files from localStorage:', e);
    return [];
  }
}

export function addRecentFile(doc) {
  if (!doc || !doc.path) return;
  // Ignore virtual sample files
  if (doc.path.startsWith('(内置示例)')) return;

  try {
    const list = getRecentFiles();
    const existingIndex = list.findIndex(item => item.path === doc.path);
    const item = {
      path: doc.path,
      name: doc.name || doc.path.split('/').pop().split('\\').pop(),
      type: doc.type,
      label: doc.label || doc.extension?.toUpperCase(),
      size: doc.size || 0,
      sizeFormatted: doc.sizeFormatted || formatFileSize(doc.size || 0),
      extension: doc.extension || '',
      langLabel: doc.langLabel || '',
      lastOpened: Date.now()
    };

    if (existingIndex !== -1) {
      list.splice(existingIndex, 1);
    }
    list.unshift(item);

    if (list.length > MAX_RECENT_COUNT) {
      list.length = MAX_RECENT_COUNT;
    }

    localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    console.error('Failed to save recent file to localStorage:', e);
  }
}

export function removeRecentFile(path) {
  try {
    const list = getRecentFiles().filter(item => item.path !== path);
    localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(list));
    return list;
  } catch (e) {
    console.error('Failed to remove recent file:', e);
    return [];
  }
}

export function clearRecentFiles() {
  try {
    localStorage.removeItem(RECENT_STORAGE_KEY);
  } catch (e) {
    console.error('Failed to clear recent files:', e);
  }
}

/**
 * App Update Checker — reads the latest GitHub Release.
 *
 * HISTORY (three bugs fixed here):
 *  1. It slept 600ms then unconditionally returned `hasUpdate: false`, while the
 *     About modal hard-coded `latestVersion: '1.1.0'` and linked to a repo that
 *     did not exist — users were told an update existed for a release that was
 *     never made.
 *  2. Replacing that with an empty feed fixed the lie but made "check for
 *     updates" a button that could only ever say "you are up to date".
 *  3. The version comparison also ignored pre-release tags.
 *
 * The feed URL is resolved at call time so it can be overridden from
 * localStorage (useful for testing a private/forked repo) without a rebuild.
 */
const DEFAULT_RELEASE_FEED =
  'https://api.github.com/repos/omni-suite-hub/omniDoc/releases/latest';

const RELEASE_FEED_KEY = 'omnidoc_release_feed';
const CURRENT_VERSION = '1.6.0';

/**
 * Pull a semver out of an arbitrary release tag.
 *
 * BUG FIX: the previous version only stripped a leading "v", so a tag like
 * `tauri-v2.12.2` or `OmniDoc-v1.4.0` collapsed to `[0]` and compared as
 * "older than everything" — updates were silently never offered.
 */
function extractVersion(tag) {
  if (!tag) return '';
  const m = String(tag).trim().match(/(\d+)\.(\d+)(?:\.(\d+))?/);
  return m ? `${m[1]}.${m[2]}.${m[3] ?? 0}` : '';
}

/** Compare semver-ish strings. Returns 1 if a > b, -1 if a < b, 0 if equal. */
function compareVersions(a, b) {
  const norm = (v) => String(v || '0')
    .split('.')
    .map((n) => parseInt(n, 10) || 0);
  const pa = norm(a);
  const pb = norm(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}

function getReleaseFeed() {
  try {
    return localStorage.getItem(RELEASE_FEED_KEY) || DEFAULT_RELEASE_FEED;
  } catch (e) {
    return DEFAULT_RELEASE_FEED;
  }
}

export async function checkAppUpdate() {
  const base = {
    currentVersion: CURRENT_VERSION,
    hasUpdate: false,
    latestVersion: CURRENT_VERSION,
    releaseDate: '',
    releaseNotes: '',
    downloadUrl: ''
  };

  const feed = getReleaseFeed();
  if (!feed) return { ...base, error: '未配置更新源' };

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(feed, {
      signal: ctrl.signal,
      headers: { Accept: 'application/vnd.github+json' }
    });
    clearTimeout(timer);

    // 404 = repo has no releases yet; 403 = rate limited. Both are "no update
    // known" rather than a hard failure, but we still surface them honestly.
    if (res.status === 404) return { ...base, error: '尚未发布任何版本' };
    if (res.status === 403) return { ...base, error: 'GitHub API 请求受限' };
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    const latest = extractVersion(data.tag_name || data.name);
    if (!latest) return { ...base, error: '更新源返回数据格式异常' };

    const isPrerelease = data.prerelease === true;
    const newer = !isPrerelease && compareVersions(latest, CURRENT_VERSION) > 0;

    // Prefer the actual DMG asset so the update can be installed in-app;
    // fall back to the release page when no binary is attached.
    const asset =
      Array.isArray(data.assets)
        ? data.assets.find(a => /\.dmg$/i.test(a.name || ''))
        : null;
    const downloadUrl = asset ? asset.browser_download_url : '';
    const assetName = asset ? asset.name : '';

    return {
      currentVersion: CURRENT_VERSION,
      hasUpdate: newer,
      latestVersion: latest,
      releaseDate: data.published_at ? data.published_at.slice(0, 10) : '',
      releaseNotes: data.body || '',
      downloadUrl: data.html_url || '',
      // Present only when a real binary can be fetched — the modal uses this
      // to decide between "install now" and "open release page".
      installerUrl: downloadUrl,
      installerName: assetName,
      installerSize: asset ? asset.size : 0
    };
  } catch (e) {
    console.warn('Update check failed:', e);
    return { ...base, error: e.name === 'AbortError' ? '检查超时' : e.message };
  }
}

/**
 * Load document from file path (Tauri native IPC)
 */
export async function loadDocumentFromPath(path) {
  const ext = path.split('.').pop().toLowerCase();
  const cat = SUPPORTED_EXTENSIONS[ext] || { type: 'text', label: '纯文本', color: '#475569' };
  const name = path.split('/').pop().split('\\').pop();

  // BUG FIX: CSV is plain text, but it was classified as "spreadsheet" and read
  // through read_binary_file, skipping the chardetng encoding detection. A GBK/GB18030
  // CSV therefore rendered as mojibake ("姓名" -> "ÐÅÃû"). We now detect the
  // encoding ourselves and hand SheetJS a properly decoded UTF-8 string.
  if (ext === 'csv') {
    const res = await invoke('read_text_file', { path });
    return {
      name: res.name || name,
      path: res.path || path,
      type: 'spreadsheet',
      label: cat.label,
      size: res.size,
      sizeFormatted: formatFileSize(res.size),
      // SheetJS accepts a string and then treats it as text
      buffer: res.content,
      isTextBuffer: true,
      encoding: res.encoding,
      extension: ext
    };
  }

  if (cat.type === 'text' || cat.type === 'markdown' || cat.type === 'code') {
    const res = await invoke('read_text_file', { path });
    return {
      name: res.name || name,
      path: res.path || path,
      type: cat.type,
      label: cat.label,
      lang: cat.lang || '',
      langLabel: cat.langLabel || '',
      size: res.size,
      sizeFormatted: formatFileSize(res.size),
      content: res.content,
      encoding: res.encoding || 'UTF-8',
      lines: res.lines,
      chars: res.chars,
      extension: ext
    };
  } else {
    const res = await invoke('read_binary_file', { path });
    const uint8 = new Uint8Array(res.data);
    return {
      name: res.name || name,
      path: res.path || path,
      type: cat.type,
      label: cat.label,
      size: res.size,
      sizeFormatted: formatFileSize(res.size),
      buffer: uint8.buffer,
      extension: ext
    };
  }
}

/**
 * Load document from HTML5 File object (Drag & Drop or browser input)
 */
export async function loadDocumentFromFileObject(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  const cat = SUPPORTED_EXTENSIONS[ext] || { type: 'text', label: '纯文本', color: '#475569' };

  // Same CSV encoding fix as loadDocumentFromPath
  if (ext === 'csv') {
    const arrayBuf = await file.arrayBuffer();
    let content = '';
    let encoding = 'UTF-8';
    try {
      content = new TextDecoder('utf-8', { fatal: true }).decode(arrayBuf);
    } catch (e) {
      content = new TextDecoder('gb18030').decode(arrayBuf);
      encoding = 'GB18030';
    }
    return {
      name: file.name,
      path: file.name,
      type: 'spreadsheet',
      label: cat.label,
      size: file.size,
      sizeFormatted: formatFileSize(file.size),
      buffer: content,
      isTextBuffer: true,
      encoding,
      extension: ext
    };
  }

  if (cat.type === 'text' || cat.type === 'markdown' || cat.type === 'code') {
    const arrayBuf = await file.arrayBuffer();
    let content = '';
    let encoding = 'UTF-8';
    try {
      const decoder = new TextDecoder('utf-8', { fatal: true });
      content = decoder.decode(arrayBuf);
    } catch (e) {
      const decoder = new TextDecoder('gb18030');
      content = decoder.decode(arrayBuf);
      encoding = 'GB18030';
    }

    return {
      name: file.name,
      path: file.name,
      type: cat.type,
      label: cat.label,
      lang: cat.lang || '',
      langLabel: cat.langLabel || '',
      size: file.size,
      sizeFormatted: formatFileSize(file.size),
      content,
      encoding,
      lines: content.split('\n').length,
      chars: content.length,
      extension: ext
    };
  } else {
    const buffer = await file.arrayBuffer();
    return {
      name: file.name,
      path: file.name,
      type: cat.type,
      label: cat.label,
      size: file.size,
      sizeFormatted: formatFileSize(file.size),
      buffer,
      extension: ext
    };
  }
}

// ---------------------------------------------------------------------------
// In-app update installation
// ---------------------------------------------------------------------------

/**
 * Download an update package. `onProgress` receives
 * { downloaded, total, percent } as the Rust side streams progress.
 */
export async function downloadUpdatePackage(url, filename, onProgress) {
  let unlisten = null;
  if (onProgress && typeof window !== 'undefined') {
    unlisten = await listen('update-progress', (event) => {
      try {
        onProgress(event.payload);
      } catch (e) {
        /* listener errors must not break the download */
      }
    });
  }

  try {
    return await invoke('download_update', { url, filename });
  } finally {
    if (unlisten) {
      try {
        unlisten();
      } catch (e) {
        /* already gone */
      }
    }
  }
}

/**
 * Replace the current app with the downloaded package and relaunch.
 * The app quits as part of this, so callers must not do more work afterwards.
 */
export async function installUpdatePackage(dmgPath, appName = 'OmniDoc') {
  await invoke('install_update', { dmgPath, appName });
}
