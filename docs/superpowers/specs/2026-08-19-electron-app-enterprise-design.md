# Electron 企业级桌面应用改造设计

- 日期：2026-08-19
- 状态：已确认，待实现

## 1. 背景与目标

将现有的 create-umi 脚手架（Umi 4.7.6 + pnpm，仅两个示例页面）改造成一个基于
React + antd + Electron 的企业级桌面应用，数据库使用 SQLite。

## 2. 范围

### 2.1 目标内

- electron-vite + React + antd v5 工程骨架
- SQLite（better-sqlite3 原生 SQL）持久化
- 动态路由：菜单/路由表落库，运行时生成路由与侧边栏，提供「菜单管理」页
- 自定义主题：antd v5 ConfigProvider token，亮/暗 + 主色 + 紧凑模式 + 圆角
- 日志功能：运行日志（electron-log）+ 操作/审计日志（落库 + 查看页）
- 示例模块：仪表盘、菜单管理、操作日志、运行日志、主题设置

### 2.2 非目标

- 登录 / 认证（无登录，单用户进入）
- 权限 / RBAC（本次不做）
- E2E 测试（首期只做 Vitest 单测）
- 自动更新、多语言

## 3. 技术选型

| 层 | 选型 | 说明 |
|---|---|---|
| 构建 | electron-vite + electron-builder | 三进程分离、HMR 快 |
| 前端 | React 18 + TypeScript + antd v5 + @ant-design/icons | |
| 路由 | react-router-dom v6（HashRouter） | 生产走 file://，必须 hash |
| 状态 | zustand | 轻量、契合桌面端 |
| 数据库 | better-sqlite3 | 同步 API，契合主进程；native 依赖需 electron-rebuild |
| 日志 | electron-log | 主/渲染进程统一落文件 |
| 时间 | dayjs | antd v5 原生依赖 |

## 4. 架构

标准 Electron 三进程隔离模型：

- **main**：应用生命周期、窗口创建；独占 SQLite（better-sqlite3）与 electron-log；
  承载全部 IPC handler，通过 service 层访问数据库。
- **preload**：`contextBridge` 暴露类型化的 `window.api`。`contextIsolation: true`、
  `nodeIntegration: false`。
- **renderer**：纯前端 React SPA，通过 `window.api` 消费能力，不直接触碰 Node/SQLite。

数据流：`renderer -> window.api -> ipcRenderer.invoke -> ipcMain.handle -> service -> sqlite`。

## 5. 目录结构

```
src/
├── main/
│   ├── index.ts             # 应用入口、窗口、生命周期
│   ├── db/index.ts          # better-sqlite3 初始化
│   ├── db/migrate.ts        # 迁移执行器
│   ├── db/migrations/       # 版本化 SQL 文件
│   ├── services/            # menu / log / settings 各业务 service
│   ├── ipc/                 # IPC handler 注册（按域拆分）
│   └── logger.ts            # electron-log 配置
├── preload/index.ts         # contextBridge 暴露 window.api
├── shared/                  # 三方共享
│   ├── ipc.ts               # channel 常量
│   └── types.ts             # Menu / Log / Theme 等领域类型
└── renderer/src/
    ├── router/              # index.tsx(静态壳) + dynamic.tsx(菜单驱动) + componentRegistry
    ├── layouts/BasicLayout  # antd Layout + 侧边栏 + 顶栏
    ├── stores/              # zustand：app / menu / theme
    ├── api/                 # window.api 类型化封装
    └── pages/               # dashboard / system/{menu,log-operation,log-runtime,theme}
```

## 6. 数据模型（SQLite）

- **`menus`**：`id, parent_id, name, path, component, icon, sort, hidden, status, created_at, updated_at`
  —— 自引用树，同时驱动路由与侧边栏。
- **`operation_logs`**：`id, module, action, detail, operator, created_at` —— 操作/审计日志。
- **`settings`**：`key, value` —— 主题等 KV 配置。
- **`schema_version`**：迁移版本记录，版本化 SQL 文件按序执行；首次运行播种默认菜单。

## 7. 动态路由

1. 启动时 renderer 调 `api.menu.getTree()`。
2. 依据菜单树动态生成路由（组件经 `componentRegistry` 懒加载映射）。
3. 同一棵树渲染 antd 侧边栏菜单。
4. 「菜单管理」页：树形 CRUD、排序、显隐；`component` 字段从组件注册表校验。
5. 未知组件路径回退 404 页。

## 8. 自定义主题

- antd v5 `ConfigProvider`：`darkAlgorithm`/`defaultAlgorithm` + `token`
  （主色、圆角、字号、紧凑模式）。
- 主题落 `settings` 表，同时写 localStorage 做瞬时应用缓存。
- 「主题设置」页：亮/暗切换、主色取色器、紧凑模式、圆角，实时预览。

## 9. 日志功能

- **运行日志**：electron-log 在主进程写文件（`userData/logs`），渲染进程错误经 IPC
  转发统一记录；「运行日志」页按级别/尾部读取。
- **操作日志**：所有写操作（菜单增删改、主题修改等）落 `operation_logs`；「操作日志」页
  支持筛选与分页。

## 10. IPC 契约

统一 `{ ok, data, error }` 信封 + 错误码。通道：

- `menu.list` / `menu.create` / `menu.update` / `menu.delete` / `menu.move`
- `log.list` / `log.clear` / `log.readRuntime`
- `theme.get` / `theme.set`
- `settings.get` / `settings.set`
- `app.getVersion`

## 11. 错误处理

- IPC handler 统一 try/catch，返回类型化错误。
- renderer 全局 ErrorBoundary + antd `message` 提示。
- 主进程未捕获异常 → electron-log + 对话框。

## 12. 测试

Vitest 单测：renderer 的 store/工具函数；main 的 service 层用 `:memory:` SQLite。

## 13. 打包

electron-builder：Windows(NSIS)/macOS(dmg)/Linux(AppImage)；`install-app-deps`
处理 better-sqlite3 native 重编译。

## 14. 验收标准

1. `pnpm dev` 启动，出现桌面窗口与 antd 布局。
2. 侧边栏菜单由 SQLite 数据动态渲染，增删改菜单后路由/菜单同步变化。
3. 切换亮/暗、修改主色后即时生效并持久化（重启后保留）。
4. 操作任一写动作后，「操作日志」页可查到记录。
5. 「运行日志」页可查看日志文件内容。
6. `pnpm test` 单测通过。
