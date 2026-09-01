# Markdown Studio —— 子项目 B：文件层 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 A 交付的编辑器引擎之上，交付文件层：打开真实文件夹作为工作空间、左侧文件树、多标签编辑、新建/打开/另存/重命名/删除、自动保存、最近打开（SQLite 持久化），并落地正式 Typora 式布局替换掉临时验收挂载。

**Architecture:** 文件系统与 SQLite 独占主进程：`modules/workspace`（对话框 + 树 + settings/recent）与 `modules/file`（读写）；service 层不 import Electron 保持可测，Electron 原生能力（`dialog`/`shell`）只在各模块 `index.ts` 使用。渲染层用 zustand 存 UI 状态，单 `Editor` 实例切 Tab 换内容；自动保存 500ms 防抖写盘 + 切/关 Tab 前 flush。

**Tech Stack:** Electron + Vite + React 18 + TypeScript 5.5 + antd v5 + zustand + better-sqlite3 + Vitest 2。

**Spec:** [2026-09-01-file-layer-design.md](../specs/2026-09-01-file-layer-design.md)

## Global Constraints

- 包管理器 pnpm；新增运行时依赖一律放 `dependencies`（本子项目不新增依赖，复用 zustand/antd/better-sqlite3）。
- 沿用现有分层范式：main `modules/{x}` 的 index/service/repository + DI'd db；`handle()` 返回 `IpcResult`；preload 聚合 `window.api`；renderer `api/*` 用 `unwrap()`；版本化 SQL 迁移。
- 引擎隔离不破：Milkdown/CodeMirror 仍只在 `src/renderer/src/editor/` 内 import；文件层只通过 `Editor` 的稳定接口（`initialMarkdown/onChange/setMarkdown`）与之交互。
- 代码风格：单引号、TS strict、`@renderer` / `@shared` alias。
- 中文错误文案。
- 测试：Vitest node 环境（`tests/**/*.test.ts`）；main service/树用 `:memory:` + 临时目录；renderer store/path/debounce 纯逻辑单测；DOM 组件与 IPC 接线用 `typecheck` + `build` + `pnpm dev` 手动验收。

---

## 文件结构总览

```
src/shared/
├── types.ts              # + FileTreeNode / RecentFile / WorkspaceInfo
└── ipc.ts                # + workspace/file/recent 通道常量
src/main/
├── db/migrations/002_files.sql   # settings + recent_files
├── db/migrate.ts         # 追加 002 到迁移清单
├── ipc/util.ts           # handle() 支持 await 异步 handler
├── ipc/register.ts       # 追加 registerWorkspaceIpc + registerFileIpc
├── modules/workspace/
│     ├── tree.ts         # buildFileTree：目录 → FileTreeNode[]（目录 + *.md，跳隐藏）
│     ├── repository.ts   # settings KV + recent_files DAO
│     ├── service.ts      # createWorkspaceService(db)
│     └── index.ts        # registerWorkspaceIpc(db)：对话框 + 树 + recent
└── modules/file/
      ├── service.ts      # createFileService()：read/write/rename/remove
      └── index.ts        # registerFileIpc()：另存对话框 + trash + reveal
src/preload/
├── apis/workspace.ts     # workspaceApi
├── apis/file.ts          # fileApi
└── index.ts              # 聚合 workspace/file
src/renderer/src/
├── env.d.ts              # Window.api 增加 workspace/file 类型
├── api/workspace.ts      # unwrap 封装
├── api/file.ts           # unwrap 封装
├── utils/path.ts         # titleFromPath / dirname
├── utils/debounce.ts     # debounce（带 flush/cancel）
├── stores/workspace.ts   # zustand：工作区/树/标签/最近/内容
├── components/Welcome.tsx
├── components/TabBar.tsx
├── components/FileTree.tsx
└── App.tsx               # 布局 + 编辑器接线 + 自动保存编排
tests/
├── workspace-service.test.ts
├── workspace-tree.test.ts
├── file-service.test.ts
├── workspace-store.test.ts
├── utils-path.test.ts
└── debounce.test.ts
```

---

### Task 1: 共享契约（类型 + IPC 通道常量）

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/shared/ipc.ts`

**Interfaces:**
- Consumes: 无。
- Produces: `FileTreeNode` / `RecentFile` / `WorkspaceInfo` 类型，`IPC.workspacePick` 等通道常量，供后续所有任务使用。

- [ ] **Step 1: 扩展 `src/shared/types.ts`**

在文件末尾追加：

```ts
/** 文件树节点（file 为叶，directory 有 children） */
export interface FileTreeNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileTreeNode[]
}

/** 最近打开的一条记录 */
export interface RecentFile {
  path: string
  title: string
  lastOpenedAt: number   // epoch 毫秒
}

/** 工作区信息：根路径 + 文件树 */
export interface WorkspaceInfo {
  path: string
  tree: FileTreeNode[]
}
```

- [ ] **Step 2: 扩展 `src/shared/ipc.ts`**

在 `IPC` 对象末尾（`systemInfo` 之后）追加：

```ts
  // workspace 模块
  workspacePick: 'workspace:pick',
  workspaceLast: 'workspace:last',
  workspaceTree: 'workspace:tree',
  recentList: 'recent:list',
  recentAdd: 'recent:add',
  recentRemove: 'recent:remove',
  // file 模块
  fileRead: 'file:read',
  fileWrite: 'file:write',
  fileCreate: 'file:create',
  fileRename: 'file:rename',
  fileDelete: 'file:delete',
  fileReveal: 'file:reveal'
```

（注意：`systemInfo: 'system:info'` 后面的逗号需保留，新增条目以逗号分隔。）

- [ ] **Step 3: 类型检查**

Run: `pnpm typecheck:node && pnpm typecheck:web`
Expected: 无错误（纯类型/常量追加，两端都能解析）。

- [ ] **Step 4: 提交**

```bash
git add src/shared/types.ts src/shared/ipc.ts
git commit -m "feat(shared): file-layer types and ipc channels"
```

---

### Task 2: 迁移 002 + workspace 仓储与 service（settings + recent）

**Files:**
- Create: `src/main/db/migrations/002_files.sql`
- Modify: `src/main/db/migrate.ts`
- Create: `src/main/modules/workspace/repository.ts`
- Create: `src/main/modules/workspace/service.ts`
- Test: `tests/workspace-service.test.ts`

**Interfaces:**
- Consumes: `RecentFile`（Task 1）。
- Produces: `createWorkspaceService(db): WorkspaceService`，含 `getLastWorkspace/setLastWorkspace/listRecent/addRecent/removeRecent`（`readTree` 在 Task 3 补）。

- [ ] **Step 1: 写失败测试 `tests/workspace-service.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { openDatabase } from '../src/main/db/database'
import { migrate } from '../src/main/db/migrate'
import { createWorkspaceService } from '../src/main/modules/workspace/service'

function setup() {
  const db = openDatabase(':memory:')
  migrate(db)
  return createWorkspaceService(db)
}

describe('workspace service (settings + recent)', () => {
  it('stores and reads last workspace (null 起跳)', () => {
    const svc = setup()
    expect(svc.getLastWorkspace()).toBeNull()
    svc.setLastWorkspace('D:/docs')
    expect(svc.getLastWorkspace()).toBe('D:/docs')
  })

  it('upserts recent by path and orders by recency desc', () => {
    const svc = setup()
    svc.addRecent('D:/a.md', 'a')
    svc.addRecent('D:/b.md', 'b')
    // 再次打开 a，应排到最前（毫秒时间戳保证顺序）
    svc.addRecent('D:/a.md', 'a')
    const list = svc.listRecent()
    expect(list).toHaveLength(2)
    expect(list[0].path).toBe('D:/a.md')
    expect(list[1].path).toBe('D:/b.md')
  })

  it('removes recent', () => {
    const svc = setup()
    svc.addRecent('D:/a.md', 'a')
    svc.removeRecent('D:/a.md')
    expect(svc.listRecent()).toHaveLength(0)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run tests/workspace-service.test.ts`
Expected: FAIL（`002_files.sql` 未迁移，`recent_files`/`settings` 表不存在，或模块不存在）。

- [ ] **Step 3: 写迁移 `src/main/db/migrations/002_files.sql`**

```sql
-- 002_files.sql —— 文件层：工作区配置(KV) + 最近打开
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS recent_files (
  path           TEXT PRIMARY KEY,
  title          TEXT NOT NULL,
  last_opened_at INTEGER NOT NULL
);
```

- [ ] **Step 4: 把 002 加入迁移清单 `src/main/db/migrate.ts`**

顶部新增 import：

```ts
import initFilesSql from './migrations/002_files.sql?raw'
```

`migrations` 数组改为：

```ts
const migrations: { name: string; sql: string }[] = [
  { name: '001_init.sql', sql: initSql },
  { name: '002_files.sql', sql: initFilesSql }
]
```

- [ ] **Step 5: 写 `src/main/modules/workspace/repository.ts`**

```ts
import type Database from 'better-sqlite3'
import type { RecentFile } from '@shared/types'

// —— SQL 位置（DML） ——
const SQL = {
  getSetting: `SELECT value FROM settings WHERE key = ?`,
  setSetting: `INSERT INTO settings (key, value) VALUES (@key, @value)
               ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  listRecent: `SELECT path, title, last_opened_at AS lastOpenedAt
               FROM recent_files ORDER BY last_opened_at DESC`,
  upsertRecent: `INSERT INTO recent_files (path, title, last_opened_at)
                 VALUES (@path, @title, @lastOpenedAt)
                 ON CONFLICT(path) DO UPDATE
                 SET title = excluded.title, last_opened_at = excluded.last_opened_at`,
  deleteRecent: `DELETE FROM recent_files WHERE path = ?`
}

/** 数据访问层：settings KV + recent_files，不含业务规则 */
export function createWorkspaceRepository(db: Database.Database) {
  return {
    getSetting(key: string): string | undefined {
      const row = db.prepare(SQL.getSetting).get(key) as { value: string } | undefined
      return row?.value
    },
    setSetting(key: string, value: string): void {
      db.prepare(SQL.setSetting).run({ key, value })
    },
    listRecent(): RecentFile[] {
      return db.prepare(SQL.listRecent).all() as RecentFile[]
    },
    upsertRecent(path: string, title: string): void {
      db.prepare(SQL.upsertRecent).run({ path, title, lastOpenedAt: Date.now() })
    },
    deleteRecent(path: string): void {
      db.prepare(SQL.deleteRecent).run(path)
    }
  }
}
```

- [ ] **Step 6: 写 `src/main/modules/workspace/service.ts`**

```ts
import type Database from 'better-sqlite3'
import type { RecentFile } from '@shared/types'
import { createWorkspaceRepository } from './repository'

export interface WorkspaceService {
  getLastWorkspace(): string | null
  setLastWorkspace(path: string): void
  listRecent(): RecentFile[]
  addRecent(path: string, title: string): void
  removeRecent(path: string): void
}

/**
 * 工作区业务 service：不 import Electron，可用 ':memory:' 直接单测。
 * （readTree 在 Task 3 补入）
 */
export function createWorkspaceService(db: Database.Database): WorkspaceService {
  const repo = createWorkspaceRepository(db)
  return {
    getLastWorkspace: () => repo.getSetting('lastWorkspace') ?? null,
    setLastWorkspace: (path) => repo.setSetting('lastWorkspace', path),
    listRecent: () => repo.listRecent(),
    addRecent: (path, title) => repo.upsertRecent(path, title),
    removeRecent: (path) => repo.deleteRecent(path)
  }
}
```

- [ ] **Step 7: 运行测试确认通过**

Run: `pnpm vitest run tests/workspace-service.test.ts`
Expected: PASS。

- [ ] **Step 8: 提交**

```bash
git add src/main/db/migrations/002_files.sql src/main/db/migrate.ts \
        src/main/modules/workspace/repository.ts src/main/modules/workspace/service.ts \
        tests/workspace-service.test.ts
git commit -m "feat(workspace): migration + recent/settings service"
```

---

### Task 3: 文件树构建器（buildFileTree）

**Files:**
- Create: `src/main/modules/workspace/tree.ts`
- Modify: `src/main/modules/workspace/service.ts`（补 `readTree`）
- Test: `tests/workspace-tree.test.ts`

**Interfaces:**
- Consumes: `FileTreeNode`（Task 1）。
- Produces: `buildFileTree(root, opts?): Promise<FileTreeNode[]>`；`WorkspaceService.readTree(root): Promise<FileTreeNode[]>`。

- [ ] **Step 1: 写失败测试 `tests/workspace-tree.test.ts`**

```ts
import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { buildFileTree } from '../src/main/modules/workspace/tree'

let dir: string
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'ms-tree-'))
})
afterAll(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('buildFileTree', () => {
  it('只返回目录与 *.md，目录在前，跳过隐藏项与非 md', async () => {
    await mkdir(join(dir, 'docs'))
    await mkdir(join(dir, 'docs', 'sub'))
    await mkdir(join(dir, '.git'))
    await writeFile(join(dir, 'a.md'), '')
    await writeFile(join(dir, 'b.txt'), '')
    await writeFile(join(dir, '.hidden.md'), '')
    await writeFile(join(dir, 'docs', 'c.md'), '')
    await writeFile(join(dir, 'docs', 'd.png'), '')
    await writeFile(join(dir, '.git', 'HEAD'), '')

    const tree = await buildFileTree(dir)

    expect(tree.map((n) => n.name)).toEqual(['docs', 'a.md'])
    expect(tree[0].type).toBe('directory')
    expect(tree[0].children!.map((n) => n.name)).toEqual(['sub', 'c.md'])
    expect(tree[0].children![0].children).toEqual([])
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run tests/workspace-tree.test.ts`
Expected: FAIL（`tree.ts` 模块不存在）。

- [ ] **Step 3: 写 `src/main/modules/workspace/tree.ts`**

```ts
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { FileTreeNode } from '@shared/types'

const HIDDEN_DIRS = new Set(['node_modules', '.git'])
const MD_EXT = '.md'

export interface BuildFileTreeOptions {
  maxDepth?: number
}

/** 递归扫描目录，只返回目录与 *.md，跳过隐藏项（点开头 / node_modules / .git）。 */
export async function buildFileTree(
  root: string,
  opts: BuildFileTreeOptions = {}
): Promise<FileTreeNode[]> {
  const maxDepth = opts.maxDepth ?? 32

  async function walk(dir: string, depth: number): Promise<FileTreeNode[]> {
    const entries = await readdir(dir, { withFileTypes: true })
    const nodes: FileTreeNode[] = []
    for (const ent of entries) {
      if (ent.name.startsWith('.') || (ent.isDirectory() && HIDDEN_DIRS.has(ent.name))) continue
      const full = join(dir, ent.name)
      if (ent.isDirectory()) {
        const children = depth + 1 <= maxDepth ? await walk(full, depth + 1) : []
        nodes.push({ name: ent.name, path: full, type: 'directory', children })
      } else if (ent.isFile() && ent.name.toLowerCase().endsWith(MD_EXT)) {
        nodes.push({ name: ent.name, path: full, type: 'file' })
      }
    }
    // 目录在前，文件在后；同类按名称（不区分大小写）排序
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    })
    return nodes
  }

  return walk(root, 0)
}
```

- [ ] **Step 4: 在 `service.ts` 补 `readTree`**

顶部新增 import：

```ts
import type { FileTreeNode } from '@shared/types'
import { buildFileTree } from './tree'
```

接口与实现分别追加：

```ts
export interface WorkspaceService {
  getLastWorkspace(): string | null
  setLastWorkspace(path: string): void
  readTree(root: string): Promise<FileTreeNode[]>
  listRecent(): RecentFile[]
  addRecent(path: string, title: string): void
  removeRecent(path: string): void
}
```

```ts
    readTree: (root) => buildFileTree(root),
```

- [ ] **Step 5: 运行测试确认通过**

Run: `pnpm vitest run tests/workspace-tree.test.ts tests/workspace-service.test.ts`
Expected: 全部 PASS。

- [ ] **Step 6: 提交**

```bash
git add src/main/modules/workspace/tree.ts src/main/modules/workspace/service.ts tests/workspace-tree.test.ts
git commit -m "feat(workspace): file tree builder"
```

---

### Task 4: 文件读写 service

**Files:**
- Create: `src/main/modules/file/service.ts`
- Test: `tests/file-service.test.ts`

**Interfaces:**
- Consumes: 无。
- Produces: `createFileService(): FileService`，含 `read/write/rename/remove`（`write` 自动建父目录，新建/另存复用）。

- [ ] **Step 1: 写失败测试 `tests/file-service.test.ts`**

```ts
import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { mkdtemp, writeFile, readFile, access, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createFileService } from '../src/main/modules/file/service'

let dir: string
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'ms-file-'))
})
afterAll(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('file service', () => {
  it('write 自动建父目录，read 读回内容', async () => {
    const svc = createFileService()
    const p = join(dir, 'nested', 'a.md')
    await svc.write(p, '# hi')
    expect(await svc.read(p)).toBe('# hi')
  })

  it('rename 成功返回新路径，目标已存在则报错', async () => {
    const svc = createFileService()
    const a = join(dir, 'a.md')
    const b = join(dir, 'b.md')
    await svc.write(a, 'A')
    await svc.write(b, 'B')
    expect(await svc.rename(a, 'c.md')).toBe(join(dir, 'c.md'))
    await expect(svc.rename(b, 'c.md')).rejects.toThrow(/已存在/)
  })

  it('remove 删除文件，read 不存在时报错', async () => {
    const svc = createFileService()
    const p = join(dir, 'x.md')
    await svc.write(p, '')
    await svc.remove(p)
    await expect(svc.read(p)).rejects.toThrow()
    await expect(access(p)).rejects.toThrow()
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run tests/file-service.test.ts`
Expected: FAIL（`service.ts` 模块不存在）。

- [ ] **Step 3: 写 `src/main/modules/file/service.ts`**

```ts
import { access, mkdir, readFile, rename as fsRename, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

export interface FileService {
  read(path: string): Promise<string>
  write(path: string, content: string): Promise<void>
  rename(path: string, newName: string): Promise<string>
  remove(path: string): Promise<void>
}

/** 文件读写 service：只用 node:fs/promises，不 import Electron，可用临时目录单测。 */
export function createFileService(): FileService {
  async function ensureWrite(path: string, content: string): Promise<void> {
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, content, 'utf-8')
  }

  return {
    read: (path) => readFile(path, 'utf-8'),
    write: ensureWrite,
    rename: async (path, newName) => {
      const target = join(dirname(path), newName)
      try {
        await access(target)
        throw new Error(`已存在同名文件：${newName}`)
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
      }
      await fsRename(path, target)
      return target
    },
    remove: async (path) => {
      await rm(path, { recursive: true, force: true })
    }
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest run tests/file-service.test.ts`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/main/modules/file/service.ts tests/file-service.test.ts
git commit -m "feat(file): file read/write service"
```

---

### Task 5: main 侧 IPC 注册（workspace + file handler）

**Files:**
- Modify: `src/main/ipc/util.ts`（`handle()` 支持 await 异步 handler）
- Create: `src/main/modules/workspace/index.ts`
- Create: `src/main/modules/file/index.ts`
- Modify: `src/main/ipc/register.ts`

**Interfaces:**
- Consumes: `IPC.*` 通道常量（Task 1）、`createWorkspaceService`（Task 2/3）、`createFileService`（Task 4）。
- Produces: `registerWorkspaceIpc(db)` / `registerFileIpc()`，汇总进 `registerIpc`。

- [ ] **Step 1: 让 `handle()` 支持异步 handler**

将 `src/main/ipc/util.ts` 的 `handle` 改为 async（对现有同步 handler 无副作用）：

```ts
export function handle(channel: string, fn: (...args: unknown[]) => unknown): void {
  ipcMain.handle(channel, async (_event, ...args: unknown[]): Promise<IpcResult<unknown>> => {
    try {
      return { ok: true, data: await fn(...args) }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  })
}
```

- [ ] **Step 2: 写 `src/main/modules/workspace/index.ts`**

```ts
import { dialog } from 'electron'
import type Database from 'better-sqlite3'
import { IPC } from '@shared/ipc'
import { handle } from '../../ipc/util'
import { createWorkspaceService } from './service'

/** 注册 workspace 模块的 IPC handler（打开文件夹对话框、树、recent） */
export function registerWorkspaceIpc(db: Database.Database): void {
  const svc = createWorkspaceService(db)

  handle(IPC.workspacePick, async () => {
    const res = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    if (res.canceled || res.filePaths.length === 0) return null
    const path = res.filePaths[0]
    svc.setLastWorkspace(path)
    return { path, tree: await svc.readTree(path) }
  })

  handle(IPC.workspaceLast, () => svc.getLastWorkspace())
  handle(IPC.workspaceTree, (root) => svc.readTree(root as string))
  handle(IPC.recentList, () => svc.listRecent())
  handle(IPC.recentAdd, (path, title) => svc.addRecent(path as string, title as string))
  handle(IPC.recentRemove, (path) => svc.removeRecent(path as string))
}
```

- [ ] **Step 3: 写 `src/main/modules/file/index.ts`**

```ts
import { dialog, shell } from 'electron'
import { join } from 'node:path'
import { IPC } from '@shared/ipc'
import { handle } from '../../ipc/util'
import { createFileService } from './service'

/** 注册 file 模块的 IPC handler（另存对话框、读写、重命名、删除、显示） */
export function registerFileIpc(): void {
  const svc = createFileService()

  handle(IPC.fileRead, (path) => svc.read(path as string))
  handle(IPC.fileWrite, (path, content) => svc.write(path as string, content as string))

  handle(IPC.fileCreate, async (suggestDir, content) => {
    const res = await dialog.showSaveDialog({
      title: '新建文件',
      defaultPath: join(suggestDir as string, '未命名.md'),
      filters: [{ name: 'Markdown', extensions: ['md'] }]
    })
    if (res.canceled || !res.filePath) return null
    await svc.write(res.filePath, content as string)
    return res.filePath
  })

  handle(IPC.fileRename, (path, newName) => svc.rename(path as string, newName as string))

  handle(IPC.fileDelete, async (path) => {
    try {
      await shell.trashItem(path as string)
    } catch {
      await svc.remove(path as string)
    }
  })

  handle(IPC.fileReveal, (path) => shell.showItemInFolder(path as string))
}
```

- [ ] **Step 4: 汇总到 `src/main/ipc/register.ts`**

```ts
import type Database from 'better-sqlite3'
import { registerUserIpc } from '../modules/user'
import { registerSystemIpc } from '../modules/system'
import { registerWorkspaceIpc } from '../modules/workspace'
import { registerFileIpc } from '../modules/file'

/**
 * 汇总注册所有模块的 IPC handler。
 * 新增一个模块：只需在这里（以及 preload/index.ts）各加一行，main/index.ts 不动。
 */
export function registerIpc(db: Database.Database): void {
  registerUserIpc(db)
  registerSystemIpc()
  registerWorkspaceIpc(db)
  registerFileIpc()
}
```

- [ ] **Step 5: 类型检查**

Run: `pnpm typecheck:node`
Expected: 无错误（`dialog`/`shell` 属 Electron，在 tsconfig.node 的 types 范围内）。

- [ ] **Step 6: 提交**

```bash
git add src/main/ipc/util.ts src/main/ipc/register.ts \
        src/main/modules/workspace/index.ts src/main/modules/file/index.ts
git commit -m "feat(ipc): workspace and file handlers"
```

---

### Task 6: preload + renderer API 封装

**Files:**
- Create: `src/preload/apis/workspace.ts`
- Create: `src/preload/apis/file.ts`
- Modify: `src/preload/index.ts`
- Create: `src/renderer/src/api/workspace.ts`
- Create: `src/renderer/src/api/file.ts`
- Modify: `src/renderer/src/env.d.ts`

**Interfaces:**
- Consumes: `IPC.*`（Task 1）、`FileTreeNode/RecentFile/WorkspaceInfo`（Task 1）。
- Produces: `window.api.workspace` / `window.api.file`（preload），`workspaceApi` / `fileApi`（renderer，unwrap 后）。

- [ ] **Step 1: 写 `src/preload/apis/workspace.ts`**

```ts
import { ipcRenderer } from 'electron'
import { IPC } from '@shared/ipc'

/** workspace 模块的 preload api */
export const workspaceApi = {
  pick: () => ipcRenderer.invoke(IPC.workspacePick),
  last: () => ipcRenderer.invoke(IPC.workspaceLast),
  tree: (root: string) => ipcRenderer.invoke(IPC.workspaceTree, root),
  recentList: () => ipcRenderer.invoke(IPC.recentList),
  recentAdd: (path: string, title: string) => ipcRenderer.invoke(IPC.recentAdd, path, title),
  recentRemove: (path: string) => ipcRenderer.invoke(IPC.recentRemove, path)
}
```

- [ ] **Step 2: 写 `src/preload/apis/file.ts`**

```ts
import { ipcRenderer } from 'electron'
import { IPC } from '@shared/ipc'

/** file 模块的 preload api */
export const fileApi = {
  read: (path: string) => ipcRenderer.invoke(IPC.fileRead, path),
  write: (path: string, content: string) => ipcRenderer.invoke(IPC.fileWrite, path, content),
  create: (suggestDir: string, content: string) => ipcRenderer.invoke(IPC.fileCreate, suggestDir, content),
  rename: (path: string, newName: string) => ipcRenderer.invoke(IPC.fileRename, path, newName),
  remove: (path: string) => ipcRenderer.invoke(IPC.fileDelete, path),
  reveal: (path: string) => ipcRenderer.invoke(IPC.fileReveal, path)
}
```

- [ ] **Step 3: 聚合到 `src/preload/index.ts`**

```ts
import { contextBridge } from 'electron'
import { userApi } from './apis/user'
import { systemApi } from './apis/system'
import { workspaceApi } from './apis/workspace'
import { fileApi } from './apis/file'

// 聚合所有模块的 api，一次性通过 contextBridge 暴露为 window.api。
const api = {
  user: userApi,
  system: systemApi,
  workspace: workspaceApi,
  file: fileApi
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
```

- [ ] **Step 4: 写 `src/renderer/src/api/workspace.ts`**

```ts
import { unwrap } from './util'
import type { FileTreeNode, RecentFile, WorkspaceInfo } from '@shared/types'

/** workspace 模块的渲染进程 API 封装 */
export const workspaceApi = {
  pick: () => unwrap<WorkspaceInfo | null>(window.api.workspace.pick()),
  last: () => unwrap<string | null>(window.api.workspace.last()),
  tree: (root: string) => unwrap<FileTreeNode[]>(window.api.workspace.tree(root)),
  recentList: () => unwrap<RecentFile[]>(window.api.workspace.recentList()),
  recentAdd: (path: string, title: string) => unwrap<void>(window.api.workspace.recentAdd(path, title)),
  recentRemove: (path: string) => unwrap<void>(window.api.workspace.recentRemove(path))
}
```

- [ ] **Step 5: 写 `src/renderer/src/api/file.ts`**

```ts
import { unwrap } from './util'

/** file 模块的渲染进程 API 封装 */
export const fileApi = {
  read: (path: string) => unwrap<string>(window.api.file.read(path)),
  write: (path: string, content: string) => unwrap<void>(window.api.file.write(path, content)),
  create: (suggestDir: string, content: string) =>
    unwrap<string | null>(window.api.file.create(suggestDir, content)),
  rename: (path: string, newName: string) => unwrap<string>(window.api.file.rename(path, newName)),
  remove: (path: string) => unwrap<void>(window.api.file.remove(path)),
  reveal: (path: string) => unwrap<void>(window.api.file.reveal(path))
}
```

- [ ] **Step 6: 扩展 `src/renderer/src/env.d.ts` 的 `Window.api` 类型**

顶部 import 追加 `FileTreeNode, RecentFile, WorkspaceInfo`，并在 `Window['api']` 中追加两个字段：

```ts
import type { User, UserInput, SystemInfo, IpcResult, FileTreeNode, RecentFile, WorkspaceInfo } from '@shared/types'

declare global {
  interface Window {
    api: {
      user: {
        list: () => Promise<IpcResult<User[]>>
        create: (input: UserInput) => Promise<IpcResult<number>>
        update: (id: number, input: UserInput) => Promise<IpcResult<boolean>>
        remove: (id: number) => Promise<IpcResult<boolean>>
      }
      system: {
        getInfo: () => Promise<IpcResult<SystemInfo>>
      }
      workspace: {
        pick: () => Promise<IpcResult<WorkspaceInfo | null>>
        last: () => Promise<IpcResult<string | null>>
        tree: (root: string) => Promise<IpcResult<FileTreeNode[]>>
        recentList: () => Promise<IpcResult<RecentFile[]>>
        recentAdd: (path: string, title: string) => Promise<IpcResult<void>>
        recentRemove: (path: string) => Promise<IpcResult<void>>
      }
      file: {
        read: (path: string) => Promise<IpcResult<string>>
        write: (path: string, content: string) => Promise<IpcResult<void>>
        create: (suggestDir: string, content: string) => Promise<IpcResult<string | null>>
        rename: (path: string, newName: string) => Promise<IpcResult<string>>
        remove: (path: string) => Promise<IpcResult<void>>
        reveal: (path: string) => Promise<IpcResult<void>>
      }
    }
  }
}
```

（用完整文件覆盖 `env.d.ts`，保留原 user/system 声明并追加 workspace/file。）

- [ ] **Step 7: 类型检查**

Run: `pnpm typecheck:node && pnpm typecheck:web`
Expected: 无错误。

- [ ] **Step 8: 提交**

```bash
git add src/preload/apis/workspace.ts src/preload/apis/file.ts src/preload/index.ts \
        src/renderer/src/api/workspace.ts src/renderer/src/api/file.ts src/renderer/src/env.d.ts
git commit -m "feat(api): preload and renderer file/workspace api"
```

---

### Task 7: zustand store + 路径工具

**Files:**
- Create: `src/renderer/src/utils/path.ts`
- Create: `src/renderer/src/stores/workspace.ts`
- Test: `tests/utils-path.test.ts`
- Test: `tests/workspace-store.test.ts`

**Interfaces:**
- Consumes: `FileTreeNode/RecentFile`（Task 1）。
- Produces: `titleFromPath(path)` / `dirname(path)`；`useWorkspaceStore`（含 `Tab` 类型与纯状态 action）。

- [ ] **Step 1: 写失败测试 `tests/utils-path.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { titleFromPath, dirname } from '../src/renderer/src/utils/path'

describe('path utils', () => {
  it('titleFromPath 取文件名并去 .md', () => {
    expect(titleFromPath('D:/docs/a.md')).toBe('a')
    expect(titleFromPath('C:\\blog\\01.md')).toBe('01')
    expect(titleFromPath('D:/docs/README')).toBe('README')
  })

  it('dirname 取父目录（兼容 / 与 \\）', () => {
    expect(dirname('D:/docs/a.md')).toBe('D:/docs')
    expect(dirname('C:\\blog\\01.md')).toBe('C:\\blog')
    expect(dirname('root.md')).toBe('')
  })
})
```

- [ ] **Step 2: 写失败测试 `tests/workspace-store.test.ts`**

```ts
import { describe, expect, it, beforeEach } from 'vitest'
import { useWorkspaceStore } from '../src/renderer/src/stores/workspace'

const initial = {
  workspacePath: null as string | null,
  tree: [] as import('@shared/types').FileTreeNode[],
  recent: [] as import('@shared/types').RecentFile[],
  tabs: [] as import('../src/renderer/src/stores/workspace').Tab[],
  activePath: null as string | null,
  contents: {} as Record<string, string>
}

describe('workspace store', () => {
  beforeEach(() => useWorkspaceStore.setState(initial))

  it('addTab upserts 并激活', () => {
    const s = useWorkspaceStore.getState()
    s.addTab('D:/a.md', 'a', '# a')
    s.addTab('D:/b.md', 'b', '# b')
    s.addTab('D:/a.md', 'a', '# a2')
    const st = useWorkspaceStore.getState()
    expect(st.tabs).toHaveLength(2)
    expect(st.activePath).toBe('D:/a.md')
    expect(st.contents['D:/a.md']).toBe('# a2')
  })

  it('removeTab 激活相邻 tab', () => {
    const s = useWorkspaceStore.getState()
    s.addTab('D:/a.md', 'a', '# a')
    s.addTab('D:/b.md', 'b', '# b')
    s.addTab('D:/c.md', 'c', '# c')
    s.removeTab('D:/b.md')
    const st = useWorkspaceStore.getState()
    expect(st.tabs.map((t) => t.path)).toEqual(['D:/a.md', 'D:/c.md'])
    expect(st.activePath).toBe('D:/c.md')
    expect(st.contents['D:/b.md']).toBeUndefined()
  })

  it('renameTab 迁移路径与内容', () => {
    const s = useWorkspaceStore.getState()
    s.addTab('D:/a.md', 'a', '# a')
    s.renameTab('D:/a.md', 'D:/b.md', 'b')
    const st = useWorkspaceStore.getState()
    expect(st.tabs[0]).toMatchObject({ path: 'D:/b.md', title: 'b' })
    expect(st.activePath).toBe('D:/b.md')
    expect(st.contents['D:/b.md']).toBe('# a')
    expect(st.contents['D:/a.md']).toBeUndefined()
  })

  it('onEdit 记内容并置 dirty，markSaved 清除', () => {
    const s = useWorkspaceStore.getState()
    s.addTab('D:/a.md', 'a', '# a')
    s.onEdit('D:/a.md', '# a1')
    expect(useWorkspaceStore.getState().tabs[0].dirty).toBe(true)
    s.markSaved('D:/a.md')
    expect(useWorkspaceStore.getState().tabs[0].dirty).toBe(false)
  })
})
```

- [ ] **Step 3: 运行测试确认失败**

Run: `pnpm vitest run tests/utils-path.test.ts tests/workspace-store.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 4: 写 `src/renderer/src/utils/path.ts`**

```ts
/** 从路径取文件名并去掉 .md 扩展名 */
export function titleFromPath(path: string): string {
  const base = path.split(/[\\/]/).pop() ?? path
  return base.replace(/\.md$/i, '')
}

/** 取父目录（兼容 / 与 \）；无父目录返回空串 */
export function dirname(path: string): string {
  const idx = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return idx < 0 ? '' : path.slice(0, idx)
}
```

- [ ] **Step 5: 写 `src/renderer/src/stores/workspace.ts`**

```ts
import { create } from 'zustand'
import type { FileTreeNode, RecentFile } from '@shared/types'

export interface Tab {
  path: string
  title: string
  dirty: boolean
}

interface WorkspaceState {
  workspacePath: string | null
  tree: FileTreeNode[]
  recent: RecentFile[]
  tabs: Tab[]
  activePath: string | null
  contents: Record<string, string>   // path → 当前内存内容

  setWorkspace(path: string | null): void
  setTree(tree: FileTreeNode[]): void
  setRecent(recent: RecentFile[]): void
  addTab(path: string, title: string, content: string): void
  activate(path: string): void
  removeTab(path: string): void
  renameTab(oldPath: string, newPath: string, newTitle: string): void
  onEdit(path: string, content: string): void
  markSaved(path: string): void
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  workspacePath: null,
  tree: [],
  recent: [],
  tabs: [],
  activePath: null,
  contents: {},

  setWorkspace: (workspacePath) => set({ workspacePath }),
  setTree: (tree) => set({ tree }),
  setRecent: (recent) => set({ recent }),

  addTab: (path, title, content) =>
    set((s) => {
      if (s.tabs.some((t) => t.path === path)) {
        return { activePath: path, contents: { ...s.contents, [path]: content } }
      }
      return {
        tabs: [...s.tabs, { path, title, dirty: false }],
        activePath: path,
        contents: { ...s.contents, [path]: content }
      }
    }),

  activate: (path) => set({ activePath: path }),

  removeTab: (path) =>
    set((s) => {
      const idx = s.tabs.findIndex((t) => t.path === path)
      if (idx < 0) return s
      const tabs = s.tabs.filter((t) => t.path !== path)
      const contents = { ...s.contents }
      delete contents[path]
      let activePath = s.activePath
      if (activePath === path) {
        const neighbor = tabs[idx] ?? tabs[idx - 1]
        activePath = neighbor ? neighbor.path : null
      }
      return { tabs, activePath, contents }
    }),

  renameTab: (oldPath, newPath, newTitle) =>
    set((s) => {
      const tabs = s.tabs.map((t) =>
        t.path === oldPath ? { path: newPath, title: newTitle, dirty: t.dirty } : t
      )
      const contents = { ...s.contents }
      if (oldPath in contents) {
        contents[newPath] = contents[oldPath]
        delete contents[oldPath]
      }
      const activePath = s.activePath === oldPath ? newPath : s.activePath
      return { tabs, contents, activePath }
    }),

  onEdit: (path, content) =>
    set((s) => ({
      contents: { ...s.contents, [path]: content },
      tabs: s.tabs.map((t) => (t.path === path ? { ...t, dirty: true } : t))
    })),

  markSaved: (path) =>
    set((s) => ({ tabs: s.tabs.map((t) => (t.path === path ? { ...t, dirty: false } : t)) }))
}))
```

- [ ] **Step 6: 运行测试确认通过**

Run: `pnpm vitest run tests/utils-path.test.ts tests/workspace-store.test.ts`
Expected: PASS。

- [ ] **Step 7: 提交**

```bash
git add src/renderer/src/utils/path.ts src/renderer/src/stores/workspace.ts \
        tests/utils-path.test.ts tests/workspace-store.test.ts
git commit -m "feat(store): workspace store and path utils"
```

---

### Task 8: UI 组件（Welcome / TabBar / FileTree）

**Files:**
- Create: `src/renderer/src/components/Welcome.tsx`
- Create: `src/renderer/src/components/TabBar.tsx`
- Create: `src/renderer/src/components/FileTree.tsx`

**Interfaces:**
- Consumes: `Tab` + `useWorkspaceStore` 类型（Task 7）、`titleFromPath`（Task 7）、`FileTreeNode/RecentFile`（Task 1）。
- Produces: 三个纯展示组件，由 App（Task 9）传入 props 与回调。

- [ ] **Step 1: 写 `src/renderer/src/components/Welcome.tsx`**

```tsx
import { Button, Empty, Space, Typography } from 'antd'
import { FolderOpenOutlined, FileAddOutlined } from '@ant-design/icons'
import { titleFromPath } from '../utils/path'

interface WelcomeProps {
  recent: string[]
  onOpenWorkspace(): void
  onNewFile(): void
  onOpenRecent(path: string): void
}

export function Welcome({ recent, onOpenWorkspace, onNewFile, onOpenRecent }: WelcomeProps) {
  return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Empty description="打开一个文件夹或文件开始写作">
        <Space direction="vertical" style={{ width: 320 }}>
          <Button type="primary" block icon={<FolderOpenOutlined />} onClick={onOpenWorkspace}>
            打开文件夹
          </Button>
          <Button block icon={<FileAddOutlined />} onClick={onNewFile}>
            新建文件
          </Button>
          {recent.length > 0 && (
            <div>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                最近打开
              </Typography.Text>
              {recent.map((p) => (
                <Button
                  key={p}
                  type="link"
                  size="small"
                  block
                  style={{ textAlign: 'left', padding: 0 }}
                  onClick={() => onOpenRecent(p)}
                >
                  {titleFromPath(p)}
                </Button>
              ))}
            </div>
          )}
        </Space>
      </Empty>
    </div>
  )
}
```

- [ ] **Step 2: 写 `src/renderer/src/components/TabBar.tsx`**

```tsx
import { Tabs } from 'antd'
import type { Tab } from '../stores/workspace'

interface TabBarProps {
  tabs: Tab[]
  activePath: string | null
  onChange(path: string): void
  onClose(path: string): void
}

export function TabBar({ tabs, activePath, onChange, onClose }: TabBarProps) {
  const items = tabs.map((t) => ({
    key: t.path,
    label: (
      <span>
        {t.dirty && <span style={{ color: '#faad14', marginRight: 4 }}>●</span>}
        {t.title}
      </span>
    ),
    closable: true
  }))

  return (
    <Tabs
      type="editable-card"
      hideAdd
      size="small"
      activeKey={activePath ?? undefined}
      items={items}
      onChange={onChange}
      onEdit={(key, action) => {
        if (action === 'remove' && typeof key === 'string') onClose(key)
      }}
      tabBarStyle={{ marginBottom: 0 }}
    />
  )
}
```

- [ ] **Step 3: 写 `src/renderer/src/components/FileTree.tsx`**

```tsx
import { Button, Dropdown, Space, Tree, Typography } from 'antd'
import type { MenuProps } from 'antd'
import type { DataNode } from 'antd/es/tree'
import { FolderOpenOutlined } from '@ant-design/icons'
import type { FileTreeNode, RecentFile } from '@shared/types'
import { titleFromPath } from '../utils/path'

interface FileTreeProps {
  workspacePath: string | null
  tree: FileTreeNode[]
  recent: RecentFile[]
  onOpenWorkspace(): void
  onOpenFile(path: string): void
  onNewFile(dir: string): void
  onRename(path: string): void
  onDelete(path: string): void
  onReveal(path: string): void
}

function fileMenu(n: FileTreeNode, props: FileTreeProps): MenuProps['items'] {
  if (n.type === 'file') {
    return [
      { key: 'rename', label: '重命名' },
      { key: 'delete', label: '删除' },
      { key: 'reveal', label: '在文件夹中显示' }
    ]
  }
  return [{ key: 'new', label: '新建文件' }]
}

export function FileTree(props: FileTreeProps) {
  const { workspacePath, tree, recent, onOpenWorkspace, onOpenFile, onNewFile, onRename, onDelete, onReveal } = props

  const toData = (nodes: FileTreeNode[]): DataNode[] =>
    nodes.map((n) => ({
      key: n.path,
      title: (
        <Dropdown
          trigger={['contextMenu']}
          menu={{
            items: fileMenu(n, props),
            onClick: ({ key }) => {
              if (key === 'rename') onRename(n.path)
              else if (key === 'delete') onDelete(n.path)
              else if (key === 'reveal') onReveal(n.path)
              else if (key === 'new') onNewFile(n.path)
            }
          }}
        >
          <span>{n.name}</span>
        </Dropdown>
      ),
      isLeaf: n.type === 'file',
      children: n.type === 'directory' ? toData(n.children ?? []) : undefined
    }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: 12 }}>
        <Button block icon={<FolderOpenOutlined />} onClick={onOpenWorkspace}>
          {workspacePath ? '切换文件夹' : '打开文件夹'}
        </Button>
      </div>

      {recent.length > 0 && (
        <div style={{ padding: '0 12px 8px' }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            最近打开
          </Typography.Text>
          {recent.slice(0, 5).map((r) => (
            <div key={r.path}>
              <Button
                type="link"
                size="small"
                style={{ padding: 0 }}
                onClick={() => onOpenFile(r.path)}
              >
                {titleFromPath(r.path)}
              </Button>
            </div>
          ))}
        </div>
      )}

      <div style={{ flex: 1, overflow: 'auto', padding: '0 4px 8px' }}>
        {tree.length > 0 ? (
          <Tree
            showIcon
            blockNode
            treeData={toData(tree)}
            defaultExpandAll
            onSelect={(keys) => {
              const key = keys[0] as string | undefined
              if (key && key.toLowerCase().endsWith('.md')) onOpenFile(key)
            }}
          />
        ) : (
          <Typography.Text type="secondary" style={{ display: 'block', padding: 12 }}>
            尚未打开工作区
          </Typography.Text>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: 类型检查 + 构建**

Run: `pnpm typecheck:web && pnpm build`
Expected: 无错误，构建通过。

- [ ] **Step 5: 提交**

```bash
git add src/renderer/src/components/Welcome.tsx \
        src/renderer/src/components/TabBar.tsx src/renderer/src/components/FileTree.tsx
git commit -m "feat(ui): file tree, tab bar and welcome"
```

---

### Task 9: 防抖工具 + App 布局与编辑器接线

**Files:**
- Create: `src/renderer/src/utils/debounce.ts`
- Modify: `src/renderer/src/App.tsx`（整体重写为正式布局）
- Test: `tests/debounce.test.ts`

**Interfaces:**
- Consumes: `Editor`/`EditorHandle`（A）、`useWorkspaceStore` + `titleFromPath/dirname`（Task 7）、`workspaceApi/fileApi`（Task 6）、三个组件（Task 8）、`debounce`（本任务）。
- Produces: 完整的 Typora 式布局 + 自动保存编排。

- [ ] **Step 1: 写失败测试 `tests/debounce.test.ts`**

```ts
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { debounce } from '../src/renderer/src/utils/debounce'

describe('debounce', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('合并窗口内的多次调用', () => {
    const fn = vi.fn()
    const d = debounce(fn, 100)
    d('a')
    d('b')
    d('c')
    vi.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('c')
  })

  it('flush 立即用最新参数执行且不再重复', () => {
    const fn = vi.fn()
    const d = debounce(fn, 100)
    d('x')
    d.flush()
    expect(fn).toHaveBeenCalledWith('x')
    vi.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('cancel 丢弃待执行调用', () => {
    const fn = vi.fn()
    const d = debounce(fn, 100)
    d('x')
    d.cancel()
    vi.advanceTimersByTime(100)
    expect(fn).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run tests/debounce.test.ts`
Expected: FAIL（`debounce.ts` 不存在）。

- [ ] **Step 3: 写 `src/renderer/src/utils/debounce.ts`**

```ts
export interface Debounced<A extends unknown[], R> {
  (...args: A): void
  flush(): R | undefined
  cancel(): void
}

/** 防抖：窗口内合并调用；flush 立即执行最新一次（返回其返回值）；cancel 丢弃。 */
export function debounce<A extends unknown[], R = void>(
  fn: (...args: A) => R,
  ms: number
): Debounced<A, R> {
  let timer: ReturnType<typeof setTimeout> | null = null
  let lastArgs: A | null = null

  const run = (): R | undefined => {
    timer = null
    if (lastArgs) {
      const args = lastArgs
      lastArgs = null
      return fn(...args)
    }
    return undefined
  }

  const debounced = ((...args: A) => {
    lastArgs = args
    if (timer) clearTimeout(timer)
    timer = setTimeout(run, ms)
  }) as Debounced<A, R>

  debounced.flush = () => (timer ? (clearTimeout(timer), run()) : undefined)
  debounced.cancel = () => {
    if (timer) clearTimeout(timer)
    timer = null
    lastArgs = null
  }
  return debounced
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest run tests/debounce.test.ts`
Expected: PASS。

- [ ] **Step 5: 重写 `src/renderer/src/App.tsx`**

用完整文件覆盖：

```tsx
import { useCallback, useRef, useState } from 'react'
import { Button, ConfigProvider, Input, Layout, Modal, message } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { Editor } from './editor'
import type { EditorHandle } from './editor'
import { useWorkspaceStore } from './stores/workspace'
import { titleFromPath, dirname } from './utils/path'
import { workspaceApi } from './api/workspace'
import { fileApi } from './api/file'
import { FileTree } from './components/FileTree'
import { TabBar } from './components/TabBar'
import { Welcome } from './components/Welcome'
import { debounce } from './utils/debounce'

const SIDEBAR_WIDTH = 280

export default function App() {
  const editorRef = useRef<EditorHandle>(null)
  const {
    workspacePath, tree, recent, tabs, activePath, contents,
    setWorkspace, setTree, setRecent, addTab, activate, removeTab, renameTab, onEdit, markSaved
  } = useWorkspaceStore()

  const [pendingClose, setPendingClose] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  // —— 自动保存：500ms 防抖写盘 ——
  const doSave = useCallback(
    async (path: string, md: string) => {
      try {
        await fileApi.write(path, md)
        markSaved(path)
      } catch (e) {
        message.error(`保存失败：${e instanceof Error ? e.message : String(e)}`)
      }
    },
    [markSaved]
  )
  const saveRef = useRef(debounce(doSave, 500))

  // 编辑器当前显示路径 + 当前激活路径（用 ref 避免 onChange 闭包过期）
  const displayedPathRef = useRef<string | null>(null)
  const activePathRef = useRef(activePath)
  activePathRef.current = activePath

  const handleEdit = useCallback(
    (md: string) => {
      const path = activePathRef.current
      if (!path) return
      onEdit(path, md)
      saveRef.current(path, md)
    },
    [onEdit]
  )

  const showFile = useCallback(async (path: string, content: string) => {
    if (displayedPathRef.current === path) return
    await saveRef.current.flush()
    displayedPathRef.current = path
    editorRef.current?.setMarkdown(content)
  }, [])

  const openFile = useCallback(
    async (path: string) => {
      const st = useWorkspaceStore.getState()
      if (st.tabs.some((t) => t.path === path)) {
        const content = st.contents[path]
        activate(path)
        if (content != null) await showFile(path, content)
        return
      }
      try {
        const content = await fileApi.read(path)
        addTab(path, titleFromPath(path), content)
        await showFile(path, content)
        fileApi.recentAdd(path, titleFromPath(path)).catch(() => {})
        setRecent(await workspaceApi.recentList())
      } catch (e) {
        message.error(`打开失败：${e instanceof Error ? e.message : String(e)}`)
      }
    },
    [activate, addTab, setRecent, showFile]
  )

  const openWorkspace = useCallback(async () => {
    try {
      const info = await workspaceApi.pick()
      if (!info) return
      setWorkspace(info.path)
      setTree(info.tree)
      setRecent(await workspaceApi.recentList())
    } catch (e) {
      message.error(`打开文件夹失败：${e instanceof Error ? e.message : String(e)}`)
    }
  }, [setWorkspace, setTree, setRecent])

  const refreshTree = useCallback(async () => {
    const path = useWorkspaceStore.getState().workspacePath
    if (!path) return
    setTree(await workspaceApi.tree(path))
  }, [setTree])

  const newFile = useCallback(
    async (dir?: string) => {
      const base = dir ?? useWorkspaceStore.getState().workspacePath
      if (!base) {
        message.info('请先打开一个文件夹')
        return
      }
      try {
        const path = await fileApi.create(base, '')
        if (!path) return
        await refreshTree()
        await openFile(path)
      } catch (e) {
        message.error(`新建失败：${e instanceof Error ? e.message : String(e)}`)
      }
    },
    [refreshTree, openFile]
  )

  const saveAs = useCallback(async () => {
    const st = useWorkspaceStore.getState()
    if (!st.activePath) return
    const md = st.contents[st.activePath] ?? ''
    try {
      const path = await fileApi.create(dirname(st.activePath), md)
      if (!path) return
      await refreshTree()
      await openFile(path)
    } catch (e) {
      message.error(`另存为失败：${e instanceof Error ? e.message : String(e)}`)
    }
  }, [refreshTree, openFile])

  // —— Tab 关闭（含 dirty 确认）——
  const finalizeClose = useCallback(
    async (path: string) => {
      await saveRef.current.flush()
      const st = useWorkspaceStore.getState()
      const idx = st.tabs.findIndex((t) => t.path === path)
      const wasActive = st.activePath === path
      removeTab(path)
      if (wasActive) {
        const next = useWorkspaceStore.getState()
        if (next.activePath && next.contents[next.activePath] != null) {
          displayedPathRef.current = null
          await showFile(next.activePath, next.contents[next.activePath])
        } else {
          displayedPathRef.current = null
        }
      }
    },
    [removeTab, showFile]
  )

  const requestClose = useCallback((path: string) => {
    const tab = useWorkspaceStore.getState().tabs.find((t) => t.path === path)
    if (tab?.dirty) setPendingClose(path)
    else void finalizeClose(path)
  }, [finalizeClose])

  const handleTabChange = useCallback(
    async (path: string) => {
      const content = useWorkspaceStore.getState().contents[path]
      activate(path)
      if (content != null) await showFile(path, content)
    },
    [activate, showFile]
  )

  // —— 重命名 ——
  const requestRename = useCallback((path: string) => {
    setRenaming(path)
    setRenameValue(titleFromPath(path))
  }, [])

  const confirmRename = useCallback(async () => {
    const path = renaming
    if (!path) return
    const name = renameValue.trim()
    setRenaming(null)
    if (!name) return
    try {
      const newPath = await fileApi.rename(path, `${name}.md`)
      renameTab(path, newPath, name)
      if (displayedPathRef.current === path) displayedPathRef.current = newPath
      await refreshTree()
      fileApi.recentRemove(path).catch(() => {})
      fileApi.recentAdd(newPath, name).catch(() => {})
      setRecent(await workspaceApi.recentList())
    } catch (e) {
      message.error(`重命名失败：${e instanceof Error ? e.message : String(e)}`)
    }
  }, [renaming, renameValue, renameTab, refreshTree, setRecent])

  // —— 删除 ——
  const confirmDelete = useCallback(
    (path: string) => {
      Modal.confirm({
        title: '删除文件',
        content: `确定删除「${titleFromPath(path)}」吗？将移入回收站。`,
        okText: '删除',
        okButtonProps: { danger: true },
        onOk: async () => {
          try {
            await fileApi.remove(path)
            if (displayedPathRef.current === path) displayedPathRef.current = null
            await finalizeClose(path)
            await refreshTree()
            fileApi.recentRemove(path).catch(() => {})
            setRecent(await workspaceApi.recentList())
          } catch (e) {
            message.error(`删除失败：${e instanceof Error ? e.message : String(e)}`)
          }
        }
      })
    },
    [finalizeClose, refreshTree, setRecent]
  )

  const hasTabs = tabs.length > 0

  return (
    <ConfigProvider locale={zhCN}>
      <Layout style={{ height: '100vh' }}>
        <Layout.Sider width={SIDEBAR_WIDTH} theme="light" style={{ borderRight: '1px solid #f0f0f0' }}>
          <FileTree
            workspacePath={workspacePath}
            tree={tree}
            recent={recent}
            onOpenWorkspace={openWorkspace}
            onOpenFile={openFile}
            onNewFile={newFile}
            onRename={requestRename}
            onDelete={confirmDelete}
            onReveal={(path) => fileApi.reveal(path).catch((e) => message.error(String(e)))}
          />
        </Layout.Sider>

        <Layout>
          <Layout.Header style={{ background: '#fff', padding: '0 8px', height: 40, lineHeight: '40px', display: 'flex', alignItems: 'center' }}>
            <TabBar tabs={tabs} activePath={activePath} onChange={handleTabChange} onClose={requestClose} />
          </Layout.Header>

          <Layout.Content style={{ background: '#fff', overflow: 'hidden' }}>
            {hasTabs && activePath ? (
              <Editor ref={editorRef} initialMarkdown={contents[activePath] ?? ''} onChange={handleEdit} />
            ) : (
              <Welcome
                recent={recent.map((r) => r.path)}
                onOpenWorkspace={openWorkspace}
                onNewFile={() => newFile()}
                onOpenRecent={openFile}
              />
            )}
          </Layout.Content>
        </Layout>
      </Layout>

      <Modal
        open={pendingClose != null}
        title="未保存的更改"
        onCancel={() => setPendingClose(null)}
        footer={[
          <Button key="cancel" onClick={() => setPendingClose(null)}>
            取消
          </Button>,
          <Button
            key="discard"
            onClick={() => {
              const p = pendingClose
              setPendingClose(null)
              if (p) void finalizeClose(p)
            }}
          >
            不保存
          </Button>,
          <Button
            key="save"
            type="primary"
            onClick={async () => {
              const p = pendingClose
              setPendingClose(null)
              if (p) {
                const md = useWorkspaceStore.getState().contents[p]
                if (md != null) await doSave(p, md)
                await finalizeClose(p)
              }
            }}
          >
            保存
          </Button>
        ]}
      >
        当前文件有未保存的更改，是否保存后再关闭？
      </Modal>

      <Modal
        open={renaming != null}
        title="重命名"
        onOk={confirmRename}
        onCancel={() => setRenaming(null)}
        okText="确定"
      >
        <Input
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onPressEnter={confirmRename}
          placeholder="文件名（不含扩展名）"
        />
      </Modal>
    </ConfigProvider>
  )
}
```

- [ ] **Step 6: 类型检查 + 构建 + 全量单测**

Run: `pnpm typecheck:node && pnpm typecheck:web && pnpm build && pnpm test`
Expected: 无类型错误、构建通过、全部单测 PASS。

- [ ] **Step 7: 提交**

```bash
git add src/renderer/src/utils/debounce.ts src/renderer/src/App.tsx tests/debounce.test.ts
git commit -m "feat(app): wire editor, autosave and layout"
```

---

## 验收对照

| 规格要求（spec §3/§8/§12） | 覆盖任务 |
|---|---|
| 打开真实文件夹为工作区，文件树镜像磁盘（目录 + `.md`） | Task 1/2/3/5/8 |
| 多 Tab 打开/切换/关闭（dirty 确认） | Task 7/9 |
| 新建 / 另存为 / 重命名 / 删除 / 在文件夹中显示 | Task 4/5/6/9 |
| 自动保存（500ms 防抖 + 切/关前 flush） | Task 9 |
| 最近打开（SQLite 持久化，重启保留） | Task 2/5/6/9 |
| 正式布局 + 极简 UI | Task 8/9 |
| `settings` + `recent_files` 表（迁移 002） | Task 2 |
| main service/树/store/path/debounce 单测 | Task 2/3/4/7/9 |
| `pnpm test` 全绿 + typecheck + build | 各任务 |

> 注：用户/系统 demo 模块（`UserManage`/`user`/`system`）在 A 已暂停渲染但文件保留。本计划按已确认的 B spec 范围**不删除**它们（仍注册、仍通过 `user.example.test.ts`），留待后续清理任务统一移除，避免超出本子项目边界。
