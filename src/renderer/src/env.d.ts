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
        /** 别的窗口改了设置时回调（主进程推送）；本窗口据此重读设置 */
        onChanged: (cb: () => void) => void
      }
      themes: {
        list: () => Promise<IpcResult<MarkdownThemeInfo[]>>
        getCss: (id: string) => Promise<IpcResult<string | null>>
        import: () => Promise<IpcResult<MarkdownThemeInfo | null>>
        export: (id: string) => Promise<IpcResult<string | null>>
        reveal: () => Promise<IpcResult<void>>
      }
      window: {
        /** 窗口启动配置：初始文件 + 是否「只有编辑器」的窗口 */
        bootstrap: () => Promise<IpcResult<{ initialPath: string | null; editorOnly: boolean }>>
        /** 把该文档**移**到新窗口；本窗口的 tab 由调用方负责关掉 */
        moveToNewWindow: (
          path: string
        ) => Promise<IpcResult<{ moved: boolean; focusedExisting: boolean }>>
        /** 打开前询问该文件是否已开在别的窗口（是则那个窗口被拿到前面） */
        claimFile: (path: string) => Promise<IpcResult<{ claimedElsewhere: boolean }>>
        /** 上报本窗口当前打开的文件 */
        reportOpenFiles: (paths: string[]) => Promise<IpcResult<void>>
      }
    }
  }
}

export {}
