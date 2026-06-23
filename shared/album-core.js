/**
 * Album V1–V4 iframe demo core.
 * Config via window.__ALBUM_VARIANT__ (generated from Kotlin Dimens).
 */
(function () {
  const ALBUM_CORE_VERSION = '3';
  const C = window.__ALBUM_VARIANT__;
  if (!C) {
    console.error('Missing __ALBUM_VARIANT__');
    return;
  }

  const EASE_IN_OUT = 'cubic-bezier(0.25, 0, 0.25, 1)';

  const root = document.documentElement;
  root.style.setProperty('--page-pad-h', `${C.pagePadH}px`);
  root.style.setProperty('--header-pad-h', `${C.headerPadH}px`);
  root.style.setProperty('--header-pad-v', `${C.headerPadV}px`);
  root.style.setProperty('--tab-pad-h', `${C.tabPadH}px`);
  root.style.setProperty('--effect-emerge-ms', `${C.effectCoverEmergeMs}ms`);
  root.style.setProperty('--effect-emerge-scale', String(C.effectCoverEmergeStartScale || 0.94));
  root.style.setProperty('--effect-tile-size', `${C.effectTileSize}px`);

  const EASE_OUT_STANDARD = 'cubic-bezier(0.33, 0.86, 0.2, 1)';
  const CAPTURE_TABS = ['Trending', 'New', 'Tool', 'Create', 'Hot', 'Hot', 'Hot', 'Hot', 'Hot', 'Hot', 'Hot'];
  const effectsEndPadding = C.effectsEndPadding ?? 0;

  const els = {
    album: document.getElementById('screen-album'),
    capture: document.getElementById('screen-capture'),
    albumScroll: document.getElementById('albumScroll'),
    navDrafts: document.getElementById('navDrafts'),
    navCamera: document.getElementById('navCamera'),
    navTitle: document.getElementById('navTitle'),
    tabsSection: document.getElementById('tabsSection'),
    tabPinnedOverlay: document.getElementById('tabPinnedOverlay'),
    navCameraBtn: document.getElementById('navCameraBtn'),
    effectsScroll: document.getElementById('effectsScroll'),
    effectsEntryBtn: document.getElementById('effectsEntryBtn'),
    capPanel: document.getElementById('capPanel'),
    capPreview: document.getElementById('capPreview'),
    capGrid: document.getElementById('capGrid'),
    capMusic: document.getElementById('capMusic'),
  };

  let navSwitched = false;
  let navProgress = 0;
  let navAnimRaf = null;
  let navAnimFrom = 0;
  let navAnimTo = 0;
  let navAnimStart = 0;
  let navAnimDuration = 0;
  let tabPinned = false;
  let effectCoversRevealed = false;
  let effectCoverTimer = null;
  let albumScrollAnimRaf = null;
  let navigatingToCapture = false;
  let effectsSnapping = false;
  let effectsSnapRaf = null;
  let selectedCapTab = 0;
  let selectedCapEffect = -1;
  let flipped = false;

  function clamp(v, lo = 0, hi = 1) {
    return Math.min(hi, Math.max(lo, v));
  }

  function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  function navFrame(t) {
    t = clamp(t);
    return {
      draftsAlpha: 1 - t,
      cameraAlpha: t,
      draftsSlide: -t * C.navDraftsSlide,
      cameraSlide: (1 - t) * C.navCameraSlide,
    };
  }

  function cancelNavAnimation() {
    if (navAnimRaf != null) {
      cancelAnimationFrame(navAnimRaf);
      navAnimRaf = null;
    }
  }

  function paintNav(t) {
    const n = navFrame(t);
    els.navDrafts.style.transition = 'none';
    els.navCamera.style.transition = 'none';
    els.navDrafts.style.opacity = String(n.draftsAlpha);
    els.navDrafts.style.transform = `translateY(${n.draftsSlide}px)`;
    els.navCamera.style.opacity = String(n.cameraAlpha);
    els.navCamera.style.transform = `translateY(${n.cameraSlide}px)`;
    navProgress = t;
    if (els.navCameraBtn) {
      els.navCameraBtn.style.pointerEvents = navProgress >= 0.5 ? 'auto' : 'none';
    }
    els.navCamera.style.pointerEvents = navProgress >= 0.5 ? 'auto' : 'none';
  }

  function tickNavAnimation(now) {
    const raw = clamp((now - navAnimStart) / navAnimDuration);
    paintNav(navAnimFrom + (navAnimTo - navAnimFrom) * easeInOut(raw));
    if (raw < 1) {
      navAnimRaf = requestAnimationFrame(tickNavAnimation);
      return;
    }
    navAnimRaf = null;
    paintNav(navAnimTo);
  }

  function setNavSwitched(switched, animate = true) {
    if (navSwitched === switched) return;
    navSwitched = switched;
    const target = switched ? 1 : 0;
    if (!animate) {
      cancelNavAnimation();
      paintNav(target);
      return;
    }
    navAnimFrom = navProgress;
    navAnimTo = target;
    navAnimStart = performance.now();
    navAnimDuration = switched ? C.cameraHideMs : C.cameraShowMs;
    cancelNavAnimation();
    navAnimRaf = requestAnimationFrame(tickNavAnimation);
  }

  /** Match Abulm*ScrollBehavior.isCameraEntryFullyObscured — button bottom clears scroll viewport. */
  function getCameraEntryEl() {
    return document.querySelector(
      '.camera-btn-v3, .camera-btn-v4, .camera-entry-v2, .entry-btn--camera',
    );
  }

  function isCameraEntryObscured() {
    const entry = getCameraEntryEl();
    if (entry && els.albumScroll) {
      const scrollRect = els.albumScroll.getBoundingClientRect();
      const entryRect = entry.getBoundingClientRect();
      return entryRect.bottom <= scrollRect.top + 0.5;
    }
    return els.albumScroll.scrollTop >= C.cameraNavSwitchScrollH;
  }

  function isTabPinned() {
    if (!els.tabsSection || !els.albumScroll) return false;
    const scrollRect = els.albumScroll.getBoundingClientRect();
    const tabsRect = els.tabsSection.getBoundingClientRect();
    return tabsRect.top < scrollRect.top - 0.5;
  }

  function setTabPinned(pinned) {
    if (tabPinned === pinned) return;
    tabPinned = pinned;
    const dur = pinned ? C.cameraHideMs : C.cameraShowMs;
    if (els.navTitle) {
      els.navTitle.style.transition = `opacity ${dur}ms ${EASE_IN_OUT}`;
    }
    els.tabPinnedOverlay?.classList.toggle('visible', pinned);
    els.tabsSection?.classList.toggle('tabs-hidden', pinned);
    els.navTitle?.classList.toggle('visible', pinned);
  }

  function syncScrollState() {
    setNavSwitched(isCameraEntryObscured(), true);
    setTabPinned(isTabPinned());
  }

  function animateAlbumScrollTo(targetTop, duration = 300) {
    const el = els.albumScroll;
    const start = el.scrollTop;
    const delta = targetTop - start;
    if (albumScrollAnimRaf != null) {
      cancelAnimationFrame(albumScrollAnimRaf);
      albumScrollAnimRaf = null;
    }
    if (Math.abs(delta) < 1) {
      el.scrollTop = targetTop;
      syncScrollState();
      return;
    }
    const t0 = performance.now();
    const step = (now) => {
      const raw = clamp((now - t0) / duration);
      el.scrollTop = Math.round(start + delta * easeInOut(raw));
      syncScrollState();
      if (raw < 1) {
        albumScrollAnimRaf = requestAnimationFrame(step);
      } else {
        albumScrollAnimRaf = null;
      }
    };
    albumScrollAnimRaf = requestAnimationFrame(step);
  }

  function revealEffectCovers() {
    if (effectCoversRevealed) return;
    effectCoversRevealed = true;
    document.querySelectorAll('.effect-preset-btn').forEach((btn) => {
      btn.removeAttribute('aria-disabled');
      btn.classList.add('revealed');
      requestAnimationFrame(() => btn.classList.add('emerge-active'));
    });
  }

  function startEffectCoverLoad() {
    if (effectCoversRevealed || effectCoverTimer) return;
    effectCoverTimer = setTimeout(() => {
      effectCoverTimer = null;
      revealEffectCovers();
    }, C.effectCoverLoadMs);
  }

  function setupAlbumTabs() {
    document.querySelectorAll('.tab-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = Number(btn.dataset.tab);
        document.querySelectorAll('.tab-item').forEach((b) => {
          b.classList.toggle('active', Number(b.dataset.tab) === tab);
        });
      });
    });
  }

  function waitForScrollEnd(el, cb) {
    if ('onscrollend' in el) {
      el.addEventListener('scrollend', () => cb(), { once: true });
      return;
    }
    let last = el.scrollLeft;
    let stable = 0;
    (function poll() {
      if (el.scrollLeft === last) {
        stable += 1;
        if (stable >= 4) {
          cb();
          return;
        }
      } else {
        stable = 0;
        last = el.scrollLeft;
      }
      requestAnimationFrame(poll);
    })();
  }

  function cancelEffectsSnapAnimation() {
    if (effectsSnapRaf != null) {
      cancelAnimationFrame(effectsSnapRaf);
      effectsSnapRaf = null;
    }
    effectsSnapping = false;
  }

  function animateEffectsScrollTo(targetLeft, onDone) {
    const el = els.effectsScroll;
    if (!el) return;
    cancelEffectsSnapAnimation();
    const start = el.scrollLeft;
    const delta = targetLeft - start;
    if (Math.abs(delta) < 1) {
      el.scrollLeft = targetLeft;
      onDone?.();
      return;
    }
    effectsSnapping = true;
    const duration = 250;
    const t0 = performance.now();
    const easeOut = (t) => 1 - (1 - t) ** 3;
    const step = (now) => {
      const t = clamp((now - t0) / duration);
      el.scrollLeft = Math.round(start + delta * easeOut(t));
      if (t < 1) {
        effectsSnapRaf = requestAnimationFrame(step);
        return;
      }
      el.scrollLeft = targetLeft;
      effectsSnapRaf = null;
      effectsSnapping = false;
      onDone?.();
    };
    effectsSnapRaf = requestAnimationFrame(step);
  }

  function isEffectsScrollBlockedTarget(target) {
    return target?.closest?.('.effect-preset-btn, .effects-btn, .effects-btn-v3, .effects-more');
  }

  function effectsLimits() {
    const el = els.effectsScroll;
    if (!el) return null;
    const max = el.scrollWidth - el.clientWidth;
    if (max <= 0) return null;
    const phase1 = Math.max(0, max - C.moreTile - C.effectsGap);
    if (max <= phase1) return null;
    return { phase1, phase2: max };
  }

  function iconRevealThreshold(limits) {
    const iconInset = (C.moreTile - C.moreCircle) / 2;
    const reveal = Math.round(iconInset + C.moreCircle - effectsEndPadding);
    return limits.phase1 + Math.max(0, reveal);
  }

  function isMoreIconFullyRevealed(scrollPx, limits) {
    return scrollPx >= iconRevealThreshold(limits);
  }

  function onEffectsScrollSettled(scrollPx, limits, allowPhase2, iconRevealedThisGesture) {
    const revealed = iconRevealedThisGesture || isMoreIconFullyRevealed(scrollPx, limits);
    if (revealed && allowPhase2) {
      snapEffectsAndNavigate(limits);
      return;
    }
    if (scrollPx > limits.phase1) {
      animateEffectsScrollTo(limits.phase1);
    }
  }

  function snapEffectsAndNavigate(limits) {
    if (navigatingToCapture || !els.capture) return;
    navigatingToCapture = true;
    animateEffectsScrollTo(limits.phase1, () => {
      openCapture();
      navigatingToCapture = false;
    });
  }

  function layoutCapTabs() {
    const scroll = document.getElementById('capTabScroll');
    if (!scroll) return;
    scroll.querySelectorAll('.cap-tab').forEach((btn) => {
      const i = Number(btn.dataset.tab);
      const active = i === selectedCapTab;
      btn.classList.toggle('active', active);
      if (active) {
        btn.innerHTML = `<span class="cap-tab-block"><span class="cap-tab-top"></span><span class="cap-tab-body"><span>${CAPTURE_TABS[i]}</span><span class="cap-tab-ind"></span></span></span>`;
      } else {
        btn.textContent = CAPTURE_TABS[i];
      }
      btn.onclick = () => {
        selectedCapTab = i;
        layoutCapTabs();
      };
    });
  }

  function selectCapEffect(index) {
    selectedCapEffect = index;
    els.capGrid?.querySelectorAll('.cap-effect').forEach((btn) => {
      btn.classList.toggle('selected', index >= 0 && Number(btn.dataset.i) === index);
    });
  }

  function resetCaptureState() {
    selectedCapTab = 0;
    selectedCapEffect = -1;
    flipped = false;
    els.capPreview?.classList.remove('flipped');
    els.capMusic?.classList.remove('hidden');
    selectCapEffect(-1);
    layoutCapTabs();
    if (els.capPanel) {
      els.capPanel.style.transition = 'none';
      els.capPanel.style.transform = 'translateY(346px)';
    }
  }

  function playCapturePanelEnter() {
    if (!els.capPanel) return;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      els.capPanel.style.transition = `transform ${C.panelEnterMs || 300}ms ${EASE_OUT_STANDARD}`;
      els.capPanel.style.transform = 'translateY(0)';
    }));
  }

  function openCapture(options = {}) {
    if (!els.capture || !els.album) return;
    resetCaptureState();
    if (options.selectFirstEffect) {
      selectCapEffect(0);
    }
    els.album.classList.remove('active');
    els.capture.classList.add('active');
    playCapturePanelEnter();
  }

  function closeCapture() {
    if (!els.capture || !els.album) return;
    els.capture.classList.remove('active');
    els.album.classList.add('active');
    const limits = effectsLimits();
    if (limits && els.effectsScroll) {
      els.effectsScroll.scrollLeft = limits.phase1;
    }
  }

  function initCapture() {
    if (!els.capture) return;
    document.getElementById('capBack')?.addEventListener('click', closeCapture);
    document.getElementById('capFlip')?.addEventListener('click', () => {
      flipped = !flipped;
      els.capPreview?.classList.toggle('flipped', flipped);
    });
    document.getElementById('capMusicClose')?.addEventListener('click', () => {
      els.capMusic?.classList.add('hidden');
    });
    els.capGrid?.addEventListener('click', (e) => {
      const btn = e.target.closest('.cap-effect');
      if (!btn) return;
      selectCapEffect(Number(btn.dataset.i));
    });
    layoutCapTabs();
  }

  function setupEffectsHorizontalScroll() {
    const el = els.effectsScroll;
    if (!el || !C.hasEffectsScroll) return;

    let inGesture = false;
    let gestureAllowPhase2 = false;
    let gesturePeak = 0;
    let iconRevealedThisGesture = false;
    let settleTimer = null;

    const resetGestureState = () => {
      inGesture = false;
      gestureAllowPhase2 = false;
      gesturePeak = 0;
      iconRevealedThisGesture = false;
      clearTimeout(settleTimer);
      settleTimer = null;
    };

    const beginGesture = () => {
      if (navigatingToCapture || effectsSnapping) return;
      const limits = effectsLimits();
      if (!limits) return;
      inGesture = true;
      gestureAllowPhase2 = el.scrollLeft >= limits.phase1 - 1;
      gesturePeak = el.scrollLeft;
      iconRevealedThisGesture = false;
    };

    const trackGesture = () => {
      if (effectsSnapping) return;
      const limits = effectsLimits();
      if (!limits) return;
      const value = el.scrollLeft;
      if (!inGesture) beginGesture();
      if (!inGesture) return;
      if (value >= limits.phase1 - 1) gestureAllowPhase2 = true;
      gesturePeak = Math.max(gesturePeak, value);
      if (gestureAllowPhase2 && isMoreIconFullyRevealed(value, limits)) {
        iconRevealedThisGesture = true;
      }
      if (value > limits.phase1 && !gestureAllowPhase2) {
        el.scrollLeft = limits.phase1;
      }
    };

    const endGesture = () => {
      if (!inGesture || effectsSnapping) return;
      const limits = effectsLimits();
      if (!limits) {
        resetGestureState();
        return;
      }
      const peak = Math.max(el.scrollLeft, gesturePeak);
      const allow = gestureAllowPhase2;
      const revealed = iconRevealedThisGesture;
      resetGestureState();
      onEffectsScrollSettled(peak, limits, allow, revealed);
    };

    const scheduleEndGesture = () => {
      if (!inGesture) return;
      clearTimeout(settleTimer);
      settleTimer = setTimeout(endGesture, 120);
    };

    el.addEventListener(
      'scroll',
      () => {
        trackGesture();
        scheduleEndGesture();
      },
      { passive: true },
    );

    el.addEventListener(
      'wheel',
      (e) => {
        const absX = Math.abs(e.deltaX);
        const absY = Math.abs(e.deltaY);

        if (e.shiftKey && absY > absX) {
          e.preventDefault();
          el.scrollLeft += e.deltaY;
          return;
        }

        if (absX > absY) {
          e.preventDefault();
          el.scrollLeft += e.deltaX;
          return;
        }

        if (absY > 0 && els.albumScroll) {
          e.preventDefault();
          els.albumScroll.scrollTop += e.deltaY;
        }
      },
      { passive: false },
    );

    el.addEventListener('touchstart', (e) => {
      if (effectsSnapping || isEffectsScrollBlockedTarget(e.target)) return;
      beginGesture();
    }, { passive: true });

    el.addEventListener('pointerdown', (e) => {
      if (effectsSnapping) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (isEffectsScrollBlockedTarget(e.target)) return;
      beginGesture();
      if (el.setPointerCapture) el.setPointerCapture(e.pointerId);
    });

    const releasePointer = (e) => {
      if (el.releasePointerCapture && el.hasPointerCapture?.(e.pointerId)) {
        el.releasePointerCapture(e.pointerId);
      }
      scheduleEndGesture();
    };

    el.addEventListener('pointerup', releasePointer);
    el.addEventListener('pointercancel', releasePointer);
    el.addEventListener('touchend', scheduleEndGesture, { passive: true });
    el.addEventListener('touchcancel', scheduleEndGesture, { passive: true });
  }

  function setupMoreNavigation() {
    document.addEventListener(
      'click',
      (e) => {
        if (e.target.closest('.popular-more')) {
          e.preventDefault();
          openCapture();
          return;
        }
        if (C.layout === 'popularEffects' && e.target.closest('.effects-more')) {
          e.preventDefault();
          const limits = effectsLimits();
          if (limits) snapEffectsAndNavigate(limits);
          else openCapture();
        }
      },
      true,
    );
  }

  function resetDemo() {
    clearTimeout(effectCoverTimer);
    effectCoverTimer = null;
    effectCoversRevealed = false;
    document.querySelectorAll('.effect-preset-btn').forEach((btn) => {
      btn.setAttribute('aria-disabled', 'true');
      btn.classList.remove('revealed', 'emerge-active');
    });
    if (albumScrollAnimRaf != null) {
      cancelAnimationFrame(albumScrollAnimRaf);
      albumScrollAnimRaf = null;
    }
    cancelEffectsSnapAnimation();
    navigatingToCapture = false;
    if (els.capture?.classList.contains('active')) {
      els.capture.classList.remove('active');
      els.album?.classList.add('active');
      resetCaptureState();
    }
    els.albumScroll.scrollTop = 0;
    if (els.effectsScroll) els.effectsScroll.scrollLeft = 0;
    cancelNavAnimation();
    tabPinned = false;
    navSwitched = false;
    paintNav(0);
    els.tabPinnedOverlay?.classList.remove('visible');
    els.tabsSection?.classList.remove('tabs-hidden');
    els.navTitle?.classList.remove('visible');
    startEffectCoverLoad();
  }

  window.__albumDemo = {
    reset: resetDemo,
    openCapture,
    config: C,
    version: ALBUM_CORE_VERSION,
    effectsLimits,
    getState: () => ({
      navSwitched,
      navProgress,
      tabPinned,
      albumScrollTop: els.albumScroll?.scrollTop ?? 0,
      effectsScrollLeft: els.effectsScroll?.scrollLeft ?? 0,
      limits: effectsLimits(),
      captureActive: els.capture?.classList.contains('active') ?? false,
    }),
  };

  window.addEventListener('message', (e) => {
    if (!e.data || typeof e.data.type !== 'string') return;
    if (e.data.type === 'album:reload') resetDemo();
  });

  if (els.navCameraBtn) {
    els.navCameraBtn.addEventListener('click', () => {
      if (navProgress < 0.5) return;
      animateAlbumScrollTo(0, 300);
    });
  }

  if (els.effectsEntryBtn) {
    els.effectsEntryBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
    els.effectsEntryBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openCapture({ selectFirstEffect: C.layout === 'sideBySide' });
    });
  }

  setupMoreNavigation();
  els.albumScroll.addEventListener('scroll', syncScrollState, { passive: true });

  paintNav(0);
  setupAlbumTabs();
  setupEffectsHorizontalScroll();
  initCapture();
  syncScrollState();
  startEffectCoverLoad();

  try {
    window.parent.postMessage({ type: 'album:ready', variant: C.id, label: C.label }, '*');
  } catch (_) {}
})();
