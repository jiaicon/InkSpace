# 应用图标（Logo）

把 logo 放到本目录（`build/`），electron-builder 会自动识别：

| 平台 | 文件名 | 说明 |
|---|---|---|
| Windows | `icon.ico` | 多尺寸 .ico（建议 256×256 起，可从 1024×1024 PNG 生成） |
| macOS | `icon.icns` | 标准 .icns |
| Linux | `icon.png` | 512×512 或 1024×1024 PNG |

**最简单的方式**：只放一张 **1024×1024 的 `icon.png`**，electron-builder 会自动为
Windows / macOS 生成对应格式（.ico / .icns）。

未放 logo 前，打包会使用 Electron 默认图标，不影响构建。

> 生成工具：可从设计稿直接导出 1024×1024 PNG；或用 `electron-icon-builder` 等工具
> 从一张大图批量生成各平台格式。
