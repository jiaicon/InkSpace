# Markdown Studio —— 子项目 B：文件层 设计

- 日期：2026-09-01
- 状态：已确认，待实现
- 范围：子项目 B / 共 A→B→C→D（A 编辑器引擎 → B 文件层 → C 知识库 → D 导出与打磨）
- 前置：[A 编辑器引擎设计](2026-08-27-markdown-editor-engine-design.md)（已交付）

## 1. 背景与目标

在子项目 A 交付的编辑器引擎之上，交付**文件层**：让用户以 Typora 式布局打开一个真实文件夹作为
「工作空间」，左侧文件树镜像磁盘目录，中间多标签编辑，顶部工具栏；文件即磁盘上的 `.md`，编辑
自动保存。本子项目同时替换掉 A 阶段遗留的临时验收挂载，落地正式布局与 UI。

编辑模型（A 已定）：Typora 式单一表面（WYSIWYG + 源码切换），无独立预览窗格。

## 2. 设计原则

- **最优方案**：文件系统操作全部走主进程（`fs/promises` + Electron 原生对话框），渲染层保持沙箱
  （`contextIsolation:true`、`nodeIntegration:false`）不变。
- **可版本迭代**：文件服务与「工作空间/最近打开」服务分层隔离，将来可替换存储或接入同步。
- **简单易用**：工作空间 = 一个真实文件夹；文件树只显示目录 + `*.md`；自动保存免手动保存。
- **满足多数需求**：打开文件夹 / 打开文件 / 新建 / 另存为 / 最近打开，覆盖 Typora 核心常见用法。

## 3. 范围

### 3.1 目标内

- 打开真实文件夹作为「工作空间」，左侧文件树镜像目录结构（目录 + `*.md`）。
- 多标签（Tab）编辑：打开文件 → 新 Tab；点击切换；关闭（含 dirty 确认）。
- 新建文件、另存为、重命名、删除（移入回收站）、在文件夹中显示。
- 自动保存（防抖写盘）+ 每 Tab dirty 指示。
- 最近打开列表（SQLite 持久化）。
- 正式布局与 UI（左侧 Sidebar + 顶部 TabBar + 工具栏 + 内容区 + 空态欢迎页），亮色极简 Typora 风，
  CSS 变量预留主题化。
- SQLite 新增 `settings`（KV）与 `recent_files` 表。

### 3.2 非目标（后续子项目）

- 知识库（workspace/vault 骨架 + AI）→ C。
- 导出 HTML/PDF、全局搜索/替换、快捷键体系、暗色主题 → D。
- 文件实时监听（外部改动自动刷新树/重载）→ 后续迭代；v1 只在「切工作区/手动刷新」时重扫。

## 4. 架构

```
renderer（React + zustand）
  ├── stores/workspace.ts          # 工作区/树/标签/最近打开 的 UI 状态
  ├── api/workspace.ts, api/file.ts# window.api 类型化封装（unwrap）
  └── 组件 FileTree / TabBar / Welcome / App
        │ ipcRenderer.invoke
        ▼
preload：workspaceApi / fileApi（contextBridge → window.api）
        ▼
main：
  ├── modules/workspace            # 对话框(打开文件夹) + 树构建 + settings/recent
  │     ├── tree.ts                # buildFileTree：递归扫描目录 → FileTreeNode[]
  │     ├── repository.ts          # settings KV + recent_files DAO
  │     ├── service.ts             # createWorkspaceService(db)
  │     └── index.ts               # registerWorkspaceIpc(db)
  ├── modules/file                 # 文件读写
  │     ├── service.ts             # createFileService()：read/write/create/rename/remove
  │     └── index.ts               # registerFileIpc()：另存对话框 + reveal + trash
  └── db/migrations/002_files.sql  # settings + recent_files
```

数据流：`renderer → window.api → ipcRenderer.invoke → ipcMain.handle → service → fs/SQLite`。

- 主进程独占 `fs` 与 SQLite；service 层不 import Electron（沿用现有约定，便于 `:memory:`/临时目录单测），
  Electron 原生能力（`dialog`、`shell`）只在各模块 `index.ts`（IPC 注册层）使用。
- 渲染层状态（树/标签/最近打开）用 zustand；`Editor`（A 交付）保持单实例，切 Tab 时换内容。

## 5. 接口

### 5.1 共享类型（`src/shared/types.ts` 新增）

```ts
export interface FileTreeNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileTreeNode[]   // 仅 directory 有
}

export interface RecentFile {
  path: string
  title: string
  lastOpenedAt: string
}

export interface WorkspaceInfo {
  path: string
  tree: FileTreeNode[]
}
```

### 5.2 IPC 通道（`src/shared/ipc.ts` 新增）

| 通道 | 入参 | 返回 | 说明 |
|---|---|---|---|
| `workspace:pick` | — | `WorkspaceInfo \| null` | 打开文件夹对话框；选定后写 `settings.lastWorkspace` 并返回树；取消返回 null |
| `workspace:last` | — | `string \| null` | 读上次工作区路径 |
| `workspace:tree` | `root: string` | `FileTreeNode[]` | 重扫指定目录 |
| `recent:list` | — | `RecentFile[]` | 按 `last_opened_at` 降序 |
| `recent:add` | `path, title` | `void` | upsert 最近打开 |
| `recent:remove` | `path` | `void` | 移除一条 |
| `file:read` | `path` | `string` | 读文本（不存在则报错） |
| `file:write` | `path, content` | `void` | 写文本（自动建父目录） |
| `file:create` | `suggestDir, content` | `string \| null` | 另存对话框→写文件；取消返回 null |
| `file:rename` | `path, newName` | `string` | 重命名，返回新路径 |
| `file:delete` | `path` | `void` | 移入回收站，失败则永久删除 |
| `file:reveal` | `path` | `void` | 系统文件管理器中显示 |

全部沿用 `IpcResult<T>` 信封；主进程 handler 永不 throw。

### 5.3 主进程服务接口

```ts
// modules/workspace/service.ts
interface WorkspaceService {
  getLastWorkspace(): string | null
  setLastWorkspace(path: string): void
  readTree(root: string): Promise<FileTreeNode[]>
  listRecent(): RecentFile[]
  addRecent(path: string, title: string): void
  removeRecent(path: string): void
}
createWorkspaceService(db: Database.Database): WorkspaceService

// modules/workspace/tree.ts
buildFileTree(root: string, opts?: { maxDepth?: number }): Promise<FileTreeNode[]>

// modules/file/service.ts
interface FileService {
  read(path: string): Promise<string>
  write(path: string, content: string): Promise<void>
  create(path: string, content: string): Promise<void>  // 已由 IPC 层确定 path
  rename(path: string, newName: string): Promise<string>
  remove(path: string): Promise<void>                    // 永久删除（IPC 层先尝试 trash）
}
createFileService(): FileService
```

## 6. 数据模型（SQLite）

新增迁移 `002_files.sql`：

```sql
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS recent_files (
  path           TEXT PRIMARY KEY,
  title          TEXT NOT NULL,
  last_opened_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);
```

- `settings` 目前仅存 `lastWorkspace`；预留 `theme` 等 KV。
- `recent_files` 以 `path` 为主键（同文件重复打开只更新时间）；`last_opened_at` 用 `datetime('now','localtime')`
  在 `addRecent` 时显式更新。

迁移执行：在 `src/main/db/migrate.ts` 的 `migrations` 数组追加 `002_files.sql`（沿用版本化 SQL + `_migrations` 幂等）。

## 7. 渲染层：状态与组件

### 7.1 zustand store（`stores/workspace.ts`）

```ts
interface Tab { path: string; title: string; dirty: boolean }

interface WorkspaceState {
  workspacePath: string | null
  tree: FileTreeNode[]
  recent: RecentFile[]
  tabs: Tab[]
  activePath: string | null
  // actions（均 async，内部走 api + unwrap）
  openWorkspace(): Promise<void>          // workspace:pick → 刷新树/工作区
  openFile(path: string): Promise<void>   // 若未开则读→加 Tab→激活；recent:add
  closeTab(path: string): Promise<void>   // 先由 App 处理 flush 与确认，再移除
  setActive(path: string): void           // 仅切换 activePath（flush 由 App 编排）
  newFile(): Promise<void>                // file:create(workspacePath, '') → 刷新树→打开
  saveAs(currentPath: string, content: string): Promise<void>  // file:create(dirname(currentPath), content) → 开新 Tab
  renameFile(path: string, newName: string): Promise<void>  // file:rename → 刷新树+改 Tab
  deleteFile(path: string): Promise<void> // file:delete → 刷新树+关 Tab+recent:remove
  refreshTree(): Promise<void>
}
```

标题 `title` = 文件名（去扩展名）或路径 `basename`。`activePath` 为空时渲染空态欢迎页。

### 7.2 组件

- `App.tsx`：`ConfigProvider(zhCN)` + `Layout`。左 `Sider`(FileTree) + 右 `Layout`（`Header`=TabBar+工具栏、
  `Content`=Editor/Welcome）。持有 `editorRef`（`EditorHandle`），编排「切 Tab/关 Tab/自动保存」的 flush 时序。
- `components/FileTree.tsx`：顶部「打开文件夹」按钮；中部「最近打开」列表（点击打开）；下部 antd `Tree`
  渲染 `tree`（目录可展开、`.md` 为叶）；树节点右键菜单：新建文件 / 重命名 / 删除 / 在文件夹中显示。
- `components/TabBar.tsx`：antd `Tabs`（`type="editable-card"`、`hideAdd`），`onChange` 切 Tab、
  `onEdit(remove)` 关 Tab；每个 Tab 标题带 dirty 圆点（`●` 表示未保存）。
- `components/Welcome.tsx`：无打开文件时的空态（打开文件夹 / 新建文件 / 最近打开三个入口）。

### 7.3 UI 风格

极简 Typora 风、亮色为主：白底编辑区、左侧浅灰 Sidebar、顶部标签；主色沿用 antd 默认蓝，间距克制。
色值/字号经 CSS 变量定义（`--ms-bg`、`--ms-sidebar-bg`、`--ms-text` 等），预留暗色/主题化（对应 D）。

## 8. 自动保存与 dirty 语义

- 编辑 → `Editor.onChange(md)`：置当前 Tab `dirty=true`，记录 `pendingSave = { path, md }`，启动 500ms 防抖。
- 防抖触发 → `file:write(path, md)` 成功 → `editorRef.markSaved()`、Tab `dirty=false`、清 `pendingSave`；失败 → 保留
  `dirty=true` 并 `message.error`（不吞内容）。
- **flush**（立即写盘，绕过防抖）：切 Tab 前、关 Tab 前，若存在 `pendingSave` 则先 `await` 写盘；应用退出前在 renderer
  `beforeunload` 里做**尽力而为**的同步 flush（防抖仅 500ms，丢失窗口极小，不为此引入主进程阻塞协议）。
- 防抖用自定义 ~10 行 `debounce(fn, ms)` 带 `flush()`；不引入新依赖。
- 新建文件走 `file:create` 先落盘（空文件）再入 Tab，因此不存在「未命名缓冲区」；「另存为」用当前内容写新路径。
- dirty 仅表示「自上次写盘后又有编辑」，是一个短暂窗口；标题栏不再像 A 验收那样显示全局「已保存/未保存」，
  改为每 Tab 的 dirty 圆点。

## 9. 文件树与多 Tab 交互

- 树只显示目录与 `*.md`；跳过隐藏项（`.git`、`node_modules`、点开头）。
- 点击 `.md` → `openFile`；双击目录展开/收起。
- 树节点右键（`.md`）：新建文件、重命名、删除、在文件夹中显示；目录节点：新建文件。
- Tab 关闭：若 `dirty` → `Modal.confirm`（「未保存，是否保存？」）→ 保存/放弃/取消；关闭的是当前 Tab 则激活相邻 Tab。
- 打开工作区不自动打开文件（保留用户上次布局由「最近打开」承担）。

## 10. 错误处理

- IPC 统一 `handle()` → `IpcResult`；renderer `unwrap()` + antd `message.error`。
- 读文件不存在（外部已删）→ 明确提示并关闭对应 Tab，保留其它内容。
- 磁盘不可写 / 重命名目标已存在 / 删除失败 → 报错并保留内存内容，dirty 不清零。
- 空态与未选工作区时，新建/另存禁用或引导先打开工作区。

## 11. 测试

- `tests/workspace-tree.test.ts`：临时目录构造嵌套目录 + 隐藏项 + 非 md，断言 `buildFileTree` 只返回目录与 `.md`。
- `tests/workspace-service.test.ts`：`:memory:` SQLite，断言 `addRecent` upsert、`listRecent` 降序、`setLast/getLast`。
- `tests/file-service.test.ts`：临时目录，断言 read/write/create/rename/remove 及重命名冲突、读不存在报错。
- renderer store 逻辑以 `typecheck:web` + 手动验收覆盖（store 主要编排 IPC，纯逻辑少）。
- 回归：`pnpm test`（A 的 controller/outline 用例 + 新增用例）、`pnpm typecheck:node`、`pnpm typecheck:web`、`pnpm build`。

## 12. 验收标准

1. 启动显示正式布局（Sidebar + 空态欢迎页）；「打开文件夹」选目录后文件树镜像磁盘（仅目录 + `.md`）。
2. 点击 `.md` 打开为新 Tab，WYSIWYG 渲染；多个文件可切换，内容互不串扰。
3. 编辑后 Tab 出现 dirty 圆点，约 0.5s 后自动消失（写盘成功）；切 Tab/关 Tab 不丢内容。
4. 新建文件（弹另存对话框，生成空 `.md` 并打开）、另存为、重命名、删除（移入回收站）、在文件夹中显示均可用。
5. 关闭 dirty Tab 弹确认；最近打开列表可见且重启后仍在（SQLite 持久化）。
6. 工作区路径、最近打开重启后保留；`pnpm test` 全绿、`typecheck:node`/`typecheck:web`/`build` 通过。
