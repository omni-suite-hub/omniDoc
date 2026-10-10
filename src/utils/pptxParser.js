import JSZip from 'jszip';

function getLuminance(hex) {
  if (!hex || !hex.startsWith('#')) return 1;
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return 1;
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/**
 * Parses a PPTX file buffer and extracts structured slide deck data
 * @param {ArrayBuffer|Uint8Array} buffer
 * @returns {Promise<{ slides: Array, width: number, height: number, aspectRatio: number, total: number }>}
 */
export async function parsePptx(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  
  // 1. Read presentation.xml to get slide size and slide order
  let slideWidth = 12192000;
  let slideHeight = 6858000;
  let slideIds = [];

  const presXmlStr = await zip.file('ppt/presentation.xml')?.async('text');
  if (presXmlStr) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(presXmlStr, 'application/xml');
    const sldSz = doc.getElementsByTagName('p:sldSz')[0] || doc.getElementsByTagName('sldSz')[0];
    if (sldSz) {
      slideWidth = parseInt(sldSz.getAttribute('cx') || '12192000', 10);
      slideHeight = parseInt(sldSz.getAttribute('cy') || '6858000', 10);
    }

    const sldIdNodes = doc.getElementsByTagName('p:sldId');
    for (let i = 0; i < sldIdNodes.length; i++) {
      const relId = sldIdNodes[i].getAttribute('r:id');
      if (relId) slideIds.push(relId);
    }
  }

  // 2. Read presentation.xml.rels to map relId to slide filename
  const presRelsStr = await zip.file('ppt/_rels/presentation.xml.rels')?.async('text');
  const relMap = new Map();
  if (presRelsStr) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(presRelsStr, 'application/xml');
    const rels = doc.getElementsByTagName('Relationship');
    for (let i = 0; i < rels.length; i++) {
      const id = rels[i].getAttribute('Id');
      const target = rels[i].getAttribute('Target');
      if (id && target) {
        const cleanPath = target.startsWith('ppt/') ? target : `ppt/${target}`;
        relMap.set(id, cleanPath);
      }
    }
  }

  // Determine slide paths in order
  let slidePaths = [];
  if (slideIds.length > 0) {
    for (const rId of slideIds) {
      if (relMap.has(rId)) {
        slidePaths.push(relMap.get(rId));
      }
    }
  }

  // Fallback: list all ppt/slides/slide*.xml files matching numbered pattern
  if (slidePaths.length === 0) {
    const found = [];
    zip.forEach((path) => {
      if (/^ppt\/slides\/slide\d+\.xml$/i.test(path)) {
        found.push(path);
      }
    });
    found.sort((a, b) => {
      const numA = parseInt(a.match(/slide(\d+)\.xml/)[1], 10);
      const numB = parseInt(b.match(/slide(\d+)\.xml/)[1], 10);
      return numA - numB;
    });
    slidePaths = found;
  }

  // Helper to extract color
  function extractColor(container, isDark) {
    if (!container) return isDark ? '#FFFFFF' : '#0F172A';

    // 1. Check srgbClr
    const srgbNode = container.getElementsByTagName('a:srgbClr')[0] || container.getElementsByTagName('srgbClr')[0];
    if (srgbNode && srgbNode.getAttribute('val')) {
      return `#${srgbNode.getAttribute('val')}`;
    }

    // 2. Check schemeClr
    const schemeNode = container.getElementsByTagName('a:schemeClr')[0] || container.getElementsByTagName('schemeClr')[0];
    if (schemeNode && schemeNode.getAttribute('val')) {
      const val = schemeNode.getAttribute('val');
      switch (val) {
        case 'tx1':
        case 'lt1':
          return isDark ? '#FFFFFF' : '#0F172A';
        case 'tx2':
        case 'lt2':
          return isDark ? '#CBD5E1' : '#64748B';
        case 'bg1':
        case 'dk1':
          return isDark ? '#0E1113' : '#FFFFFF';
        case 'bg2':
        case 'dk2':
          return isDark ? '#1E293B' : '#F1F5F9';
        case 'accent1': return '#3B82F6';
        case 'accent2': return '#00C8D6';
        case 'accent3': return '#10B981';
        case 'accent4': return '#F59E0B';
        case 'accent5': return '#EC4899';
        case 'accent6': return '#8B5CF6';
        default: return isDark ? '#FFFFFF' : '#0F172A';
      }
    }

    return isDark ? '#FFFFFF' : '#0F172A';
  }

  // 3. Parse each slide
  const slides = [];
  for (let idx = 0; idx < slidePaths.length; idx++) {
    const sPath = slidePaths[idx];
    const sXmlStr = await zip.file(sPath)?.async('text');
    if (!sXmlStr) continue;

    const parser = new DOMParser();
    const doc = parser.parseFromString(sXmlStr, 'application/xml');

    // Build relationship map for images
    const slideRelPath = sPath.replace('ppt/slides/', 'ppt/slides/_rels/') + '.rels';
    const relsStr = await zip.file(slideRelPath)?.async('text');
    const imgRelMap = new Map();
    if (relsStr) {
      const rDoc = parser.parseFromString(relsStr, 'application/xml');
      const relNodes = rDoc.getElementsByTagName('Relationship');
      for (let r = 0; r < relNodes.length; r++) {
        const rId = relNodes[r].getAttribute('Id');
        const target = relNodes[r].getAttribute('Target');
        if (rId && target) {
          let resolved = target;
          if (target.startsWith('../')) {
            resolved = 'ppt/' + target.slice(3);
          } else if (!target.startsWith('ppt/')) {
            resolved = 'ppt/slides/' + target;
          }
          imgRelMap.set(rId, resolved);
        }
      }
    }

    // Step A: Detect slide background color
    let slideBg = '#FFFFFF';
    
    // 1. Check p:bg -> a:solidFill
    const bgNode = doc.getElementsByTagName('p:bg')[0] || doc.getElementsByTagName('bg')[0];
    if (bgNode) {
      const solidFill = bgNode.getElementsByTagName('a:solidFill')[0] || bgNode.getElementsByTagName('solidFill')[0];
      if (solidFill) {
        const clrNode = solidFill.getElementsByTagName('a:srgbClr')[0] || solidFill.getElementsByTagName('srgbClr')[0];
        if (clrNode && clrNode.getAttribute('val')) {
          slideBg = `#${clrNode.getAttribute('val')}`;
        }
      }
    }

    // 2. Check full-bleed background shape
    const allShapes = doc.getElementsByTagName('p:sp');
    for (let s = 0; s < allShapes.length; s++) {
      const sp = allShapes[s];
      const xfrm = sp.getElementsByTagName('a:xfrm')[0] || sp.getElementsByTagName('xfrm')[0];
      if (xfrm) {
        const off = xfrm.getElementsByTagName('a:off')[0] || xfrm.getElementsByTagName('off')[0];
        const ext = xfrm.getElementsByTagName('a:ext')[0] || xfrm.getElementsByTagName('ext')[0];
        const x = parseInt(off?.getAttribute('x') || '-1', 10);
        const y = parseInt(off?.getAttribute('y') || '-1', 10);
        const cx = parseInt(ext?.getAttribute('cx') || '0', 10);
        const cy = parseInt(ext?.getAttribute('cy') || '0', 10);

        // If shape covers full slide area from (0,0)
        if (x === 0 && y === 0 && cx >= slideWidth * 0.95 && cy >= slideHeight * 0.95) {
          const spPr = sp.getElementsByTagName('p:spPr')[0] || sp.getElementsByTagName('spPr')[0];
          const solidFill = spPr?.getElementsByTagName('a:solidFill')[0] || spPr?.getElementsByTagName('solidFill')[0];
          if (solidFill) {
            const clrNode = solidFill.getElementsByTagName('a:srgbClr')[0] || solidFill.getElementsByTagName('srgbClr')[0];
            if (clrNode && clrNode.getAttribute('val')) {
              slideBg = `#${clrNode.getAttribute('val')}`;
              break;
            }
          }
        }
      }
    }

    // Check if background is dark
    const bgLuminance = getLuminance(slideBg);
    const isDark = bgLuminance < 0.45;

    // Step B: Extract shapes, images, and text boxes
    const elements = [];
    let slideTitle = '';
    let fallbackTitlePlaced = false;
    let fallbackContentRows = 0;

    const spTree = doc.getElementsByTagName('p:spTree')[0] || doc.getElementsByTagName('spTree')[0];
    const treeChildren = spTree ? Array.from(spTree.children) : Array.from(allShapes);

    // Pre-count text-bearing shapes so fallback rows can be distributed evenly
    const totalTextShapes = treeChildren.filter(node => {
      const tag = node.tagName.toLowerCase();
      if (tag !== 'p:sp' && tag !== 'sp') return false;
      return !!(node.getElementsByTagName('p:txBody')[0] || node.getElementsByTagName('txBody')[0]);
    }).length;

    for (const node of treeChildren) {
      const tagName = node.tagName.toLowerCase();

      // Case 1: Picture / Image Element (<p:pic>)
      if (tagName === 'p:pic' || tagName === 'pic') {
        const xfrm = node.getElementsByTagName('a:xfrm')[0] || node.getElementsByTagName('xfrm')[0];
        let x = 0, y = 0, cx = 0, cy = 0;
        if (xfrm) {
          const off = xfrm.getElementsByTagName('a:off')[0] || xfrm.getElementsByTagName('off')[0];
          const ext = xfrm.getElementsByTagName('a:ext')[0] || xfrm.getElementsByTagName('ext')[0];
          if (off) {
            x = parseInt(off.getAttribute('x') || '0', 10);
            y = parseInt(off.getAttribute('y') || '0', 10);
          }
          if (ext) {
            cx = parseInt(ext.getAttribute('cx') || '0', 10);
            cy = parseInt(ext.getAttribute('cy') || '0', 10);
          }
        }

        // Find relationship ID
        let rId = null;
        const svgBlip = node.getElementsByTagName('asvg:svgBlip')[0] || node.getElementsByTagName('svgBlip')[0];
        if (svgBlip) {
          rId = svgBlip.getAttribute('r:embed') || svgBlip.getAttribute('embed');
        }
        if (!rId) {
          const blip = node.getElementsByTagName('a:blip')[0] || node.getElementsByTagName('blip')[0];
          if (blip) {
            rId = blip.getAttribute('r:embed') || blip.getAttribute('embed');
          }
        }

        if (rId && imgRelMap.has(rId)) {
          const targetPath = imgRelMap.get(rId);
          const f = zip.file(targetPath);
          if (f) {
            let imgSrc = null;
            if (targetPath.toLowerCase().endsWith('.svg')) {
              const svgText = await f.async('text');
              imgSrc = `data:image/svg+xml;utf8,${encodeURIComponent(svgText)}`;
            } else {
              const ext = targetPath.split('.').pop().toLowerCase();
              const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'png' ? 'image/png' : 'image/octet-stream';
              const b64 = await f.async('base64');
              imgSrc = `data:${mime};base64,${b64}`;
            }

            if (imgSrc) {
              elements.push({
                type: 'image',
                src: imgSrc,
                x: x / slideWidth,
                y: y / slideHeight,
                w: cx > 0 ? cx / slideWidth : 0.3,
                h: cy > 0 ? cy / slideHeight : 0.3
              });
            }
          }
        }
        continue;
      }

      // Case 2: Shape / Text Box (<p:sp>)
      if (tagName !== 'p:sp' && tagName !== 'sp') {
        continue;
      }

      const sp = node;

      // Transform / bounding box
      let x = 0, y = 0, cx = 0, cy = 0;
      const xfrm = sp.getElementsByTagName('a:xfrm')[0] || sp.getElementsByTagName('xfrm')[0];
      if (xfrm) {
        const off = xfrm.getElementsByTagName('a:off')[0] || xfrm.getElementsByTagName('off')[0];
        const ext = xfrm.getElementsByTagName('a:ext')[0] || xfrm.getElementsByTagName('ext')[0];
        if (off) {
          x = parseInt(off.getAttribute('x') || '0', 10);
          y = parseInt(off.getAttribute('y') || '0', 10);
        }
        if (ext) {
          cx = parseInt(ext.getAttribute('cx') || '0', 10);
          cy = parseInt(ext.getAttribute('cy') || '0', 10);
        }
      }

      // Skip the full background shape we already captured
      if (x === 0 && y === 0 && cx >= slideWidth * 0.95 && cy >= slideHeight * 0.95) {
        continue;
      }

      // Shape properties (fill / border)
      const spPr = sp.getElementsByTagName('p:spPr')[0] || sp.getElementsByTagName('spPr')[0];
      let shapeFill = null;
      let shapeBorder = null;
      if (spPr) {
        const sFill = spPr.getElementsByTagName('a:solidFill')[0] || spPr.getElementsByTagName('solidFill')[0];
        if (sFill) {
          shapeFill = extractColor(sFill, isDark);
        }
        const sLn = spPr.getElementsByTagName('a:ln')[0] || spPr.getElementsByTagName('ln')[0];
        if (sLn) {
          const lnFill = sLn.getElementsByTagName('a:solidFill')[0] || sLn.getElementsByTagName('solidFill')[0];
          if (lnFill) {
            shapeBorder = extractColor(lnFill, isDark);
          }
        }
      }

      // Text paragraphs (<a:p>)
      const txBody = sp.getElementsByTagName('p:txBody')[0] || sp.getElementsByTagName('txBody')[0];
      const paragraphs = [];

      // BUG FIX: <a:bodyPr> carries the real box insets and the autofit mode.
      // Design decks commonly use wrap="none" with zero insets and
      // <a:normAutofit fontScale="..." lnSpcReduction="..."/>, both of which
      // visibly change the rendered result when ignored.
      let insets = { l: 91440, t: 45720, r: 91440, b: 45720 };
      let wrap = 'square';
      let fontScale = null;
      let lnSpcReduction = null;
      // BUG FIX: <a:bodyPr anchor="ctr"/> (vertical centring) was ignored, so
      // text in middle/centre-anchored boxes rendered against the top edge.
      let anchor = 't';

      if (txBody) {
        const bodyPr = txBody.getElementsByTagName('a:bodyPr')[0] || txBody.getElementsByTagName('bodyPr')[0];
        if (bodyPr) {
          wrap = bodyPr.getAttribute('wrap') || 'square';
          const a = bodyPr.getAttribute('anchor');
          if (a === 'ctr') anchor = 'center';
          else if (a === 'b') anchor = 'flex-end';
          else if (a === 'just') anchor = 'space-between';
          else anchor = 'flex-start';
          const num = (attr, dflt) => {
            const v = parseInt(bodyPr.getAttribute(attr) || '', 10);
            return Number.isFinite(v) ? v : dflt;
          };
          insets = {
            l: num('lIns', 91440),
            t: num('tIns', 45720),
            r: num('rIns', 91440),
            b: num('bIns', 45720)
          };

          const norm = bodyPr.getElementsByTagName('a:normAutofit')[0] || bodyPr.getElementsByTagName('normAutofit')[0];
          if (norm) {
            const fs = parseInt(norm.getAttribute('fontScale') || '', 10);
            if (Number.isFinite(fs) && fs > 0) fontScale = fs / 100000;
            const lr = parseInt(norm.getAttribute('lnSpcReduction') || '', 10);
            if (Number.isFinite(lr) && lr > 0) lnSpcReduction = lr / 100000;
          }
        }
      }

      if (txBody) {
        const paras = txBody.getElementsByTagName('a:p');

        for (let pIdx = 0; pIdx < paras.length; pIdx++) {
          const para = paras[pIdx];
          const textRuns = [];
          
          // Paragraph alignment
          const pPr = para.getElementsByTagName('a:pPr')[0] || para.getElementsByTagName('pPr')[0];
          let align = 'left';
          // Line spacing as a multiplier (e.g. 0.86, 1.1, 1.8)
          let lineHeight = null;
          if (pPr) {
            const algn = pPr.getAttribute('algn');
            if (algn === 'ctr') align = 'center';
            else if (algn === 'r') align = 'right';
            else if (algn === 'just') align = 'justify';

            // BUG FIX: <a:lnSpc><a:spcPct val="86000"/></a:lnSpc> was dropped.
            // Decks rely on it heavily (86% for tight headings, 170-180% for
            // airy body copy) and ignoring it made every slide look cramped and
            // unlike the original.
            const lnSpc = pPr.getElementsByTagName('a:lnSpc')[0] || pPr.getElementsByTagName('lnSpc')[0];
            if (lnSpc) {
              const pct = lnSpc.getElementsByTagName('a:spcPct')[0] || lnSpc.getElementsByTagName('spcPct')[0];
              if (pct) {
                const raw = parseInt(pct.getAttribute('val') || '100000', 10);
                if (Number.isFinite(raw) && raw > 0) {
                  lineHeight = Math.max(0.6, Math.min(3, raw / 100000));
                }
              }
            }
          }

          // <a:buNone/> explicitly disables inherited bullets
          const buNone = pPr &&
            (pPr.getElementsByTagName('a:buNone')[0] || pPr.getElementsByTagName('buNone')[0]);
          const paraHasBulletAttr = !!(buNone || (pPr && (
            pPr.getElementsByTagName('a:buChar')[0] || pPr.getElementsByTagName('buChar')[0]
          )));

          const runs = para.getElementsByTagName('a:r');
          for (let rIdx = 0; rIdx < runs.length; rIdx++) {
            const r = runs[rIdx];
            const tNode = r.getElementsByTagName('a:t')[0] || r.getElementsByTagName('t')[0];
            if (!tNode) continue;
            const text = tNode.textContent || '';
            if (!text) continue;

            const rPr = r.getElementsByTagName('a:rPr')[0] || r.getElementsByTagName('rPr')[0];
            let isBold = false;
            let isItalic = false;
            let isUnderline = false;
            let sz = 1800; // in hundredths of a point
            let color = isDark ? '#FFFFFF' : '#0F172A';
            // BUG FIX: the deck's actual typeface was thrown away. Decks
            // commonly specify Microsoft YaHei / 思源黑体 etc.; falling back to
            // a generic sans changed both metrics and appearance.
            let latinFont = '';
            let eaFont = '';

            if (rPr) {
              isBold = rPr.getAttribute('b') === '1' || rPr.getAttribute('b') === 'true';
              isItalic = rPr.getAttribute('i') === '1' || rPr.getAttribute('i') === 'true';
              isUnderline = rPr.getAttribute('u') && rPr.getAttribute('u') !== 'none';
              if (rPr.getAttribute('sz')) {
                sz = parseInt(rPr.getAttribute('sz'), 10);
              }
              color = extractColor(rPr, isDark);

              const latinNode = rPr.getElementsByTagName('a:latin')[0] || rPr.getElementsByTagName('latin')[0];
              if (latinNode) latinFont = latinNode.getAttribute('typeface') || '';
              const eaNode = rPr.getElementsByTagName('a:ea')[0] || rPr.getElementsByTagName('ea')[0];
              if (eaNode) eaFont = eaNode.getAttribute('typeface') || '';
            }

            textRuns.push({
              text,
              bold: isBold,
              italic: isItalic,
              underline: isUnderline,
              sizePt: Math.round(sz / 100),
              color,
              latinFont,
              eaFont
            });
          }

          if (textRuns.length > 0) {
            const fullParaText = textRuns.map(r => r.text).join('');
            paragraphs.push({
              runs: textRuns,
              text: fullParaText,
              align,
              lineHeight,
              bulletDisabled: !!buNone,
              isBullet: fullParaText.startsWith('•') || fullParaText.startsWith('- ')
            });

            if (!slideTitle && fullParaText.length < 50 && (textRuns[0]?.sizePt >= 22 || elements.length === 0)) {
              slideTitle = fullParaText.replace(/^[•\-]\s*/, '').trim();
            }
          }
        }
      }

      if (paragraphs.length > 0 || shapeFill || shapeBorder) {
        // Fallback layout: many generators (and some real decks) emit shapes
        // without an explicit <a:xfrm> because the position is inherited from
        // the slide layout placeholder. Without a fallback every one of those
        // shapes resolves to x=0,y=0 and the whole slide collapses into an
        // unreadable pile in the top-left corner. Distribute them instead.
        if (cx === 0 && cy === 0) {
          const titleParas = paragraphs.filter(p =>
            p.runs.some(r => (r.sizePt || 0) >= 24)
          );
          const hasBigText = titleParas.length > 0;
          if (hasBigText && !fallbackTitlePlaced) {
            fallbackTitlePlaced = true;
            // Title band: sized to the text it holds, not a fixed 22%
            const titleRunCount = Math.max(1, titleParas.length);
            const titleH = Math.max(
              Math.round(slideHeight * 0.14),
              Math.round(slideHeight * 0.055 * titleRunCount)
            );
            x = Math.round(slideWidth * 0.08);
            y = Math.round(slideHeight * 0.14);
            cx = Math.round(slideWidth * 0.84);
            cy = titleH;
          } else {
            // Content rows: compact band, hugging the actual row count so a
            // 3-bullet slide doesn't stretch to fill the whole canvas
            const rowCount = Math.max(1, totalTextShapes - 1);
            const contentTop = slideHeight * 0.40;
            const contentBand = slideHeight * 0.46;
            const rowHeight = contentBand / rowCount;
            const rowIndex = fallbackContentRows++;
            x = Math.round(slideWidth * 0.08);
            y = Math.round(contentTop + rowIndex * rowHeight);
            cx = Math.round(slideWidth * 0.84);
            cy = Math.round(rowHeight);
          }
        }

        elements.push({
          type: paragraphs.length > 0 ? 'text' : 'shape',
          x: x / slideWidth,
          y: y / slideHeight,
          w: cx > 0 ? cx / slideWidth : 0.8,
          h: cy > 0 ? cy / slideHeight : 0.05,
          shapeFill,
          shapeBorder,
          paragraphs,
          insets,
          wrap,
          anchor,
          fontScale,
          lnSpcReduction
        });
      }
    }

    if (!slideTitle) {
      slideTitle = `第 ${idx + 1} 页幻灯片`;
    }

    slides.push({
      index: idx + 1,
      title: slideTitle,
      background: slideBg,
      isDark,
      elements,
      aspectRatio: slideWidth / slideHeight
    });
  }

  return {
    slides,
    width: slideWidth,
    height: slideHeight,
    aspectRatio: slideWidth / slideHeight,
    total: slides.length
  };
}
