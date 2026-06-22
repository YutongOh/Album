/**
 * Resolve computed CSS typography to TUX typography token names
 * (e.g. p1_semibold, headline_semibold). Specs mirror TUXFontCatalog.kt.
 */
(function initTuxTypographyResolver(global) {
  /** @type {{ name: string, size: number, lineHeight: number, weight: string }[]} */
  const CATALOG = [
    { name: 'large_title_semibold', size: 32, lineHeight: 38, weight: 'semibold' },
    { name: 'large_title_bold', size: 32, lineHeight: 38, weight: 'bold' },

    { name: 'h1_regular', size: 24, lineHeight: 30, weight: 'regular' },
    { name: 'h1_semibold', size: 24, lineHeight: 30, weight: 'semibold' },
    { name: 'h1_bold', size: 24, lineHeight: 30, weight: 'bold' },

    { name: 'h2_regular', size: 20, lineHeight: 25, weight: 'regular' },
    { name: 'h2_semibold', size: 20, lineHeight: 25, weight: 'semibold' },
    { name: 'h2_bold', size: 20, lineHeight: 25, weight: 'bold' },

    { name: 'h3_regular', size: 17, lineHeight: 22, weight: 'regular' },
    { name: 'h3_semibold', size: 17, lineHeight: 22, weight: 'semibold' },
    { name: 'h3_bold', size: 17, lineHeight: 22, weight: 'bold' },

    { name: 'headline_regular', size: 16, lineHeight: 21, weight: 'regular' },
    { name: 'headline_semibold', size: 16, lineHeight: 21, weight: 'semibold' },
    { name: 'headline_bold', size: 16, lineHeight: 21, weight: 'bold' },

    { name: 'longform_regular', size: 16, lineHeight: 24, weight: 'regular' },
    { name: 'longform_semibold', size: 16, lineHeight: 24, weight: 'semibold' },
    { name: 'longform_bold', size: 16, lineHeight: 24, weight: 'bold' },

    { name: 'h4_regular', size: 15, lineHeight: 18, weight: 'regular' },
    { name: 'h4_semibold', size: 15, lineHeight: 18, weight: 'semibold' },
    { name: 'h4_bold', size: 15, lineHeight: 20, weight: 'bold' },

    { name: 'p1_regular', size: 14, lineHeight: 18, weight: 'regular' },
    { name: 'p1_semibold', size: 14, lineHeight: 18, weight: 'semibold' },
    { name: 'p1_bold', size: 14, lineHeight: 18, weight: 'bold' },

    { name: 'p2_regular', size: 13, lineHeight: 17, weight: 'regular' },
    { name: 'p2_semibold', size: 13, lineHeight: 17, weight: 'semibold' },
    { name: 'p2_bold', size: 13, lineHeight: 17, weight: 'bold' },

    { name: 'p3_regular', size: 12, lineHeight: 16, weight: 'regular' },
    { name: 'p3_semibold', size: 12, lineHeight: 16, weight: 'semibold' },
    { name: 'p3_bold', size: 12, lineHeight: 16, weight: 'bold' },

    { name: 'small_text_1_regular', size: 11, lineHeight: 14, weight: 'regular' },
    { name: 'small_text_1_semibold', size: 11, lineHeight: 14, weight: 'semibold' },
    { name: 'small_text_1_bold', size: 11, lineHeight: 14, weight: 'bold' },

    { name: 'small_text_2_regular', size: 10, lineHeight: 13, weight: 'regular' },
    { name: 'small_text_2_semibold', size: 10, lineHeight: 13, weight: 'semibold' },
    { name: 'small_text_2_bold', size: 10, lineHeight: 13, weight: 'bold' },
  ];

  function normalizeWeight(raw) {
    if (!raw) return 'regular';
    const value = String(raw).trim().toLowerCase();
    if (value === 'bold' || value === 'bolder') return 'bold';
    if (value === 'semibold' || value === 'demibold') return 'semibold';
    const n = parseInt(value, 10);
    if (Number.isFinite(n)) {
      if (n >= 700) return 'bold';
      if (n >= 600) return 'semibold';
      return 'regular';
    }
    return 'regular';
  }

  function parsePx(value) {
    const n = parseFloat(value);
    return Number.isFinite(n) ? Math.round(n) : 0;
  }

  function parseLineHeight(raw, fontSize) {
    if (!raw || raw === 'normal') return fontSize ? Math.round(fontSize * 1.2) : 0;
    if (String(raw).endsWith('px')) return parsePx(raw);
    const unitless = parseFloat(raw);
    if (Number.isFinite(unitless) && unitless > 0 && unitless < 10) {
      return Math.round(fontSize * unitless);
    }
    return parsePx(raw);
  }

  function scoreEntry(entry, size, lineHeight, weight) {
    let score = Math.abs(entry.size - size) * 4;
    if (lineHeight > 0) score += Math.abs(entry.lineHeight - lineHeight);
    if (entry.weight !== weight) score += 6;
    return score;
  }

  function resolveFromStyles(fontSizePx, lineHeightPx, fontWeight) {
    const size = parsePx(fontSizePx);
    if (size <= 0) return null;

    const weight = normalizeWeight(fontWeight);
    const lineHeight = parseLineHeight(lineHeightPx, size);

    const exact = CATALOG.filter(
      (entry) =>
        entry.size === size &&
        entry.lineHeight === lineHeight &&
        entry.weight === weight,
    );
    if (exact.length === 1) return exact[0];
    if (exact.length > 1) return exact[0];

    const sized = CATALOG.filter((entry) => entry.size === size && entry.weight === weight);
    if (sized.length === 1) return sized[0];
    if (sized.length > 1) {
      return sized.reduce((best, entry) =>
        scoreEntry(entry, size, lineHeight, weight) < scoreEntry(best, size, lineHeight, weight)
          ? entry
          : best,
      );
    }

    const ranked = CATALOG.map((entry) => ({
      entry,
      score: scoreEntry(entry, size, lineHeight, weight),
    }))
      .filter(({ score }) => score <= 10)
      .sort((a, b) => a.score - b.score);

    return ranked[0]?.entry ?? null;
  }

  function resolveElement(el) {
    if (!el) return null;
    const explicit = el.getAttribute?.('data-tux-typography');
    if (explicit) {
      return {
        name: explicit,
        label: explicit,
        token: explicit,
      };
    }
    return null;
  }

  function describeFromComputed(fontSizePx, lineHeightPx, fontWeight) {
    const match = resolveFromStyles(fontSizePx, lineHeightPx, fontWeight);
    if (!match) return null;
    return {
      name: match.name,
      label: match.name,
      token: match.name,
    };
  }

  function describeElement(el, computedStyle) {
    const explicit = resolveElement(el);
    if (explicit) return explicit;
    if (!computedStyle) return null;
    return describeFromComputed(
      computedStyle.fontSize,
      computedStyle.lineHeight,
      computedStyle.fontWeight,
    );
  }

  global.TuxTypographyResolver = {
    describeElement,
    describeFromComputed,
    resolveFromStyles,
  };
})(window);
