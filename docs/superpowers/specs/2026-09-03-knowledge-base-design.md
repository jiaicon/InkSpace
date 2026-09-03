# Markdown Studio —— 子项目 C：知识库 设计

- 日期：2026-09-03
- 状态：草稿，待确认
- 范围：子项目 C / 共 A→B→C→D（A 编辑器引擎 → B 文件层 → C 知识库 → D 导出与打磨）
- 前置：[A 编辑器引擎设计](2026-08-27-markdown-editor-engine-design.md)、[B 文件层设计](2026-09-01-file-layer-design.md)（均已交付）

## 1. 背景与目标

在 B 文件层之上交付**知识库骨架**：让笔记之间能通过 `[[wiki 链接]]` 互相引用、可查询**反向链接**
（backlinks），并在 SQLite 建立**笔记元数据索引**；同时预留 **AI 缝隙**（稳定接口）供未来的 AI 补全、
重写、语义检索接入。

编辑模型不变：markdown 仍是唯一事实源。知识库索引是**可重建的派生数据**——丢了随时可重扫磁盘
重建，因此不承担「数据权威」，只承担「快速查询」（反向链接、标题解析、补全候选）。

## 2. 设计原则

- **最优方案**：wiki 链接采用 Obsidian 事实标准 `[[title]]` / `[[title|alias]]`；索引用 SQLite（主进程独占）。
- **可版本迭代**：索引是可重建派生数据，与磁盘 markdown 松耦合；AI 能力隔离在 provider 接口后，可替换。
- **简单易用**：v1 只做「链接 + 反向链接 + 笔记索引 + AI 缝隙」，YAGNI 掉图谱可视化、全文检索（归 D）、标签面板。
- **满足多数需求**：wiki 链接与反向链接是知识库的核心用法，覆盖多数人的普遍需求。

## 3. 范围

### 3.1 目标内

- **vault 骨架**：工作空间即 vault（复用 B 的「工作空间=一个真实文件夹」）；笔记元数据索引进 SQLite
  （title / path / 链接关系 / 更新时间）。
- **wiki 链接**：`[[title]]` / `[[title|alias]]` 语法；WYSIWYG 与源码模式均支持；输入 `[[` 触发笔记补全
  （候选来自索引的标题）。
- **反向链接面板**：Sidebar 新增「反向链接」标签，显示「引用当前笔记」的其它笔记（用索引查询）。
- **AI 缝隙**：主进程 `KnowledgeService`（索引查询）+ 渲染层 `AiProvider` 接口（默认空实现），供未来 AI 接入。

### 3.2 非目标（后续子项目 / D）

- 图谱可视化（节点连线图）→ 后续。
- 全文检索 / FTS5 → D（全局搜索替换）。
- 标签面板 / 前置元数据（frontmatter）编辑 UI → 后续。
- 重命名时同步改写其它笔记中的引用（wiki-link 重定向）→ 后续；v1 重命名后旧引用变「未解析」，不自动改写。
- 文件实时监听（外部改动自动重索引）→ 与 B 一致，v1 只在「切工作区 / 保存 / 手动刷新」时重建。
- 真实 AI 模型接入 → 未来（本子项目只落接口与空实现）。

## 4. 架构

```
renderer（React + zustand）
  ├── stores/notes.ts             # 反向链接/补全候选/当前笔记链接 的 UI 状态
  ├── ai/provider.ts              # AiProvider 接口 + nullAiProvider（AI 缝隙，空实现）
  ├── api/knowledge.ts            # window.api 类型化封装（unwrap）
  └── 组件 Sidebar（新增反向链接标签）、App（编排重建时机）
        │ ipcRenderer.invoke
        ▼
preload：knowledgeApi（contextBridge → window.api.knowledge）
        ▼
main：
  ├── modules/knowledge
  │     ├── indexer.ts            # scanNotes：解析 *.md 的 title/链接 → 索引记录
  │     ├── repository.ts         # notes + note_links DAO
  │     ├── service.ts            # createKnowledgeService(db)：查询 + 重建
  │     └── index.ts              # registerKnowledgeIpc(db)
  └── db/migrations/003_notes.sql # notes + note_links
```

数据流沿用既有范式：`renderer → window.api → ipcRenderer.invoke → ipcMain.handle → service → fs/SQLite`。

- 主进程独占 `fs` 与 SQLite；service/indexer 层不 import Electron（沿用约定，便于 `:memory:`/临时目录单测），
  Electron 原生能力仅在各模块 `index.ts` 使用。
- 索引重建由 renderer 编排：打开工作区后、保存笔记后、手动刷新时调用 `knowledge:rebuild`（或增量 `knowledge:indexFile`）。

## 5. 接口

### 5.1 共享类型（`src/shared/types.ts` 新增）

```ts
export interface NoteMeta {
  path: string
  title: string        // 文件名去 .md（与 B 的 titleFromPath 一致）
  updatedAt: number    // epoch 毫秒
}

export interface NoteLink {
  source: string       // 源笔记 path
  target: string       // [[...]] 内的原始 title 文本
  targetPath: string | null   // 解析到的目标 path；未解析为 null
}
```

### 5.2 IPC 通道（`src/shared/ipc.ts` 新增）

| 通道 | 入参 | 返回 | 说明 |
|---|---|---|---|
| `knowledge:rebuild` | `root: string` | `{ notes: number, links: number }` | 扫描 vault 重建索引；返回统计 |
| `knowledge:indexFile` | `path, content` | `void` | 保存后增量索引单个文件 |
| `knowledge:backlinks` | `path` | `NoteMeta[]` | 反向链接：引用该笔记的其它笔记 |
| `knowledge:resolveTitle` | `title` | `string \| null` | 标题 → 路径（补全候选确认用） |
| `knowledge:searchTitles` | `prefix` | `string[]` | 按标题前缀匹配（补全候选） |

全部沿用 `IpcResult<T>` 信封；handler 永不 throw。

### 5.3 主进程服务接口

```ts
// modules/knowledge/service.ts
interface KnowledgeService {
  rebuild(root: string): Promise<{ notes: number; links: number }>
  indexFile(path: string, content: string): Promise<void>
  backlinks(path: string): Promise<NoteMeta[]>
  resolveTitle(title: string): string | null
  searchTitles(prefix: string): string[]
}
createKnowledgeService(db: Database.Database): KnowledgeService

// modules/knowledge/indexer.ts（纯函数，可单测）
parseLinks(content: string): { target: string; alias: string | null }[]  // 提取 [[...]]
```

### 5.4 AI 缝隙（渲染层，`src/renderer/src/ai/provider.ts`）

```ts
export interface AiProvider {
  readonly id: string
  readonly label: string
  // 未来能力（本子项目仅声明，不实现）：
  // complete?(ctx: { before: string; after: string }): Promise<string>
  // rewrite?(selection: string, instruction: string): Promise<string>
  // semanticSearch?(query: string, limit: number): Promise<NoteMeta[]>
}
export const nullAiProvider: AiProvider = { id: 'null', label: '未启用 AI' }
```

- v1 只声明接口 + `nullAiProvider`；渲染层通过 `getAiProvider()`（目前恒返回 null）取值，为未来替换留缝。
- 未来真实 provider（OpenAI / Anthropic / 本地 LLM）只需实现该接口并在注册处替换，不改动 UI 与 knowledge 层。

## 6. 数据模型（SQLite）

新增迁移 `003_notes.sql`：

```sql
CREATE TABLE IF NOT EXISTS notes (
  path        TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS note_links (
  source      TEXT NOT NULL,   -- 源笔记 path
  target      TEXT NOT NULL,   -- [[...]] 原始 title
  target_path TEXT,            -- 解析到的 path；未解析为 NULL
  PRIMARY KEY (source, target)
);
```

- `notes` 是「标题 → 路径」的主索引；`updated_at` 由 service 用 `Date.now()` 显式写入。
- `note_links` 以 `(source, target)` 为主键（去重）；`target_path` 在 rebuild 时解析。
- 标题解析规则（v1 从简）：`title` = `[[...]]` 中去掉 `|alias` 后的文本；按 `notes.title` 精确匹配，
  多个同名取「与源笔记同目录者优先」，仍不唯一则取字典序最小路径；解析失败 `target_path = NULL`（渲染为普通文本）。
- 迁移执行：在 `src/main/db/migrate.ts` 追加 `003_notes.sql`。

## 7. 渲染层

### 7.1 wiki 链接渲染与交互

- WYSIWYG（Milkdown）：`[[title]]` 渲染为内链样式（可点击）；已解析 → 点击跳转到该笔记（复用 B 的 `openFile`）；
  未解析 → 渲染为普通文本（保留原文）。
- 源码（CodeMirror）：`[[...]]` 保持文本；输入 `[[` 弹出补全（候选 = `searchTitles` 结果），选中后补全为 `[[title]]`。
- 补全候选与「确认后是否跳转」由 App 编排：`resolveTitle` 把标题转路径，再 `openFile`。

### 7.2 Sidebar 新增「反向链接」标签

- Sidebar 已有「文件 / 大纲」两个标签，新增第三个「反向链接」。
- 内容 = 当前激活笔记的 `backlinks(path)` 结果列表；点击项 → `openFile`；无激活笔记时显示空态。

### 7.3 索引重建时机

- 打开工作区后 → `knowledge:rebuild(root)`。
- 保存笔记后 → `knowledge:indexFile(path, content)`（增量，保持反向链接实时）。
- 手动「刷新」文件树时 → 同时 `rebuild`（与 B 的 `refreshTree` 一并触发）。

## 8. 错误处理

- `rebuild` 遇到单个不可读文件：跳过该文件并继续，不中断整体重建（统计里体现为少计）。
- 未解析链接不报错，降级渲染为普通文本。
- 索引查询失败：反向链接面板显示空态 + `message.error`，不影响编辑。
- 磁盘/索引不可用不阻塞编辑：索引是派生数据，宁可缺失也不阻塞写作主路径。

## 9. 测试

- `tests/knowledge-indexer.test.ts`：`parseLinks` 提取 `[[a]]`、`[[a|b]]`、嵌套/多链接、非链接文本不误报。
- `tests/knowledge-service.test.ts`：`:memory:` SQLite，断言 `rebuild` 后 `backlinks` 正确、
  `resolveTitle`/`searchTitles` 解析、`indexFile` 增量更新。
- 回归：`pnpm test`（A/B/C 用例）、`pnpm typecheck:node`、`pnpm typecheck:web`、`pnpm build`。

## 10. 验收标准

1. 打开工作区后，索引建立；`[[title]]` 在 WYSIWYG 渲染为可点击内链，点击跳到对应笔记。
2. 输入 `[[` 弹出补全，候选为索引中的标题，选中后插入 `[[title]]`。
3. Sidebar「反向链接」标签显示引用当前笔记的其它笔记，点击可跳转。
4. 保存后反向链接实时更新；重启后索引仍在（SQLite 持久化）。
5. AI 缝隙：`AiProvider` 接口与 `nullAiProvider` 落地，`getAiProvider()` 返回空实现，UI 无 AI 功能但不报错。
6. `pnpm test` 全绿、`typecheck:node`/`typecheck:web`/`build` 通过。
