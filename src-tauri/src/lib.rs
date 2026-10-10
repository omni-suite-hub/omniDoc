use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::sync::Mutex;
use tauri::{Emitter, Manager, RunEvent};

#[cfg(target_os = "macos")]
use std::ffi::{CStr, CString};
#[cfg(target_os = "macos")]
use std::os::raw::{c_char, c_int};

#[cfg(target_os = "macos")]
unsafe extern "C" {
    fn macos_is_default_for_uti(uti: *const c_char) -> c_int;
    fn macos_get_default_app_name_for_uti(uti: *const c_char) -> *mut c_char;
    fn macos_set_default_app_for_uti(uti: *const c_char) -> c_int;
    fn macos_reset_default_app_for_uti(uti: *const c_char) -> c_int;
    fn macos_open_system_settings();
    fn free(ptr: *mut std::ffi::c_void);
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct TextFilePayload {
    pub content: String,
    pub encoding: String,
    pub size: u64,
    pub lines: usize,
    pub chars: usize,
    pub name: String,
    pub path: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct BinaryFilePayload {
    pub data: Vec<u8>,
    pub size: u64,
    pub name: String,
    pub path: String,
    pub extension: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct FileMetadata {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub extension: String,
    pub modified_ms: u64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct FolderFileItem {
    pub name: String,
    pub path: String,
    pub rel_path: String,
    pub size: u64,
    pub doc_type: String,
    pub extension: String,
    pub modified_ms: u64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct FolderPayload {
    pub name: String,
    pub path: String,
    pub total_files: usize,
    pub files: Vec<FolderFileItem>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AppDefaultInfo {
    pub category: String,
    pub name: String,
    pub extensions: Vec<String>,
    pub uti: String,
    pub is_default: bool,
    pub current_app_name: String,
}

pub struct OpenedFilesState(pub Mutex<Vec<String>>);

#[tauri::command]
fn open_file_dialog() -> Option<String> {
    let file = rfd::FileDialog::new()
        .add_filter(
            "所有支持文档与代码",
            &[
                "md", "markdown", "txt", "text", "log", "json", "csv", "xlsx", "xls", "docx", "pptx", "pdf",
                "js", "ts", "jsx", "tsx", "py", "rs", "go", "java", "c", "cpp", "h", "hpp", "cs",
                "html", "css", "scss", "less", "vue", "sql", "sh", "bash", "yaml", "yml", "xml", "toml", "ini", "env",
                "swift", "kt", "php", "rb", "lua"
            ],
        )
        .add_filter("PDF 文档", &["pdf"])
        .add_filter("Excel / CSV 表格", &["xlsx", "xls", "csv"])
        .add_filter("Word 文档", &["docx"])
        .add_filter("PowerPoint 演示", &["pptx"])
        .add_filter("Markdown 笔记", &["md", "markdown"])
        .add_filter("代码源文件", &[
            "js", "ts", "jsx", "tsx", "py", "rs", "go", "java", "c", "cpp", "h", "hpp", "cs",
            "html", "css", "scss", "less", "vue", "sql", "sh", "bash", "yaml", "yml", "xml", "toml", "ini",
            "swift", "kt", "php", "rb", "lua", "json"
        ])
        .add_filter("纯文本与日志", &["txt", "text", "log"])
        .pick_file();

    file.map(|p| p.to_string_lossy().to_string())
}

#[tauri::command]
fn open_folder_dialog() -> Option<String> {
    let folder = rfd::FileDialog::new().pick_folder();
    folder.map(|p| p.to_string_lossy().to_string())
}

#[tauri::command]
fn is_directory(path: String) -> bool {
    Path::new(&path).is_dir()
}

fn scan_dir_recursive(root: &Path, current: &Path, depth: usize, max_depth: usize, out: &mut Vec<FolderFileItem>) {
    if depth > max_depth {
        return;
    }
    let Ok(entries) = fs::read_dir(current) else { return; };
    for entry in entries.flatten() {
        let path = entry.path();
        let file_name = path.file_name().unwrap_or_default().to_string_lossy().to_string();

        // Skip hidden files/directories and common build/temp folders
        if file_name.starts_with('.') || file_name == "node_modules" || file_name == "target" || file_name == "dist" {
            continue;
        }

        if path.is_dir() {
            scan_dir_recursive(root, &path, depth + 1, max_depth, out);
        } else if path.is_file() {
            let ext = path.extension().unwrap_or_default().to_string_lossy().to_lowercase();
            let doc_type = match ext.as_str() {
                "pdf" => Some("pdf"),
                "xlsx" | "xls" | "csv" => Some("spreadsheet"),
                "docx" => Some("docx"),
                "pptx" => Some("pptx"),
                "md" | "markdown" => Some("markdown"),
                "js" | "mjs" | "cjs" | "jsx" | "ts" | "mts" | "cts" | "tsx" |
                "py" | "pyw" | "rs" | "go" | "java" | "kt" | "kts" |
                "c" | "cpp" | "cc" | "cxx" | "h" | "hpp" | "cs" |
                "html" | "htm" | "css" | "scss" | "less" | "vue" |
                "json" | "yaml" | "yml" | "toml" | "xml" | "ini" | "env" |
                "sql" | "sh" | "bash" | "zsh" | "php" | "swift" | "rb" | "lua" => Some("code"),
                "txt" | "text" | "log" => Some("text"),
                _ => None,
            };

            if let Some(dtype) = doc_type {
                let meta = path.metadata().ok();
                let size = meta.as_ref().map(|m| m.len()).unwrap_or(0);
                let modified_ms = meta
                    .and_then(|m| m.modified().ok())
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|d| d.as_millis() as u64)
                    .unwrap_or(0);

                let rel_path = path.strip_prefix(root)
                    .unwrap_or(&path)
                    .to_string_lossy()
                    .to_string();

                out.push(FolderFileItem {
                    name: file_name,
                    path: path.to_string_lossy().to_string(),
                    rel_path,
                    size,
                    doc_type: dtype.to_string(),
                    extension: ext,
                    modified_ms,
                });
            }
        }
    }
}

#[tauri::command]
fn read_folder_files(folder_path: String) -> Result<FolderPayload, String> {
    let p = Path::new(&folder_path);
    if !p.exists() || !p.is_dir() {
        return Err(format!("文件夹路径不存在或不是目录: {}", folder_path));
    }

    let folder_name = p.file_name().unwrap_or_default().to_string_lossy().to_string();
    let mut files = Vec::new();
    scan_dir_recursive(p, p, 1, 4, &mut files);

    // Sort files alphabetically by relative path
    files.sort_by(|a, b| a.rel_path.to_lowercase().cmp(&b.rel_path.to_lowercase()));

    Ok(FolderPayload {
        name: if folder_name.is_empty() { folder_path.clone() } else { folder_name },
        path: folder_path,
        total_files: files.len(),
        files,
    })
}

#[tauri::command]
fn get_launch_file(state: tauri::State<OpenedFilesState>) -> Option<String> {
    let mut pending = state.0.lock().unwrap();
    if let Some(path) = pending.pop() {
        return Some(path);
    }

    let args: Vec<String> = std::env::args().collect();
    if args.len() > 1 {
        let candidate = &args[1];
        if !candidate.starts_with('-') && Path::new(candidate).exists() {
            return Some(candidate.clone());
        }
    }
    None
}

#[tauri::command]
fn read_text_file(path: String) -> Result<TextFilePayload, String> {
    let p = Path::new(&path);
    if !p.exists() {
        return Err(format!("文件不存在: {}", path));
    }

    let raw_bytes = fs::read(p).map_err(|e| format!("读取文件失败: {}", e))?;
    let metadata = fs::metadata(p).map_err(|e| e.to_string())?;
    let size = metadata.len();
    let name = p.file_name().unwrap_or_default().to_string_lossy().to_string();

    // 1. Detect encoding using chardetng
    let mut detector = chardetng::EncodingDetector::new();
    detector.feed(&raw_bytes, true);
    let detected_encoding = detector.guess(None, true);
    let encoding_name = detected_encoding.name().to_string();

    // 2. Decode using encoding_rs
    let (cow, _, had_errors) = detected_encoding.decode(&raw_bytes);
    let content = if had_errors {
        String::from_utf8_lossy(&raw_bytes).to_string()
    } else {
        cow.into_owned()
    };

    let lines = content.lines().count();
    let chars = content.chars().count();

    Ok(TextFilePayload {
        content,
        encoding: encoding_name,
        size,
        lines,
        chars,
        name,
        path,
    })
}

#[tauri::command]
fn read_binary_file(path: String) -> Result<BinaryFilePayload, String> {
    let p = Path::new(&path);
    if !p.exists() {
        return Err(format!("文件不存在: {}", path));
    }

    let data = fs::read(p).map_err(|e| format!("读取二进制文件失败: {}", e))?;
    let metadata = fs::metadata(p).map_err(|e| e.to_string())?;
    let size = metadata.len();
    let name = p.file_name().unwrap_or_default().to_string_lossy().to_string();
    let extension = p
        .extension()
        .unwrap_or_default()
        .to_string_lossy()
        .to_lowercase();

    Ok(BinaryFilePayload {
        data,
        size,
        name,
        path,
        extension,
    })
}

#[tauri::command]
fn get_file_metadata(path: String) -> Result<FileMetadata, String> {
    let p = Path::new(&path);
    if !p.exists() {
        return Err(format!("文件不存在: {}", path));
    }

    let meta = fs::metadata(p).map_err(|e| e.to_string())?;
    let name = p.file_name().unwrap_or_default().to_string_lossy().to_string();
    let extension = p
        .extension()
        .unwrap_or_default()
        .to_string_lossy()
        .to_lowercase();
    let modified_ms = meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);

    Ok(FileMetadata {
        name,
        path,
        size: meta.len(),
        extension,
        modified_ms,
    })
}

// Also made async: it queries Launch Services for every category, which can
// block for hundreds of milliseconds and froze the modal's opening animation.
#[tauri::command]
async fn check_default_apps() -> Result<Vec<AppDefaultInfo>, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let configs = vec![
            ("pdf", "PDF 文档", vec![".pdf"], "com.adobe.pdf"),
            (
                "excel",
                "Excel 表格",
                vec![".xlsx", ".xls", ".csv"],
                "org.openxmlformats.spreadsheetml.sheet",
            ),
            (
                "word",
                "Word 文档",
                vec![".docx"],
                "org.openxmlformats.wordprocessingml.document",
            ),
            (
                "pptx",
                "PowerPoint 演示",
                vec![".pptx"],
                "org.openxmlformats.presentationml.presentation",
            ),
            (
                "markdown",
                "Markdown 笔记",
                vec![".md", ".markdown"],
                "net.daringfireball.markdown",
            ),
            (
                "text",
                "纯文本与代码",
                vec![".txt", ".log", ".json"],
                "public.plain-text",
            ),
        ];

        let mut result = Vec::new();

        for (cat, name, exts, uti) in configs {
            let mut is_default = false;
            let mut current_app = "系统默认".to_string();

            #[cfg(target_os = "macos")]
            {
                if let Ok(c_uti) = CString::new(uti) {
                    unsafe {
                        is_default = macos_is_default_for_uti(c_uti.as_ptr()) == 1;
                        let app_ptr = macos_get_default_app_name_for_uti(c_uti.as_ptr());
                        if !app_ptr.is_null() {
                            let c_str = CStr::from_ptr(app_ptr);
                            current_app = c_str.to_string_lossy().to_string();
                            free(app_ptr as *mut std::ffi::c_void);
                        }
                    }
                }
            }

            result.push(AppDefaultInfo {
                category: cat.to_string(),
                name: name.to_string(),
                extensions: exts.into_iter().map(String::from).collect(),
                uti: uti.to_string(),
                is_default,
                current_app_name: current_app,
            });
        }

        result
    })
    .await
    .map_err(|e| format!("查询系统默认应用失败: {}", e))
}

/// Resolve a UI category to the macOS Uniform Type Identifier.
fn uti_for_category(category: &str) -> Result<&'static str, String> {
    Ok(match category {
        "pdf" => "com.adobe.pdf",
        "excel" => "org.openxmlformats.spreadsheetml.sheet",
        "word" => "org.openxmlformats.wordprocessingml.document",
        "pptx" => "org.openxmlformats.presentationml.presentation",
        "markdown" => "net.daringfireball.markdown",
        "text" => "public.plain-text",
        other => return Err(format!("未知文档类型: {}", other)),
    })
}

// BUG FIX: these two commands were synchronous. A synchronous Tauri command runs
// on the main thread, and the Objective-C side calls
// `dispatch_semaphore_wait(..., 10s)` while waiting for the user to answer the
// macOS confirmation sheet. That froze the whole webview — the UI looked dead
// for up to ten seconds after clicking "set/reset default".
// `async` + `spawn_blocking` moves the blocking wait onto the blocking pool so
// the webview stays responsive and the button shows its pending state.
#[tauri::command]
async fn set_default_app_for_category(category: String) -> Result<bool, String> {
    let uti = uti_for_category(&category)?.to_string();

    #[cfg(target_os = "macos")]
    {
        let result = tauri::async_runtime::spawn_blocking(move || {
            let c_uti = CString::new(uti).map_err(|_| "文档类型包含非法字符".to_string())?;
            // SAFETY: `c_uti` outlives the FFI call, which only reads the pointer.
            let res = unsafe { macos_set_default_app_for_uti(c_uti.as_ptr()) };
            Ok::<bool, String>(res == 0)
        })
        .await
        .map_err(|e| format!("任务执行失败: {}", e))??;

        if result {
            Ok(true)
        } else {
            Err("系统未完成默认设置（可能已取消授权）".to_string())
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = uti;
        Ok(true)
    }
}

#[tauri::command]
async fn reset_default_app_for_category(category: String) -> Result<bool, String> {
    let uti = uti_for_category(&category)?.to_string();

    #[cfg(target_os = "macos")]
    {
        let result = tauri::async_runtime::spawn_blocking(move || {
            let c_uti = CString::new(uti).map_err(|_| "文档类型包含非法字符".to_string())?;
            // SAFETY: `c_uti` outlives the FFI call, which only reads the pointer.
            let res = unsafe { macos_reset_default_app_for_uti(c_uti.as_ptr()) };
            Ok::<bool, String>(res == 0)
        })
        .await
        .map_err(|e| format!("任务执行失败: {}", e))??;

        if result {
            Ok(true)
        } else {
            Err("取消默认设置失败".to_string())
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = uti;
        Ok(true)
    }
}

#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("open").arg(&url).spawn();
        return Ok(());
    }
    #[cfg(target_os = "windows")]
    {
        let _ = std::process::Command::new("cmd").args(["/c", "start", &url]).spawn();
        return Ok(());
    }
    #[cfg(target_os = "linux")]
    {
        let _ = std::process::Command::new("xdg-open").arg(&url).spawn();
        return Ok(());
    }
    #[allow(unreachable_code)]
    Ok(())
}

#[tauri::command]
fn open_system_settings() {
    #[cfg(target_os = "macos")]
    unsafe {
        macos_open_system_settings();
    }
}

// ---------------------------------------------------------------------------
// In-app updater
//
// The About modal used to just open the GitHub release page. This downloads
// the .dmg straight into the app instead: the user stays in OmniDoc, and the
// new build replaces the old one on disk.
//
// We deliberately shell out to `curl` rather than pulling in a Rust HTTP
// client: curl ships with macOS, follows redirects (the GitHub release asset
// URL redirects to a CDN), and keeps the dependency tree untouched.
// ---------------------------------------------------------------------------

fn emit_progress(app: &tauri::AppHandle, downloaded: u64, total: u64) {
    let _ = app.emit(
        "update-progress",
        serde_json::json!({
            "downloaded": downloaded,
            "total": total,
            "percent": if total > 0 {
                (downloaded as f64 / total as f64 * 100.0).min(100.0)
            } else { 0.0 }
        }),
    );
}

/// Download an update DMG to a stable temp location.
///
/// Returns the downloaded file path on success.
#[tauri::command]
async fn download_update(app: tauri::AppHandle, url: String, filename: String) -> Result<String, String> {
    // Only ever write a .dmg, and sanitise the name so the URL cannot escape
    // the temp directory or pick a different extension.
    let safe_name: String = filename
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '.' || *c == '-' || *c == '_')
        .collect();
    let file_name = if safe_name.ends_with(".dmg") {
        safe_name
    } else {
        format!("{}.dmg", safe_name)
    };

    let dir = std::env::temp_dir().join("omnidoc-update");
    fs::create_dir_all(&dir).map_err(|e| format!("无法创建临时目录: {}", e))?;
    let target = dir.join(&file_name);

    // Remove a partial file from an earlier attempt
    let _ = fs::remove_file(&target);

    let target_str = target.to_string_lossy().to_string();
    let app2 = app.clone();
    let url2 = url.clone();
    // Keep a copy for the closure's return value (the outer `target` is moved
    // into the polling loop below).
    let target_done = target.clone();

    // curl writes progress as machine-readable lines when asked, so we can
    // stream it instead of reporting only at the end.
    let script = format!(
        r#"curl -L --fail --silent --show-error \
             --connect-timeout 15 --max-time 900 \
             --retry 2 --retry-delay 2 \
             -o "{target}" \
             "{url}"
        "#,
        target = target_str,
        url = url2
    );

    tauri::async_runtime::spawn_blocking(move || -> Result<String, String> {
        use std::process::{Command, Stdio};

        let mut child = Command::new("/bin/sh")
            .arg("-c")
            .arg(&script)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("无法启动下载: {}", e))?;

        // Poll the file size while curl runs. Simple and reliable: curl writes
        // straight to the target path, so on-disk size is the progress.
        let mut last = 0u64;
        for _ in 0..900 {
            std::thread::sleep(std::time::Duration::from_millis(500));
            let size = fs::metadata(&target).map(|m| m.len()).unwrap_or(0);
            if size != last {
                last = size;
                emit_progress(&app2, size, 0);
            }
            if let Ok(Some(status)) = child.try_wait() {
                if !status.success() {
                    let err = child
                        .stderr
                        .as_mut()
                        .map(|_| String::new())
                        .unwrap_or_default();
                    let _ = fs::remove_file(&target);
                    return Err(if err.is_empty() {
                        format!("下载失败（curl 退出码 {:?}）", status.code())
                    } else {
                        err
                    });
                }
                let size = fs::metadata(&target).map(|m| m.len()).unwrap_or(0);
                // Sanity check: a truncated DMG would fail later in a much
                // more confusing way, so refuse it here.
                if size < 1_000_000 {
                    let _ = fs::remove_file(&target);
                    return Err("下载内容不完整，请重试".to_string());
                }
                emit_progress(&app2, size, size);
                return Ok(target_done.to_string_lossy().to_string());
            }
        }

        let _ = child.kill();
        let _ = fs::remove_file(&target);
        Err("下载超时".to_string())
    })
    .await
    .map_err(|e| format!("下载任务异常: {}", e))?
}

/// Replace the running app with a freshly downloaded DMG, then relaunch.
///
/// The app cannot replace itself while running, so we hand the work to a
/// detached shell that waits for our PID to exit before touching anything.
#[tauri::command]
async fn install_update(dmg_path: String, app_name: String) -> Result<(), String> {
    use std::process::{Command, Stdio};

    // Validate inputs: the path must live in our own temp directory and end
    // in .dmg, otherwise a compromised web response could point us elsewhere.
    let dmg = Path::new(&dmg_path);
    if !dmg.exists() {
        return Err("安装包不存在".to_string());
    }
    if dmg.extension().and_then(|e| e.to_str()) != Some("dmg") {
        return Err("安装包格式无效".to_string());
    }
    let temp_root = std::env::temp_dir().join("omnidoc-update");
    if !dmg.starts_with(&temp_root) {
        return Err("安装包路径不合法".to_string());
    }
    if app_name.contains('/') || app_name.is_empty() {
        return Err("应用名称不合法".to_string());
    }

    let pid = std::process::id();
    let script = format!(
        r#"
# Wait for the running app to exit (it is the one launching us).
while kill -0 {pid} 2>/dev/null; do sleep 0.4; done
sleep 1.2

VOL=""
for try in 1 2 3; do
  OUT=$(/usr/bin/hdiutil attach "{dmg}" -nobrowse -readonly 2>&1)
  VOL=$(printf '%s' "$OUT" | grep -o '/Volumes/[^[:space:]]*' | head -1)
  if [ -n "$VOL" ]; then break; fi
  sleep 2
done

if [ -z "$VOL" ]; then
  open "{dmg}"
  exit 1
fi

SRC="$VOL/{app_name}.app"
DEST="/Applications/{app_name}.app"

if [ -d "$SRC" ]; then
  # Preserve the existing bundle so any open document context is not lost.
  if [ -d "$DEST" ]; then
    /bin/rm -rf "$DEST"
  fi
  /bin/cp -R "$SRC" "$DEST" 2>/dev/null || /usr/bin/ditto "$SRC" "$DEST"
fi

/usr/bin/hdiutil detach "$VOL" -quiet -force 2>/dev/null
/bin/rm -f "{dmg}"
open -a "{app_name}" 2>/dev/null
        "#,
        pid = pid,
        dmg = dmg_path,
        app_name = app_name
    );

    // Detach: the installer must outlive this process.
    Command::new("/bin/sh")
        .arg("-c")
        .arg(&script)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("无法启动安装程序: {}", e))?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .manage(OpenedFilesState(Mutex::new(Vec::new())))
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            open_file_dialog,
            open_folder_dialog,
            is_directory,
            read_folder_files,
            get_launch_file,
            read_text_file,
            read_binary_file,
            get_file_metadata,
            check_default_apps,
            set_default_app_for_category,
            reset_default_app_for_category,
            open_system_settings,
            open_url,
            download_update,
            install_update
        ]);

    let app = builder
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, event| match event {
        RunEvent::Opened { urls } => {
            log::info!("RunEvent::Opened received urls: {:?}", urls);
            let state = app_handle.state::<OpenedFilesState>();
            let mut pending = state.0.lock().unwrap();

            for url_item in urls {
                let file_path = if let Ok(path_buf) = url_item.to_file_path() {
                    path_buf.to_string_lossy().to_string()
                } else {
                    let s = url_item.to_string();
                    if s.starts_with("file://") {
                        s["file://".len()..].to_string()
                    } else {
                        s
                    }
                };

                if Path::new(&file_path).exists() {
                    pending.push(file_path.clone());
                    // Warm start: notify running frontend webview
                    let _ = app_handle.emit("file-opened", file_path);
                }
            }

            // Bring window to front
            if let Some(window) = app_handle.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }
        _ => {}
    });
}
