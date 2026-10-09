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
  // 外部打开（右键 md「打开方式」）—— 运行中由主进程**推送**给窗口
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
  /** 窗口启动时拉取自己的启动配置：初始文件 + 是不是「只有编辑器」的窗口 */
  windowBootstrap: 'window:bootstrap',
  /** 把某个文档从本窗口移到一个新窗口（是**移动**，本窗口的 tab 会被关掉） */
  windowMoveToNewWindow: 'window:move-to-new-window',
  /** 打开前问一句「该文件是否已开在别的窗口」——「一个文件只在一个窗口打开」的守卫 */
  windowClaimFile: 'window:claim-file',
  windowReportOpenFiles: 'window:report-open-files'
} as const
