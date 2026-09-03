import { unwrap } from './util'
import type { FileTreeNode, RecentFile, WorkspaceInfo } from '@shared/types'

/** workspace 模块的渲染进程 API 封装 */
export const workspaceApi = {
  pick: () => unwrap<WorkspaceInfo | null>(window.api.workspace.pick()),
  last: () => unwrap<string | null>(window.api.workspace.last()),
  tree: (root: string) => unwrap<FileTreeNode[]>(window.api.workspace.tree(root)),
  recentList: () => unwrap<RecentFile[]>(window.api.workspace.recentList()),
  recentAdd: (path: string, title: string) => unwrap<void>(window.api.workspace.recentAdd(path, title)),
  recentRemove: (path: string) => unwrap<void>(window.api.workspace.recentRemove(path)),
  recentClear: () => unwrap<void>(window.api.workspace.recentClear())
}
