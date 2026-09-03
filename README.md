# 墨境 InkSpace

一个 **Typora 类、AI 原生的 Markdown 编辑器**。所见即所得的单一编辑表面（WYSIWYG），支持源码模式切换，编辑器即应用本体——目标是「本地优先的写作工具，未来接入 AI 增强」。

> 状态：**开发中**。核心编辑与文件层已可用，知识库与 AI 能力在设计/规划阶段。

## 特性

* **所见即所得编辑**：基于 [Milkdown](https://milkdown.dev/)（ProseMirror），输入 Markdown 语法即时渲染，无独立预览窗格
* **源码模式**：CodeMirror 6 一键切换，两种模式共享同一份 Markdown
* **斜杠菜单**：段落开头输入 `/` 呼出块级菜单（标题、无序/有序列表、任务列表、引用、代码块、表格、分割线）
* **选中工具条**：选中文本浮出加粗/斜体/删除线/行内代码/链接
* **表格**：斜杠插入 3×3 表格，支持拖拽列边沿调整列宽，浮出工具条增删行/列、删除表格
* **任务列表**：`- [ ] ` 输入规则 + 斜杠菜单，带可勾选复选框
* **文件层**：文件夹作为工作区、文件树、多 Tab、打开/保存/另存为、自动保存、最近打开
* **大纲**：标题树导航
* **主题**：CSS 变量集中定义，预留明暗主题

## 技术栈

| 层   | 技术                                                        |
| --- | --------------------------------------------------------- |
| 桌面壳 | Electron 31 + [electron-vite](https://electron-vite.org/) |
| UI  | React 18 + [antd](https://ant.design/) v5 + zustand       |
| 编辑器 | Milkdown v7（WYSIWYG）+ CodeMirror 6（源码模式）                  |
| 存储  | better-sqlite3（主进程，版本化 SQL 迁移）                            |
| 语言  | TypeScript（strict）                                        |
| 包管理 | pnpm                                                      |

Markdown 方言：GFM（表格/任务列表/删除线）。Mermaid 与 KaTeX 数学插件因 Milkdown v7 生态滞后暂缓（见 git log）。

## 架构

标准 Electron 三进程隔离，主进程永不向渲染进程抛异常，统一以 `IpcResult<T>` 信封返回：

```
┌─────────────────────────────────────────────────────┐
│ Renderer（React）                                     │
│  App · components/ · editor/ · stores/ · api/        │
│  window.api.*  ← preload 聚合的 typed API            │
├─────────────────────────────────────────────────────┤
│ Preload  contextIsolation: true, sandbox: false      │
├─────────────────────────────────────────────────────┤
│ Main                                                 │
│  modules/{file,workspace,system,user}  ← DI 注入 db   │
│  ipc/register  ·  db/{database,migrate,migrations}   │
│  SQLite（app.db 位于 userData）                       │
└─────────────────────────────────────────────────────┘
        src/shared/{types.ts,ipc.ts}  ← 三端共享的 IPC 契约
```

* 主进程模块遵循 `index/service/repository` 分层，`db` 由 composition root 注入（[src/main/index.ts](src/main/index.ts)）
* IPC channel 常量集中在 [src/shared/ipc.ts](src/shared/ipc.ts)，避免三端字符串拼写漂移
* 编辑器引擎隔离在 `renderer/src/editor/` 薄边界后，对外只暴露 `getMarkdown/setMarkdown/onChange` 稳定接口

## 目录结构

```
src/
  main/            # Electron 主进程
    db/            #   SQLite 连接 + 版本化迁移
    modules/       #   file / workspace / system / user 业务模块
    ipc/           #   IPC 注册
  preload/         # 预加载脚本，聚合 window.api
  renderer/        # React 渲染进程
    src/
      App.tsx      #   布局与全局状态编排
      components/  #   FileTree / Outline / Sidebar / TabBar / Welcome
      editor/      #   Milkdown / CodeMirror / 斜杠菜单 / 工具条
      pages/       #   UserManage（旧 demo，待移除）
      stores/      #   zustand 工作区状态
      api/         #   window.api 的 renderer 侧封装
  shared/          # 主进程与渲染进程共享的类型与 IPC 常量
tests/             # vitest 单测（工作区/文件服务）
scripts/           # better-sqlite3 原生二进制下载脚本
docs/superpowers/  # spec / plan 设计文档（A 编辑器 · B 文件层 · C 知识库）
build/             # electron-builder 资源目录（放图标）
```

## 快速开始

```bash
# 安装依赖（postinstall 会自动下载 better-sqlite3 原生二进制）
pnpm install

# 开发模式（热更新）
pnpm dev

# 类型检查
pnpm typecheck        # = node + web

# 单元测试
pnpm test

# 构建（产物在 out/）
pnpm build
```

> 网络说明：`.npmrc` 已把 registry 与 Electron / better-sqlite3 二进制镜像指向 npmmirror，
> 因为当前网络无法访问 GitHub。`scripts/setup-better-sqlite3.mjs` 会同时下载
> Electron ABI 与本地 Node ABI 两份预编译产物，供打包运行时与 vitest 分别加载。

## 打包与图标

```bash
pnpm package        # 构建 + 全平台打包
pnpm package:win    # Windows NSIS 安装包
pnpm package:mac    # macOS DMG
pnpm package:linux  # Linux AppImage
```

* 打包配置：[electron-builder.yml](electron-builder.yml)（`productName: InkSpace`、`appId: com.inkspace.app`）
* 应用运行时名称为「墨境」（`app.setName("墨境")`），英文名 `InkSpace` 用于安装包/可执行文件名
* 图标放到 `build/`：`icon.ico`（Windows）/ `icon.icns`（macOS）/ `icon.png`（Linux）。详见 [build/README.md](build/README.md)

## 数据存储

SQLite 位于 `app.getPath("userData")/app.db`，schema 变更一律走版本化迁移（`src/main/db/migrations/`，按文件名顺序只执行一次）：

| 迁移              | 内容                                          |
| --------------- | ------------------------------------------- |
| `001_init.sql`  | users 表（旧企业 demo，待移除）                       |
| `002_files.sql` | `settings`（工作区 KV 配置）+ `recent_files`（最近打开） |

## 开发路线图

按子项目拆解，各自 spec → plan → 实现循环推进：

* **A 编辑器引擎** —— Milkdown/CodeMirror 双模式、斜杠菜单、工具条（已基本完成，持续打磨）
* **B 文件层** —— 文件树 / 多 Tab / 打开保存 / 自动保存 / 最近打开（已实现）
* **C 知识库** —— workspace/vault 骨架 + 笔记索引 + 双向链接 + AI 缝隙（`KnowledgeService` / `AiProvider` 接口，设计已完成，实现待排期）
* **D 导出与打磨** —— HTML/PDF 导出、全局搜索替换、快捷键、主题完善

## 设计文档

* [编辑器引擎设计](docs/superpowers/specs/2026-08-27-markdown-editor-engine-design.md)
* [文件层设计](docs/superpowers/specs/2026-09-01-file-layer-design.md)
* [知识库设计](docs/superpowers/specs/2026-09-03-knowledge-base-design.md)

