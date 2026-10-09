# TODO / 待办

> 这是**未设计完的功能积压清单**，不是 spec。每一项要动手时，按项目既有流程走：
> 能力级改动直接做；架构级先补 spec → 计划 → 实现（`docs/superpowers/`）。
>
> 生成于 2026-10-09。仓库当时的基线：`main`，326 测试全绿。

## 1. 多窗口编辑（把某个 md 单独开一个窗口）

**目标**：像 VSCode 那样，把一个文档从主窗口分离成独立窗口，还能合并回去。

**结论：可行，但不是"简单实现"，建议分两阶段。**

### 为什么核心不难

渲染进程已具备"按路径打开文件"的能力（`src/renderer/src/App.tsx` 的 `openFile(path)`，
Welcome 页 / 最近打开 / 外部「打开方式」都走它），且每个窗口各有一份自己的 zustand store
（`stores/workspace.ts`），所以**新窗口天然自带独立的多 Tab**。要加的只是让窗口可创建、可指定初开文件。

### 为什么整体不简单（三个真实代价）

1. **同一文件双开 = 静默丢数据（必须先解决）**
   `src/main/modules/file/service.ts:17` 的写入是裸 `writeFile(path, content, 'utf-8')`：
   整文件覆盖、**无 mtime / 无冲突检测**；而每个窗口都在 500ms 防抖后全量回写
   （`App.tsx` 的 `saveRef`）→ 后写的赢，另一边的编辑无声消失。
   而"拖出去再拖回来"会让这条路变成**常规路径**。
   → 二选一：**(a)** 禁止同一文件同时开在两个窗口（简单、可接受）；**(b)** 加冲突检测（比对 mtime，冲突时提示）。
2. **没有跨窗口广播**
   一个窗口改设置（主题 / 图片目录 / Markdown 主题）或改文件树（新建 / 重命名 / 删除），
   其它窗口不会跟着变。全仓没有 `webContents.getAllWebContents()` 广播。
   → 需要一层轻量广播：设置变更、文件树变更各推一次。
3. **拖拽分离 / 拖回合并（最贵的一块）**
   跨窗口 HTML5 拖拽 + 分离（源窗口移除 tab、新窗口接管）+ **关闭窗口时合并回源窗口**的状态交接。
   VSCode 为此做了专门的拖拽层。→ 放阶段 2。

### 两个必须先处理的小前提

- `src/main/modules/file/external.ts:5` 的 `pendingOpenPath` 是**全局单槽** → 多窗口下
  "这个文件交给哪个窗口"未定义。要么改成按窗口、要么改为创建窗口时的入参。
- `src/main/index.ts:68` 用 `BrowserWindow.getAllWindows()[0]` —— 假设只有一个窗口。
  而且 `getAllWindows()` **本来就不干净**：mermaid 的复用隐藏窗口（`export/mermaidRender.ts:33`）
  与导出 PDF 的 `show:false` 窗口（`export/service.ts:52`）都在里面。
  → 需要一个明确的"文档窗口"注册表（或给窗口打标记），别再用 `getAllWindows()` 猜。

### 阶段 1 —— **主体已实现（2026-10-09）**

已完成：

- [x] `src/main/index.ts`：`createWindow` → `createDocumentWindow(initialPath?)`，可复用、可带初始文件
- [x] 新增 `src/main/modules/window/`：**文档窗口注册表** + 双开守卫 + IPC。
      顺带修掉两处 `BrowserWindow.getAllWindows()` 的用法 —— 那里面混着 mermaid 的复用隐藏窗口
      与导出 PDF 的 `show:false` 窗口，多窗口下拿 `[0]` 猜主界面必然出错
- [x] 通道 `window:openWithPath` / `window:reportOpenFiles`（`src/shared/ipc.ts`）；
      `ipc/util.ts` 增加 `handleWithSender`（handler 需要知道"哪个窗口在请求"）
- [x] 初始文件**按窗口路由**：`file/external.ts` 由全局单槽改为 per-window + 全局回落
- [x] preload（`apis/window.ts`）/ `env.d.ts` / 渲染侧封装 `api/window.ts`
- [x] `TabBar.tsx` tab 右键菜单「在新窗口打开」；`App.tsx` 接线 + 上报本窗口已打开的文件
- [x] 单测 `tests/window-service.test.ts`（注册表 / 守卫 / 关闭清理 / Windows 路径大小写不敏感）

仍未做：

- [ ] **广播层**：设置变更 / 文件树变更推到所有文档窗口（`modules/settings`、`modules/file` 写入后触发）。
      现在开两个窗口时，一个改主题或新建文件，另一个不会跟着变
- [ ] 快捷键（可选），例如 `Ctrl+Shift+N`
- [ ] **端到端仍未验证**：`run-desktop` 驱动用**桩** `window.api` 直接加载 `out/renderer`，
      从不加载真实主进程 —— 「点菜单 → 主进程真的开窗」这条链路它验不了，单测只覆盖了注册表/守卫逻辑。
      要自动化验证得另做一条能驱动**真实应用**的通道：带 `--remote-debugging-port` 启动真实应用，
      再用 CDP 连它的渲染进程。（这也是 run-desktop 目前的固有盲区：凡属主进程的能力都够不着。）

### 阶段 2（贵）—— 拖拽分离 / 拖回合并

- [ ] tab 拖出窗口边界 → 分离为新窗口（跨窗口拖拽，HTML5 DnD 或自定义拖拽层）
- [ ] 新窗口关闭 / 拖回 → tab 合并回源窗口（需要记住源窗口与其 tab 顺序）
- [ ] 拖拽过程中的视觉反馈（落点高亮、幽灵元素）
- [ ] 边界：源窗口已关闭、同文件已在别处打开、拖到非文档窗口上

### 设计问题

- ~~同一文件允不允许双开？~~ **已定：不允许** —— 已实现「已在别的窗口打开则聚焦那个窗口」的守卫。
  理由：写入是整文件覆盖、无冲突检测，双开必然静默丢编辑。将来若要放开，必须同时做 mtime 冲突检测。
- 设置/文件树的跨窗口同步是"实时推送"还是"切窗口时重读"？（**未决**，广播层还没做）
- 新窗口关掉后，它的 tab 是回到源窗口，还是就地消失？（VSCode 是前者，但需要记住来源；阶段 2 再定）
- 窗口要不要记住各自的 tab 集合（重启后恢复多窗口）？—— 这会把 SQLite 也牵进来

---

## 2. tabs 拖拽排序

**目标**：tab 按住可拖动、调换顺序。

**成本：小，且不需要新依赖。** antd 的 Tabs 本身不支持拖拽排序，但 store 里 `tabs` 就是一个数组
（`src/renderer/src/stores/workspace.ts`）：加一个 `reorderTabs(from, to)` action，再在
`TabBar.tsx` 的 tab label 上挂 HTML5 `draggable` + `dragstart`/`dragover`/`drop` 即可
（右键菜单已经包在 label 上，可以复用同一个元素）。

- [ ] `stores/workspace.ts`：加 `reorderTabs(from: number, to: number)`（数组 move，`activePath` 不变）
- [ ] `TabBar.tsx`：label 加 `draggable`；拖动时记源下标、`dragover` 给落点反馈、`drop` 调 action
- [ ] 视觉反馈：拖动中的半透明、落点插入线（注意别和 antd 自带的 ink bar 打架）
- [ ] 单测：`reorderTabs` 是纯数组操作，好测（边界：同位置、首尾互换、越界下标）
- [ ] ⚠️ 与「拖出窗口分离」（§1 阶段 2）**共用同一套拖拽手势**，两者要一起设计，
      否则手势会打架：拖到 tab 条内 = 排序，拖出窗口 = 分离

## 3. 其他已知未做项（各 spec 已登记，勿重复登记）

- **子项目 C：知识库**（spec 已写但状态仍是"草稿，待确认"，从未实现）
  `docs/superpowers/specs/2026-09-03-knowledge-base-design.md`
  含 wiki 链接 `[[title]]`、反向链接面板、笔记索引进 SQLite、AI 缝隙。
  ⚠️ **该 spec 已过期**：三处写的迁移名 `003_notes.sql` 与现有的 `003_drop_users.sql` **撞号**，
  动手前要改为 `004` 并复核文件清单与接口。
- **文件实时监听**（外部改动自动刷新文件树 / 重索引）——B 与 C 都登记为"后续迭代"，至今未做
- **FTS5 全文检索**——C 划给 D，而 D 从未立 spec；现在的全局搜索是每次现场遍历文件（`workspace/search.ts`），无索引
- **标签面板 / frontmatter 编辑 UI**、**图谱可视化**、**真实 AI 模型接入**——均登记在 C 的非目标里
- **提示块 / 目录的非目标**——`docs/superpowers/specs/2026-10-08-new-block-types-design.md` §3.2
  （callout 块内改类型下拉 / 可折叠 / 自定义标题；TOC 折叠 / 编号 / 层级筛选 / 跳转高亮；`[[toc]]` 兼容）
