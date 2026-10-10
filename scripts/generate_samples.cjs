const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const JSZip = require('jszip');

const outDir = path.join(__dirname, '../public/samples');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// 1. Generate sample.xlsx
const wb = XLSX.utils.book_new();

// Sheet 1: Sales Data
const salesData = [
  ['产品名称', '业务大区', '单价(元)', '销售数量', '总销售额(元)', '达成率', '负责人', '季度评价'],
  ['OmniCloud 智能算力集群', '华东一区', 12800, 45, 576000, '128%', '林晨', '卓越 ★★★★★'],
  ['NeuralEngine 神经加速卡', '华北二区', 6400, 112, 716800, '115%', '张昊天', '优秀 ★★★★'],
  ['VectorDB 向量数据库套件', '华南大区', 3200, 240, 768000, '142%', '苏锦程', '卓越 ★★★★★'],
  ['QuantumSecure 加密网关', '西南大区', 8900, 38, 338200, '98%', '陆明峰', '达标 ★★★'],
  ['EdgeNode 边缘感知网关', '西北大区', 1950, 320, 624000, '106%', '陈子昂', '优秀 ★★★★'],
  ['DeepVision 质检智能相机', '华东二区', 4600, 85, 391000, '118%', '何雨桐', '优秀 ★★★★'],
  ['CyberShield 漏洞全景扫描仪', '华北一区', 7800, 64, 499200, '102%', '宋思涵', '优秀 ★★★★'],
  ['DataFlow 实时日志湖仓', '华南自贸区', 5200, 96, 499200, '133%', '唐文博', '卓越 ★★★★★'],
  ['VoiceAI 电话坐席智能体', '华中大区', 2800, 150, 420000, '94%', '赵雅静', '达标 ★★★'],
  ['AutoOps 故障自愈机器人', '华东三区', 4200, 180, 756000, '125%', '孙启元', '卓越 ★★★★★'],
  ['总计 / 平均基准', '全国合计', '-', '-', 5588400, '116%', '运营分析组', '持续超预期']
];
const ws1 = XLSX.utils.aoa_to_sheet(salesData);
ws1['!cols'] = [
  { wch: 26 }, { wch: 14 }, { wch: 12 }, { wch: 12 },
  { wch: 16 }, { wch: 10 }, { wch: 12 }, { wch: 16 }
];
XLSX.utils.book_append_sheet(wb, ws1, '季度销售业绩总览');

// Sheet 2: Department Budget
const budgetData = [
  ['科目编号', '费用类别', '申请部门', '单价预估', '采购数量', '总预算金额(元)', '紧急程度', '审批状态'],
  ['IT-2026-001', '高性能 GPU 开发工作站', 'AI 创新实验室', 28500, 6, 171000, '高', '已核准通过'],
  ['IT-2026-002', '4K 广色域专业显示器', '交互设计体验中心', 3800, 14, 53200, '中', '已核准通过'],
  ['IT-2026-003', '机房三相防浪涌 UPS 电源', '基础设施运维组', 42000, 2, 84000, '高', '已核准通过'],
  ['IT-2026-004', '万兆光纤交换机堆叠模块', '基础设施运维组', 15600, 4, 62400, '高', '审核中'],
  ['HR-2026-012', '第三季度技术大会门票与差旅', '研发委员会', 4500, 18, 81000, '中', '已核准通过'],
  ['AD-2026-035', '办公区健康人体工学椅批量替换', '行政总务部', 1200, 45, 54000, '低', '计划中'],
  ['RD-2026-088', '知识产权与海外发明专利答辩费', '法务与战略部', 18000, 5, 90000, '高', '已核准通过']
];
const ws2 = XLSX.utils.aoa_to_sheet(budgetData);
ws2['!cols'] = [
  { wch: 16 }, { wch: 28 }, { wch: 18 }, { wch: 12 },
  { wch: 12 }, { wch: 16 }, { wch: 10 }, { wch: 14 }
];
XLSX.utils.book_append_sheet(wb, ws2, '部门采购预算清单');

// Sheet 3: Team Roster
const rosterData = [
  ['员工工号', '姓名', '归属团队', '岗位职能', '周一', '周二', '周三', '周四', '周五', '周工时合计'],
  ['E1001', '顾长风', '内核研发部', '首席架构师', '出勤', '出勤', '出勤', '出勤', '出勤', '42.5h'],
  ['E1002', '沈清璇', '体验设计部', '高级体验设计师', '出勤', '远程', '出勤', '出勤', '出勤', '40.0h'],
  ['E1003', '周凌峰', '系统性能部', '资深 Rust 专家', '出勤', '出勤', '出勤', '出勤', '远程', '41.0h'],
  ['E1004', '白芷若', '产品战略部', '高级产品负责人', '出勤', '出勤', '出勤', '远程', '出勤', '40.5h'],
  ['E1005', '韩立阳', '质量保障部', '自动化测试负责人', '出勤', '出勤', '出勤', '出勤', '出勤', '43.0h']
];
const ws3 = XLSX.utils.aoa_to_sheet(rosterData);
ws3['!cols'] = [
  { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 18 },
  { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 14 }
];
XLSX.utils.book_append_sheet(wb, ws3, '核心研发排班表');

XLSX.writeFile(wb, path.join(outDir, 'sample_report.xlsx'));
console.log('✔ sample_report.xlsx generated');

// 2. Generate sample.md
const mdContent = `# OmniDoc 极速技术架构与设计规范

> **“让万能文档预览回归纯粹的闪电体验。”**
> 基于 **Tauri (Rust) + 现代轻量渲染器** 构建的桌面端极速文档预览神器。

---

## ⚡ 核心设计哲学

1. **瞬时响应**：启动耗时 $\\le 0.3\\text{s}$，内存占用仅 $30\\text{MB} \\sim 45\\text{MB}$。
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

\`\`\`rust
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
\`\`\`

---

## ✅ 待办任务清单

- [x] 完成 Rust 后端与 Tauri 2.0 框架初始化
- [x] 集成 SheetJS 实现多格交互求和算盘
- [x] 集成 docx-preview 实现标准合同排版呈现
- [x] 实现独立 PPTX 胶卷缩略图与幻灯片翻页引擎
- [x] 智能 GBK/ANSI 编码嗅探防乱码保障
- [ ] 导出 PDF 快捷打印预览
`;
fs.writeFileSync(path.join(outDir, 'sample_notes.md'), mdContent, 'utf8');
console.log('✔ sample_notes.md generated');

// 3. Generate sample.txt (contains GBK-style classic Chinese text & technical notes)
const txtContent = `【OmniDoc 纯文本测试样本与系统运行日志】
==================================================
文档名称: system_kernel_diagnostic.log
生成时间: 2026-10-09 16:30:00 CST
字符集支持: UTF-8 / GBK / GB2312 / BIG5 智能自适应
运行环境: macOS aarch64 / Windows 11 x64

[00:00:01.024] [INFO] 内核引导程序已装载完毕，物理内存基地址映射完成。
[00:00:01.108] [INFO] 正在初始化本地文件嗅探引擎...
[00:00:01.145] [INFO] 探测到用户传入文档: sample_report.xlsx (类型: Office OpenXML Spreadsheet)
[00:00:01.192] [INFO] 工作表解析完成: 共 3 个 Sheet，检测到 35 个有效数据行，包含多列数值型资产。
[00:00:01.215] [INFO] 状态栏求和算盘已就绪：支持鼠标按住多格拉选实时求和、平均值、最大最小值计算。
[00:00:02.040] [DEBUG] 文件句柄释放完成，未产生任何悬挂线程，内存水位稳定在 32.4 MB。

==================================================
【测试用例备忘：常见中文古典散文（用于验证中文字符渲染）】

先天下之忧而忧，后天下之乐而乐。
山不在高，有仙则名；水不在深，有龙则灵。斯是陋室，惟吾德馨。
苔痕上阶绿，草色入帘青。谈笑有鸿儒，往来无白丁。可以调素琴，阅金经。
无丝竹之乱耳，无案牍之劳形。南阳诸葛庐，西蜀子云亭。孔子云：何陋之有？

落霞与孤鹜齐飞，秋水共长天一色。
渔舟唱晚，响穷彭蠡之滨；雁阵惊寒，声断衡阳之浦。

==================================================
[EOF] 文本渲染测试通过，排版行距舒适，行号显示对齐。
`;
fs.writeFileSync(path.join(outDir, 'sample_text.txt'), txtContent, 'utf8');
console.log('✔ sample_text.txt generated');

// 4. Generate sample_contract.docx using JSZip OpenXML specification
const docxZip = new JSZip();

docxZip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`);

docxZip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);

docxZip.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`);

docxZip.file('word/styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="PingFang SC" w:eastAsia="PingFang SC" w:hAnsi="PingFang SC"/>
        <w:sz w:val="24"/>
        <w:color w:val="1E293B"/>
      </w:rPr>
    </w:rPrDefault>
  </w:docDefaults>
</w:styles>`);

const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr><w:jc w:val="center"/><w:spacing w:before="240" w:after="240"/></w:pPr>
      <w:r><w:rPr><w:b/><w:sz w:val="44"/><w:color w:val="0F172A"/></w:rPr><w:t>企业级软件技术开发与服务合作协议</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:jc w:val="center"/><w:spacing w:after="360"/></w:pPr>
      <w:r><w:rPr><w:sz w:val="22"/><w:color w:val="64748B"/></w:rPr><w:t>合同编号：OMNIDOC-2026-TECH-0889 | 签署日期：2026 年 10 月 09 日</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:rPr><w:b/><w:sz w:val="28"/><w:color w:val="2563EB"/></w:rPr><w:t>第一条 合作双方与项目目标</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:spacing w:after="180"/></w:pPr>
      <w:r><w:t>甲方（委托方）：未来数智科技有限公司</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:spacing w:after="240"/></w:pPr>
      <w:r><w:t>乙方（开发方）：极速架构软件工作室（OmniDoc 核心团队）</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:spacing w:after="200"/></w:pPr>
      <w:r><w:t>双方本着平等互利、优势互补的原则，就“新一代桌面端极速万能文档预览系统”的开发与交付达成如下排他性合作协议。乙方负责底层 Rust 引擎驱动与各文档渲染适配，确保冷启动时间不高于 300 毫秒，运行时内存不高于 50MB。</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:rPr><w:b/><w:sz w:val="28"/><w:color w:val="2563EB"/></w:rPr><w:t>第二条 交付里程碑与验收标准</w:t></w:r>
    </w:p>
    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="9200" w:type="dxa"/>
        <w:tblBorders>
          <w:top w:val="single" w:sz="8" w:space="0" w:color="CBD5E1"/>
          <w:left w:val="single" w:sz="8" w:space="0" w:color="CBD5E1"/>
          <w:bottom w:val="single" w:sz="8" w:space="0" w:color="CBD5E1"/>
          <w:right w:val="single" w:sz="8" w:space="0" w:color="CBD5E1"/>
          <w:insideH w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>
          <w:insideV w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>
        </w:tblBorders>
      </w:tblPr>
      <w:tr>
        <w:tc><w:tcPr><w:tcW w:w="1600" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/></w:tcPr><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>阶段编号</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:tcW w:w="3000" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/></w:tcPr><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>里程碑关键交付物</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:tcW w:w="2600" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/></w:tcPr><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>技术验收指标</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:tcW w:w="2000" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/></w:tcPr><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>阶段结算金额</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>第一期 M1</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>多格式文件内核与 Rust 交互</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>完成 TXT/MD/XLSX 支持</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>¥ 120,000 元</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>第二期 M2</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>DOCX 与 PPTX 预览引擎强化</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>胶卷缩略图与多格求和算盘</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>¥ 160,000 元</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>第三期 M3</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>macOS / Windows 正式安装包打包</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>安装包小于 15MB 且自测达标</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>¥ 80,000 元</w:t></w:r></w:p></w:tc>
      </w:tr>
    </w:tbl>
    <w:p><w:pPr><w:spacing w:before="360"/></w:pPr>
      <w:r><w:rPr><w:b/><w:sz w:val="28"/><w:color w:val="2563EB"/></w:rPr><w:t>第三条 商业保密与版权归属</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>双方在合作过程中所接触到的对方专有技术、业务数据及知识产权，均属于最高级别商业保密信息。未经另一方书面授权，任何一方不得向任何第三方披露或擅自使用。</w:t></w:r>
    </w:p>
  </w:body>
</w:document>`;

docxZip.file('word/document.xml', documentXml);
docxZip.generateNodeStream({ type: 'nodebuffer', streamFiles: true })
  .pipe(fs.createWriteStream(path.join(outDir, 'sample_contract.docx')))
  .on('finish', () => console.log('✔ sample_contract.docx generated'));

// 5. Generate sample_slides.pptx using JSZip OpenXML specification
const pptxZip = new JSZip();

pptxZip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
  <Override PartName="/ppt/slides/slide2.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
  <Override PartName="/ppt/slides/slide3.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
  <Override PartName="/ppt/slides/slide4.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
</Types>`);

pptxZip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`);

pptxZip.file('ppt/_rels/presentation.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide2.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide3.xml"/>
  <Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide4.xml"/>
</Relationships>`);

pptxZip.file('ppt/presentation.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:sldMasterIdLst/>
  <p:sldIdLst>
    <p:sldId id="256" r:id="rId1"/>
    <p:sldId id="257" r:id="rId2"/>
    <p:sldId id="258" r:id="rId3"/>
    <p:sldId id="259" r:id="rId4"/>
  </p:sldIdLst>
  <p:sldSz cx="12192000" cy="6858000"/>
</p:presentation>`);

function makeSlideXml(title, subtitle, bullets, highlightCard) {
  let bulletsXml = bullets.map(b => `<a:p><a:r><a:rPr lang="zh-CN" sz="1800"/><a:t>• ${b}</a:t></a:r></a:p>`).join('');
  let cardXml = highlightCard ? `<a:p><a:r><a:rPr lang="zh-CN" sz="2000" b="1"/><a:t>【核心亮点】: ${highlightCard}</a:t></a:r></a:p>` : '';

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr/>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr/>
        <p:txBody>
          <a:bodyPr/>
          <a:p><a:r><a:rPr lang="zh-CN" sz="3600" b="1"/><a:t>${title}</a:t></a:r></a:p>
          <a:p><a:r><a:rPr lang="zh-CN" sz="2000"/><a:t>${subtitle}</a:t></a:r></a:p>
        </p:txBody>
      </p:sp>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="3" name="Content"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr/>
        <p:txBody>
          <a:bodyPr/>
          ${bulletsXml}
          ${cardXml}
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`;
}

pptxZip.file('ppt/slides/slide1.xml', makeSlideXml(
  'OmniDoc 桌面极速预览神器',
  '2026 年度旗舰产品发布会 | 重新定义桌面文档体验',
  [
    '轻量化革命：突破传统臃肿 Office 体积限制，安装包压缩至 12MB',
    '瞬间秒开：采用 Rust 机器码直接驱动系统级排版通道，启动仅需 0.3 秒',
    '五合一矩阵：原生打通 MD、TXT、XLSX、DOCX、PPTX 全格式生态'
  ],
  '小巧、纯粹、极速、无广告打扰'
));

pptxZip.file('ppt/slides/slide2.xml', makeSlideXml(
  'Excel 表格与实时求和算盘',
  '打工人对账与数据查阅的杀手级功能',
  [
    '多 Sheet 自由切换，自适应列宽与行网格',
    '鼠标任意框选多格，状态栏实时闪电汇总',
    '支持选中计数 (COUNT)、数值求和 (SUM)、平均值 (AVG)、极值 (MIN/MAX)',
    '无需等待 WPS 或 Excel 漫长启动，看一眼拉一下，用完即关'
  ],
  '数据处理快人一步，告别繁重操作'
));

pptxZip.file('ppt/slides/slide3.xml', makeSlideXml(
  '纯文本与 Markdown 现代排版',
  '文字阅读的极致美学与防乱码护航',
  [
    '智能字符集嗅探：GBK、GB18030、BIG5 自动转码，杜绝中文字符乱码',
    'Markdown 沉浸阅读：代码语法高亮、快捷一键复制、层级标题目录',
    '行号与字数实时统计，沉浸式极简无干扰界面'
  ],
  '像原生记事本一样轻快，拥有 Typora 般优雅'
));

pptxZip.file('ppt/slides/slide4.xml', makeSlideXml(
  '架构蓝图与产品路线演进',
  '专注轻量化效率工具矩阵的长期主义',
  [
    'Q4 2026: 完善 macOS 原生空格键 QuickLook 深度集成',
    'Q1 2027: 引入跨文件快速全文检索与最近打开历史聚合',
    '保持克制：坚守零云端收集、零隐私上传、纯本地离线优先'
  ],
  '精于极简，致敬生产力'
));

pptxZip.generateNodeStream({ type: 'nodebuffer', streamFiles: true })
  .pipe(fs.createWriteStream(path.join(outDir, 'sample_slides.pptx')))
  .on('finish', () => console.log('✔ sample_slides.pptx generated'));
