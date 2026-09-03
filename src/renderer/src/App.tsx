import { useCallback, useEffect, useRef, useState } from 'react'
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

  // 编辑器当前显示路径 + 当前激活路径（用 ref 避免 onChange 闭包过期）
  const displayedPathRef = useRef<string | null>(null)
  const activePathRef = useRef(activePath)
  activePathRef.current = activePath

  const handleEdit = useCallback(
    (md: string) => {
      const path = activePathRef.current
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

  const requestClose = useCallback((path: string) => {
    const tab = useWorkspaceStore.getState().tabs.find((t) => t.path === path)
    if (tab?.dirty) setPendingClose(path)
    else void finalizeClose(path, true)
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
              <Editor
                ref={editorRef}
                initialMarkdown={contents[activePath] ?? ''}
                onChange={handleEdit}
                onChangeDirty={() => {}}
              />
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
    </ConfigProvider>
  )
}
