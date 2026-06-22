#!/usr/bin/env python3
"""Generate Album V1–V4 web demo from Kotlin Dimens + shared assets."""

from __future__ import annotations

import json
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
SHARED = OUT / "shared"
SRC_ASSETS = OUT.parent / "effect-loading-1s" / "assets"
RES = ROOT / "playgrounds/src/main/res/drawable-nodpi"

VARIANTS = {
    "v1": {
        "kotlin": ROOT / "playgrounds/src/main/java/com/example/designlab/playgrounds/abulmv1/AbulmV1Dimens.kt",
        "layout": "sideBySide",
        "label": "V1",
    },
    "v2": {
        "kotlin": ROOT / "playgrounds/src/main/java/com/example/designlab/playgrounds/abulmv2/AbulmV2Dimens.kt",
        "layout": "cameraRow",
        "label": "V2",
    },
    "v3": {
        "kotlin": ROOT / "playgrounds/src/main/java/com/example/designlab/playgrounds/creation/AlbumV4Dimens.kt",
        "layout": "stackedEffects",
        "label": "V3",
    },
    "v4": {
        "kotlin": ROOT / "playgrounds/src/main/java/com/example/designlab/playgrounds/abulmv4/AbulmV4Dimens.kt",
        "layout": "popularEffects",
        "label": "V4",
    },
}

EFFECT_PRESETS = [
    "album_v4_effect_1.png",
    "album_v4_effect_2.png",
    "album_v4_effect_ai.png",
    "album_v4_effect_4.png",
    "album_v4_effect_5.png",
]

GRID_TILES = [
    ("album_v4_tile_1.png", "2.7 MB", "00:07"),
    ("album_v4_tile_2.png", "2.7 MB", None),
    ("album_v4_tile_3.png", "2.7 MB", None),
    ("album_v4_tile_4.png", "2.7 MB", None),
    ("album_v4_tile_5.png", "2.7 MB", "00:07"),
    ("album_v4_tile_6.png", "2.7 MB", "00:07"),
    ("album_v4_tile_7.png", "2.7 MB", None),
    ("album_v4_tile_8.png", "2.7 MB", None),
    ("album_v4_tile_9.png", "2.7 MB", "00:07"),
    ("album_v4_tile_10.png", "2.7 MB", None),
    ("album_v4_tile_11.png", "2.7 MB", None),
    ("album_v4_tile_12.png", None, None),
    ("album_v4_tile_13.png", None, None),
    ("album_v4_tile_14.png", None, None),
    ("album_v4_tile_16.png", "2.7 MB", None),
    ("album_v4_tile_17.png", "2.7 MB", None),
    ("album_v4_tile_18.png", "2.7 MB", None),
    ("album_v4_tile_15.png", None, None),
]


def parse_dimens(path: Path) -> dict[str, float]:
    text = path.read_text(encoding="utf-8")
    out: dict[str, float] = {}
    for m in re.finditer(r"val\s+(\w+)\s*=\s*([\d.]+)\.dp", text):
        out[m.group(1)] = float(m.group(2))
    for m in re.finditer(r"const val\s+(\w+)\s*=\s*(\d+)", text):
        out[m.group(1)] = float(m.group(2))
    return out


def build_config(vid: str, meta: dict, d: dict[str, float]) -> dict:
    layout = meta["layout"]
    cfg = {
        "id": vid,
        "label": meta["label"],
        "layout": layout,
        "designFrameW": int(d.get("DesignFrameW", 360)),
        "designFrameH": int(d.get("DesignFrameH", 800)),
        "cameraHideMs": int(d.get("CameraHideAnimMs", 200)),
        "cameraShowMs": int(d.get("CameraShowAnimMs", 250)),
        "navDraftsSlide": int(d.get("NavDraftsSlideDistance", 32)),
        "navCameraSlide": int(d.get("NavCameraSlideDistance", 44)),
        "headerH": int(d.get("HeaderH", 48)),
        "recentsH": int(d.get("HeaderH", 48)),
        "tabSectionH": int(d.get("TabSectionH", 42)),
        "effectCoverLoadMs": int(d.get("EffectCoverLoadMs", 1200)),
        "effectCoverEmergeMs": int(d.get("EffectCoverEmergeMs", 150)),
        "pagePadH": int(d.get("EntryRowPadH", d.get("CameraSectionPadH", 12))),
        "effectsGap": int(d.get("EffectsGap", 10)),
        "effectTileSize": int(d.get("EffectTileSize", 64)),
        "moreTile": int(d.get("EffectsMoreTileSize", d.get("EffectTileSize", 64))),
        "moreCircle": int(d.get("EffectsMoreCircleSize", 28)),
    }

    if layout == "sideBySide":
        pad_v = int(d.get("EntryRowPadV", 12))
        btn_h = int(d.get("EntryButtonH", 80))
        cfg.update(
            {
                "entryRowPadV": pad_v,
                "entryRowPadH": int(d.get("EntryRowPadH", 12)),
                "entryButtonH": btn_h,
                "entryButtonGap": int(d.get("EntryButtonGap", 8)),
                "cameraIconFrame": int(d.get("EntryIconFrame", 28)),
                "effectIconFrame": int(d.get("EffectEntryIconFrame", 26)),
                "cameraEffectsSectionH": int(d.get("CameraEffectsSectionH", pad_v + btn_h + pad_v)),
                "cameraNavSwitchScrollH": int(d.get("CameraNavSwitchScrollH", pad_v + btn_h)),
                "headerScrollH": int(d.get("CameraEffectsSectionH", pad_v + btn_h + pad_v)),
            }
        )
    elif layout == "cameraRow":
        pad_top = int(d.get("EntryRowPadTop", 12))
        btn_h = int(d.get("CameraEntryH", 80))
        cfg.update(
            {
                "entryRowPadTop": pad_top,
                "entryRowPadBottom": int(d.get("EntryRowPadBottom", 12)),
                "entryRowPadH": int(d.get("EntryRowPadH", 12)),
                "cameraEntryW": int(d.get("CameraEntryW", 172)),
                "cameraEntryH": btn_h,
                "cameraToEffectsGap": int(d.get("CameraToEffectsGap", 8)),
                "effectsScrollPadV": int(d.get("EffectsScrollPadV", 6)),
                "cameraIconFrame": int(d.get("CameraEntryIconFrame", 28)),
                "cameraEffectsSectionH": int(d.get("CameraEffectsSectionH", pad_top + btn_h + int(d.get("EntryRowPadBottom", 12)))),
                "cameraNavSwitchScrollH": int(d.get("CameraNavSwitchScrollH", pad_top + btn_h)),
                "headerScrollH": int(d.get("CameraEffectsSectionH", 104)),
            }
        )
    elif layout == "stackedEffects":
        cam_h = int(d.get("CameraSectionH", 104))
        eff_h = int(d.get("EffectsSectionH", 76))
        cfg.update(
            {
                "cameraSectionPadTop": int(d.get("CameraSectionPadTop", 12)),
                "cameraSectionPadBottom": int(d.get("CameraSectionPadBottom", 12)),
                "cameraButtonH": int(d.get("CameraButtonH", 80)),
                "cameraIconFrame": int(d.get("CameraIconFrame", 28)),
                "effectsSectionPadBottom": int(d.get("EffectsSectionPadBottom", 12)),
                "effectsRowH": int(d.get("EffectsRowH", 64)),
                "effectsBtnPadH": int(d.get("EffectsBtnPadH", 14)),
                "effectsIconFrame": int(d.get("EffectsIconFrame", 22)),
                "cameraSectionH": cam_h,
                "effectsSectionH": eff_h,
                "cameraNavSwitchScrollH": int(d.get("CameraNavSwitchScrollH", 92)),
                "headerScrollH": cam_h + eff_h,
                "pagePadH": int(d.get("CameraSectionPadH", 12)),
            }
        )
    elif layout == "popularEffects":
        cam_h = int(d.get("CameraSectionH", 108))
        eff_h = int(d.get("EffectsSectionH", 110))
        cfg.update(
            {
                "cameraSectionPadTop": int(d.get("CameraSectionPadTop", 12)),
                "cameraSectionPadBottom": int(d.get("CameraSectionPadBottom", 16)),
                "cameraButtonH": int(d.get("CameraButtonH", 80)),
                "cameraIconFrame": int(d.get("CameraIconFrame", 28)),
                "popularEffectsHeaderH": int(d.get("PopularEffectsHeaderH", 18)),
                "popularEffectsHeaderPadStart": int(d.get("PopularEffectsHeaderPadStart", 16)),
                "popularEffectsHeaderPadEnd": int(d.get("PopularEffectsHeaderPadEnd", 12)),
                "effectsHeaderToScrollGap": int(d.get("EffectsHeaderToScrollGap", 16)),
                "effectsScrollPadBottom": int(d.get("EffectsScrollPadBottom", 12)),
                "effectsScrollPadH": int(d.get("EffectsScrollPadH", 12)),
                "effectsRowH": int(d.get("EffectsRowH", 64)),
                "cameraSectionH": cam_h,
                "effectsSectionH": eff_h,
                "cameraNavSwitchScrollH": int(d.get("CameraNavSwitchScrollH", 92)),
                "headerScrollH": cam_h + eff_h,
                "pagePadH": int(d.get("CameraSectionPadH", 12)),
            }
        )

    cfg.update(
        {
            "headerPadH": int(d.get("HeaderPadH", 16)),
            "headerPadV": int(d.get("HeaderPadV", 8)),
            "tabPadH": int(d.get("TabPadH", 16)),
            "albumSectionGap": int(d.get("AlbumSectionGap", 2)),
            "effectCoverEmergeStartScale": float(d.get("EffectCoverEmergeStartScale", 0.94)),
        }
    )
    if layout == "sideBySide":
        cfg.update(
            {
                "entryIconLabelGap": int(d.get("EntryIconLabelGap", 2)),
                "effectEntryIconLabelGap": int(d.get("EffectEntryIconLabelGap", 4)),
                "effectEntryButtonPadH": int(d.get("EffectEntryButtonPadH", 10)),
            }
        )

    cfg["panelEnterMs"] = 300
    if layout == "cameraRow":
        cfg["hasEffectsScroll"] = True
        cfg["effectsEndPadding"] = 0
    elif layout in ("stackedEffects", "popularEffects"):
        cfg["hasEffectsScroll"] = True
        cfg["effectsEndPadding"] = 0 if layout == "popularEffects" else int(cfg.get("pagePadH", 12))
    else:
        cfg["hasEffectsScroll"] = False
        cfg["effectsEndPadding"] = 0
    return cfg


def effect_preset_buttons(asset_prefix: str) -> str:
    parts = []
    for i, name in enumerate(EFFECT_PRESETS):
        parts.append(
            f'<button class="effect-preset-btn" type="button" data-index="{i}" aria-disabled="true">'
            f'<img class="effect-preset-placeholder" src="{asset_prefix}/images/album_v4_effect_cover_placeholder.svg" alt="" aria-hidden="true" />'
            f'<img class="effect-preset-img" src="{asset_prefix}/images/{name}" alt="" />'
            f"</button>"
        )
    return "\n".join(parts)


def effect_preset_imgs(asset_prefix: str) -> str:
    return "\n".join(
        f'<div class="effect-tile"><img src="{asset_prefix}/images/{n}" alt="" /></div>'
        for n in EFFECT_PRESETS
    )


def grid_html(asset_prefix: str) -> str:
    rows = []
    for i in range(0, len(GRID_TILES), 3):
        cells = []
        for img, size, dur in GRID_TILES[i : i + 3]:
            size_html = f'<span class="tile-size">{size}</span>' if size else ""
            dur_html = f'<span class="tile-duration">{dur}</span>' if dur else ""
            cells.append(
                f'<div class="grid-tile"><img src="{asset_prefix}/images/{img}" alt="" />{size_html}{dur_html}</div>'
            )
        rows.append(f'<div class="grid-row">{"".join(cells)}</div>')
    return f'<div class="grid-wrap">{"".join(rows)}</div>'


def header_html(cfg: dict, asset_prefix: str) -> str:
    layout = cfg["layout"]
    presets = effect_preset_buttons(asset_prefix)
    more = f"""
<div class="effects-more">
  <div class="effects-more-circle">
    <img class="effects-more-chevron" src="{asset_prefix}/icons/album_v4_ic_chevron_up_small.svg" width="28" height="28" alt="" />
  </div>
  <span>More</span>
</div>"""

    if layout == "sideBySide":
        return f"""
<div id="cameraHeader" class="camera-header camera-header--v1" style="height:{cfg['headerScrollH']}px">
  <div class="entry-row-v1" style="padding:{cfg['entryRowPadV']}px {cfg['entryRowPadH']}px; gap:{cfg['entryButtonGap']}px">
    <button class="entry-btn entry-btn--camera" type="button" style="height:{cfg['entryButtonH']}px;gap:{cfg['entryIconLabelGap']}px">
      <img src="{asset_prefix}/icons/album_v4_ic_camera.svg" width="{cfg['cameraIconFrame']}" height="{cfg['cameraIconFrame']}" alt="" />
      <span>Camera</span>
    </button>
    <button id="effectsEntryBtn" class="entry-btn entry-btn--effect" type="button" style="height:{cfg['entryButtonH']}px;gap:{cfg['effectEntryIconLabelGap']}px">
      <img src="{asset_prefix}/icons/album_v4_ic_effects.svg" width="{cfg['effectIconFrame']}" height="{cfg['effectIconFrame']}" alt="" />
      <span>Effect</span>
    </button>
  </div>
</div>"""

    if layout == "cameraRow":
        return f"""
<div id="cameraHeader" class="camera-header camera-header--v2" style="height:{cfg['headerScrollH']}px">
  <div id="effectsScroll" class="effects-scroll-v2">
    <div class="effects-inner-v2" style="gap:{cfg['cameraToEffectsGap']}px;padding:{cfg['entryRowPadTop']}px {cfg['entryRowPadH']}px {cfg['entryRowPadBottom']}px">
      <div class="camera-entry-v2" style="width:{cfg['cameraEntryW']}px;height:{cfg['cameraEntryH']}px">
        <img src="{asset_prefix}/icons/album_v4_ic_camera.svg" width="{cfg['cameraIconFrame']}" height="{cfg['cameraIconFrame']}" alt="" />
        <span>Camera</span>
      </div>
      <div class="effects-presets-v2" style="gap:{cfg['effectsGap']}px">
        {presets}
      </div>
      {more}
    </div>
  </div>
</div>"""

    if layout == "stackedEffects":
        return f"""
<div id="cameraHeader" class="camera-header camera-header--v3" style="height:{cfg['headerScrollH']}px">
  <div class="camera-section-v3" style="padding:{cfg['cameraSectionPadTop']}px {cfg['pagePadH']}px {cfg['cameraSectionPadBottom']}px">
    <div class="camera-btn-v3" style="height:{cfg['cameraButtonH']}px">
      <img src="{asset_prefix}/icons/album_v4_ic_camera.svg" width="{cfg['cameraIconFrame']}" height="{cfg['cameraIconFrame']}" alt="" />
      <span>Camera</span>
    </div>
  </div>
  <div class="effects-section-v3" style="height:{cfg['effectsSectionH']}px">
    <div id="effectsScroll" class="effects-scroll-v3">
      <div class="effects-inner-v3" style="gap:{cfg['effectsGap']}px;padding:0 {cfg['pagePadH']}px {cfg['effectsSectionPadBottom']}px">
        <button id="effectsEntryBtn" class="effects-btn-v3" type="button" style="padding:0 {cfg['effectsBtnPadH']}px">
          <img src="{asset_prefix}/icons/album_v4_ic_effects.svg" width="{cfg['effectsIconFrame']}" height="{cfg['effectsIconFrame']}" alt="" />
          <span>Effects</span>
        </button>
        <div class="effects-presets-v3">{presets}</div>
        {more}
      </div>
    </div>
  </div>
</div>"""

    # popularEffects
    return f"""
<div id="cameraHeader" class="camera-header camera-header--v4" style="height:{cfg['headerScrollH']}px">
  <div class="camera-section-v4" style="padding:{cfg['cameraSectionPadTop']}px {cfg['pagePadH']}px {cfg['cameraSectionPadBottom']}px">
    <div class="camera-btn-v4" style="height:{cfg['cameraButtonH']}px">
      <img src="{asset_prefix}/icons/album_v4_ic_camera.svg" width="{cfg['cameraIconFrame']}" height="{cfg['cameraIconFrame']}" alt="" />
      <span>Camera</span>
    </div>
  </div>
  <div class="effects-section-v4" style="height:{cfg['effectsSectionH']}px">
    <div class="popular-header-v4" style="height:{cfg['popularEffectsHeaderH']}px;padding:0 {cfg['popularEffectsHeaderPadEnd']}px 0 {cfg['popularEffectsHeaderPadStart']}px">
      <span class="popular-title">Popular Effects</span>
      <button class="popular-more" type="button">More <img src="{asset_prefix}/icons/album_v4_ic_chevron_down.svg" width="16" height="16" alt="" style="transform:rotate(-90deg)" /></button>
    </div>
    <div id="effectsScroll" class="effects-scroll-v4">
      <div class="effects-inner-v4" style="gap:{cfg['effectsGap']}px;padding:{cfg['effectsHeaderToScrollGap']}px {cfg['pagePadH']}px {cfg['effectsScrollPadBottom']}px {cfg['effectsScrollPadH']}px">
        {presets}
        {more}
      </div>
    </div>
  </div>
</div>"""


def capture_effect_grid(asset_prefix: str) -> str:
    rows = []
    for row in range(4):
        cells = []
        for col in range(4):
            i = row * 4 + col + 1
            cells.append(
                f'<button class="cap-effect" type="button" data-i="{i - 1}">'
                f'<div class="cap-effect-inner">'
                f'<img class="cap-effect-thumb" src="{asset_prefix}/images/capture_panel_effect_{i}.png" alt="" />'
                f'<img class="cap-effect-loading" src="{asset_prefix}/icons/capture_panel_loading.svg" alt="" />'
                f"</div></button>"
            )
        row_cls = "cap-grid-row last" if row == 3 else "cap-grid-row"
        rows.append(f'<div class="{row_cls}">{"".join(cells)}</div>')
    return "\n".join(rows)


def capture_html(asset_prefix: str) -> str:
    tabs = ["Trending", "New", "Tool", "Create"] + ["Hot"] * 7
    tab_buttons = []
    for i, label in enumerate(tabs):
        if i == 0:
            inner = (
                f'<span class="cap-tab-block"><span class="cap-tab-top"></span>'
                f'<span class="cap-tab-body"><span>{label}</span><span class="cap-tab-ind"></span></span></span>'
            )
        else:
            inner = label
        tab_buttons.append(
            f'<button class="cap-tab{" active" if i == 0 else ""}" type="button" data-tab="{i}">{inner}</button>'
        )
    tab_row = "".join(tab_buttons)
    return f"""
    <div id="screen-capture" class="screen screen-capture">
      <div class="capture-root">
        <div id="capPreview" class="cap-preview">
          <img src="{asset_prefix}/images/capture_preview_bg.png" alt="" />
        </div>
        <div class="cap-overlay">
          <div class="cap-nav">
            <button id="capBack" class="cap-back" type="button" aria-label="Back">
              <img src="{asset_prefix}/icons/capture_overlay_back.svg" width="24" height="24" alt="" />
            </button>
          </div>
          <div id="capMusic" class="cap-music">
            <div class="cap-music-main">
              <img src="{asset_prefix}/icons/capture_overlay_music.svg" width="16" height="16" alt="" />
              <span>Fly me to the moon an</span>
            </div>
            <div class="cap-music-split"></div>
            <button id="capMusicClose" class="cap-music-close" type="button" aria-label="Close music">
              <img src="{asset_prefix}/icons/capture_overlay_sound_close.svg" width="20" height="20" alt="" />
            </button>
          </div>
          <div class="cap-tool">
            <button id="capFlip" type="button" aria-label="Flip">
              <img src="{asset_prefix}/icons/capture_overlay_flip.svg" width="30" height="28" alt="" />
            </button>
            <span>Flip</span>
          </div>
        </div>
        <div id="capPanel" class="cap-panel">
          <div class="cap-panel-inner">
            <div class="cap-save-row">
              <button class="cap-save" type="button">
                <img src="{asset_prefix}/icons/capture_panel_save.svg" width="22" height="22" alt="" />Save
              </button>
            </div>
            <div class="cap-panel-body">
              <div class="cap-tabbar">
                <div class="cap-tab-none">
                  <img src="{asset_prefix}/icons/capture_panel_tab_none.svg" width="26" height="26" alt="" />
                </div>
                <div class="cap-tab-scroll-wrap">
                  <div id="capTabScroll" class="cap-tab-scroll">
                    <div class="cap-tab-fav">
                      <img src="{asset_prefix}/icons/capture_panel_favorites.svg" width="22" height="22" alt="" />
                    </div>
                    {tab_row}
                  </div>
                </div>
              </div>
              <div id="capGrid" class="cap-grid">
                {capture_effect_grid(asset_prefix)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>"""


def variant_page(cfg: dict) -> str:
    asset_prefix = "../../shared/assets"
    cfg_json = json.dumps(cfg, ensure_ascii=False, indent=2)
    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=360, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <meta name="theme-color" content="#000000" />
  <title>{cfg['label']}</title>
  <link rel="stylesheet" href="../../shared/album.css" />
</head>
<body class="variant-embed">
  <div class="phone">
    <div class="status-bar">
      <div class="status-time-wrap"><span class="status-time">9:41</span></div>
      <div class="status-icons" aria-hidden="true">
        <div class="status-network">
          <img class="status-wifi" src="{asset_prefix}/icons/status_wifi.svg" width="16" height="16" alt="" />
          <img class="status-signal" src="{asset_prefix}/icons/status_signal.svg" width="16" height="16" alt="" />
        </div>
        <img class="status-battery" src="{asset_prefix}/icons/status_battery.svg" width="16" height="16" alt="" />
      </div>
    </div>
    <div id="screen-album" class="screen active">
      <div class="album-root">
        <div class="album-nav">
          <button class="nav-tap" type="button" aria-label="Close">
            <img src="{asset_prefix}/icons/album_v4_ic_close.svg" width="24" height="24" alt="" />
          </button>
          <div class="nav-spacer"></div>
          <div class="nav-trailing">
            <div id="navDrafts" class="nav-layer">
              <div class="drafts-btn"><span>12 Drafts</span></div>
            </div>
            <div id="navCamera" class="nav-layer">
              <button id="navCameraBtn" class="nav-tap" type="button" aria-label="Camera">
                <img src="{asset_prefix}/icons/album_v4_ic_nav_camera.svg" width="24" height="24" alt="" />
              </button>
            </div>
          </div>
          <div id="navTitle" class="nav-title" aria-hidden="true">
            <span>Recents</span>
            <img src="{asset_prefix}/icons/album_v4_ic_chevron_down.svg" width="16" height="16" alt="" />
          </div>
        </div>
        <div class="album-scroll-wrap">
          <div id="tabPinnedOverlay" class="tabs-pinned">
            <div class="tabs-row" style="padding:0 {cfg['tabPadH']}px">
              <button class="tab-item active" type="button" data-tab="0">All</button>
              <button class="tab-item" type="button" data-tab="1">Photos</button>
              <button class="tab-item" type="button" data-tab="2">Videos</button>
            </div>
            <div class="tab-sep"></div>
          </div>
          <div id="albumScroll" class="album-scroll">
            {header_html(cfg, asset_prefix)}
            <div class="recents recents-v48" style="padding:{cfg['headerPadV']}px {cfg['headerPadH']}px">
              <div class="recents-left">
                <span>Recents</span>
                <img src="{asset_prefix}/icons/album_v4_ic_chevron_down.svg" width="16" height="16" alt="" />
              </div>
              <div class="storage-pill">
                <span>5.9 MB</span>
                <div class="eye-wrap"><img src="{asset_prefix}/icons/album_v4_ic_eye.svg" width="16" height="16" alt="" /></div>
              </div>
            </div>
            <div id="tabsSection" class="tabs-section" style="padding-bottom:{cfg['albumSectionGap']}px">
              <div class="tabs-row" style="padding:0 {cfg['tabPadH']}px">
                <button class="tab-item active" type="button" data-tab="0">All</button>
                <button class="tab-item" type="button" data-tab="1">Photos</button>
                <button class="tab-item" type="button" data-tab="2">Videos</button>
              </div>
              <div class="tab-sep"></div>
            </div>
            {grid_html(asset_prefix)}
          </div>
        </div>
        <div class="select-bar">
          <div class="select-row">
            <div class="checkbox-outer"><div class="checkbox-inner"></div></div>
            <span>Select multiple</span>
          </div>
        </div>
      </div>
    </div>
    {capture_html(asset_prefix)}
    <div class="system-home-indicator" aria-hidden="true"><div class="system-home-indicator-handle"></div></div>
  </div>
  <script>window.__ALBUM_VARIANT__ = {cfg_json};</script>
  <script src="../../shared/album-core.js"></script>
</body>
</html>
"""


def sync_assets() -> None:
    dst = SHARED / "assets"
    dst.mkdir(parents=True, exist_ok=True)
    if SRC_ASSETS.is_dir():
        shutil.copytree(SRC_ASSETS, dst, dirs_exist_ok=True)
    if RES.is_dir():
        for png in RES.glob("*.png"):
            shutil.copy2(png, dst / "images" / png.name)


def main() -> None:
    sync_assets()
    manifest = []
    for vid, meta in VARIANTS.items():
        dimens = parse_dimens(meta["kotlin"])
        cfg = build_config(vid, meta, dimens)
        vdir = OUT / "variants" / vid
        vdir.mkdir(parents=True, exist_ok=True)
        (vdir / "config.json").write_text(json.dumps(cfg, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        (vdir / "index.html").write_text(variant_page(cfg), encoding="utf-8")
        manifest.append({"id": vid, "label": cfg["label"], "path": f"variants/{vid}/index.html"})
        print(f"generated {vid}: headerScrollH={cfg['headerScrollH']} navSwitch={cfg['cameraNavSwitchScrollH']}")
    (OUT / "variants-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
