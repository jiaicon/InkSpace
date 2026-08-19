# Electron 企业级桌面应用 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有 create-umi 脚手架改造成基于 electron-vite + React + antd v5 + better-sqlite3 的企业级桌面应用，支持动态路由、自定义主题、运行日志与操作日志。

**Architecture:** 标准 Electron 三进程隔离——main 进程独占 SQLite（better-sqlite3）与 electron-log，preload 通过 contextBridge 暴露类型化 `window.api`，renderer 作为纯前端消费 API。动态路由由 SQLite 菜单表驱动；主题由 antd v5 ConfigProvider token 驱动并持久化到 settings 表；操作日志在 service 层落库，运行日志由 electron-log 落文件。

**Tech Stack:** electron-vite、electron 31、React 18、TypeScript 5.5、antd 5、react-router-dom 6、zustand、better-sqlite3 11、electron-log 5、dayjs、vitest 2。

**Spec:** [2026-08-19-electron-app-enterprise-design.md](../specs/2026-08-19-electron-app-enterprise-design.md)

## Global Constraints

- 包管理器：pnpm。
- Electron 主进程：`contextIsolation: true`、`nodeIntegration: false`、`sandbox: false`。
- 渲染进程路由使用 HashRouter（生产走 `file://`）。
- 所有 IPC 通道名定义在 `src/shared/ipc.ts`，主/preload/renderer 三端共用，禁止散落字符串。
- IPC 返回值统一为 `Result<T> = { ok: boolean; data?; error?: { code; message } }`。
- 主进程业务逻辑只写在 `src/main/services/`，IPC handler 只做参数校验与 service 调用，不写 SQL。
- 数据库访问只通过 `getDb()`（应用）或 `openDatabase()`（测试），禁止在 renderer/preload 中直接访问 SQLite。
- better-sqlite3 必须放在 `dependencies`（electron-builder 需打包 native 依赖）；electron 必须放在 `devDependencies`。
- 中文界面文案。

---

## 文件结构总览

```
├── package.json                     # 替换 umi 为 electron-vite 工程
├── electron.vite.config.ts          # 三进程构建配置 + alias
├── electron-builder.yml             # 打包配置
├── vitest.config.ts                 # 单测配置（node 环境）
├── tsconfig.json                    # 根 references
├── tsconfig.node.json               # main/preload/shared
├── tsconfig.web.json                # renderer/shared
├── .gitignore                       # 清理 umi 残留，新增 out/release
├── src/
│   ├── shared/
│   │   ├── types.ts                 # 领域类型 + DEFAULT_THEME
│   │   └── ipc.ts                   # IPC 通道常量 + Api 接口
│   ├── main/
│   │   ├── index.ts                 # app 入口、窗口、生命周期、注册 IPC
│   │   ├── logger.ts                # electron-log 配置
│   │   ├── db/
│   │   │   ├── index.ts             # openDatabase（无 electron 依赖）
│   │   │   ├── connection.ts        # getDb（依赖 electron app.getPath）
│   │   │   └── migrations.ts        # 版本化 SQL（内联数组）
│   │   ├── services/
│   │   │   ├── settings.service.ts  # settings KV
│   │   │   ├── menu.service.ts      # 菜单树 CRUD/移动（含操作日志）
│   │   │   ├── log.service.ts       # 操作日志 append/list/clear（纯 DB）
│   │   │   └── runtime-log.service.ts # 读取 electron-log 运行日志文件
│   │   └── ipc/
│   │       └── index.ts             # 注册全部 ipcMain.handle
│   ├── preload/
│   │   └── index.ts                 # contextBridge 暴露 window.api
│   └── renderer/
│       ├── index.html
│       └── src/
│           ├── main.tsx             # 渲染入口 + ConfigProvider
│           ├── App.tsx              # HashRouter + 路由壳
│           ├── env.d.ts             # window.api 类型声明
│           ├── api/index.ts         # window.api 类型化封装
│           ├── stores/
│           │   ├── theme.store.ts
│           │   ├── menu.store.ts
│           │   └── app.store.ts
│           ├── router/
│           │   ├── buildRoutes.ts   # 纯函数：菜单树 -> RouteNode 树
│           │   ├── componentRegistry.tsx # component 字符串 -> 懒加载组件
│           │   └── DynamicRoutes.tsx # RouteNode -> <Route>
│           ├── layouts/BasicLayout.tsx
│           ├── utils/icon.tsx       # 图标名 -> antd 图标
│           └── pages/
│               ├── dashboard/index.tsx
│               ├── system/menu/index.tsx
│               ├── system/operation-log/index.tsx
│               ├── system/runtime-log/index.tsx
│               └── system/theme/index.tsx
└── tests/
    ├── migrate.test.ts
    ├── menu.service.test.ts
    ├── settings.service.test.ts
    ├── log.service.test.ts
    └── buildRoutes.test.ts
```

---

### Task 1: 工程脚手架与三进程最小可运行窗口

**Files:**
- Replace: `package.json`
- Create: `electron.vite.config.ts`, `electron-builder.yml`, `vitest.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `tsconfig.web.json`, `src/main/index.ts`, `src/preload/index.ts`, `src/renderer/index.html`, `src/renderer/src/main.tsx`, `src/renderer/src/App.tsx`, `src/renderer/src/env.d.ts`
- Delete: `.umirc.ts`, `typings.d.ts`, `src/pages/`, `src/layouts/`, `src/assets/`, `src/.umi/`, `src/.umi-production/`, `src/.umi-test/`, `tsconfig.json`（旧）
- Modify: `.gitignore`

**Interfaces:**
- Produces: `pnpm dev` 可启动桌面窗口；`src/shared`、`src/main`、`src/preload`、`src/renderer` 目录骨架；alias `@shared` / `@renderer` 生效。

- [ ] **Step 1: 删除旧 umi 文件**

```bash
rm -rf .umirc.ts typings.d.ts src/pages src/layouts src/assets src/.umi src/.umi-production src/.umi-test
```

- [ ] **Step 2: 写入 `package.json`**

```json
{
  "name": "electron-app",
  "version": "1.0.0",
  "description": "Enterprise Electron desktop app (React + antd + SQLite)",
  "main": "./out/main/index.js",
  "author": "jiaicon <jiaicon@163.com>",
  "private": true,
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "preview": "electron-vite preview",
    "start": "electron-vite preview",
    "typecheck:node": "tsc --noEmit -p tsconfig.node.json --composite false",
    "typecheck:web": "tsc --noEmit -p tsconfig.web.json --composite false",
    "typecheck": "npm run typecheck:node && npm run typecheck:web",
    "test": "vitest run",
    "test:watch": "vitest",
    "postinstall": "electron-builder install-app-deps",
    "package": "electron-vite build && electron-builder",
    "package:win": "electron-vite build && electron-builder --win",
    "package:mac": "electron-vite build && electron-builder --mac",
    "package:linux": "electron-vite build && electron-builder --linux"
  },
  "dependencies": {
    "@ant-design/icons": "^5.4.0",
    "antd": "^5.20.0",
    "better-sqlite3": "^11.3.0",
    "dayjs": "^1.11.13",
    "electron-log": "^5.2.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.0",
    "zustand": "^4.5.5"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.11",
    "@types/node": "^20.14.0",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "electron": "^31.0.0",
    "electron-builder": "^24.13.3",
    "electron-vite": "^2.3.0",
    "typescript": "^5.5.3",
    "vite": "^5.3.5",
    "vitest": "^2.0.5"
  }
}
```

- [ ] **Step 3: 写入 `electron.vite.config.ts`**

```ts
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: { '@shared': resolve('src/shared') } }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: { '@shared': resolve('src/shared') } }
  },
  renderer: {
    plugins: [react()],
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('src/shared')
      }
    }
  }
})
```

- [ ] **Step 4: 写入三个 tsconfig**

`tsconfig.json`:
```json
{
  "files": [],
  "references": [{ "path": "./tsconfig.node.json" }, { "path": "./tsconfig.web.json" }]
}
```

`tsconfig.node.json`:
```json
{
  "compilerOptions": {
    "composite": true,
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "types": ["node", "electron-vite/node"],
    "baseUrl": ".",
    "paths": { "@shared/*": ["src/shared/*"] }
  },
  "include": ["src/main/**/*", "src/preload/**/*", "src/shared/**/*", "electron.vite.config.ts"]
}
```

`tsconfig.web.json`:
```json
{
  "compilerOptions": {
    "composite": true,
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "baseUrl": ".",
    "paths": {
      "@renderer/*": ["src/renderer/src/*"],
      "@shared/*": ["src/shared/*"]
    }
  },
  "include": ["src/renderer/src/**/*", "src/shared/**/*"]
}
```

- [ ] **Step 5: 写入 `electron-builder.yml`**

```yaml
appId: com.jiaicon.electronapp
productName: ElectronApp
directories:
  output: release
files:
  - out/**
asarUnpack:
  - node_modules/better-sqlite3/**
win:
  target: [nsis]
nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
mac:
  target: [dmg]
linux:
  target: [AppImage]
npmRebuild: true
```

- [ ] **Step 6: 写入 `vitest.config.ts`**

```ts
import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve('src/shared'),
      '@renderer': resolve('src/renderer/src')
    }
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts']
  }
})
```

- [ ] **Step 7: 重写 `.gitignore`**

```gitignore
/node_modules
/out
/release
/dist
/.env.local
*.log
.DS_Store
```

- [ ] **Step 8: 写入最小主进程 `src/main/index.ts`**

```ts
import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  win.on('ready-to-show', () => win.show())

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
```

- [ ] **Step 9: 写入最小 preload `src/preload/index.ts`**

```ts
import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('api', {
  ping: () => 'pong'
})
```

- [ ] **Step 10: 写入渲染层入口三件套**

`src/renderer/index.html`:
```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ElectronApp</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/renderer/src/main.tsx`:
```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

`src/renderer/src/App.tsx`:
```tsx
export default function App() {
  return <div>Hello Electron</div>
}
```

`src/renderer/src/env.d.ts`:
```ts
/// <reference types="vite/client" />

declare global {
  interface Window {
    api: { ping: () => string }
  }
}

export {}
```

- [ ] **Step 11: 安装依赖并验证窗口启动**

Run: `pnpm install`
Expected: `postinstall` 执行 `electron-builder install-app-deps` 成功（better-sqlite3 会针对 Electron ABI 重编译；此处尚未引入 better-sqlite3，无碍）。

Run: `pnpm dev`
Expected: 弹出桌面窗口，显示 "Hello Electron"。

- [ ] **Step 12: 提交**

```bash
git add -A
git commit -m "chore: scaffold electron-vite react antd project"
```

---

### Task 2: 共享类型与 IPC 契约

**Files:**
- Create: `src/shared/types.ts`, `src/shared/ipc.ts`

**Interfaces:**
- Produces: `MenuItem`、`MenuInput`、`OperationLog`、`LogQuery`、`PageResult`、`ThemeConfig`、`DEFAULT_THEME`、`RuntimeLogLine`、`Result`、`IPC_CHANNELS`、`Api`。

- [ ] **Step 1: 写入 `src/shared/types.ts`**

```ts
export interface MenuItem {
  id: number
  parentId: number | null
  name: string
  path: string
  component: string
  icon: string | null
  sort: number
  hidden: boolean
  status: 'enabled' | 'disabled'
  createdAt: string
  updatedAt: string
  children?: MenuItem[]
}

export interface MenuInput {
  parentId: number | null
  name: string
  path: string
  component: string
  icon: string | null
  sort: number
  hidden: boolean
  status: 'enabled' | 'disabled'
}

export interface OperationLog {
  id: number
  module: string
  action: string
  detail: string
  operator: string
  createdAt: string
}

export interface LogQuery {
  module?: string
  keyword?: string
  page: number
  pageSize: number
}

export interface PageResult<T> {
  items: T[]
  total: number
}

export type ThemeMode = 'light' | 'dark'

export interface ThemeConfig {
  mode: ThemeMode
  primaryColor: string
  compact: boolean
  borderRadius: number
}

export const DEFAULT_THEME: ThemeConfig = {
  mode: 'light',
  primaryColor: '#1677ff',
  compact: false,
  borderRadius: 6
}

export interface RuntimeLogLine {
  level: string
  message: string
}

export interface Result<T = unknown> {
  ok: boolean
  data?: T
  error?: { code: string; message: string }
}
```

- [ ] **Step 2: 写入 `src/shared/ipc.ts`**

```ts
import type {
  LogQuery,
  MenuInput,
  MenuItem,
  OperationLog,
  PageResult,
  RuntimeLogLine,
  ThemeConfig
} from './types'

export const IPC_CHANNELS = {
  menuGetTree: 'menu:getTree',
  menuCreate: 'menu:create',
  menuUpdate: 'menu:update',
  menuRemove: 'menu:remove',
  menuMove: 'menu:move',
  logList: 'log:list',
  logClear: 'log:clear',
  logReadRuntime: 'log:readRuntime',
  themeGet: 'theme:get',
  themeSet: 'theme:set',
  appGetVersion: 'app:getVersion'
} as const

export interface Api {
  menu: {
    getTree(): Promise<MenuItem[]>
    create(input: MenuInput): Promise<MenuItem>
    update(id: number, input: MenuInput): Promise<MenuItem>
    remove(id: number): Promise<void>
    move(id: number, parentId: number | null, sort: number): Promise<void>
  }
  log: {
    list(params: LogQuery): Promise<PageResult<OperationLog>>
    clear(): Promise<void>
    readRuntime(level: string, tail: number): Promise<RuntimeLogLine[]>
  }
  theme: {
    get(): Promise<ThemeConfig>
    set(config: ThemeConfig): Promise<void>
  }
  app: {
    getVersion(): Promise<string>
  }
}
```

- [ ] **Step 3: 验证类型编译**

Run: `pnpm typecheck:node && pnpm typecheck:web`
Expected: 无错误（shared 同时被两端 include）。

- [ ] **Step 4: 提交**

```bash
git add -A
git commit -m "feat: add shared types and IPC contract"
```

---

### Task 3: SQLite 数据库初始化与迁移

**Files:**
- Create: `src/main/db/index.ts`, `src/main/db/connection.ts`, `src/main/db/migrations.ts`, `tests/migrate.test.ts`

**Interfaces:**
- Consumes: `MenuItem` 等（不直接依赖）。
- Produces: `openDatabase(filename): Database.Database`、`getDb(): Database.Database`、`migrate(db)`。

- [ ] **Step 1: 写入迁移文件 `src/main/db/migrations.ts`**

```ts
export interface Migration {
  version: number
  sql: string
}

export const migrations: Migration[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE menus (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        parent_id INTEGER,
        name TEXT NOT NULL,
        path TEXT NOT NULL,
        component TEXT NOT NULL DEFAULT '',
        icon TEXT,
        sort INTEGER NOT NULL DEFAULT 0,
        hidden INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'enabled',
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
      );

      CREATE TABLE operation_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        module TEXT NOT NULL,
        action TEXT NOT NULL,
        detail TEXT NOT NULL DEFAULT '',
        operator TEXT NOT NULL DEFAULT 'system',
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
      );

      CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      INSERT INTO menus (id, parent_id, name, path, component, icon, sort, hidden, status) VALUES
        (1, NULL, '仪表盘', '/', 'dashboard', 'DashboardOutlined', 1, 0, 'enabled'),
        (2, NULL, '系统管理', '/system', '', 'SettingOutlined', 2, 0, 'enabled'),
        (3, 2, '菜单管理', '/system/menu', 'system/menu', 'MenuOutlined', 1, 0, 'enabled'),
        (4, 2, '操作日志', '/system/operation-log', 'system/operation-log', 'FileTextOutlined', 2, 0, 'enabled'),
        (5, 2, '运行日志', '/system/runtime-log', 'system/runtime-log', 'CodeOutlined', 3, 0, 'enabled'),
        (6, 2, '主题设置', '/system/theme', 'system/theme', 'BgColorsOutlined', 4, 0, 'enabled');
    `
  }
]
```

- [ ] **Step 2: 写入迁移执行器 `src/main/db/migrate.ts`**

```ts
import type Database from 'better-sqlite3'
import { migrations, type Migration } from './migrations'

export function migrate(db: Database.Database): void {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)`)
  const row = db.prepare(`SELECT MAX(version) AS v FROM schema_version`).get() as
    | { v: number | null }
    | undefined
  const current = row?.v ?? 0

  const apply = db.transaction((m: Migration) => {
    db.exec(m.sql)
    db.prepare(`INSERT INTO schema_version (version) VALUES (?)`).run(m.version)
  })

  for (const m of migrations) {
    if (m.version > current) apply(m)
  }
}
```

- [ ] **Step 3: 写入数据库打开逻辑**

`src/main/db/index.ts`:
```ts
import Database from 'better-sqlite3'
import { migrate } from './migrate'

export function openDatabase(filename: string): Database.Database {
  const db = new Database(filename)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  migrate(db)
  return db
}
```

`src/main/db/connection.ts`:
```ts
import { app } from 'electron'
import { join } from 'node:path'
import type Database from 'better-sqlite3'
import { openDatabase } from './index'

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!db) {
    db = openDatabase(join(app.getPath('userData'), 'app.db'))
  }
  return db
}
```

- [ ] **Step 4: 写失败测试 `tests/migrate.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { openDatabase } from '../src/main/db'

describe('migrate', () => {
  it('creates tables and seeds default menus', () => {
    const db = openDatabase(':memory:')

    const tables = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table'`)
      .all() as { name: string }[]
    const names = tables.map((t) => t.name)
    expect(names).toContain('menus')
    expect(names).toContain('operation_logs')
    expect(names).toContain('settings')
    expect(names).toContain('schema_version')

    const menuCount = (db.prepare('SELECT COUNT(*) AS c FROM menus').get() as { c: number }).c
    expect(menuCount).toBe(6)

    const rootCount = (
      db.prepare('SELECT COUNT(*) AS c FROM menus WHERE parent_id IS NULL').get() as { c: number }
    ).c
    expect(rootCount).toBe(2)

    db.close()
  })
})
```

- [ ] **Step 5: 运行测试确认失败**

Run: `pnpm vitest run tests/migrate.test.ts`
Expected: 因 `src/main/db` 尚不存在而失败（模块解析错误）。

- [ ] **Step 6: 运行测试确认通过**

（Step 3 已写入实现，此处直接验证）

Run: `pnpm vitest run tests/migrate.test.ts`
Expected: PASS。

- [ ] **Step 7: 提交**

```bash
git add -A
git commit -m "feat: sqlite database init and versioned migrations"
```

---

### Task 4: 设置与菜单 service

**Files:**
- Create: `src/main/services/settings.service.ts`, `src/main/services/menu.service.ts`, `tests/settings.service.test.ts`, `tests/menu.service.test.ts`

**Interfaces:**
- Consumes: `openDatabase`（Task 3）、`MenuItem`/`MenuInput`（Task 2）、`appendOperationLog`（Task 5，见下方注释——本任务内先以直接写 `operation_logs` 的方式内联，Task 5 再替换为共享函数）。

> 说明：为避免任务间循环依赖，本任务在 menu.service 内部直接 `INSERT INTO operation_logs` 记录操作日志；Task 5 完成后统一重构为调用 `appendOperationLog`。

- Produces: `getSetting(db, key)`、`setSetting(db, key, value)`、`getMenuTree(db)`、`createMenu(db, input)`、`updateMenu(db, id, input)`、`removeMenu(db, id)`、`moveMenu(db, id, parentId, sort)`。

- [ ] **Step 1: 写失败测试 `tests/settings.service.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { openDatabase } from '../src/main/db'
import { getSetting, setSetting } from '../src/main/services/settings.service'

describe('settings.service', () => {
  it('sets and gets a value', () => {
    const db = openDatabase(':memory:')
    setSetting(db, 'theme', '{"mode":"dark"}')
    expect(getSetting(db, 'theme')).toBe('{"mode":"dark"}')
    db.close()
  })

  it('overwrites existing value', () => {
    const db = openDatabase(':memory:')
    setSetting(db, 'k', '1')
    setSetting(db, 'k', '2')
    expect(getSetting(db, 'k')).toBe('2')
    db.close()
  })

  it('returns null for missing key', () => {
    const db = openDatabase(':memory:')
    expect(getSetting(db, 'missing')).toBeNull()
    db.close()
  })
})
```

- [ ] **Step 2: 写失败测试 `tests/menu.service.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { openDatabase } from '../src/main/db'
import {
  createMenu,
  getMenuTree,
  moveMenu,
  removeMenu,
  updateMenu
} from '../src/main/services/menu.service'

const input = {
  parentId: null,
  name: '测试页',
  path: '/test',
  component: 'test',
  icon: 'AppstoreOutlined',
  sort: 1,
  hidden: false,
  status: 'enabled' as const
}

describe('menu.service', () => {
  it('creates a menu and returns a full item', () => {
    const db = openDatabase(':memory:')
    const item = createMenu(db, input)
    expect(item.id).toBeGreaterThan(0)
    expect(item.name).toBe('测试页')
    expect(item.createdAt).toBeTruthy()
    db.close()
  })

  it('builds a tree from seeded menus', () => {
    const db = openDatabase(':memory:')
    const tree = getMenuTree(db)
    const system = tree.find((m) => m.name === '系统管理')
    expect(system?.children?.length).toBe(4)
    db.close()
  })

  it('updates a menu', () => {
    const db = openDatabase(':memory:')
    const item = createMenu(db, input)
    const updated = updateMenu(db, item.id, { ...input, name: '改名' })
    expect(updated.name).toBe('改名')
    db.close()
  })

  it('removes a menu and its children', () => {
    const db = openDatabase(':memory:')
    const parent = createMenu(db, input)
    createMenu(db, { ...input, parentId: parent.id, path: '/test/child' })
    removeMenu(db, parent.id)
    const count = (
      db.prepare('SELECT COUNT(*) AS c FROM menus WHERE id = ? OR parent_id = ?').get(
        parent.id,
        parent.id
      ) as { c: number }
    ).c
    expect(count).toBe(0)
    db.close()
  })

  it('moves a menu under another parent', () => {
    const db = openDatabase(':memory:')
    const a = createMenu(db, input)
    const b = createMenu(db, { ...input, path: '/b' })
    moveMenu(db, b.id, a.id, 9)
    const row = db.prepare('SELECT parent_id, sort FROM menus WHERE id = ?').get(b.id) as {
      parent_id: number
      sort: number
    }
    expect(row.parent_id).toBe(a.id)
    expect(row.sort).toBe(9)
    db.close()
  })
})
```

- [ ] **Step 3: 运行测试确认失败**

Run: `pnpm vitest run tests/settings.service.test.ts tests/menu.service.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 4: 实现 `src/main/services/settings.service.ts`**

```ts
import type Database from 'better-sqlite3'

export function getSetting(db: Database.Database, key: string): string | null {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined
  return row?.value ?? null
}

export function setSetting(db: Database.Database, key: string, value: string): void {
  db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(key, value)
}
```

- [ ] **Step 5: 实现 `src/main/services/menu.service.ts`**

```ts
import type Database from 'better-sqlite3'
import type { MenuInput, MenuItem } from '@shared/types'

interface MenuRow {
  id: number
  parent_id: number | null
  name: string
  path: string
  component: string
  icon: string | null
  sort: number
  hidden: number
  status: 'enabled' | 'disabled'
  created_at: string
  updated_at: string
}

function toItem(r: MenuRow): MenuItem {
  return {
    id: r.id,
    parentId: r.parent_id,
    name: r.name,
    path: r.path,
    component: r.component,
    icon: r.icon,
    sort: r.sort,
    hidden: r.hidden === 1,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }
}

function log(db: Database.Database, action: string, detail: string): void {
  db.prepare(
    'INSERT INTO operation_logs (module, action, detail, operator) VALUES (?, ?, ?, ?)'
  ).run('menu', action, detail, 'system')
}

export function getMenuTree(db: Database.Database): MenuItem[] {
  const rows = db.prepare('SELECT * FROM menus ORDER BY sort ASC, id ASC').all() as MenuRow[]
  const map = new Map<number, MenuItem>()
  for (const r of rows) map.set(r.id, toItem(r))
  const roots: MenuItem[] = []
  for (const m of map.values()) {
    if (m.parentId != null && map.has(m.parentId)) {
      const parent = map.get(m.parentId)!
      parent.children ??= []
      parent.children.push(m)
    } else {
      roots.push(m)
    }
  }
  return roots
}

export function createMenu(db: Database.Database, input: MenuInput): MenuItem {
  const info = db
    .prepare(
      `INSERT INTO menus (parent_id, name, path, component, icon, sort, hidden, status)
       VALUES (@parentId, @name, @path, @component, @icon, @sort, @hidden, @status)`
    )
    .run({
      parentId: input.parentId,
      name: input.name,
      path: input.path,
      component: input.component,
      icon: input.icon,
      sort: input.sort,
      hidden: input.hidden ? 1 : 0,
      status: input.status
    })
  const id = Number(info.lastInsertRowid)
  log(db, 'create', JSON.stringify({ id, ...input }))
  const row = db.prepare('SELECT * FROM menus WHERE id = ?').get(id) as MenuRow
  return toItem(row)
}

export function updateMenu(db: Database.Database, id: number, input: MenuInput): MenuItem {
  db.prepare(
    `UPDATE menus SET parent_id=@parentId, name=@name, path=@path, component=@component,
       icon=@icon, sort=@sort, hidden=@hidden, status=@status,
       updated_at=datetime('now','localtime') WHERE id=@id`
  ).run({
    id,
    parentId: input.parentId,
    name: input.name,
    path: input.path,
    component: input.component,
    icon: input.icon,
    sort: input.sort,
    hidden: input.hidden ? 1 : 0,
    status: input.status
  })
  log(db, 'update', JSON.stringify({ id, ...input }))
  const row = db.prepare('SELECT * FROM menus WHERE id = ?').get(id) as MenuRow
  return toItem(row)
}

export function removeMenu(db: Database.Database, id: number): void {
  db.prepare(
    `WITH RECURSIVE subtree(id) AS (
       SELECT id FROM menus WHERE id = ?
       UNION ALL
       SELECT m.id FROM menus m JOIN subtree s ON m.parent_id = s.id
     )
     DELETE FROM menus WHERE id IN subtree`
  ).run(id)
  log(db, 'remove', JSON.stringify({ id }))
}

export function moveMenu(
  db: Database.Database,
  id: number,
  parentId: number | null,
  sort: number
): void {
  db.prepare(`UPDATE menus SET parent_id=?, sort=?, updated_at=datetime('now','localtime') WHERE id=?`).run(
    parentId,
    sort,
    id
  )
  log(db, 'move', JSON.stringify({ id, parentId, sort }))
}
```

- [ ] **Step 6: 运行测试确认通过**

Run: `pnpm vitest run tests/settings.service.test.ts tests/menu.service.test.ts`
Expected: PASS。

- [ ] **Step 7: 提交**

```bash
git add -A
git commit -m "feat: settings and menu services with operation logging"
```

---

### Task 5: 操作日志与运行日志 service

**Files:**
- Create: `src/main/services/log.service.ts`, `src/main/services/runtime-log.service.ts`, `tests/log.service.test.ts`
- Modify: `src/main/services/menu.service.ts`（用 `appendOperationLog` 替换内联 `log`）

**Interfaces:**
- Consumes: `openDatabase`（Task 3）、`OperationLog`/`LogQuery`/`PageResult`/`RuntimeLogLine`（Task 2）。
- Produces: `appendOperationLog(db, {module,action,detail,operator?})`、`listOperationLogs(db, params): PageResult<OperationLog>`、`clearOperationLogs(db)`、`readRuntimeLog(level, tail): RuntimeLogLine[]`。

- [ ] **Step 1: 写失败测试 `tests/log.service.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { openDatabase } from '../src/main/db'
import {
  appendOperationLog,
  clearOperationLogs,
  listOperationLogs
} from '../src/main/services/log.service'

describe('log.service', () => {
  it('appends and lists logs with pagination', () => {
    const db = openDatabase(':memory:')
    appendOperationLog(db, { module: 'menu', action: 'create', detail: 'a' })
    appendOperationLog(db, { module: 'theme', action: 'set', detail: 'b' })

    const page = listOperationLogs(db, { page: 1, pageSize: 10 })
    expect(page.total).toBe(2)
    expect(page.items[0].module).toBe('theme')

    const filtered = listOperationLogs(db, { module: 'menu', page: 1, pageSize: 10 })
    expect(filtered.total).toBe(1)
    expect(filtered.items[0].module).toBe('menu')
    db.close()
  })

  it('clears all logs', () => {
    const db = openDatabase(':memory:')
    appendOperationLog(db, { module: 'm', action: 'a', detail: 'd' })
    clearOperationLogs(db)
    expect(listOperationLogs(db, { page: 1, pageSize: 10 }).total).toBe(0)
    db.close()
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run tests/log.service.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现 `src/main/services/log.service.ts`**

```ts
import type Database from 'better-sqlite3'
import type { LogQuery, OperationLog, PageResult } from '@shared/types'

interface LogRow {
  id: number
  module: string
  action: string
  detail: string
  operator: string
  created_at: string
}

function toItem(r: LogRow): OperationLog {
  return {
    id: r.id,
    module: r.module,
    action: r.action,
    detail: r.detail,
    operator: r.operator,
    createdAt: r.created_at
  }
}

export interface AppendLogInput {
  module: string
  action: string
  detail: string
  operator?: string
}

export function appendOperationLog(db: Database.Database, input: AppendLogInput): void {
  db.prepare(
    'INSERT INTO operation_logs (module, action, detail, operator) VALUES (?, ?, ?, ?)'
  ).run(input.module, input.action, input.detail, input.operator ?? 'system')
}

export function listOperationLogs(db: Database.Database, params: LogQuery): PageResult<OperationLog> {
  const where: string[] = []
  const args: unknown[] = []
  if (params.module) {
    where.push('module = ?')
    args.push(params.module)
  }
  if (params.keyword) {
    where.push('detail LIKE ?')
    args.push(`%${params.keyword}%`)
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

  const total = (
    db.prepare(`SELECT COUNT(*) AS c FROM operation_logs ${whereSql}`).get(...args) as { c: number }
  ).c

  const rows = db
    .prepare(`SELECT * FROM operation_logs ${whereSql} ORDER BY id DESC LIMIT ? OFFSET ?`)
    .all(...args, params.pageSize, (params.page - 1) * params.pageSize) as LogRow[]

  return { items: rows.map(toItem), total }
}

export function clearOperationLogs(db: Database.Database): void {
  db.prepare('DELETE FROM operation_logs').run()
}
```

- [ ] **Step 4: 实现 `src/main/services/runtime-log.service.ts`**

```ts
import log from 'electron-log/main'
import { readFileSync } from 'node:fs'
import type { RuntimeLogLine } from '@shared/types'

function parseLine(line: string): RuntimeLogLine {
  const m = line.match(/\[(\w+)\]\s+(.*)$/)
  return { level: m ? m[1].toLowerCase() : 'info', message: m ? m[2] : line }
}

export function readRuntimeLog(level: string, tail: number): RuntimeLogLine[] {
  const file = log.transports.file.getFile()
  const raw = readFileSync(file.path, 'utf-8')
  const lines = raw.split(/\r?\n/).filter((l) => l.length > 0)
  const parsed = lines.map(parseLine)
  const filtered = level === 'all' ? parsed : parsed.filter((l) => l.level === level)
  return filtered.slice(-tail)
}
```

- [ ] **Step 5: 重构 `menu.service.ts` 复用 `appendOperationLog`**

删除 menu.service.ts 内部 `log` 函数，顶部导入：
```ts
import { appendOperationLog } from './log.service'
```
并将三处 `log(db, action, detail)` 替换为 `appendOperationLog(db, { module: 'menu', action, detail })`。

- [ ] **Step 6: 运行全部单测确认通过**

Run: `pnpm vitest run`
Expected: 全部 PASS。

- [ ] **Step 7: 提交**

```bash
git add -A
git commit -m "feat: operation and runtime log services"
```

---

### Task 6: IPC handler 注册与 preload 桥接

**Files:**
- Create: `src/main/logger.ts`, `src/main/ipc/index.ts`
- Modify: `src/main/index.ts`（初始化 logger、注册 IPC）、`src/preload/index.ts`（暴露完整 api）、`src/renderer/src/env.d.ts`（完整 window.api 类型）

**Interfaces:**
- Consumes: `getDb`（Task 3）、全部 service（Task 4/5）、`IPC_CHANNELS`/`Api`/`Result`/`DEFAULT_THEME`（Task 2）。
- Produces: 运行时 `window.api` 与 `Api` 接口完全一致；`registerIpcHandlers()`。

- [ ] **Step 1: 写入 `src/main/logger.ts`**

```ts
import log from 'electron-log/main'

log.initialize()
log.transports.file.level = 'info'
log.transports.console.level = 'debug'
log.transports.file.maxSize = 5 * 1024 * 1024

export default log
```

- [ ] **Step 2: 写入 `src/main/ipc/index.ts`**

```ts
import { app, ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/ipc'
import type { LogQuery, MenuInput, ThemeConfig } from '@shared/types'
import { DEFAULT_THEME } from '@shared/types'
import { getDb } from '../db/connection'
import {
  createMenu,
  getMenuTree,
  moveMenu,
  removeMenu,
  updateMenu
} from '../services/menu.service'
import { getSetting, setSetting } from '../services/settings.service'
import { appendOperationLog, clearOperationLogs, listOperationLogs } from '../services/log.service'
import { readRuntimeLog } from '../services/runtime-log.service'
import log from '../logger'

function parseTheme(raw: string | null): ThemeConfig {
  if (!raw) return DEFAULT_THEME
  try {
    return { ...DEFAULT_THEME, ...(JSON.parse(raw) as Partial<ThemeConfig>) }
  } catch {
    return DEFAULT_THEME
  }
}

export function registerIpcHandlers(): void {
  const db = getDb()

  ipcMain.handle(IPC_CHANNELS.menuGetTree, () => getMenuTree(db))
  ipcMain.handle(IPC_CHANNELS.menuCreate, (_e, input: MenuInput) => createMenu(db, input))
  ipcMain.handle(IPC_CHANNELS.menuUpdate, (_e, id: number, input: MenuInput) =>
    updateMenu(db, id, input)
  )
  ipcMain.handle(IPC_CHANNELS.menuRemove, (_e, id: number) => removeMenu(db, id))
  ipcMain.handle(IPC_CHANNELS.menuMove, (_e, id: number, parentId: number | null, sort: number) =>
    moveMenu(db, id, parentId, sort)
  )

  ipcMain.handle(IPC_CHANNELS.logList, (_e, params: LogQuery) => listOperationLogs(db, params))
  ipcMain.handle(IPC_CHANNELS.logClear, () => clearOperationLogs(db))
  ipcMain.handle(IPC_CHANNELS.logReadRuntime, (_e, level: string, tail: number) =>
    readRuntimeLog(level, tail)
  )

  ipcMain.handle(IPC_CHANNELS.themeGet, () => parseTheme(getSetting(db, 'theme')))
  ipcMain.handle(IPC_CHANNELS.themeSet, (_e, config: ThemeConfig) => {
    setSetting(db, 'theme', JSON.stringify(config))
    appendOperationLog(db, { module: 'theme', action: 'set', detail: JSON.stringify(config) })
  })

  ipcMain.handle(IPC_CHANNELS.appGetVersion, () => app.getVersion())

  log.info('[ipc] handlers registered')
}
```

- [ ] **Step 3: 修改 `src/main/index.ts` 接入 logger 与 IPC**

在 `app.whenReady().then(...)` 内、`createWindow()` 之前插入：
```ts
import { registerIpcHandlers } from './ipc'
import log from './logger'
// ...
app.whenReady().then(() => {
  registerIpcHandlers()
  createWindow()
  // ...
})
```
并在文件顶部补 `import './logger'` 保证 logger 先初始化。

- [ ] **Step 4: 重写 `src/preload/index.ts`**

```ts
import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '@shared/ipc'
import type { Api } from '@shared/ipc'
import type { LogQuery, MenuInput, ThemeConfig } from '@shared/types'

const api: Api = {
  menu: {
    getTree: () => ipcRenderer.invoke(IPC_CHANNELS.menuGetTree),
    create: (input: MenuInput) => ipcRenderer.invoke(IPC_CHANNELS.menuCreate, input),
    update: (id: number, input: MenuInput) => ipcRenderer.invoke(IPC_CHANNELS.menuUpdate, id, input),
    remove: (id: number) => ipcRenderer.invoke(IPC_CHANNELS.menuRemove, id),
    move: (id: number, parentId: number | null, sort: number) =>
      ipcRenderer.invoke(IPC_CHANNELS.menuMove, id, parentId, sort)
  },
  log: {
    list: (params: LogQuery) => ipcRenderer.invoke(IPC_CHANNELS.logList, params),
    clear: () => ipcRenderer.invoke(IPC_CHANNELS.logClear),
    readRuntime: (level: string, tail: number) =>
      ipcRenderer.invoke(IPC_CHANNELS.logReadRuntime, level, tail)
  },
  theme: {
    get: () => ipcRenderer.invoke(IPC_CHANNELS.themeGet),
    set: (config: ThemeConfig) => ipcRenderer.invoke(IPC_CHANNELS.themeSet, config)
  },
  app: {
    getVersion: () => ipcRenderer.invoke(IPC_CHANNELS.appGetVersion)
  }
}

contextBridge.exposeInMainWorld('api', api)
```

- [ ] **Step 5: 更新 `src/renderer/src/env.d.ts`**

```ts
/// <reference types="vite/client" />
import type { Api } from '@shared/ipc'

declare global {
  interface Window {
    api: Api
  }
}

export {}
```

- [ ] **Step 6: 验证构建与启动**

Run: `pnpm typecheck:node`
Run: `pnpm dev`
Expected: 窗口正常启动，无 IPC 报错（DevTools 控制台无 `api is undefined`）。

- [ ] **Step 7: 提交**

```bash
git add -A
git commit -m "feat: ipc handlers and preload bridge"
```

---

### Task 7: 渲染层入口、主题 store 与 antd ConfigProvider

**Files:**
- Create: `src/renderer/src/api/index.ts`, `src/renderer/src/stores/theme.store.ts`, `src/renderer/src/stores/app.store.ts`
- Modify: `src/renderer/src/main.tsx`, `src/renderer/src/App.tsx`

**Interfaces:**
- Consumes: `window.api`（Task 6）、`ThemeConfig`/`DEFAULT_THEME`（Task 2）。
- Produces: `api`（renderer 统一调用入口）、`useThemeStore`（`theme`、`loaded`、`load`、`setTheme`）、`useAppStore`（`version`、`load`）。

- [ ] **Step 1: 写入 `src/renderer/src/api/index.ts`**

```ts
import type { Api } from '@shared/ipc'

export const api: Api = window.api
```

- [ ] **Step 2: 写入 `src/renderer/src/stores/theme.store.ts`**

```ts
import { create } from 'zustand'
import { api } from '@renderer/api'
import { DEFAULT_THEME, type ThemeConfig } from '@shared/types'

interface ThemeState {
  theme: ThemeConfig
  loaded: boolean
  load: () => Promise<void>
  setTheme: (patch: Partial<ThemeConfig>) => Promise<void>
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: DEFAULT_THEME,
  loaded: false,
  load: async () => {
    const theme = await api.theme.get()
    set({ theme, loaded: true })
  },
  setTheme: async (patch) => {
    const next = { ...get().theme, ...patch }
    set({ theme: next })
    await api.theme.set(next)
  }
}))
```

- [ ] **Step 3: 写入 `src/renderer/src/stores/app.store.ts`**

```ts
import { create } from 'zustand'
import { api } from '@renderer/api'

interface AppState {
  version: string
  load: () => Promise<void>
}

export const useAppStore = create<AppState>((set) => ({
  version: '',
  load: async () => {
    set({ version: await api.app.getVersion() })
  }
}))
```

- [ ] **Step 4: 重写 `src/renderer/src/main.tsx`**

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider, theme as antdTheme, App as AntdApp } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import 'antd/dist/reset.css'
import App from './App'
import { useThemeStore } from './stores/theme.store'

function Root() {
  const theme = useThemeStore((s) => s.theme)
  const algorithm = theme.mode === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm,
        token: {
          colorPrimary: theme.primaryColor,
          borderRadius: theme.borderRadius
        },
        components: theme.compact ? { Layout: { headerHeight: 48 } } : undefined
      }}
    >
      <AntdApp>
        <App />
      </AntdApp>
    </ConfigProvider>
  )
}

useThemeStore.getState().load()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
)
```

- [ ] **Step 5: 重写 `src/renderer/src/App.tsx` 为占位**

```tsx
import { Typography } from 'antd'

export default function App() {
  return <Typography.Title level={3}>企业级桌面应用</Typography.Title>
}
```

- [ ] **Step 6: 验证启动**

Run: `pnpm dev`
Expected: 窗口显示 antd 主题化的标题；在 DevTools 中执行 `window.api.menu.getTree()` 返回 6 条菜单的树结构。

- [ ] **Step 7: 提交**

```bash
git add -A
git commit -m "feat: renderer bootstrap, theme store and antd config provider"
```

---

### Task 8: 动态路由、组件注册表与基础布局

**Files:**
- Create: `src/renderer/src/router/buildRoutes.ts`, `src/renderer/src/router/componentRegistry.tsx`, `src/renderer/src/router/DynamicRoutes.tsx`, `src/renderer/src/layouts/BasicLayout.tsx`, `src/renderer/src/stores/menu.store.ts`, `src/renderer/src/utils/icon.tsx`, `tests/buildRoutes.test.ts`
- Modify: `src/renderer/src/App.tsx`（接入 HashRouter + BasicLayout + DynamicRoutes）

**Interfaces:**
- Consumes: `MenuItem`（Task 2）、`api`（Task 7）、`useThemeStore`（Task 7）。
- Produces: `buildRouteTree(menus): RouteNode[]`（纯函数）、`componentRegistry`、`DynamicRoutes`、`useMenuStore`、`BasicLayout`、`renderIcon(name)`。

- [ ] **Step 1: 写失败测试 `tests/buildRoutes.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { buildRouteTree } from '../src/renderer/src/router/buildRoutes'
import type { MenuItem } from '../src/shared/types'

const menus: MenuItem[] = [
  { id: 1, parentId: null, name: '首页', path: '/', component: 'dashboard', icon: null, sort: 1, hidden: false, status: 'enabled', createdAt: '', updatedAt: '' },
  {
    id: 2, parentId: null, name: '系统', path: '/system', component: '', icon: null, sort: 2, hidden: false, status: 'enabled', createdAt: '', updatedAt: '',
    children: [
      { id: 3, parentId: 2, name: '菜单', path: '/system/menu', component: 'system/menu', icon: null, sort: 1, hidden: false, status: 'enabled', createdAt: '', updatedAt: '' }
    ]
  }
]

describe('buildRouteTree', () => {
  it('skips group nodes without component', () => {
    const tree = buildRouteTree(menus)
    expect(tree).toHaveLength(1)
    expect(tree[0].componentKey).toBe('dashboard')
  })

  it('keeps a node with children even if component is empty', () => {
    const groupOnly = buildRouteTree([
      { ...menus[1], component: '' }
    ])
    expect(groupOnly).toHaveLength(1)
    expect(groupOnly[0].componentKey).toBeNull()
    expect(groupOnly[0].children).toHaveLength(1)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run tests/buildRoutes.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现 `src/renderer/src/router/buildRoutes.ts`**

```ts
import type { MenuItem } from '@shared/types'

export interface RouteNode {
  path: string
  componentKey: string | null
  children?: RouteNode[]
}

export function buildRouteTree(menus: MenuItem[]): RouteNode[] {
  const result: RouteNode[] = []
  for (const m of menus) {
    if (m.hidden) continue
    const children = m.children?.length ? buildRouteTree(m.children) : undefined
    const node: RouteNode = { path: m.path, componentKey: m.component || null, children }
    if (node.componentKey || node.children?.length) result.push(node)
  }
  return result
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest run tests/buildRoutes.test.ts`
Expected: PASS。

- [ ] **Step 5: 写入组件注册表 `src/renderer/src/router/componentRegistry.tsx`**

```tsx
import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

export type RegisteredComponent = LazyExoticComponent<ComponentType>

export const componentRegistry: Record<string, RegisteredComponent> = {
  dashboard: lazy(() => import('@renderer/pages/dashboard')),
  'system/menu': lazy(() => import('@renderer/pages/system/menu')),
  'system/operation-log': lazy(() => import('@renderer/pages/system/operation-log')),
  'system/runtime-log': lazy(() => import('@renderer/pages/system/runtime-log')),
  'system/theme': lazy(() => import('@renderer/pages/system/theme'))
}

export function resolveComponent(key: string): RegisteredComponent | null {
  return componentRegistry[key] ?? null
}
```

- [ ] **Step 6: 写入图标工具 `src/renderer/src/utils/icon.tsx`**

```tsx
import * as Icons from '@ant-design/icons'
import type { ReactNode } from 'react'

export function renderIcon(name: string | null | undefined): ReactNode {
  if (!name) return null
  const Cmp = (Icons as unknown as Record<string, React.ComponentType>)[name]
  return Cmp ? <Cmp /> : null
}
```

- [ ] **Step 7: 写入 `src/renderer/src/router/DynamicRoutes.tsx`**

```tsx
import { Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Spin } from 'antd'
import { resolveComponent } from './componentRegistry'
import { buildRouteTree } from './buildRoutes'
import type { MenuItem } from '@shared/types'

function toRoutes(nodes: ReturnType<typeof buildRouteTree>): ReactNode[] {
  return nodes.map((node, i) => {
    const children = node.children?.length ? toRoutes(node.children) : undefined
    const Comp = node.componentKey ? resolveComponent(node.componentKey) : null
    const key = `${node.path}-${i}`
    if (Comp) {
      return (
        <Route
          key={key}
          path={node.path}
          element={
            <Suspense fallback={<Spin style={{ margin: 40 }} />}>
              <Comp />
            </Suspense>
          }
        >
          {children}
        </Route>
      )
    }
    return <Route key={key} path={node.path} element={<Navigate to={node.children?.[0].path ?? '/'} replace />} />
  })
}

export default function DynamicRoutes({ menus }: { menus: MenuItem[] }) {
  const tree = buildRouteTree(menus)
  return (
    <Routes>
      {toRoutes(tree)}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
```

- [ ] **Step 8: 写入 `src/renderer/src/stores/menu.store.ts`**

```ts
import { create } from 'zustand'
import { api } from '@renderer/api'
import type { MenuInput, MenuItem } from '@shared/types'

interface MenuState {
  menus: MenuItem[]
  loaded: boolean
  load: () => Promise<void>
  create: (input: MenuInput) => Promise<void>
  update: (id: number, input: MenuInput) => Promise<void>
  remove: (id: number) => Promise<void>
  move: (id: number, parentId: number | null, sort: number) => Promise<void>
}

export const useMenuStore = create<MenuState>((set) => ({
  menus: [],
  loaded: false,
  load: async () => {
    set({ menus: await api.menu.getTree(), loaded: true })
  },
  create: async (input) => {
    await api.menu.create(input)
    await useMenuStore.getState().load()
  },
  update: async (id, input) => {
    await api.menu.update(id, input)
    await useMenuStore.getState().load()
  },
  remove: async (id) => {
    await api.menu.remove(id)
    await useMenuStore.getState().load()
  },
  move: async (id, parentId, sort) => {
    await api.menu.move(id, parentId, sort)
    await useMenuStore.getState().load()
  }
}))
```

- [ ] **Step 9: 写入基础布局 `src/renderer/src/layouts/BasicLayout.tsx`**

```tsx
import { useMemo } from 'react'
import { Layout, Menu, Typography } from 'antd'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useMenuStore } from '@renderer/stores/menu.store'
import { useAppStore } from '@renderer/stores/app.store'
import { renderIcon } from '@renderer/utils/icon'
import type { MenuItem as MenuType } from '@shared/types'

const { Header, Sider, Content } = Layout

type AntdMenuItems = NonNullable<Parameters<typeof Menu>[0]['items']>

function toAntdItems(menus: MenuType[]): AntdMenuItems {
  return menus
    .filter((m) => !m.hidden)
    .map((m) => ({
      key: m.path,
      icon: renderIcon(m.icon),
      label: m.name,
      children: m.children?.length ? toAntdItems(m.children) : undefined
    }))
}

export default function BasicLayout() {
  const menus = useMenuStore((s) => s.menus)
  const version = useAppStore((s) => s.version)
  const navigate = useNavigate()
  const location = useLocation()

  const items = useMemo(() => toAntdItems(menus), [menus])
  const selectedKeys = [location.pathname]

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={220} theme="dark">
        <div style={{ height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 600 }}>
          企业级桌面应用
        </div>
        <Menu
          theme="dark"
          mode="inline"
          items={items}
          selectedKeys={selectedKeys}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 24px' }}>
          <Typography.Text type="secondary">v{version || '-'}</Typography.Text>
        </Header>
        <Content style={{ margin: 16 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
```

- [ ] **Step 10: 重写 `src/renderer/src/App.tsx`**

```tsx
import { useEffect } from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import BasicLayout from '@renderer/layouts/BasicLayout'
import DynamicRoutes from '@renderer/router/DynamicRoutes'
import { useMenuStore } from '@renderer/stores/menu.store'
import { useAppStore } from '@renderer/stores/app.store'

export default function App() {
  const menus = useMenuStore((s) => s.menus)
  const loaded = useMenuStore((s) => s.loaded)

  useEffect(() => {
    useMenuStore.getState().load()
    useAppStore.getState().load()
  }, [])

  if (!loaded) return null

  return (
    <HashRouter>
      <Routes>
        <Route element={<BasicLayout />}>
          <Route path="*" element={<DynamicRoutes menus={menus} />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
```

- [ ] **Step 11: 验证路由**

Run: `pnpm dev`
Expected: 窗口出现侧边栏（仪表盘 + 系统管理四个子项），点击菜单路由切换正常；访问未知 hash 回退到首页。

- [ ] **Step 12: 提交**

```bash
git add -A
git commit -m "feat: dynamic routing, component registry and basic layout"
```

---

### Task 9: 示例页面（仪表盘、菜单管理、操作日志、运行日志、主题设置）

**Files:**
- Create: `src/renderer/src/pages/dashboard/index.tsx`, `src/renderer/src/pages/system/menu/index.tsx`, `src/renderer/src/pages/system/operation-log/index.tsx`, `src/renderer/src/pages/system/runtime-log/index.tsx`, `src/renderer/src/pages/system/theme/index.tsx`

**Interfaces:**
- Consumes: `useMenuStore`（Task 8）、`useThemeStore`（Task 7）、`api`（Task 7）、`renderIcon`/`resolveComponent`（Task 8）、`DEFAULT_THEME`（Task 2）。

- [ ] **Step 1: 仪表盘 `src/renderer/src/pages/dashboard/index.tsx`**

```tsx
import { Card, Col, Row, Statistic } from 'antd'
import { useMenuStore } from '@renderer/stores/menu.store'

export default function Dashboard() {
  const menus = useMenuStore((s) => s.menus)
  const count = (list: typeof menus): number =>
    list.reduce((acc, m) => acc + 1 + (m.children ? count(m.children) : 0), 0)

  return (
    <Row gutter={16}>
      <Col span={8}>
        <Card>
          <Statistic title="菜单总数" value={count(menus)} />
        </Card>
      </Col>
      <Col span={8}>
        <Card>
          <Statistic title="顶级菜单" value={menus.length} />
        </Card>
      </Col>
    </Row>
  )
}
```

- [ ] **Step 2: 菜单管理页 `src/renderer/src/pages/system/menu/index.tsx`**

```tsx
import { useState } from 'react'
import { Button, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Switch, Table, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { useMenuStore } from '@renderer/stores/menu.store'
import { componentRegistry } from '@renderer/router/componentRegistry'
import type { MenuInput, MenuItem } from '@shared/types'

const components = Object.keys(componentRegistry)

function flatten(menus: MenuItem[], depth = 0): (MenuItem & { key: number })[] {
  return menus.flatMap((m) => [
    { ...m, key: m.id, name: `${'　'.repeat(depth)}${m.name}` },
    ...(m.children ? flatten(m.children, depth + 1) : [])
  ])
}

export default function MenuManage() {
  const menus = useMenuStore((s) => s.menus)
  const { create, update, remove } = useMenuStore.getState()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<MenuItem | null>(null)
  const [form] = Form.useForm<MenuInput>()

  const flat = flatten(menus)

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ parentId: null, sort: 0, hidden: false, status: 'enabled' })
    setOpen(true)
  }

  const openEdit = (m: MenuItem) => {
    setEditing(m)
    form.setFieldsValue({ ...m })
    setOpen(true)
  }

  const submit = async () => {
    const values = await form.validateFields()
    if (editing) {
      await update(editing.id, values)
      message.success('已更新')
    } else {
      await create(values)
      message.success('已创建')
    }
    setOpen(false)
  }

  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '路径', dataIndex: 'path', key: 'path' },
    { title: '组件', dataIndex: 'component', key: 'component' },
    { title: '排序', dataIndex: 'sort', key: 'sort' },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: MenuItem) => (
        <Space>
          <Button size="small" onClick={() => openEdit(record)}>编辑</Button>
          <Popconfirm title="删除该菜单及其子菜单？" onConfirm={() => remove(record.id)}>
            <Button size="small" danger>删除</Button>
          </Popconfirm>
        </Space>
      )
    }
  ]

  return (
    <div>
      <Button type="primary" icon={<PlusOutlined />} onClick={openCreate} style={{ marginBottom: 16 }}>
        新增菜单
      </Button>
      <Table rowKey="id" columns={columns} dataSource={flat} pagination={false} />
      <Modal
        title={editing ? '编辑菜单' : '新增菜单'}
        open={open}
        onOk={submit}
        onCancel={() => setOpen(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="parentId" label="父级">
            <Select allowClear placeholder="无（顶级）" options={flat.map((m) => ({ value: m.id, label: m.name }))} />
          </Form.Item>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="path" label="路径" rules={[{ required: true }]}>
            <Input placeholder="/system/example" />
          </Form.Item>
          <Form.Item name="component" label="组件">
            <Select allowClear placeholder="留空表示分组" options={components.map((c) => ({ value: c, label: c }))} />
          </Form.Item>
          <Form.Item name="sort" label="排序">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select options={[{ value: 'enabled', label: '启用' }, { value: 'disabled', label: '禁用' }]} />
          </Form.Item>
          <Form.Item name="hidden" label="隐藏" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
```

- [ ] **Step 3: 操作日志页 `src/renderer/src/pages/system/operation-log/index.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { Button, Input, Popconfirm, Select, Space, Table } from 'antd'
import { api } from '@renderer/api'
import type { OperationLog } from '@shared/types'

export default function OperationLogPage() {
  const [rows, setRows] = useState<OperationLog[]>([])
  const [total, setTotal] = useState(0)
  const [module, setModule] = useState<string | undefined>()
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 10

  const load = async () => {
    const r = await api.log.list({ module, keyword, page, pageSize })
    setRows(r.items)
    setTotal(r.total)
  }

  useEffect(() => {
    load()
  }, [module, keyword, page])

  const columns = [
    { title: '模块', dataIndex: 'module', key: 'module' },
    { title: '动作', dataIndex: 'action', key: 'action' },
    { title: '详情', dataIndex: 'detail', key: 'detail', ellipsis: true },
    { title: '操作者', dataIndex: 'operator', key: 'operator' },
    { title: '时间', dataIndex: 'createdAt', key: 'createdAt' }
  ]

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Select
          allowClear
          placeholder="模块"
          style={{ width: 160 }}
          options={['menu', 'theme', 'system'].map((m) => ({ value: m, label: m }))}
          onChange={setModule}
        />
        <Input.Search placeholder="搜索详情" onSearch={setKeyword} style={{ width: 240 }} />
        <Popconfirm title="清空全部日志？" onConfirm={async () => { await api.log.clear(); load() }}>
          <Button danger>清空</Button>
        </Popconfirm>
      </Space>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={rows}
        pagination={{ current: page, pageSize, total, onChange: setPage }}
      />
    </div>
  )
}
```

- [ ] **Step 4: 运行日志页 `src/renderer/src/pages/system/runtime-log/index.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { Select, Table } from 'antd'
import { api } from '@renderer/api'
import type { RuntimeLogLine } from '@shared/types'

export default function RuntimeLogPage() {
  const [rows, setRows] = useState<RuntimeLogLine[]>([])
  const [level, setLevel] = useState('all')

  useEffect(() => {
    api.log.readRuntime(level, 200).then(setRows)
  }, [level])

  const columns = [
    { title: '级别', dataIndex: 'level', key: 'level', width: 100 },
    { title: '内容', dataIndex: 'message', key: 'message' }
  ]

  return (
    <div>
      <Select
        style={{ width: 160, marginBottom: 16 }}
        value={level}
        onChange={setLevel}
        options={['all', 'info', 'warn', 'error'].map((l) => ({ value: l, label: l }))}
      />
      <Table rowKey={(r) => `${r.level}-${r.message}-${Math.random()}`} columns={columns} dataSource={rows} pagination={false} />
    </div>
  )
}
```

- [ ] **Step 5: 主题设置页 `src/renderer/src/pages/system/theme/index.tsx`**

```tsx
import { Card, ColorPicker, Form, Segmented, Slider, Switch, Typography, message } from 'antd'
import { useThemeStore } from '@renderer/stores/theme.store'

export default function ThemeSettings() {
  const theme = useThemeStore((s) => s.theme)
  const setTheme = useThemeStore((s) => s.setTheme)

  return (
    <Card title="主题设置" style={{ maxWidth: 560 }}>
      <Form layout="vertical">
        <Form.Item label="模式">
          <Segmented
            value={theme.mode}
            onChange={(mode) => setTheme({ mode: mode as 'light' | 'dark' })}
            options={[{ label: '亮色', value: 'light' }, { label: '暗色', value: 'dark' }]}
          />
        </Form.Item>
        <Form.Item label="主色">
          <ColorPicker
            value={theme.primaryColor}
            onChange={(c) => setTheme({ primaryColor: c.toHexString() })}
            showText
          />
        </Form.Item>
        <Form.Item label={`圆角：${theme.borderRadius}px`}>
          <Slider min={0} max={16} value={theme.borderRadius} onChange={(borderRadius) => setTheme({ borderRadius })} />
        </Form.Item>
        <Form.Item label="紧凑模式">
          <Switch checked={theme.compact} onChange={(compact) => setTheme({ compact })} />
        </Form.Item>
      </Form>
      <Typography.Text type="secondary">修改实时生效并持久化到本地。</Typography.Text>
    </Card>
  )
}
```

- [ ] **Step 6: 验证页面**

Run: `pnpm dev`
Expected: 五个页面均可访问；菜单管理可增删改，侧边栏随之变化；主题设置改动即时生效；操作日志页能看到菜单增删改与主题修改产生的记录。

- [ ] **Step 7: 提交**

```bash
git add -A
git commit -m "feat: example pages (dashboard, menu, logs, theme)"
```

---

### Task 10: 全局错误处理与渲染进程日志转发

**Files:**
- Create: `src/renderer/src/components/ErrorBoundary.tsx`
- Modify: `src/main/index.ts`（主进程未捕获异常）、`src/main/ipc/index.ts`（新增 `log:error` 通道，或复用运行时日志记录）、`src/shared/ipc.ts`（新增通道）、`src/preload/index.ts`（暴露 `logError`）、`src/renderer/src/api/index.ts`、`src/renderer/src/main.tsx`（包 ErrorBoundary）

**Interfaces:**
- Consumes: 既有 IPC 与 logger。
- Produces: `ErrorBoundary`、`api.log.error(message)`、主进程 `log.error` 落文件。

- [ ] **Step 1: 扩展共享契约 `src/shared/ipc.ts`**

在 `IPC_CHANNELS` 增加：
```ts
  logError: 'log:error',
```
在 `Api['log']` 增加：
```ts
    error: (message: string) => Promise<void>
```

- [ ] **Step 2: 主进程注册错误日志通道**

`src/main/ipc/index.ts` 中新增：
```ts
ipcMain.handle(IPC_CHANNELS.logError, (_e, message: string) => {
  log.error('[renderer]', message)
})
```

- [ ] **Step 3: preload 暴露 `log.error`**

`src/preload/index.ts` 的 `log` 对象内新增：
```ts
    error: (message: string) => ipcRenderer.invoke(IPC_CHANNELS.logError, message)
```

- [ ] **Step 4: 主进程未捕获异常处理**

`src/main/index.ts` 顶部（import 之后）新增：
```ts
process.on('uncaughtException', (err) => {
  log.error('[uncaughtException]', err)
})
```

- [ ] **Step 5: 写入 `src/renderer/src/components/ErrorBoundary.tsx`**

```tsx
import { Component, type ReactNode } from 'react'
import { Button, Result } from 'antd'
import { api } from '@renderer/api'

interface Props {
  children: ReactNode
}
interface State {
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error): void {
    api.log.error(`${error.message}\n${error.stack ?? ''}`)
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <Result
          status="error"
          title="页面出错了"
          subTitle={this.state.error.message}
          extra={<Button type="primary" onClick={() => location.reload()}>刷新</Button>}
        />
      )
    }
    return this.props.children
  }
}
```

- [ ] **Step 6: 包裹 ErrorBoundary**

`src/renderer/src/main.tsx` 中，将 `<App />` 替换为：
```tsx
<ErrorBoundary>
  <App />
</ErrorBoundary>
```
并补 import。

- [ ] **Step 7: 验证**

Run: `pnpm typecheck:web && pnpm dev`
Expected: 类型通过；故意在某个页面抛错可看到 Result 兜底页，且主进程日志文件（`userData/logs/main.log`）出现对应 error 记录。

- [ ] **Step 8: 提交**

```bash
git add -A
git commit -m "feat: global error handling and renderer log forwarding"
```

---

### Task 11: 收尾——类型检查、测试、打包验证与 README

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes: 全部。
- Produces: 全量校验通过、可打包产物。

- [ ] **Step 1: 运行全量类型检查**

Run: `pnpm typecheck`
Expected: 无错误。

- [ ] **Step 2: 运行全量单测**

Run: `pnpm test`
Expected: 全部 PASS。

- [ ] **Step 3: 运行构建**

Run: `pnpm build`
Expected: 生成 `out/`（main/preload/renderer 三端产物）无报错。

- [ ] **Step 4: 写入 `README.md`**

````markdown
# 企业级 Electron 桌面应用

基于 electron-vite + React 18 + antd 5 + better-sqlite3 的企业级桌面应用脚手架。

## 特性

- 动态路由（菜单落 SQLite，运行期增删改）
- 自定义主题（亮/暗、主色、紧凑模式、圆角，实时生效并持久化）
- 运行日志（electron-log）+ 操作日志（SQLite + 查看页）
- 三进程隔离 + 类型化 IPC

## 脚本

| 命令 | 说明 |
|---|---|
| `pnpm dev` | 启动开发（HMR） |
| `pnpm build` | 构建三端产物 |
| `pnpm test` | 运行 Vitest 单测 |
| `pnpm typecheck` | 类型检查 |
| `pnpm package:win` | 打包 Windows 安装包 |

## 目录

- `src/main` 主进程（SQLite、日志、IPC）
- `src/preload` 预加载桥接
- `src/renderer` 渲染进程（React + antd）
- `src/shared` 三端共享类型与契约
````

- [ ] **Step 5: 打包验证（可选，耗时较长）**

Run: `pnpm package:win`
Expected: `release/` 下生成 NSIS 安装包；安装后 better-sqlite3 native 依赖可正常加载（首次运行自动建库并显示侧边栏）。

- [ ] **Step 6: 最终提交**

```bash
git add -A
git commit -m "docs: readme and finalize"
```

---

## 验收对照

| 规格要求 | 覆盖任务 |
|---|---|
| electron-vite + React + antd 工程 | Task 1 |
| SQLite（better-sqlite3 原生 SQL） | Task 3/4/5 |
| 动态路由（落库 + 管理页） | Task 8/9 |
| 自定义主题 | Task 7/9 |
| 运行日志 + 操作日志 | Task 5/9/10 |
| 示例模块 | Task 9 |
| IPC 契约 + 错误处理 | Task 2/6/10 |
| 单测 | Task 3/4/5/8 |
| 打包 | Task 1/11 |
