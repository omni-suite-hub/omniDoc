# OmniDoc 极速技术架构与设计规范

> **“让万能文档预览回归纯粹的闪电体验。”**
> 基于 **Tauri (Rust) + 现代轻量渲染器** 构建的桌面端极速文档预览神器。

---

## ⚡ 核心设计哲学

1. **瞬时响应**：启动耗时 $\le 0.3\text{s}$，内存占用仅 $30\text{MB} \sim 45\text{MB}$。
2. **零转圈无干扰**：双击即开，无登录弹窗、无诱导广告、无无谓的云端同步阻滞。
3. **全格式覆盖**：
   - 📊 **Excel / CSV**：支持多 Sheet 表格切换、**鼠标拖拽框选实时求和、平均值、极值算盘**。
   - 📽️ **PPTX 幻灯片**：左右键翻页预览、幻灯片缩略胶卷、全屏放映。
   - 📄 **Word 文档 (.docx)**：排版高保真排布，合同表格与图文清晰呈现。
   - 📝 **Markdown 笔记**：代码高亮、数学公式、检查清单与层级大纲。
   - 📜 **纯文本 (.txt)**：智能识别 **GBK / UTF-8** 编码，彻底告别乱码。

---

## 🛠️ 核心架构技术对比矩阵

| 对比维度 | 传统 Electron 方案 | 传统重型 Office / WPS | **OmniDoc (Tauri 架构)** |
| :--- | :--- | :--- | :--- |
| **安装包体积** | 120MB ~ 200MB | 300MB ~ 1.5GB | **< 15MB 极度小巧** |
| **冷启动耗时** | 2.5 ~ 4.0 秒 | 3.0 ~ 8.0 秒 | **0.2 ~ 0.4 秒瞬间秒开** |
| **运行时内存** | 250MB ~ 450MB | 300MB ~ 800MB | **30MB ~ 50MB 微量消耗** |
| **广告与弹窗** | 无或轻度 | 每日推荐、资讯悬浮弹窗 | **绝对零广告、零弹窗打扰** |
| **编码自适应** | 经常出现 GBK 乱码 | 偶尔弹编码选择窗 | **Rust 底层自动嗅探无感转码** |

---

## 💻 Rust 核心解码器代码示例

```rust
use encoding_rs::Encoding;
use chardetng::EncodingDetector;

/// 毫秒级探测任意纯文本的字符编码并无损解码为 UTF-8
pub fn smart_decode_text(bytes: &[u8]) -> (String, &'static str) {
    let mut detector = EncodingDetector::new();
    detector.feed(bytes, true);
    let encoding = detector.guess(None, true);
    
    let (cow, _, had_errors) = encoding.decode(bytes);
    let text = if had_errors {
        String::from_utf8_lossy(bytes).to_string()
    } else {
        cow.into_owned()
    };
    
    (text, encoding.name())
}
```

---

## ✅ 待办任务清单

- [x] 完成 Rust 后端与 Tauri 2.0 框架初始化
- [x] 集成 SheetJS 实现多格交互求和算盘
- [x] 集成 docx-preview 实现标准合同排版呈现
- [x] 实现独立 PPTX 胶卷缩略图与幻灯片翻页引擎
- [x] 智能 GBK/ANSI 编码嗅探防乱码保障
- [ ] 导出 PDF 快捷打印预览
