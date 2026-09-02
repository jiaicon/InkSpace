// 主进程与渲染进程共享的类型定义（两端都能 import，保证 IPC 契约一致）

/** 用户实体（对应 users 表一行） */
export interface User {
  id: number
  username: string
  name: string
  email: string
  role: string
  /** 1 = 启用，0 = 禁用 */
  status: number
  createdAt: string
}

/** 新建/更新用户的入参（无 id、无时间戳） */
export interface UserInput {
  username: string
  name: string
  email: string
  role: string
  status: number
}

/** 系统信息（system 模块） */
export interface SystemInfo {
  platform: string
  arch: string
  appVersion: string
  electron: string
  node: string
  chrome: string
}

/** IPC 统一返回结构：主进程永不 throw，错误以 error 字段返回 */
export interface IpcResult<T> {
  ok: boolean
  data?: T
  error?: string
}

/** 文件树节点（file 为叶，directory 有 children） */
export interface FileTreeNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileTreeNode[]
}

/** 最近打开的一条记录 */
export interface RecentFile {
  path: string
  title: string
  lastOpenedAt: number   // epoch 毫秒
}

/** 工作区信息：根路径 + 文件树 */
export interface WorkspaceInfo {
  path: string
  tree: FileTreeNode[]
}
