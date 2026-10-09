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

### 阶段 1（成本小、价值高）—— 建议先做这个

- [ ] `src/main/index.ts`：把 `createWindow()` 抽出为可复用函数，接受"初始打开的文件路径"；建立文档窗口注册表
- [ ] `src/shared/ipc.ts` + `src/main/ipc/register.ts`：新增 `window:openWithPath(path)`（在主进程建新窗口）
- [ ] `src/preload/index.ts` + `src/renderer/src/env.d.ts`：暴露该通道
- [ ] `src/renderer/src/components/TabBar.tsx`：tab 右键菜单加「在新窗口打开」（复用现有 Dropdown 用法）
- [ ] 新窗口启动时用初始路径调 `openFile(path)`（复用 `pendingOpen` 的拉取模式，但要按窗口隔离）
- [ ] **双开守卫**：主进程记录"哪些文件正开在哪个窗口"，已在别处打开时聚焦那个窗口而不是开第二个
- [ ] **广播层**：设置变更 / 文件树变更推到所有文档窗口（`src/main/modules/settings` 与 `file` 写入后触发）
- [ ] 快捷键（可选）：`Ctrl+Shift+N` 之类
- [ ] 验证：用 `.claude/skills/run-desktop` 驱动 —— 开两个窗口、两边改设置看是否同步、双开守卫是否聚焦已有窗口

### 阶段 2（贵）—— 拖拽分离 / 拖回合并

- [ ] tab 拖出窗口边界 → 分离为新窗口（跨窗口拖拽，HTML5 DnD 或自定义拖拽层）
- [ ] 新窗口关闭 / 拖回 → tab 合并回源窗口（需要记住源窗口与其 tab 顺序）
- [ ] 拖拽过程中的视觉反馈（落点高亮、幽灵元素）
- [ ] 边界：源窗口已关闭、同文件已在别处打开、拖到非文档窗口上

### 动手前要先定的设计问题（brainstorm 时回答）

- 同一文件**允不允许**双开？（决定要不要做冲突检测，是整个功能的成本分水岭）
- 设置/文件树的跨窗口同步是"实时推送"还是"切窗口时重读"？
- 新窗口关掉后，它的 tab 是回到源窗口，还是就地消失？（VSCode 是前者，但需要记住来源）
- 窗口要不要记住各自的 tab 集合（重启后恢复多窗口）？—— 这会把 SQLite 也牵进来

---

## 2. 其他已知未做项（各 spec 已登记，勿重复登记）

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
