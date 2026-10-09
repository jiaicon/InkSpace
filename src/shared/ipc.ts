// IPC channel 名称常量 —— 主进程 / preload / 渲染进程三端共用，避免字符串拼写不一致
export const IPC = {
  // system 模块
  systemInfo: 'system:info',
  // workspace 模块
  workspacePick: 'workspace:pick',
  workspaceLast: 'workspace:last',
  workspaceTree: 'workspace:tree',
  workspaceSearch: 'workspace:search',
  recentList: 'recent:list',
  recentAdd: 'recent:add',
  recentRemove: 'recent:remove',
  recentClear: 'recent:clear',
  // file 模块
  fileRead: 'file:read',
  fileWrite: 'file:write',
  fileCreate: 'file:create',
  fileRename: 'file:rename',
  fileDelete: 'file:delete',
  fileReveal: 'file:reveal',
  filePick: 'file:pick',
  fileSaveImage: 'file:save-image',
  // 外部打开（右键 md「打开方式」）
  filePendingOpen: 'file:pending-open',
  fileOpenExternal: 'file:open-external',
  // export 模块
  exportHtml: 'export:html',
  exportPdf: 'export:pdf',
  // settings 模块
  settingsGet: 'settings:get',
  settingsSet: 'settings:set',
  settingsChooseImageDir: 'settings:choose-image-dir',
  // themes 模块（Markdown 主题）
  themesList: 'themes:list',
  themesGetCss: 'themes:get-css',
  themesImport: 'themes:import',
  themesExport: 'themes:export',
  themesReveal: 'themes:reveal',
  // window 模块（多窗口）
  windowOpenWithPath: 'window:open-with-path',
  windowReportOpenFiles: 'window:report-open-files'
} as const
