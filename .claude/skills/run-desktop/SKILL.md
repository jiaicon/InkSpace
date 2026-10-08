---
name: run-desktop
description: 构建、启动并驱动 InkSpace 这个 Electron 桌面应用（真窗口、真键鼠、读回 DOM 与写盘内容）。当需要启动应用、截图、或在真实界面里验证改动是否生效时使用。
---

InkSpace 是 Electron 32 + Vite + React 的 Markdown 编辑器。**本项目没装 Playwright**，也不需要：
`driver.cjs` 以 Electron 主进程身份运行，用 `webContents.sendInputEvent` / `executeJavaScript`
控制真实窗口，再配一个 `window.api` 桩（`preload.cjs`）把渲染进程喂起来。

所有路径相对仓库根目录。

## 前置

```bash
# 1) 必须先构建 —— 驱动加载的是 out/renderer，源码改了不重编就是在测旧行为
npm run build

# 2) ELECTRON_RUN_AS_NODE 必须去掉：本环境预设为 1，会让 electron.exe 退化成普通 node，
#    app.whenReady 直接报 “Cannot read properties of undefined”
env -u ELECTRON_RUN_AS_NODE node_modules/electron/dist/electron.exe \
  .claude/skills/run-desktop/driver.cjs --script-file /tmp/cmds.txt
```

## 两种跑法

**一次性脚本** —— 把命令按行写进文件，每条命令输出一行 JSON，跑完自动退出：

```bash
env -u ELECTRON_RUN_AS_NODE node_modules/electron/dist/electron.exe \
  .claude/skills/run-desktop/driver.cjs --script-file /tmp/cmds.txt
```

**交互式** —— 应用一直开着，往命令文件里**追加**一行就执行一行，省掉反复重启的 ~8 秒：

```bash
env -u ELECTRON_RUN_AS_NODE node_modules/electron/dist/electron.exe \
  .claude/skills/run-desktop/driver.cjs --watch-file /tmp/cmds.txt &
echo 'open' >> /tmp/cmds.txt          # 追加即执行
echo 'markdown' >> /tmp/cmds.txt
echo 'quit'   >> /tmp/cmds.txt        # 结束
```

> 注意：**stdin 不可用** —— Electron 会把 stdin 吃掉，管道喂进去的命令一条都收不到（实测）。
> 交互请用 `--watch-file`。

命令示例（`eval:` 里可以有分号，命令行内其余部分不要塞分号）：

```
doc:在这里输入斜杠。\n
open
focus
key:Home
key:/
type:jg
eval:document.querySelectorAll('.ms-slash-menu[data-show="true"] .ms-slash-item').length
key:Enter
rect:.milkdown .ms-callout
markdown
ss:before-after
quit
```

可选参数：`--doc <path>`（文档内容临时文件）、`--shot-dir <dir>`（截图目录）、
`--settle <ms>`（每条命令后的等待，默认 400）。默认都落在系统 temp 下。
整个过程有 180 秒硬超时（`--watch-file` 也受它保护），避免留下孤儿 Electron 进程。

## 命令

| 命令                               | 作用                                                                           |
| ---------------------------------- | ------------------------------------------------------------------------------ |
| `doc:<内容>`                       | 设定「打开文件」时要读到的文档内容（`\n` 写成字面 `\n`）。要在 `open` 之前发   |
| `open`                             | 点应用里的「打开文件」按钮。**编辑器在这之前并不存在**（启动页只有欢迎界面）   |
| `focus`                            | 把焦点给编辑器                                                                 |
| `key:<Key>[:mods]`                 | 发真实按键；mods 逗号分隔：`ctrl,shift,alt`，例如 `key:Home:ctrl`              |
| `type:<文本>`                      | 逐字符输入                                                                     |
| `click:<css>` / `clicktext:<文本>` | 按选择器 / 按文字点按钮                                                        |
| `eval:<js>`                        | 在页面里求值，结果按 JSON 打印                                                 |
| `rect:<css>`                       | 第一个匹配元素的视口矩形 —— 没有看图能力时用它验布局                           |
| `text[:<css>]`                     | 元素（缺省整页）的 innerText                                                   |
| `markdown[:<n>]`                   | 应用最近一次写盘的 markdown（`n=1` 是上一次）。**会轮询等防抖落盘，最多 3 秒** |
| `sleep:<ms>`                       | 等待                                                                           |
| `ss[:<名字>]`                      | 截图到截图目录                                                                 |
| `help` / `quit`                    | —                                                                              |

## 坑（都是实际踩过的）

- **改了源码必须先 `npm run build`**。驱动的 `ready` 事件不会告诉你构建是旧的，表现为
  「功能像没生效」或「菜单筛出 0 项」。先构建再怀疑代码。
- **按键要同时发 `char` 事件**，只发 `keyDown`/`keyUp` 时字符不会进入文档。驱动已经处理了；
  自己写 `eval` 模拟输入时要注意 —— 例如斜杠菜单依赖 `/` 真的插进了文档，否则它唤出后会立刻收起。
- **判断弹层是否可见要看它自己的标志，不是元素是否存在**。例如 `.ms-slash-menu[data-show='false']`
  是 `display:none`，元素一直在 DOM 里，但 `getBoundingClientRect()` 全返回 0。
- **本机 Read 工具渲染不了 PNG**（368×370、16KB 的图也会被判 `Unsupported Image`）。
  别指望看截图，用 `rect:` / `eval:` 量几何和计算样式做客观断言，截图只落盘给人看。
- **渲染进程的报错会以 `{"rendererConsole": "…"}` 单独打印一行**。插入/交互失败往往不抛到主进程，
  这行是唯一线索。
- `open` 之前 `.ProseMirror` 不存在；`focus` 在没打开文档时会静默失败。
- 自动保存是 500ms 防抖，用 `markdown` 命令而不是 `eval:window.__verify.writes()` 手动读。
