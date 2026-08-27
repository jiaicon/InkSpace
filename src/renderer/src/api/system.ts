import { unwrap } from './util'

/** system 模块的渲染进程 API 封装 */
export const systemApi = {
  getInfo: () => unwrap(window.api.system.getInfo())
}
