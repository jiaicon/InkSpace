// IPC channel 名称常量 —— 主进程 / preload / 渲染进程三端共用，避免字符串拼写不一致
export const IPC = {
  // user 模块
  userList: 'user:list',
  userCreate: 'user:create',
  userUpdate: 'user:update',
  userDelete: 'user:delete',
  // system 模块
  systemInfo: 'system:info',
  // workspace 模块
  workspacePick: 'workspace:pick',
  workspaceLast: 'workspace:last',
  workspaceTree: 'workspace:tree',
  recentList: 'recent:list',
  recentAdd: 'recent:add',
  recentRemove: 'recent:remove',
  // file 模块
  fileRead: 'file:read',
  fileWrite: 'file:write',
  fileCreate: 'file:create',
  fileRename: 'file:rename',
  fileDelete: 'file:delete',
  fileReveal: 'file:reveal'
} as const
