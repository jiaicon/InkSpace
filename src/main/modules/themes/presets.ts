import type { MarkdownThemeInfo } from '@shared/types'

/**
 * 内置 Markdown 主题。
 *
 * 约定（自定义主题同样适用）：
 * - 变量写在 `.milkdown` 上：编辑器（所见即所得）与导出文档里都存在这层容器，
 *   因此一份选择器同时驱动两边；`.milkdown` 之外的界面外壳不受影响。
 * - 变量清单与 theme.css 的 `:root` 一致（--ms-text / --ms-accent / --ms-code-bg …）。
 * - 结构性调整写 `.milkdown .editor ...`（编辑器）或 `.markdown-body ...`（仅导出）。
 *
 * 这里只改变量，不改版式——版式由应用统一控制，主题负责配色与字体。
 */

const GITHUB = `.milkdown {
  --ms-bg: #ffffff;
  --ms-text: #24292f;
  --ms-text-secondary: #57606a;
  --ms-heading: #1f2328;
  --ms-accent: #0969da;
  --ms-accent-hover: #0550ae;
  --ms-border: #d8dee4;
  --ms-border-strong: #d0d7de;
  --ms-code-bg: #f6f8fa;
  --ms-code-text: #24292f;
  --ms-blockquote-bg: #f6f8fa;
  --ms-blockquote-border: #d0d7de;
  --ms-blockquote-text: #57606a;
  --ms-hr: #d8dee4;
  --ms-table-border: #d0d7de;
  --ms-table-header-bg: #f6f8fa;
}
`

const JUEJIN = `.milkdown {
  --ms-bg: #ffffff;
  --ms-text: #252933;
  --ms-text-secondary: #8a919f;
  --ms-heading: #252933;
  --ms-accent: #1e80ff;
  --ms-accent-hover: #1171ee;
  --ms-border: #e4e6eb;
  --ms-border-strong: #dcdfe6;
  --ms-code-bg: #f7f8fa;
  --ms-code-text: #252933;
  --ms-blockquote-bg: #f7f8fa;
  --ms-blockquote-border: #1e80ff;
  --ms-blockquote-text: #515767;
  --ms-hr: #e4e6eb;
  --ms-table-border: #dcdfe6;
  --ms-table-header-bg: #f7f8fa;
}

/* 掘金特征：二级标题左侧色条，去掉默认下划线 */
.milkdown .editor h2 {
  position: relative;
  padding-left: 12px;
  border-bottom: none;
}
.milkdown .editor h2::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0.15em;
  bottom: 0.15em;
  width: 4px;
  border-radius: 2px;
  background: var(--ms-accent);
}
`

const NORD = `.milkdown {
  --ms-bg: #2e3440;
  --ms-text: #d8dee9;
  --ms-text-secondary: #a3adc2;
  --ms-heading: #eceff4;
  --ms-accent: #88c0d0;
  --ms-accent-hover: #8fbcbb;
  --ms-border: #434c5e;
  --ms-border-strong: #4c566a;
  --ms-code-bg: #3b4252;
  --ms-code-text: #d8dee9;
  --ms-blockquote-bg: #3b4252;
  --ms-blockquote-border: #4c566a;
  --ms-blockquote-text: #a3adc2;
  --ms-hr: #434c5e;
  --ms-table-border: #4c566a;
  --ms-table-header-bg: #3b4252;
}
`

export interface PresetTheme extends MarkdownThemeInfo {
  css: string
}

export const PRESET_THEMES: readonly PresetTheme[] = [
  {
    id: 'github',
    name: 'GitHub',
    description: 'GitHub 官方文档风格，浅色',
    builtin: true,
    css: GITHUB
  },
  {
    id: 'juejin',
    name: '掘金',
    description: '掘金社区风格：蓝色强调色 + 标题色条',
    builtin: true,
    css: JUEJIN
  },
  {
    id: 'nord',
    name: 'Nord',
    description: 'Nord 冷色调，深色',
    builtin: true,
    css: NORD
  }
]

/** 导出模板：给用户一个可直接改的起点，注释说明约定与可用变量 */
export function buildThemeTemplate(): string {
  return `/* 墨境 Markdown 主题
 *
 * 编写约定：
 * 1. 变量写在 .milkdown 上——编辑器与导出文档里都有这层容器，一份即可两边生效；
 *    界面外壳（侧栏、工具栏）不受影响。
 * 2. 只想改配色时，改下面的变量就够了。
 * 3. 结构性调整：编辑器用 .milkdown .editor ...，导出用 .markdown-body ...。
 * 4. 代码块的颜色由「代码块主题」单独控制，这里不用管。
 */

.milkdown {
  /* 文档底色与文字 */
  --ms-bg: #ffffff;
  --ms-text: #24292f;
  --ms-text-secondary: #57606a;
  --ms-heading: #1f2328;

  /* 强调色（链接、光标等） */
  --ms-accent: #0969da;
  --ms-accent-hover: #0550ae;

  /* 分隔线与边框 */
  --ms-border: #e4e7eb;
  --ms-border-strong: #d0d7de;
  --ms-hr: #e4e7eb;

  /* 代码 */
  --ms-code-bg: #f6f8fa;
  --ms-code-text: #24292f;

  /* 引用 */
  --ms-blockquote-bg: #f6f8fa;
  --ms-blockquote-border: #d0d7de;
  --ms-blockquote-text: #57606a;

  /* 表格 */
  --ms-table-border: #d0d7de;
  --ms-table-header-bg: #f6f8fa;

  /* 字体（可选）
  --ms-font-sans: -apple-system, 'Segoe UI', 'PingFang SC', sans-serif;
  --ms-font-mono: ui-monospace, Consolas, monospace;
  */
}
`
}
