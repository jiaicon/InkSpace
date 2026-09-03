/// <reference types="vite/client" />

import type { User, UserInput, SystemInfo, IpcResult, FileTreeNode, RecentFile, WorkspaceInfo } from '@shared/types'

declare global {
  interface Window {
    api: {
      user: {
        list: () => Promise<IpcResult<User[]>>
        create: (input: UserInput) => Promise<IpcResult<number>>
        update: (id: number, input: UserInput) => Promise<IpcResult<boolean>>
        remove: (id: number) => Promise<IpcResult<boolean>>
      }
      system: {
        getInfo: () => Promise<IpcResult<SystemInfo>>
      }
      workspace: {
        pick: () => Promise<IpcResult<WorkspaceInfo | null>>
        last: () => Promise<IpcResult<string | null>>
        tree: (root: string) => Promise<IpcResult<FileTreeNode[]>>
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
      }
    }
  }
}

export {}
