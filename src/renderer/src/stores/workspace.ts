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
