# Album V1–V4 Web Demo

静态 HTML 演示，复刻 Android `AbulmV1`–`AbulmV4` / `FigmaAlbumV4` 相册头部与 Effect Cover 1.2s 加载动画。

## 入口

| 文件 | 说明 |
|------|------|
| `index.html` | 四组实验列表（V1–V4 Effect Loading 1.2s） |
| `preview.html` | 预览壳：切换实验组、缩放、自适应、重启 |

## 在线预览（GitHub Pages）

- 列表入口：<https://yutongoh.github.io/Album/>
- 预览壳：<https://yutongoh.github.io/Album/preview.html?v=v1>（`v1`–`v4`）

## 本地预览

```bash
python3 -m http.server 8765
```

打开 [http://localhost:8765/preview.html?v=v1](http://localhost:8765/preview.html?v=v1)

## 工具栏

- **实验组**：下拉选择 V1–V4 Effect Loading 1.2s
- **缩放**：下拉选择 50% / 75% / 100% / 125% / 150% / 自适应
- **重启**：工具栏右侧图标按钮

## 重新生成

从 Kotlin `*Dimens.kt` 同步尺寸与配置：

```bash
python3 export_album_v1234.py
```

## 目录

```
album-v1234-demo/
├── preview.html / preview.js / preview.css   # 预览壳
├── index.html                                 # 列表入口
├── export_album_v1234.py                      # 生成脚本
├── shared/
│   ├── album.css / album-core.js
│   └── assets/
└── variants/v1–v4/index.html
```

## 与 Android 对齐

- 设计帧：360×800
- Nav 切换：`CameraNavSwitchScrollH` = 92px（Camera 按钮滚出，不含底部 padding）
- Effect Cover：`EffectCoverLoadMs` = 1200ms
- Recents 行高：48dp
