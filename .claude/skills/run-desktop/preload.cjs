// run-desktop 的 preload 桩：给渲染进程喂一个最小可用的 window.api。
// 应用启动时会调用它（读文档、读设置、列主题…），没有它页面起不来。
//
// 文档内容从 VERIFY_DOC 指向的文件惰性读取 —— 每次 file.read 都重读，
// 所以驱动脚本里先 `doc:<内容>` 再 `open` 就能换文档。
const { contextBridge } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

const DOC_FILE = process.env.VERIFY_DOC || path.join(__dirname, '.doc.tmp')
const docPath = path.join(__dirname, '.doc-md.tmp')
const settingsFile = path.join(__dirname, '.settings.json')

const ok = (data) => Promise.resolve({ ok: true, data })
const fail = (error) => Promise.resolve({ ok: false, error })
const writes = []
// 多窗口相关的桩：记下调用，便于驱动脚本断言「点了菜单是否真的带着路径调过去」
const windowCalls = [] // moveToNewWindow
const claimCalls = [] // claimFile
let reportedFiles = []
let bootstrapCalls = 0

function readDoc() {
  try {
    return fs.readFileSync(DOC_FILE, 'utf8')
  } catch {
    return '在这里输入斜杠呼出菜单。\n'
  }
}

const DEFAULT_SETTINGS = {
  theme: 'light',
  imageStorage: 'document',
  imageDir: '',
  imageSubdir: 'assets',
  highlightTheme: 'auto',
  markdownTheme: 'auto'
}

function readSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(fs.readFileSync(settingsFile, 'utf8')) }
  } catch {
    return DEFAULT_SETTINGS
  }
}

// 设置：可被驱动脚本改写，并能手动触发「别的窗口改了设置」的推送，用来验跨窗口联动
let settingsState = readSettings()
let settingsChangedCb = null

contextBridge.exposeInMainWorld('api', {
  system: {
    getInfo: () =>
      ok({
        appVersion: 'run-desktop',
        electron: process.versions.electron,
        node: process.versions.node,
        chrome: process.versions.chrome,
        platform: process.platform
      })
  },
  workspace: {
    pick: () => ok(null),
    last: () => ok(null),
    tree: () => ok([]),
    search: () => ok({ matches: [], truncated: false }),
    recentList: () => ok([]),
    recentAdd: () => ok(undefined),
    recentRemove: () => ok(undefined),
    recentClear: () => ok(undefined)
  },
  file: {
    read: () => ok(readDoc()),
    write: (p, content) => {
      writes.push({ path: p, content, at: Date.now() })
      return ok(undefined)
    },
    create: () => ok(null),
    rename: () => fail('run-desktop stub: rename 未实现'),
    remove: () => ok(undefined),
    reveal: () => ok(undefined),
    pick: () => ok(docPath),
    saveImage: () => fail('run-desktop stub: saveImage 未实现'),
    pendingOpen: () => ok(null),
    onOpenExternal: () => {},
    getPathForFile: () => ''
  },
  export: { html: () => ok(null), pdf: () => ok(null) },
  settings: {
    get: () => ok(settingsState),
    set: (key, value) => {
      settingsState = { ...settingsState, [key]: value }
      return ok(settingsState)
    },
    chooseImageDir: () => ok(null),
    // 应用挂载时会订阅「设置变更广播」；桩要提供它，否则 App 一启动就炸
    onChanged: (cb) => {
      settingsChangedCb = cb
    }
  },
  themes: {
    list: () => ok([]),
    getCss: () => ok(null),
    import: () => ok(null),
    export: () => ok(null),
    reveal: () => ok(undefined)
  },
  window: {
    // 模拟分离窗口的启动配置：VERIFY_BOOTSTRAP_PATH 给了就当「该窗口的初始文件」，
    // VERIFY_EDITOR_ONLY=1 就当「只有编辑器」的窗口（用来验无左侧栏的布局）
    bootstrap: () => {
      bootstrapCalls++
      return ok({
        initialPath: process.env.VERIFY_BOOTSTRAP_PATH || null,
        editorOnly: process.env.VERIFY_EDITOR_ONLY === '1'
      })
    },
    moveToNewWindow: (path) => {
      windowCalls.push({ path })
      return ok({ moved: true, focusedExisting: false })
    },
    claimFile: (path) => {
      claimCalls.push({ path })
      return ok({ claimedElsewhere: false })
    },
    reportOpenFiles: (paths) => {
      reportedFiles = paths
      return ok(undefined)
    }
  }
})

// 应用每次保存都会写 markdown，驱动脚本用 `markdown` 命令读它 —— 这是最强的断言信号
contextBridge.exposeInMainWorld('__verify', {
  writes: () => writes,
  windowCalls: () => windowCalls,
  claimCalls: () => claimCalls,
  reportedFiles: () => reportedFiles,
  bootstrapCalls: () => bootstrapCalls,
  // 跨窗口设置联动：先改桩里的设置，再模拟「主进程广播」触发订阅回调
  setSettings: (patch) => {
    settingsState = { ...settingsState, ...patch }
  },
  fireSettingsChanged: () => settingsChangedCb?.()
})
