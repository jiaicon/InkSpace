// run-desktop 驱动：以 **Electron 主进程**身份运行，用 webContents 控制真实应用。
// 不依赖 Playwright —— 这个项目没装，也不需要。
//
// 用法（必须去掉 ELECTRON_RUN_AS_NODE，否则 electron.exe 退化成普通 node）：
//   env -u ELECTRON_RUN_AS_NODE node_modules/electron/dist/electron.exe \
//     .claude/skills/run-desktop/driver.cjs --script-file /tmp/cmds.txt
//
// 命令来源：--script-file 指定的文件（每行一条；eval: 里可以有分号），
// 没给则逐行读 stdin。每条命令输出一行 JSON 结果。
//
// 命令一览（见 SKILL.md）：
//   doc:<内容>          设定「打开文件」时要读到的文档内容（\n 写成字面 \n）
//   open                点应用里的「打开文件」按钮 —— 编辑器在此之前并不存在
//   focus               把焦点给编辑器
//   key:<Key>[:mods]    发真实按键；mods 逗号分隔：ctrl,shift,alt
//   type:<文本>         逐字符输入
//   click:<css> / clicktext:<文本>
//   eval:<js>           在页面里求值，结果按 JSON 打印（返回 undefined 会打印 null）
//   rect:<css>          第一个匹配元素的视口矩形（没有截图权限时用它验布局）
//   text[:<css>]        元素（缺省整页）的 innerText
//   markdown[:<n>]      应用最近一次写盘的 markdown（n=1 是上一次，缺省最新）
//   sleep:<ms>
//   ss[:<名字>]         截图到截图目录
//   help / quit
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..', '..', '..')
const argv = process.argv.slice(1)
const argOf = (name, dflt) => {
  const i = argv.indexOf(name)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt
}

const scriptFile = argOf('--script-file', null)
// 临时文件放系统 temp，别污染 skill 目录
const docFile = argOf('--doc', path.join(os.tmpdir(), 'run-desktop-doc.md'))
const shotDir = argOf('--shot-dir', path.join(os.tmpdir(), 'run-desktop-shots'))
const settle = Number(argOf('--settle', '400'))

fs.mkdirSync(shotDir, { recursive: true })
process.env.VERIFY_DOC = docFile

let win = null
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const out = (obj) => process.stdout.write(JSON.stringify(obj) + '\n')

setTimeout(() => {
  out({ fatal: 'timeout', after: '180s' })
  app.exit(1)
}, 180_000)

app.whenReady().then(async () => {
  win = new BrowserWindow({
    width: 1280,
    height: 860,
    show: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })
  // 渲染进程的报错必须捕获，否则交互失败只会表现为「静默无输出」
  win.webContents.on('console-message', (_e, level, msg) => {
    if (level >= 2 && !/Electron Security Warning|white-space/.test(msg)) {
      out({ rendererConsole: msg })
    }
  })
  await win.loadFile(path.join(ROOT, 'out', 'renderer', 'index.html'))
  win.focus()
  await sleep(1200)
  out({ ready: true, url: win.webContents.getURL() })

  run()
})

const js = (code) => win.webContents.executeJavaScript(code, true)
const send = (ev) => win.webContents.sendInputEvent(ev)

const COMMANDS = {
  doc(text) {
    fs.writeFileSync(docFile, text.replace(/\\n/g, '\n'))
    return { docChars: fs.readFileSync(docFile, 'utf8').length }
  },
  async open() {
    const clicked = await js(`(() => {
      const b = [...document.querySelectorAll('button, .ant-btn')].find((x) => (x.textContent || '').includes('打开文件'))
      if (!b) return 'NOT_FOUND'
      b.click(); return 'OK'
    })()`)
    await sleep(1500)
    return { clicked }
  },
  async focus() {
    await js(
      `(() => { const p = document.querySelector('.ProseMirror'); if (p) p.focus(); return true })()`
    )
    await sleep(200)
    return { focused: await js(`document.activeElement ? document.activeElement.className : null`) }
  },
  async key(spec) {
    const [k, mods] = spec.split(':')
    const modifiers = mods ? mods.split(',') : undefined
    const withMods = (ev) => (modifiers ? { ...ev, modifiers } : ev)
    send(withMods({ type: 'keyDown', keyCode: k }))
    // 可打印字符必须补一个 char 事件，否则字符不会真的进入文档 ——
    // 而依赖该字符的插件（例如斜杠菜单要看到 `/` 还在）会立刻判定失败并收起来。
    if (k === 'Enter') send(withMods({ type: 'char', keyCode: '\r' }))
    else if (k.length === 1) send(withMods({ type: 'char', keyCode: k }))
    send(withMods({ type: 'keyUp', keyCode: k }))
    await sleep(settle)
    return { key: k, modifiers: modifiers ?? null }
  },
  async type(text) {
    for (const ch of text) {
      send({ type: 'char', keyCode: ch })
      await sleep(80)
    }
    await sleep(settle)
    return { typed: text }
  },
  async click(sel) {
    const r = await js(`(() => {
      const el = document.querySelector(${JSON.stringify(sel)})
      if (!el) return 'NOT_FOUND'
      el.click(); return 'OK'
    })()`)
    await sleep(settle)
    return { sel, result: r }
  },
  async clicktext(text) {
    const r = await js(`(() => {
      const els = [...document.querySelectorAll('button, a, [role="button"], .ant-btn')]
      const el = els.find((e) => (e.textContent || '').trim() === ${JSON.stringify(text)}) ||
                 els.find((e) => (e.textContent || '').includes(${JSON.stringify(text)}))
      if (!el) return 'NOT_FOUND'
      el.click(); return 'OK:' + el.tagName
    })()`)
    await sleep(settle)
    return { text, result: r }
  },
  async eval(code) {
    const v = await js(code)
    return { value: v === undefined ? null : v }
  },
  async rect(sel) {
    const r = await js(`(() => {
      const el = document.querySelector(${JSON.stringify(sel)})
      if (!el) return null
      const b = el.getBoundingClientRect()
      return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }
    })()`)
    return { sel, rect: r }
  },
  async text(sel) {
    const t = await js(
      sel
        ? `document.querySelector(${JSON.stringify(sel)})?.innerText ?? null`
        : `document.body.innerText`
    )
    return { text: t }
  },
  async markdown(n) {
    const want = Number(n || 1)
    const read = `(() => {
      const w = window.__verify ? window.__verify.writes() : []
      if (!w.length) return null
      const i = Math.max(0, w.length - ${want})
      return w[i] ? w[i].content : null
    })()`
    // 自动保存是 500ms 防抖的：轮询等它落盘，免得拿到 null 误判成「功能没生效」
    const deadline = Date.now() + 3000
    let v = null
    for (;;) {
      v = await js(read)
      if (v !== null || Date.now() > deadline) break
      await sleep(150)
    }
    return { markdown: v }
  },
  async sleep(ms) {
    await sleep(Number(ms) || 0)
    return { slept: Number(ms) || 0 }
  },
  async ss(name) {
    const img = await win.webContents.capturePage()
    const file = path.join(shotDir, `${name || `ss-${Date.now()}`}.png`)
    fs.writeFileSync(file, img.toPNG())
    return { screenshot: file, size: img.getSize() }
  },
  help() {
    return { commands: Object.keys(COMMANDS).join(', ') }
  },
  quit() {
    return { bye: true }
  }
}

function dispatch(line) {
  const raw = line.trim()
  if (!raw || raw.startsWith('#')) return Promise.resolve(null)
  const i = raw.indexOf(':')
  const cmd = i < 0 ? raw : raw.slice(0, i)
  const arg = i < 0 ? '' : raw.slice(i + 1)
  const fn = COMMANDS[cmd]
  if (!fn)
    return Promise.resolve({
      cmd,
      ok: false,
      error: `未知命令，可用：${Object.keys(COMMANDS).join(', ')}`
    })
  return Promise.resolve(fn(arg)).then(
    (result) => ({ cmd, ok: true, result }),
    (e) => ({ cmd, ok: false, error: e instanceof Error ? e.message : String(e) })
  )
}

async function run() {
  const lines = scriptFile
    ? fs.readFileSync(scriptFile, 'utf8').split(/\r?\n/)
    : await readStdinLines()

  for (const line of lines) {
    const res = await dispatch(line)
    if (!res) continue
    out(res)
    if (res.cmd === 'quit') break
  }
  app.exit(0)
}

function readStdinLines() {
  return new Promise((resolve) => {
    let buf = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (d) => (buf += d))
    process.stdin.on('end', () => resolve(buf.split(/\r?\n/)))
    process.stdin.resume()
  })
}
