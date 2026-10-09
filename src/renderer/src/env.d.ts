/// <reference types="vite/client" />

import type {
  SystemInfo,
  IpcResult,
  FileTreeNode,
  RecentFile,
  WorkspaceInfo,
  ExportRequest,
  AppSettings,
  MarkdownThemeInfo,
  SearchResponse
} from '@shared/types'

declare global {
  interface Window {
    api: {
      system: {
        getInfo: () => Promise<IpcResult<SystemInfo>>
      }
      workspace: {
        pick: () => Promise<IpcResult<WorkspaceInfo | null>>
        last: () => Promise<IpcResult<string | null>>
        tree: (root: string) => Promise<IpcResult<FileTreeNode[]>>
        search: (
          root: string,
          query: string,
          caseSensitive: boolean
        ) => Promise<IpcResult<SearchResponse>>
        recentList: () => Promise<IpcResult<RecentFile[]>>
        recentAdd: (path: string, title: string) => Promise<IpcResult<void>>
        recentRemove: (path: string) => Promise<IpcResult<void>>
        recentClear: () => Promise<IpcResult<void>>
      }
      file: {
        read: (path: string) => Promise<IpcResult<string>>
        write: (path: string, content: string) => Promise<IpcResult<void>>
        create: (suggestDir: string, content: string) => Promise<IpcResult<string | null>>
        rename: (path: string, newName: string) => Promise<IpcResult<string>>
        remove: (path: string) => Promise<IpcResult<void>>
        reveal: (path: string) => Promise<IpcResult<void>>
        pick: () => Promise<IpcResult<string | null>>
        saveImage: (docPath: string, data: Uint8Array, ext: string) => Promise<IpcResult<string>>
        pendingOpen: () => Promise<IpcResult<string | null>>
        onOpenExternal: (cb: (path: string) => void) => void
        getPathForFile: (file: File) => string
      }
      export: {
        html: (req: ExportRequest) => Promise<IpcResult<string | null>>
        pdf: (req: ExportRequest) => Promise<IpcResult<string | null>>
      }
      settings: {
        get: () => Promise<IpcResult<AppSettings>>
        set: (key: string, value: string) => Promise<IpcResult<AppSettings>>
        chooseImageDir: (current: string) => Promise<IpcResult<string | null>>
      }
      themes: {
        list: () => Promise<IpcResult<MarkdownThemeInfo[]>>
        getCss: (id: string) => Promise<IpcResult<string | null>>
        import: () => Promise<IpcResult<MarkdownThemeInfo | null>>
        export: (id: string) => Promise<IpcResult<string | null>>
        reveal: () => Promise<IpcResult<void>>
      }
      window: {
        /** 把该文件单独开到一个新窗口；已在别的窗口打开时主进程会聚焦那个窗口 */
        openWithPath: (path: string) => Promise<IpcResult<{ focusedExisting: boolean }>>
        /** 上报本窗口当前打开的文件，供主进程做「同一文件不开两个窗口」的守卫 */
        reportOpenFiles: (paths: string[]) => Promise<IpcResult<void>>
      }
    }
  }
}

export {}
