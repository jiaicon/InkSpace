import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Button,
  ConfigProvider,
  Dropdown,
  Input,
  Layout,
  Modal,
  message,
  theme as antdTheme
} from 'antd'
import type { InputRef, ThemeConfig } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import {
  CodeOutlined,
  EditOutlined,
  BulbOutlined,
  PictureOutlined,
  LinkOutlined,
  FileAddOutlined,
  SaveOutlined,
  ExportOutlined,
  DownloadOutlined,
  FileTextOutlined,
  FilePdfOutlined,
  SettingOutlined
} from '@ant-design/icons'
import type { AppSettings, ThemeMode } from '@shared/types'
import { Editor, parseOutline } from './editor'
import type { EditorHandle, EditorMode } from './editor'
import { useWorkspaceStore } from './stores/workspace'
import { titleFromPath, dirname } from './utils/path'
import { classifyDroppedPaths } from './utils/drop'
import { extFromImageFile } from './utils/image'
import { workspaceApi } from './api/workspace'
import { fileApi } from './api/file'
import { exportApi } from './api/export'
import { settingsApi } from './api/settings'
import { Sidebar } from './components/Sidebar'
import { TabBar } from './components/TabBar'
import { Welcome } from './components/Welcome'
import { SettingsDrawer } from './components/SettingsDrawer'
import { debounce } from './utils/debounce'
import { countStats } from './utils/stats'

const SIDEBAR_WIDTH = 280

const FONT_SANS =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Helvetica, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', Arial, sans-serif"

// Typora 风格的 antd 主题令牌（与 theme.css 的 --ms-* 变量保持一致）。
// 按明暗分别取色：antd 暗色算法会把这些 seed 视为「真值」而不再套用自身默认，
// 所以必须显式给暗色一套，否则切暗色后文字/图标仍沿用亮色、导致不可见。
function getAppTheme(mode: 'light' | 'dark'): ThemeConfig {
  const dark = mode === 'dark'
  return {
    token: {
      colorPrimary: dark ? '#4c9aff' : '#0969da',
      colorLink: dark ? '#4c9aff' : '#0969da',
      colorTextBase: dark ? '#d4d4d4' : '#24292f',
      colorBgBase: dark ? '#1e1e1e' : '#ffffff',
      colorBorder: dark ? '#3a3a3a' : '#e4e7eb',
      colorBorderSecondary: dark ? '#3a3a3a' : '#e4e7eb',
      borderRadius: 6,
      fontFamily: FONT_SANS
    },
    components: {
      Tree: {
        colorBgContainer: 'transparent',
        nodeSelectedBg: dark ? 'rgba(76, 154, 255, 0.16)' : '#e8f0fe',
        nodeHoverBg: dark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.03)'
      },
      Tabs: {
        cardBg: 'transparent',
        itemColor: dark ? '#9d9d9d' : '#6e7781',
        itemSelectedColor: dark ? '#e8e8e8' : '#24292f',
        itemActiveColor: dark ? '#4c9aff' : '#0969da'
      }
    }
  }
}

export default function App() {
  const editorRef = useRef<EditorHandle>(null)
  const {
    workspacePath,
    tree,
    recent,
    tabs,
    activePath,
    contents,
    setWorkspace,
    setTree,
    setRecent,
    addTab,
    activate,
    removeTab,
    renameTab,
    onEdit,
    markSaved
  } = useWorkspaceStore()

  const [pendingClose, setPendingClose] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [urlKind, setUrlKind] = useState<'image' | 'link' | null>(null)
  const [urlValue, setUrlValue] = useState('')
  const urlInputRef = useRef<InputRef>(null)
  const linkRangeRef = useRef<{ from: number; to: number } | null>(null)

  // —— 显示模式（wysiwyg / source）与主题（light / dark） ——
  const [mode, setMode] = useState<EditorMode>('wysiwyg')
  // 主题：settings 表是权威来源；localStorage 只作首帧缓存，避免启动时浅色闪一下再变深色
  const [theme, setTheme] = useState<ThemeMode>(() =>
    localStorage.getItem('ms-theme') === 'dark' ? 'dark' : 'light'
  )
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  // —— 大纲与字数统计（随当前文档变化） ——
  const currentMd = contents[activePath ?? ''] ?? ''
  const outline = useMemo(() => parseOutline(currentMd), [currentMd])
  const stats = useMemo(() => countStats(currentMd), [currentMd])

  // —— 自动保存：500ms 防抖写盘 ——
  const doSave = useCallback(
    async (path: string, md: string) => {
      try {
        await fileApi.write(path, md)
        markSaved(path)
        if (pendingPathRef.current === path) pendingPathRef.current = null
      } catch (e) {
        message.error(`保存失败：${e instanceof Error ? e.message : String(e)}`)
      }
    },
    [markSaved]
  )
  const saveRef = useRef(debounce(doSave, 500))
  const pendingPathRef = useRef<string | null>(null)

  // —— 启动恢复：上次工作区 + 最近打开 ——
  useEffect(() => {
    ;(async () => {
      try {
        const last = await workspaceApi.last()
        if (last) {
          setWorkspace(last)
          setTree(await workspaceApi.tree(last))
        }
      } catch {
        // 启动恢复失败静默，不阻塞首次交互
      }
      try {
        setRecent(await workspaceApi.recentList())
      } catch {
        // 同上
      }
    })()
  }, [setWorkspace, setTree, setRecent])

  // —— 退出前尽力 flush 未落盘编辑 ——
  useEffect(() => {
    const h = () => {
      void saveRef.current.flush()
    }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [])

  // —— 设置加载：主题、图片存放位置 ——
  useEffect(() => {
    settingsApi
      .get()
      .then((s) => {
        setAppSettings(s)
        setTheme(s.theme)
      })
      .catch(() => {
        // 读设置失败不阻塞使用，沿用本地缓存的主题
      })
  }, [])

  // —— 主题应用到 <html data-theme> 并写入首帧缓存 ——
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('ms-theme', theme)
  }, [theme])

  const updateSetting = useCallback(async (key: keyof AppSettings, value: string) => {
    try {
      const next = await settingsApi.set(key, value)
      setAppSettings(next)
      setTheme(next.theme)
    } catch (e) {
      message.error(`设置保存失败：${e instanceof Error ? e.message : String(e)}`)
    }
  }, [])

  // —— 源码模式切换（工具栏按钮与 Ctrl+/ 共用） ——
  const toggleMode = useCallback(() => {
    editorRef.current?.setMode(mode === 'wysiwyg' ? 'source' : 'wysiwyg')
  }, [mode])

  const toggleTheme = useCallback(() => {
    void updateSetting('theme', theme === 'light' ? 'dark' : 'light')
  }, [theme, updateSetting])

  // —— 图片 / 链接插入 ——
  const requestImage = useCallback(() => {
    setUrlKind('image')
    setUrlValue('')
  }, [])

  const requestLink = useCallback(() => {
    const range = editorRef.current?.getSelection()
    if (!range) {
      message.info('请先选中要添加链接的文字')
      return
    }
    linkRangeRef.current = range
    setUrlKind('link')
    setUrlValue('')
  }, [])

  const confirmUrl = useCallback(() => {
    const url = urlValue.trim()
    if (!url) return
    console.log('[confirmUrl] 应用链接/图片', { url, kind: urlKind, range: linkRangeRef.current })
    if (urlKind === 'image') editorRef.current?.insertImage(url)
    else if (urlKind === 'link') editorRef.current?.setLink(url, linkRangeRef.current ?? undefined)
    setUrlKind(null)
  }, [urlKind, urlValue])

  // 弹窗打开后把焦点交给输入框，确保 Enter 触发确认而非被编辑器抢走
  useEffect(() => {
    if (!urlKind) return
    const t = setTimeout(() => urlInputRef.current?.focus(), 0)
    return () => clearTimeout(t)
  }, [urlKind])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault()
        toggleMode()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleMode])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        if (urlKind) return
        requestLink()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [urlKind, requestLink])

  // 链接/图片弹窗打开时，用捕获阶段拦截 Enter 直接确认：无论焦点在输入框还是编辑器，
  // 都能阻止 Enter 落到编辑器（否则会把选中文字替换成换行）。
  useEffect(() => {
    if (!urlKind) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        e.stopPropagation()
        confirmUrl()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [urlKind, confirmUrl])

  // 编辑器当前显示路径（用 ref 避免 onChange 闭包过期；编辑内容归属当前显示的文档）
  const displayedPathRef = useRef<string | null>(null)

  const handleEdit = useCallback(
    (md: string) => {
      const path = displayedPathRef.current
      if (!path) return
      onEdit(path, md)
      pendingPathRef.current = path
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
        workspaceApi.recentAdd(path, titleFromPath(path)).catch(() => {})
        setRecent(await workspaceApi.recentList())
      } catch (e) {
        message.error(`打开失败：${e instanceof Error ? e.message : String(e)}`)
      }
    },
    [activate, addTab, setRecent, showFile]
  )

  const openFileDialog = useCallback(async () => {
    try {
      const path = await fileApi.pick()
      if (!path) return
      await openFile(path)
    } catch (e) {
      message.error(`打开文件失败：${e instanceof Error ? e.message : String(e)}`)
    }
  }, [openFile])

  // 外部打开：右键 md「打开方式」唤起（首启走拉取，运行中走 second-instance 推送）
  useEffect(() => {
    fileApi.onOpenExternal((path) => {
      void openFile(path)
    })
    void fileApi.pendingOpen().then((path) => {
      if (path) void openFile(path)
    })
  }, [openFile])

  // —— 粘贴 / 拖入的图片：存到文档旁的 assets/，再在光标处插入相对路径 ——
  const insertImages = useCallback(async (files: File[]) => {
    const docPath = useWorkspaceStore.getState().activePath
    if (!docPath) {
      message.info('请先保存文档，再插入本地图片')
      return
    }
    for (const file of files) {
      const ext = extFromImageFile(file.name, file.type)
      if (!ext) {
        message.warning(`不支持的图片格式：${file.name || file.type || '未知'}`)
        continue
      }
      try {
        const data = new Uint8Array(await file.arrayBuffer())
        editorRef.current?.insertImage(await fileApi.saveImage(docPath, data, ext))
      } catch (e) {
        message.error(`图片保存失败：${e instanceof Error ? e.message : String(e)}`)
      }
    }
  }, [])

  // 拖拽：Markdown 走「打开文件」，图片走「插入」，两者互斥，避免抢同一个落点
  useEffect(() => {
    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer && e.dataTransfer.types.includes('Files')) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    const onDrop = (e: DragEvent) => {
      const files = e.dataTransfer ? Array.from(e.dataTransfer.files) : []
      if (files.length === 0) return
      e.preventDefault()
      e.stopPropagation()
      // 分类用真实路径；插入图片需要 File 本身取字节，故按键建立映射
      const paths = files.map((f) => fileApi.getPathForFile(f))
      const { markdown, images } = classifyDroppedPaths(paths)
      if (markdown.length > 0) {
        for (const p of markdown) void openFile(p)
        return
      }
      if (images.length > 0) {
        const byPath = new Map(paths.map((p, i) => [p, files[i]]))
        const picked = images.map((p) => byPath.get(p)).filter((f): f is File => f != null)
        void insertImages(picked)
        return
      }
      message.info('仅支持拖入 Markdown 或图片文件')
    }
    window.addEventListener('dragover', onDragOver, true)
    window.addEventListener('drop', onDrop, true)
    return () => {
      window.removeEventListener('dragover', onDragOver, true)
      window.removeEventListener('drop', onDrop, true)
    }
  }, [openFile, insertImages])

  // 粘贴：剪贴板里有图片（截图等）时插入图片，其余情况交给编辑器处理文本
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = e.clipboardData ? Array.from(e.clipboardData.files) : []
      const images = files.filter((f) => extFromImageFile(f.name, f.type) !== null)
      if (images.length === 0) return
      e.preventDefault()
      e.stopPropagation()
      void insertImages(images)
    }
    window.addEventListener('paste', onPaste, true)
    return () => window.removeEventListener('paste', onPaste, true)
  }, [insertImages])

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

  // —— 清空最近打开记录（只清记录，不删文件） ——
  const clearRecent = useCallback(async () => {
    try {
      await workspaceApi.recentClear()
      setRecent([])
    } catch (e) {
      message.error(`清除失败：${e instanceof Error ? e.message : String(e)}`)
    }
  }, [setRecent])

  // —— 图片存放目录：选择与打开 ——
  const chooseImageDir = useCallback(async () => {
    try {
      const dir = await settingsApi.chooseImageDir(appSettings?.imageDir ?? '')
      if (dir) await updateSetting('imageDir', dir)
    } catch (e) {
      message.error(`选择目录失败：${e instanceof Error ? e.message : String(e)}`)
    }
  }, [appSettings?.imageDir, updateSetting])

  const revealImageDir = useCallback(() => {
    const dir = appSettings?.imageDir
    if (!dir) return
    fileApi.reveal(dir).catch((e) => message.error(String(e)))
  }, [appSettings?.imageDir])

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

  // —— 导出为 HTML / PDF（内容取自内存，包含尚未落盘的编辑） ——
  const exportDoc = useCallback(async (format: 'html' | 'pdf') => {
    const st = useWorkspaceStore.getState()
    const path = st.activePath
    if (!path) {
      message.info('请先打开一个文档')
      return
    }
    const req = {
      markdown: st.contents[path] ?? '',
      sourcePath: path,
      title: st.tabs.find((t) => t.path === path)?.title ?? titleFromPath(path)
    }
    try {
      const savedPath = format === 'html' ? await exportApi.html(req) : await exportApi.pdf(req)
      if (savedPath) message.success(`已导出到 ${savedPath}`)
    } catch (e) {
      message.error(`导出失败：${e instanceof Error ? e.message : String(e)}`)
    }
  }, [])

  // —— 手动保存（Ctrl+S / 工具栏）：立即写盘，取消防抖中同路径的待写 ——
  const handleSave = useCallback(async () => {
    const st = useWorkspaceStore.getState()
    if (!st.activePath) return
    const md = st.contents[st.activePath]
    if (md == null) return
    if (pendingPathRef.current === st.activePath) {
      saveRef.current.cancel()
      pendingPathRef.current = null
    }
    await doSave(st.activePath, md)
  }, [doSave])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault()
        void handleSave()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleSave])

  // —— Tab 关闭（含 dirty 确认）——
  const finalizeClose = useCallback(
    async (path: string, save: boolean) => {
      if (save) {
        const st = useWorkspaceStore.getState()
        const tab = st.tabs.find((t) => t.path === path)
        if (tab?.dirty) {
          // 关闭保存：直接写该 tab 当前内容，不依赖共享防抖的 lastArgs（防抖可能已 fire 失败或指向其它 tab）
          if (pendingPathRef.current === path) {
            saveRef.current.cancel()
            pendingPathRef.current = null
          }
          await doSave(path, st.contents[path] ?? '')
        }
      } else if (pendingPathRef.current === path) {
        saveRef.current.cancel()
        pendingPathRef.current = null
      }
      const st = useWorkspaceStore.getState()
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
    [removeTab, showFile, doSave]
  )

  const requestClose = useCallback(
    (path: string) => {
      const tab = useWorkspaceStore.getState().tabs.find((t) => t.path === path)
      if (tab?.dirty) setPendingClose(path)
      else void finalizeClose(path, true)
    },
    [finalizeClose]
  )

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
      if (pendingPathRef.current === path) await saveRef.current.flush()
      const newPath = await fileApi.rename(path, `${name}.md`)
      renameTab(path, newPath, name)
      if (displayedPathRef.current === path) displayedPathRef.current = newPath
      await refreshTree()
      workspaceApi.recentRemove(path).catch(() => {})
      workspaceApi.recentAdd(newPath, name).catch(() => {})
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
            // 先取消该路径的待写防抖，避免 remove 后延迟的写盘重建文件
            if (pendingPathRef.current === path) {
              saveRef.current.cancel()
              pendingPathRef.current = null
            }
            await fileApi.remove(path)
            if (displayedPathRef.current === path) displayedPathRef.current = null
            await finalizeClose(path, false)
            await refreshTree()
            workspaceApi.recentRemove(path).catch(() => {})
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
    <ConfigProvider
      locale={zhCN}
      theme={{
        ...getAppTheme(theme),
        algorithm: theme === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm
      }}
    >
      <Layout style={{ height: '100vh' }}>
        <Layout.Sider width={SIDEBAR_WIDTH} theme="light" className="ms-sider">
          <Sidebar
            workspacePath={workspacePath}
            tree={tree}
            recent={recent}
            activePath={activePath}
            outline={outline}
            onOpenWorkspace={openWorkspace}
            onOpenFileDialog={openFileDialog}
            onOpenFile={openFile}
            onNewFile={newFile}
            onRename={requestRename}
            onDelete={confirmDelete}
            onReveal={(path) => fileApi.reveal(path).catch((e) => message.error(String(e)))}
            onClearRecent={clearRecent}
            onJumpOutline={(i) => editorRef.current?.scrollToHeading(i)}
          />
        </Layout.Sider>

        <Layout>
          <Layout.Header
            className="ms-header"
            style={{
              padding: '0 8px',
              height: 40,
              lineHeight: '40px',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <div
              style={{
                flex: 1,
                minWidth: 0,
                height: '100%',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <TabBar
                tabs={tabs}
                activePath={activePath}
                onChange={handleTabChange}
                onClose={requestClose}
              />
            </div>
            <Button
              type="text"
              size="small"
              icon={<FileAddOutlined />}
              title="新建文件"
              onClick={() => newFile()}
            />
            <Button
              type="text"
              size="small"
              icon={<SaveOutlined />}
              title="保存 (Ctrl+S)"
              onClick={handleSave}
            />
            <Button
              type="text"
              size="small"
              icon={<ExportOutlined />}
              title="另存为"
              onClick={saveAs}
            />
            <Dropdown
              trigger={['click']}
              menu={{
                items: [
                  { key: 'html', icon: <FileTextOutlined />, label: '导出为 HTML…' },
                  { key: 'pdf', icon: <FilePdfOutlined />, label: '导出为 PDF…' }
                ],
                onClick: ({ key }) => void exportDoc(key as 'html' | 'pdf')
              }}
            >
              <Button
                type="text"
                size="small"
                icon={<DownloadOutlined />}
                title="导出为 HTML / PDF"
              />
            </Dropdown>
            <Button
              type="text"
              size="small"
              icon={<PictureOutlined />}
              title="插入图片"
              onClick={requestImage}
            />
            <Button
              type="text"
              size="small"
              icon={<LinkOutlined />}
              title="插入链接 (Ctrl+K)"
              onClick={requestLink}
            />
            <Button
              type="text"
              size="small"
              icon={mode === 'wysiwyg' ? <CodeOutlined /> : <EditOutlined />}
              title={mode === 'wysiwyg' ? '源码模式 (Ctrl+/)' : '所见即所得 (Ctrl+/)'}
              onClick={toggleMode}
            />
            <Button
              type="text"
              size="small"
              icon={<BulbOutlined />}
              title="切换主题"
              onClick={toggleTheme}
            />
            <Button
              type="text"
              size="small"
              icon={<SettingOutlined />}
              title="设置"
              onClick={() => setSettingsOpen(true)}
            />
          </Layout.Header>

          <Layout.Content
            className="ms-content"
            style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
          >
            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
              {hasTabs && activePath ? (
                <Editor
                  ref={editorRef}
                  initialMarkdown={contents[activePath] ?? ''}
                  docDir={dirname(activePath)}
                  onChange={handleEdit}
                  onChangeDirty={() => {}}
                  onModeChange={setMode}
                  onRequestLink={requestLink}
                />
              ) : (
                <Welcome
                  recent={recent.map((r) => r.path)}
                  onOpenWorkspace={openWorkspace}
                  onOpenFileDialog={openFileDialog}
                  onNewFile={() => newFile()}
                  onOpenRecent={openFile}
                />
              )}
            </div>
            <div className="ms-statusbar">
              <span>字数 {stats.words}</span>
              <span>字符 {stats.chars}</span>
              <span>行 {stats.lines}</span>
              <span style={{ marginLeft: 'auto' }}>
                {mode === 'wysiwyg' ? '所见即所得' : '源码模式'}
              </span>
            </div>
          </Layout.Content>
        </Layout>
      </Layout>

      {appSettings && (
        <SettingsDrawer
          open={settingsOpen}
          settings={appSettings}
          onChange={(key, value) => void updateSetting(key, value)}
          onChooseImageDir={() => void chooseImageDir()}
          onRevealImageDir={revealImageDir}
          onClose={() => setSettingsOpen(false)}
        />
      )}

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
              if (p) void finalizeClose(p, false)
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
              if (p) await finalizeClose(p, true)
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

      <Modal
        open={urlKind != null}
        title={urlKind === 'image' ? '插入图片' : '插入链接'}
        onOk={confirmUrl}
        onCancel={() => setUrlKind(null)}
        okText="确定"
        okButtonProps={{ disabled: !urlValue.trim() }}
      >
        <Input
          ref={urlInputRef}
          value={urlValue}
          onChange={(e) => setUrlValue(e.target.value)}
          placeholder={urlKind === 'image' ? '图片地址（https://…）' : '链接地址（https://…）'}
          autoFocus
        />
      </Modal>
    </ConfigProvider>
  )
}
