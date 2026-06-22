(function () {
  const FRAME_W = 360;
  const FRAME_H = 800;
  const ZOOM_STEPS = [0.5, 0.75, 1];
  const ZOOM_FIT = 'fit';
  const STAGE_PAD = 24;
  const TOOLBAR_GAP = 28;

  const VARIANTS = [
    { id: 'v1', label: 'V1', path: 'variants/v1/index.html' },
    { id: 'v2', label: 'V2', path: 'variants/v2/index.html' },
    { id: 'v3', label: 'V3', path: 'variants/v3/index.html' },
    { id: 'v4', label: 'V4', path: 'variants/v4/index.html' },
  ];

  const els = {
    toolbar: document.getElementById('toolbar'),
    stage: document.getElementById('stage'),
    phoneWrap: document.getElementById('phone-wrap'),
    frame: document.getElementById('app-frame'),
    variantSelect: document.getElementById('variantSelect'),
    zoomSelect: document.getElementById('zoomSelect'),
    reloadBtn: document.getElementById('reloadBtn'),
    measureBtn: document.getElementById('measureBtn'),
    measureHighlight: document.getElementById('measure-highlight'),
    measureGapHighlight: document.getElementById('measure-gap-highlight'),
    measureSpacingGuides: document.getElementById('measure-spacing-guides'),
    measurePanel: document.getElementById('measure-panel'),
    cursor: document.getElementById('touch-cursor'),
  };

  let currentVariant = 'v1';
  let zoomMode = ZOOM_FIT;
  let zoomIndex = 2;

  function parseVariantFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const v = params.get('v') || params.get('variant');
    if (v && VARIANTS.some((item) => item.id === v)) return v;
    return 'v1';
  }

  function updateUrl(variantId) {
    const url = new URL(window.location.href);
    url.searchParams.set('v', variantId);
    window.history.replaceState({}, '', url);
  }

  function toolbarClearance() {
    const rect = els.toolbar?.getBoundingClientRect();
    return rect ? rect.bottom + TOOLBAR_GAP : 72;
  }

  function currentScale() {
    if (zoomMode === ZOOM_FIT) return computeFitScale();
    return ZOOM_STEPS[zoomIndex];
  }

  function computeFitScale() {
    const clearance = toolbarClearance();
    const availW = els.stage.clientWidth - STAGE_PAD * 2;
    const availH = els.stage.clientHeight - clearance - STAGE_PAD;
    return Math.min(availW / FRAME_W, availH / FRAME_H, 1);
  }

  function applyLayout() {
    const clearance = toolbarClearance();
    const availH = Math.max(1, els.stage.clientHeight - clearance - STAGE_PAD);
    const scale = currentScale();
    const centerY = clearance + availH / 2;
    els.phoneWrap.style.left = '50%';
    els.phoneWrap.style.top = `${centerY}px`;
    els.phoneWrap.style.transform = `translate(-50%, -50%) scale(${scale})`;
  }

  function syncZoomSelect() {
    els.zoomSelect.value = zoomMode === ZOOM_FIT ? ZOOM_FIT : String(zoomIndex);
  }

  function setZoom(value) {
    if (value === ZOOM_FIT) {
      zoomMode = ZOOM_FIT;
      syncZoomSelect();
      applyLayout();
      return;
    }
    const index = Number(value);
    if (!Number.isFinite(index) || index < 0 || index >= ZOOM_STEPS.length) return;
    zoomMode = 'step';
    zoomIndex = index;
    syncZoomSelect();
    applyLayout();
  }

  function setVariant(variantId, reload = true) {
    currentVariant = variantId;
    const meta = VARIANTS.find((v) => v.id === variantId);
    if (!meta) return;
    els.variantSelect.value = variantId;
    updateUrl(variantId);
    if (reload) {
      els.frame.src = meta.path;
    }
  }

  function reloadDemo() {
    try {
      els.frame.contentWindow.postMessage({ type: 'album:reload' }, '*');
    } catch (_) {
      els.frame.src = els.frame.src;
    }
  }

  function setupMeasureTool() {
    let active = false;
    let boundDoc = null;
    let onIframeMove = null;

    const SKIP_TAGS = new Set(['HTML', 'BODY', 'HEAD', 'SCRIPT', 'STYLE', 'SVG']);
    const LAYOUT_IDS = new Set([
      'effectsScroll',
      'cameraHeader',
      'albumScroll',
      'album',
      'screen',
      'screen-album',
      'tabPinnedOverlay',
    ]);
    const LAYOUT_CLASS_HINTS = [
      'album-scroll',
      'album-scroll-wrap',
      'album-root',
      'camera-header',
      'camera-section',
      'effects-scroll',
      'effects-inner',
      'effects-presets',
      'effects-section',
      'entry-row',
      'grid-wrap',
      'grid-row',
      'popular-header',
      'select-bar',
      'capture-root',
      'screen-capture',
    ];
    const MEASURE_TARGET_SELECTOR = [
      '.entry-btn',
      '.camera-entry-v2',
      '.camera-btn-v3',
      '.camera-btn-v4',
      '.effects-btn-v3',
      '.effect-preset-btn',
      '.effects-more',
      '.grid-tile',
      '.tile-size',
      '.tile-duration',
      '.popular-title',
      '.popular-more',
      '.tab-item',
      '.drafts-btn',
      '.storage-pill',
      '.nav-tap',
    ].join(',');

    function isLayoutShell(el) {
      if (!el || el.nodeType !== 1) return true;
      if (el.id && LAYOUT_IDS.has(el.id)) return true;
      const cls = typeof el.className === 'string' ? el.className : '';
      if (/\bscreen\b/.test(cls) && !cls.includes('screen-capture')) return true;
      return LAYOUT_CLASS_HINTS.some((hint) => cls.includes(hint));
    }

    function isMediaOverlayText(el, win) {
      if (!el || !el.textContent?.trim()) return false;
      const tag = el.tagName;
      if (tag !== 'SPAN' && tag !== 'P' && tag !== 'LABEL') return false;
      const cs = win.getComputedStyle(el);
      if (cs.position !== 'absolute' && cs.position !== 'fixed') return false;
      return Boolean(el.closest('.grid-tile, .effect-preset-btn, .camera-entry-v2'));
    }

    function isMeasureTarget(el, win) {
      return measureTargetScore(el, win) > 0;
    }

    function pointerDistanceToRect(x, y, rect) {
      const cx = Math.max(rect.left, Math.min(x, rect.right));
      const cy = Math.max(rect.top, Math.min(y, rect.bottom));
      const dx = x - cx;
      const dy = y - cy;
      return Math.hypot(dx, dy);
    }

    function snapSlopForTarget(el, win) {
      const parent = el.parentElement;
      if (!parent) return 20;
      const pcs = win.getComputedStyle(parent);
      const pad = Math.max(
        parseFloat(pcs.paddingTop) || 0,
        parseFloat(pcs.paddingRight) || 0,
        parseFloat(pcs.paddingBottom) || 0,
        parseFloat(pcs.paddingLeft) || 0,
        parseFloat(pcs.rowGap || pcs.gap || '0') || 0,
        parseFloat(pcs.columnGap || pcs.gap || '0') || 0,
      );
      return Math.max(20, pad + 6);
    }

    function findNearestMeasureTarget(localX, localY, doc, win) {
      const nodes = doc.querySelectorAll(MEASURE_TARGET_SELECTOR);
      let best = null;
      let bestDist = Infinity;
      nodes.forEach((el) => {
        if (!isInspectable(el, win) || isLayoutShell(el)) return;
        const rect = el.getBoundingClientRect();
        const slop = snapSlopForTarget(el, win);
        if (
          localX < rect.left - slop ||
          localX > rect.right + slop ||
          localY < rect.top - slop ||
          localY > rect.bottom + slop
        ) {
          return;
        }
        const dist = pointerDistanceToRect(localX, localY, rect);
        if (dist < bestDist) {
          bestDist = dist;
          best = el;
        }
      });
      return best;
    }

    function measureTargetScore(el, win) {
      if (isLayoutShell(el)) return -1000;
      if (win && isMediaOverlayText(el, win)) return 130;
      const tag = el.tagName;
      if (tag === 'BUTTON') return 120;
      if (el.classList.contains('camera-entry-v2')) return 115;
      if (el.classList.contains('effect-preset-btn')) return 115;
      if (el.classList.contains('grid-tile')) return 110;
      if (el.classList.contains('effects-more')) return 105;
      if (el.classList.contains('effects-btn-v3')) return 115;
      if (el.classList.contains('popular-title')) return 95;
      if (el.classList.contains('entry-btn')) return 110;
      if (tag === 'IMG') return 40;
      if (tag === 'SPAN' && el.textContent.trim()) return 90;
      if (tag === 'DIV' && !el.textContent.trim() && el.children.length > 0) return -200;
      return 20;
    }

    function normalizeMeasureTarget(el, win) {
      if (!el) return null;
      if (el.tagName === 'IMG') {
        const host = el.closest(
          'button, .effect-preset-btn, .camera-entry-v2, .grid-tile, .effects-more-circle',
        );
        if (host && isInspectable(host, win) && !isLayoutShell(host)) return host;
      }
      if (isLayoutShell(el)) {
        return null;
      }
      return el;
    }

    function hasBoxSides(box) {
      return box.t > 0 || box.r > 0 || box.b > 0 || box.l > 0;
    }

    function hasDirectText(el) {
      return [...el.childNodes].some(
        (node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim(),
      );
    }

    function isTextualElement(el, win) {
      if (!el || el.tagName === 'IMG') return false;
      if (el.tagName === 'BUTTON' && el.querySelector(':scope > img') && !el.textContent.trim()) {
        return false;
      }
      const textTags = new Set(['SPAN', 'P', 'LABEL', 'A', 'BUTTON']);
      if (textTags.has(el.tagName) && el.textContent.trim()) return true;
      if (hasDirectText(el)) return true;
      if (el.querySelector(':scope > span, :scope > p, :scope > label')) {
        const cs = win.getComputedStyle(el);
        if (cs.display !== 'none' && el.textContent.trim()) return true;
      }
      return false;
    }

    function elementTextColor(el, win) {
      if (!isTextualElement(el, win)) return null;
      const textEl =
        el.querySelector(':scope > span, :scope > p, :scope > label') ||
        (hasDirectText(el) ? el : null);
      const target = textEl || el;
      return readableColor(win.getComputedStyle(target).color);
    }

    function elementHasCoverImage(el, win) {
      if (el.tagName === 'IMG') return true;
      const img = el.querySelector(
        ':scope > img, :scope > .effect-preset-img, :scope > .effect-preset-placeholder',
      );
      if (!img || !isInspectable(img, win)) return false;
      const ir = img.getBoundingClientRect();
      const er = el.getBoundingClientRect();
      return ir.width >= er.width * 0.85 && ir.height >= er.height * 0.85;
    }

    function elementFill(el, win) {
      if (elementHasCoverImage(el, win)) return 'image';
      const cs = win.getComputedStyle(el);
      const bgImage = cs.backgroundImage;
      if (bgImage && bgImage !== 'none' && !/gradient/i.test(bgImage)) return 'image';
      const bg = readableColor(cs.backgroundColor);
      if (!bg) return null;
      return bg;
    }

    function frameMetrics() {
      const rect = els.frame.getBoundingClientRect();
      return {
        rect,
        scaleX: rect.width / Math.max(1, els.frame.clientWidth),
        scaleY: rect.height / Math.max(1, els.frame.clientHeight),
      };
    }

    function toScreenRectFromIframe(r) {
      const { rect, scaleX, scaleY } = frameMetrics();
      return {
        left: rect.left + r.left * scaleX,
        top: rect.top + r.top * scaleY,
        width: r.width * scaleX,
        height: r.height * scaleY,
      };
    }

    function dp(value) {
      const n = Number(value);
      return Number.isFinite(n) ? Math.round(n) : 0;
    }

    function isInspectable(el, win) {
      if (!el || el.nodeType !== 1) return false;
      if (SKIP_TAGS.has(el.tagName)) return false;
      if (el.classList?.contains('phone')) return false;
      const cs = win.getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
      if (el.offsetWidth < 1 || el.offsetHeight < 1) return false;
      return true;
    }

    function pickElement(localX, localY, doc, win) {
      const rawStack = doc
        .elementsFromPoint(localX, localY)
        .filter((el) => isInspectable(el, win));

      const rawTargets = rawStack.filter((el) => isMeasureTarget(el, win) && !isLayoutShell(el));
      if (rawTargets.length) {
        return rawTargets.sort((a, b) => {
          const scoreDiff = measureTargetScore(b, win) - measureTargetScore(a, win);
          if (scoreDiff !== 0) return scoreDiff;
          const areaA = a.offsetWidth * a.offsetHeight;
          const areaB = b.offsetWidth * b.offsetHeight;
          return areaA - areaB;
        })[0];
      }

      const stack = rawStack
        .map((el) => normalizeMeasureTarget(el, win))
        .filter(Boolean);

      const direct = stack.filter((el) => isMeasureTarget(el, win));
      if (direct.length) {
        return direct.sort((a, b) => {
          const scoreDiff = measureTargetScore(b, win) - measureTargetScore(a, win);
          if (scoreDiff !== 0) return scoreDiff;
          const areaA = a.offsetWidth * a.offsetHeight;
          const areaB = b.offsetWidth * b.offsetHeight;
          return areaA - areaB;
        })[0];
      }

      return findNearestMeasureTarget(localX, localY, doc, win);
    }

    function findFlexGapAt(parent, localX, localY, win) {
      const pcs = win.getComputedStyle(parent);
      if (pcs.display !== 'flex' && pcs.display !== 'inline-flex') return null;
      const justify = pcs.justifyContent;
      if (justify === 'space-between' || justify === 'space-around' || justify === 'space-evenly') {
        return null;
      }

      const kids = flexLayoutChildren(parent, win);
      const gapLimit = flexGapLimit(pcs);
      const isRow = !pcs.flexDirection.startsWith('column');

      for (let i = 0; i < kids.length - 1; i += 1) {
        const r1 = kids[i].getBoundingClientRect();
        const r2 = kids[i + 1].getBoundingClientRect();
        if (isRow) {
          const gapW = r2.left - r1.right;
          if (gapW <= 0 || dp(gapW) > gapLimit) continue;
          const top = Math.max(r1.top, r2.top);
          const bottom = Math.min(r1.bottom, r2.bottom);
          if (bottom - top < 1) continue;
          if (localX < r1.right || localX > r2.left || localY < top || localY > bottom) continue;
          return {
            value: dp(gapW),
            rect: {
              left: r1.right,
              top,
              width: gapW,
              height: bottom - top,
            },
          };
        }

        const gapH = r2.top - r1.bottom;
        if (gapH <= 0 || dp(gapH) > gapLimit) continue;
        const left = Math.max(r1.left, r2.left);
        const right = Math.min(r1.right, r2.right);
        if (right - left < 1) continue;
        if (localY < r1.bottom || localY > r2.top || localX < left || localX > right) continue;
        return {
          value: dp(gapH),
          rect: {
            left,
            top: r1.bottom,
            width: right - left,
            height: gapH,
          },
        };
      }
      return null;
    }

    function flexLayoutChildren(parent, win) {
      const items = [];
      [...parent.children].forEach((child) => {
        if (child.nodeType !== 1 || SKIP_TAGS.has(child.tagName)) return;
        const cs = win.getComputedStyle(child);
        if (cs.display === 'none' || cs.visibility === 'hidden') return;
        if (cs.display === 'contents') {
          items.push(...flexLayoutChildren(child, win));
          return;
        }
        const rect = child.getBoundingClientRect();
        if (rect.width < 1 || rect.height < 1) return;
        items.push(child);
      });
      return items;
    }

    function flexGapLimit(pcs) {
      const isRow = !pcs.flexDirection.startsWith('column');
      const raw = parseFloat(isRow ? pcs.columnGap || pcs.gap || '0' : pcs.rowGap || pcs.gap || '0');
      const gap = Number.isFinite(raw) ? raw : 0;
      return Math.max(24, gap * 2 + 6);
    }

    function detectGap(localX, localY, doc, win) {
      const probe = doc.elementFromPoint(localX, localY);
      if (!probe) return null;
      let node = probe;
      while (node && node !== doc.body) {
        const hit = findFlexGapAt(node, localX, localY, win);
        if (hit) return hit;
        node = node.parentElement;
      }
      return null;
    }

    function readableColor(raw) {
      if (!raw || raw === 'transparent' || raw === 'rgba(0, 0, 0, 0)') return null;
      return raw;
    }

    function parsePx(value) {
      return dp(parseFloat(value) || 0);
    }

    function formatBoxSides(t, r, b, l) {
      return `<span class="measure-box-sides"><span>↑${dp(t)}</span><span>→${dp(r)}</span><span>↓${dp(b)}</span><span>←${dp(l)}</span></span>`;
    }

    function boxMeasureRow(label, t, r, b, l) {
      return `<div class="measure-row"><span>${label}</span><strong>${formatBoxSides(t, r, b, l)}</strong></div>`;
    }

    function parseInsetBoxShadow(boxShadow) {
      if (!boxShadow || boxShadow === 'none') return null;
      const re = /inset\s+([-\d.]+px)\s+([-\d.]+px)\s+([-\d.]+px)\s+([-\d.]+px)\s+(rgba?\([^)]+\)|hsla?\([^)]+\)|#[0-9a-fA-F]+|[a-zA-Z]+)/gi;
      let match = re.exec(boxShadow);
      while (match) {
        const width = parseFloat(match[4]);
        const color = match[5].trim();
        if (width > 0 && readableColor(color)) {
          return { width, color };
        }
        match = re.exec(boxShadow);
      }
      return null;
    }

    function detectStroke(el, win) {
      const cs = win.getComputedStyle(el);
      const sides = ['Top', 'Right', 'Bottom', 'Left'];
      const widths = sides.map((s) => parseFloat(cs[`border${s}Width`]) || 0);
      const colors = sides.map((s) => readableColor(cs[`border${s}Color`]));
      if (widths.some((w) => w > 0)) {
        const uniqW = [...new Set(widths.map((w) => dp(w)))];
        const uniqC = [...new Set(colors.filter(Boolean))];
        return {
          t: widths[0],
          r: widths[1],
          b: widths[2],
          l: widths[3],
          color: uniqC.length === 1 ? uniqC[0] : colors[0],
          uniform: uniqW.length === 1 && uniqC.length <= 1,
        };
      }

      const selfShadow = parseInsetBoxShadow(cs.boxShadow);
      if (selfShadow) {
        return {
          t: selfShadow.width,
          r: selfShadow.width,
          b: selfShadow.width,
          l: selfShadow.width,
          color: selfShadow.color,
          uniform: true,
        };
      }

      for (const pseudo of ['::after', '::before']) {
        const ps = win.getComputedStyle(el, pseudo);
        if (ps.content === 'none') continue;
        const shadow = parseInsetBoxShadow(ps.boxShadow);
        if (shadow) {
          return {
            t: shadow.width,
            r: shadow.width,
            b: shadow.width,
            l: shadow.width,
            color: shadow.color,
            uniform: true,
          };
        }
      }
      return null;
    }

    function strokeMeasureRow(stroke) {
      if (!stroke) return '';
      const info = formatMeasureColor(stroke.color);
      const widthHtml = stroke.uniform
        ? `${dp(stroke.t)} dp`
        : formatBoxSides(stroke.t, stroke.r, stroke.b, stroke.l);
      if (!info) {
        return `<div class="measure-row"><span>描边</span><strong>${widthHtml}</strong></div>`;
      }
      const title = info.token ? ` title="${info.token}"` : '';
      return `<div class="measure-row"><span>描边</span><strong${title}>${widthHtml}<span class="measure-stroke-sep">·</span><span class="measure-swatch" style="background:${info.swatch}"></span><span class="measure-color-label">${info.label}</span></strong></div>`;
    }

    function formatMeasureColor(raw) {
      if (!raw) return null;
      if (window.TuxColorResolver) {
        const info = TuxColorResolver.describe(raw);
        if (!info) return null;
        return {
          swatch: raw,
          label: info.label,
          token: info.token,
        };
      }
      return null;
    }

    const SPACING_REFERENCE_SELECTOR = [
      MEASURE_TARGET_SELECTOR,
      '.recents',
      '.tabs-section',
      '.tab-sep',
      '.album-nav',
      '.select-bar',
      '.popular-header-v4',
      '.camera-section-v3',
      '.camera-section-v4',
      '.effects-section-v3',
      '.effects-section-v4',
      '.status-bar',
      '.home-indicator',
    ].join(',');

    function isSpacingReference(el, win, self) {
      if (!el || el === self) return false;
      if (self.contains(el) || el.contains(self)) return false;
      if (SKIP_TAGS.has(el.tagName)) return false;
      if (el.classList?.contains('phone')) return false;
      if (isLayoutShell(el)) return false;
      const cs = win.getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
      const r = el.getBoundingClientRect();
      return r.width >= 1 && r.height >= 1;
    }

    function spacingReferences(doc, win, self) {
      const seen = new Set();
      const list = [];
      doc.querySelectorAll(SPACING_REFERENCE_SELECTOR).forEach((el) => {
        if (!isSpacingReference(el, win, self) || seen.has(el)) return;
        seen.add(el);
        list.push(el);
      });
      return list;
    }

    function overlapSize(a1, a2, b1, b2) {
      return Math.min(a2, b2) - Math.max(a1, b1);
    }

    function computeAroundSpacing(el, win, doc) {
      const rect = el.getBoundingClientRect();
      const sides = { t: Infinity, r: Infinity, b: Infinity, l: Infinity };
      const guides = { t: null, r: null, b: null, l: null };

      function apply(side, distance, guide) {
        if (!Number.isFinite(distance) || distance < 0) return;
        if (distance < sides[side]) {
          sides[side] = distance;
          guides[side] = guide;
        }
      }

      spacingReferences(doc, win, el).forEach((other) => {
        const sr = other.getBoundingClientRect();
        const vOverlap = overlapSize(rect.top, rect.bottom, sr.top, sr.bottom);
        const hOverlap = overlapSize(rect.left, rect.right, sr.left, sr.right);
        const minH = Math.min(rect.width, sr.width) * 0.15;
        const minV = Math.min(rect.height, sr.height) * 0.15;

        if (vOverlap >= Math.max(4, minV)) {
          if (sr.right <= rect.left + 0.5) {
            const gapW = rect.left - sr.right;
            apply('l', gapW, {
              left: sr.right,
              top: Math.max(rect.top, sr.top),
              width: gapW,
              height: vOverlap,
            });
          }
          if (sr.left >= rect.right - 0.5) {
            const gapW = sr.left - rect.right;
            apply('r', gapW, {
              left: rect.right,
              top: Math.max(rect.top, sr.top),
              width: gapW,
              height: vOverlap,
            });
          }
        }

        if (hOverlap >= Math.max(4, minH)) {
          if (sr.bottom <= rect.top + 0.5) {
            const gapH = rect.top - sr.bottom;
            apply('t', gapH, {
              left: Math.max(rect.left, sr.left),
              top: sr.bottom,
              width: hOverlap,
              height: gapH,
            });
          }
          if (sr.top >= rect.bottom - 0.5) {
            const gapH = sr.top - rect.bottom;
            apply('b', gapH, {
              left: Math.max(rect.left, sr.left),
              top: rect.bottom,
              width: hOverlap,
              height: gapH,
            });
          }
        }
      });

      const phone = doc.querySelector('.phone');
      if (phone) {
        const pr = phone.getBoundingClientRect();
        if (sides.l === Infinity) {
          apply('l', rect.left - pr.left, {
            left: pr.left,
            top: rect.top,
            width: rect.left - pr.left,
            height: rect.height,
          });
        }
        if (sides.r === Infinity) {
          apply('r', pr.right - rect.right, {
            left: rect.right,
            top: rect.top,
            width: pr.right - rect.right,
            height: rect.height,
          });
        }
        if (sides.t === Infinity) {
          apply('t', rect.top - pr.top, {
            left: rect.left,
            top: pr.top,
            width: rect.width,
            height: rect.top - pr.top,
          });
        }
        if (sides.b === Infinity) {
          apply('b', pr.bottom - rect.bottom, {
            left: rect.left,
            top: rect.bottom,
            width: rect.width,
            height: pr.bottom - rect.bottom,
          });
        }
      }

      return {
        spacing: {
          t: sides.t === Infinity ? 0 : dp(sides.t),
          r: sides.r === Infinity ? 0 : dp(sides.r),
          b: sides.b === Infinity ? 0 : dp(sides.b),
          l: sides.l === Infinity ? 0 : dp(sides.l),
        },
        guides,
      };
    }

    function renderSpacingGuides(guides, spacing) {
      const root = els.measureSpacingGuides;
      if (!root) return;
      root.innerHTML = '';
      const sideLabels = { t: '↑', r: '→', b: '↓', l: '←' };
      ['t', 'r', 'b', 'l'].forEach((side) => {
        const value = spacing[side];
        const guide = guides[side];
        if (!guide || value <= 0) return;
        const sr = toScreenRectFromIframe(guide);
        if (sr.width < 1 && sr.height < 1) return;
        const div = document.createElement('div');
        div.className = 'measure-spacing-guide';
        div.dataset.label = `${sideLabels[side]}${value}`;
        div.style.left = `${sr.left}px`;
        div.style.top = `${sr.top}px`;
        div.style.width = `${Math.max(sr.width, 2)}px`;
        div.style.height = `${Math.max(sr.height, 2)}px`;
        root.appendChild(div);
      });
    }

    function colorMeasureRow(label, raw) {
      const info = formatMeasureColor(raw);
      if (!info) return '';
      const title = info.token ? ` title="${info.token}"` : '';
      return `<div class="measure-row"><span>${label}</span><strong${title}><span class="measure-swatch" style="background:${info.swatch}"></span><span class="measure-color-label">${info.label}</span></strong></div>`;
    }

    function fillMeasureRow(fill) {
      if (fill === 'image') {
        return '<div class="measure-row"><span>填充</span><strong>image</strong></div>';
      }
      return colorMeasureRow('填充', fill);
    }

    function inspectElement(el, win) {
      const cs = win.getComputedStyle(el);
      const bg = elementFill(el, win);
      const color = elementTextColor(el, win);
      const padding = {
        t: parsePx(cs.paddingTop),
        r: parsePx(cs.paddingRight),
        b: parsePx(cs.paddingBottom),
        l: parsePx(cs.paddingLeft),
      };
      const margin = {
        t: parsePx(cs.marginTop),
        r: parsePx(cs.marginRight),
        b: parsePx(cs.marginBottom),
        l: parsePx(cs.marginLeft),
      };
      const stroke = detectStroke(el, win);
      const { spacing, guides } = computeAroundSpacing(el, win, win.document);
      return {
        el,
        bg,
        color,
        w: el.offsetWidth,
        h: el.offsetHeight,
        padding,
        margin,
        stroke,
        spacing,
        spacingGuides: guides,
      };
    }

    function hideMeasureUi() {
      els.measureHighlight.style.display = 'none';
      els.measureGapHighlight.style.display = 'none';
      if (els.measureSpacingGuides) els.measureSpacingGuides.innerHTML = '';
      els.measurePanel.hidden = true;
    }

    function showElementMeasure(data) {
      const sr = toScreenRectFromIframe(data.el.getBoundingClientRect());
      els.measureGapHighlight.style.display = 'none';
      els.measureHighlight.style.display = 'block';
      els.measureHighlight.style.left = `${sr.left}px`;
      els.measureHighlight.style.top = `${sr.top}px`;
      els.measureHighlight.style.width = `${sr.width}px`;
      els.measureHighlight.style.height = `${sr.height}px`;

      const rows = [`<div class="measure-row"><span>尺寸</span><strong>${dp(data.w)} × ${dp(data.h)} dp</strong></div>`];
      if (data.bg) {
        const fillRow = fillMeasureRow(data.bg);
        if (fillRow) rows.push(fillRow);
      }
      if (data.color) {
        const textRow = colorMeasureRow('文字', data.color);
        if (textRow) rows.push(textRow);
      }
      if (hasBoxSides(data.padding)) {
        rows.push(boxMeasureRow('内边距', data.padding.t, data.padding.r, data.padding.b, data.padding.l));
      }
      if (hasBoxSides(data.margin)) {
        rows.push(boxMeasureRow('外边距', data.margin.t, data.margin.r, data.margin.b, data.margin.l));
      }
      const strokeRow = strokeMeasureRow(data.stroke);
      if (strokeRow) rows.push(strokeRow);
      if (hasBoxSides(data.spacing)) {
        rows.push(boxMeasureRow('周围间距', data.spacing.t, data.spacing.r, data.spacing.b, data.spacing.l));
      }
      renderSpacingGuides(data.spacingGuides, data.spacing);
      els.measurePanel.innerHTML = rows.join('');
      els.measurePanel.hidden = false;
      positionPanel(sr);
    }

    function showGapMeasure(gap) {
      els.measureHighlight.style.display = 'none';
      const sr = toScreenRectFromIframe(gap.rect);
      els.measureGapHighlight.style.display = 'block';
      els.measureGapHighlight.style.left = `${sr.left}px`;
      els.measureGapHighlight.style.top = `${sr.top}px`;
      els.measureGapHighlight.style.width = `${Math.max(sr.width, 2)}px`;
      els.measureGapHighlight.style.height = `${Math.max(sr.height, 2)}px`;
      els.measurePanel.innerHTML = `<div class="measure-row"><span>间距</span><strong>${gap.value} dp</strong></div>`;
      els.measurePanel.hidden = false;
      positionPanel(sr);
    }

    function positionPanel(targetRect) {
      const panel = els.measurePanel;
      const phoneRect = els.phoneWrap.getBoundingClientRect();
      panel.hidden = false;
      const pw = panel.offsetWidth || 160;
      const ph = panel.offsetHeight || 80;

      let left = phoneRect.right + 12;
      if (left + pw > window.innerWidth - 8) {
        left = phoneRect.left - pw - 12;
      }

      let top = targetRect.top + targetRect.height / 2 - ph / 2;
      top = Math.max(phoneRect.top + 8, Math.min(top, phoneRect.bottom - ph - 8));
      top = Math.max(8, Math.min(top, window.innerHeight - ph - 8));

      panel.style.left = `${Math.max(8, left)}px`;
      panel.style.top = `${top}px`;
    }

    function bindIframe(doc) {
      if (!doc || boundDoc === doc) return;
      unbindIframe();
      boundDoc = doc;
      onIframeMove = (e) => {
        if (!active) return;
        const win = els.frame.contentWindow;
        if (!win) return;
        const x = e.clientX;
        const y = e.clientY;
        const el = pickElement(x, y, doc, win);
        if (!el) {
          hideMeasureUi();
          return;
        }
        showElementMeasure(inspectElement(el, win));
      };
      doc.addEventListener('pointermove', onIframeMove, { passive: true });
      doc.addEventListener('mouseleave', hideMeasureUi, { passive: true });
    }

    function unbindIframe() {
      if (!boundDoc || !onIframeMove) return;
      boundDoc.removeEventListener('pointermove', onIframeMove);
      boundDoc.removeEventListener('mouseleave', hideMeasureUi);
      boundDoc = null;
      onIframeMove = null;
    }

    function setActive(on) {
      active = on;
      els.measureBtn.classList.toggle('is-active', on);
      els.measureBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
      document.body.classList.toggle('measure-mode', on);
      if (!on) {
        unbindIframe();
        hideMeasureUi();
        return;
      }
      try {
        bindIframe(els.frame.contentDocument);
      } catch (_) {}
    }

    els.measureBtn.addEventListener('click', () => setActive(!active));

    els.frame.addEventListener('load', () => {
      if (active) {
        setTimeout(() => {
          try {
            bindIframe(els.frame.contentDocument);
          } catch (_) {}
        }, 0);
      } else {
        hideMeasureUi();
      }
    });
  }

  function setupTouchCursor() {
    let isCoarse = false;
    try {
      isCoarse = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    } catch (_) {}
    if (isCoarse) return;

    document.body.classList.add('has-touch-cursor');
    const cursor = els.cursor;

    function inFrame(x, y) {
      const rect = els.frame.getBoundingClientRect();
      return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    }

    function hideCursor() {
      cursor.classList.remove('visible', 'is-down');
    }

    function showCursor(x, y) {
      if (!inFrame(x, y)) {
        hideCursor();
        return;
      }
      cursor.style.left = `${x}px`;
      cursor.style.top = `${y}px`;
      cursor.classList.add('visible');
    }

    function onDown() {
      if (cursor.classList.contains('visible')) cursor.classList.add('is-down');
    }

    function onUp() {
      cursor.classList.remove('is-down');
    }

    function bindIframeDoc() {
      try {
        const doc = els.frame.contentDocument;
        if (!doc || doc.documentElement?.dataset.albumCursorBound === '1') return;
        doc.documentElement.dataset.albumCursorBound = '1';

        if (!doc.getElementById('album-preview-hide-cursor')) {
          const style = doc.createElement('style');
          style.id = 'album-preview-hide-cursor';
          style.textContent = 'html,body,*{cursor:none!important}';
          doc.head.appendChild(style);
        }

        const moveFrame = (e) => {
          const rect = els.frame.getBoundingClientRect();
          const sx = rect.width / Math.max(1, els.frame.clientWidth);
          const sy = rect.height / Math.max(1, els.frame.clientHeight);
          showCursor(rect.left + e.clientX * sx, rect.top + e.clientY * sy);
        };

        doc.addEventListener('pointermove', moveFrame);
        doc.addEventListener('pointerdown', onDown);
        doc.addEventListener('pointerup', onUp);
        doc.addEventListener('pointercancel', onUp);
        doc.addEventListener('mouseleave', hideCursor);
      } catch (_) {}
    }

    els.frame.addEventListener('load', () => {
      setTimeout(bindIframeDoc, 0);
    });

    document.addEventListener('pointermove', (e) => {
      if (!inFrame(e.clientX, e.clientY)) hideCursor();
    });

    if (els.frame.contentDocument?.readyState === 'complete') {
      bindIframeDoc();
    }
  }

  VARIANTS.forEach((variant) => {
    const option = document.createElement('option');
    option.value = variant.id;
    option.textContent = variant.label;
    els.variantSelect.appendChild(option);
  });

  ZOOM_STEPS.forEach((step, index) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = `${Math.round(step * 100)}%`;
    els.zoomSelect.appendChild(option);
  });

  const fitOption = document.createElement('option');
  fitOption.value = ZOOM_FIT;
  fitOption.textContent = '自适应';
  els.zoomSelect.appendChild(fitOption);

  els.variantSelect.addEventListener('change', () => {
    setVariant(els.variantSelect.value);
  });

  els.zoomSelect.addEventListener('change', () => {
    setZoom(els.zoomSelect.value);
  });

  els.reloadBtn.addEventListener('click', reloadDemo);

  window.addEventListener('resize', applyLayout);

  if (els.toolbar && typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(applyLayout).observe(els.toolbar);
  }

  els.frame.addEventListener('load', () => {
    requestAnimationFrame(applyLayout);
  });

  setupTouchCursor();
  if (window.TuxColorResolver) {
    TuxColorResolver.load('shared/');
  }
  setupMeasureTool();

  currentVariant = parseVariantFromUrl();
  setVariant(currentVariant, true);
  setZoom(ZOOM_FIT);
})();
