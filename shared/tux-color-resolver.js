/**
 * Resolve computed CSS colors to TUX token labels (dark theme).
 * Labels follow design shorthand, e.g. UIImageOverlayDarkGrayA60 → dark/A60.
 */
(function initTuxColorResolver(global) {
  const OVERLAY_FAMILY = {
    DarkGray: 'dark',
    Black: 'black',
    White: 'white',
  };

  /** @type {Map<string, { token: string, label: string, rgba: { r: number, g: number, b: number, a: number } }> | null} */
  let index = null;
  /** @type {Promise<void> | null} */
  let loadPromise = null;

  const PREFERRED_PREFIXES = [
    'UIText',
    'UIShape',
    'UIPage',
    'UIImageOverlay',
    'UISheet',
    'Shadow',
    'Misc',
    'Brand',
  ];

  function tokenRank(token) {
    const idx = PREFERRED_PREFIXES.findIndex((prefix) => token.startsWith(prefix));
    return idx === -1 ? PREFERRED_PREFIXES.length : idx;
  }

  function hexToRgba(hex) {
    const h = hex.replace('#', '');
    return {
      a: parseInt(h.slice(0, 2), 16) / 255,
      r: parseInt(h.slice(2, 4), 16),
      g: parseInt(h.slice(4, 6), 16),
      b: parseInt(h.slice(6, 8), 16),
    };
  }

  function parseColor(input) {
    if (!input || input === 'transparent') return null;
    const probe = document.createElement('span');
    probe.style.color = input;
    document.documentElement.appendChild(probe);
    const raw = getComputedStyle(probe).color;
    probe.remove();
    const m = raw.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/);
    if (!m) return null;
    return {
      r: Number(m[1]),
      g: Number(m[2]),
      b: Number(m[3]),
      a: m[4] !== undefined ? Number(m[4]) : 1,
    };
  }

  function colorDistance(a, b) {
    return (
      Math.abs(a.r - b.r) +
      Math.abs(a.g - b.g) +
      Math.abs(a.b - b.b) +
      Math.abs(a.a - b.a) * 255
    );
  }

  /** CSS rgba mirrors for TUX tokens used in AbulmV1/V2/V4 + FigmaAlbumV4 pages. */
  const SEMANTIC_ALIASES = [
    { r: 255, g: 255, b: 255, a: 0.13, token: 'UIShapeNeutral4' },
    { r: 255, g: 255, b: 255, a: 0.19, token: 'UIShapeNeutral3' },
    { r: 255, g: 255, b: 255, a: 0.32, token: 'UIShapeNeutral2' },
    { r: 255, g: 255, b: 255, a: 0.88, token: 'UIText2' },
    { r: 255, g: 255, b: 255, a: 0.6, token: 'UIText3' },
    { r: 246, g: 246, b: 246, a: 1, token: 'UIText1' },
    { r: 51, g: 51, b: 51, a: 0.6, token: 'UIImageOverlayDarkGrayA60' },
  ];

  function resolveSemanticAlias(rgba) {
    for (const alias of SEMANTIC_ALIASES) {
      if (
        Math.abs(rgba.r - alias.r) <= 1 &&
        Math.abs(rgba.g - alias.g) <= 1 &&
        Math.abs(rgba.b - alias.b) <= 1 &&
        Math.abs(rgba.a - alias.a) <= 0.02
      ) {
        return {
          token: alias.token,
          label: formatTokenLabel(alias.token),
          rgba,
        };
      }
    }
    return null;
  }

  function formatTokenLabel(token) {
    let m = token.match(/^UIImageOverlay(DarkGray|Black|White)(A\d+)?$/);
    if (m) {
      const family = OVERLAY_FAMILY[m[1]] || m[1].toLowerCase();
      return m[2] ? `${family}/${m[2]}` : family;
    }

    m = token.match(/^UIText(\d+|Display|Primary|Secondary|Placeholder|Danger|Success|Warning|Info)$/);
    if (m) return `UIText/${m[1]}`;

    m = token.match(/^UIShapeText1On(.+)$/);
    if (m) return `UIShape/Text1On/${m[1]}`;

    m = token.match(/^UIShapeText2On(.+)$/);
    if (m) return `UIShape/Text2On/${m[1]}`;

    m = token.match(/^UIShape(Neutral|Primary|Secondary|Danger|Success|Warning|Info)(\d+)?$/);
    if (m) return m[2] ? `UIShape/${m[1]}/${m[2]}` : `UIShape/${m[1]}`;

    m = token.match(/^UIPage(Flat|Grouped)(\d+)$/);
    if (m) return `UIPage/${m[1]}/${m[2]}`;

    m = token.match(/^UISheet(Flat|Grouped|Backdrop)(\d+)?$/);
    if (m) return m[2] ? `UISheet/${m[1]}/${m[2]}` : `UISheet/${m[1]}`;

    m = token.match(/^Shadow([A-Za-z]+)$/);
    if (m) return `Shadow/${m[1]}`;

    m = token.match(/^Brand([A-Za-z0-9]+)$/);
    if (m) return `Brand/${m[1]}`;

    m = token.match(/^Misc([A-Za-z0-9]+)$/);
    if (m) return `Misc/${m[1]}`;

    return token;
  }

  function buildIndex(entries) {
    const map = new Map();
    /** @type {{ token: string, label: string, rgba: { r: number, g: number, b: number, a: number } }[]} */
    const list = [];

    entries.forEach(({ token, dark }) => {
      const rgba = hexToRgba(dark);
      const entry = {
        token,
        label: formatTokenLabel(token),
        rgba,
      };
      list.push(entry);

      const key = `${Math.round(rgba.r)},${Math.round(rgba.g)},${Math.round(rgba.b)},${rgba.a.toFixed(3)}`;
      const existing = map.get(key);
      if (!existing || tokenRank(token) < tokenRank(existing.token)) {
        map.set(key, entry);
      }
    });

    index = map;
    index.list = list;
  }

  function load(basePath) {
    if (loadPromise) return loadPromise;
    const url = `${basePath || 'shared/'}tux-color-tokens.json`;
    loadPromise = fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load ${url}`);
        return res.json();
      })
      .then((entries) => {
        buildIndex(entries);
      })
      .catch(() => {
        index = new Map();
      });
    return loadPromise;
  }

  function resolve(colorInput) {
    const rgba = parseColor(colorInput);
    if (!rgba || !index) return null;

    const semantic = resolveSemanticAlias(rgba);
    if (semantic) return semantic;

    const exactKey = `${Math.round(rgba.r)},${Math.round(rgba.g)},${Math.round(rgba.b)},${rgba.a.toFixed(3)}`;
    if (index.has(exactKey)) return index.get(exactKey);

    const list = index.list || [...index.values()];
    const candidates = list
      .map((entry) => ({ entry, dist: colorDistance(rgba, entry.rgba) }))
      .filter(({ dist }) => dist <= 4)
      .sort((a, b) => {
        if (a.dist !== b.dist) return a.dist - b.dist;
        return tokenRank(a.entry.token) - tokenRank(b.entry.token);
      });

    return candidates[0]?.entry ?? null;
  }

  function describe(colorInput) {
    const match = resolve(colorInput);
    if (!match) return null;
    return {
      label: match.label,
      token: match.token,
      swatch: colorInput,
    };
  }

  global.TuxColorResolver = {
    load,
    resolve,
    describe,
    formatTokenLabel,
  };
})(window);
