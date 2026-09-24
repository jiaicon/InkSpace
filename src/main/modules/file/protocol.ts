import { protocol } from 'electron'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { imageMime } from './assets'

export const MS_FILE_SCHEME = 'ms-file'

/**
 * 注册 ms-file 自定义协议：把文档里的相对图片路径映射成渲染进程可加载的 URL。
 *
 * 渲染进程的页面地址不是文档路径（开发态是 http://localhost，打包后是 out/renderer/index.html），
 * 所以 markdown 里的 `./assets/a.png` 直接交给 <img> 会解析到应用目录上、显示为裂图。
 *
 * URL 形态：ms-file://local/?dir=<文档目录>&p=<markdown 里的原始路径>
 * 目录放在 query 里而不是全局状态里，避免切换文档时状态过期。
 */
export function registerMsFileScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: MS_FILE_SCHEME,
      privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true }
    }
  ])
}

/** 注册实际的文件处理逻辑（必须在 app ready 之后调用） */
export function handleMsFileProtocol(): void {
  protocol.handle(MS_FILE_SCHEME, async (request) => {
    try {
      const url = new URL(request.url)
      const baseDir = url.searchParams.get('dir') ?? ''
      const rel = url.searchParams.get('p') ?? ''
      const abs = rel ? resolve(baseDir, rel) : ''
      // 只放行图片：这个协议不该变成任意文件读取通道
      const mime = abs ? imageMime(abs) : null
      if (!mime) return new Response('forbidden', { status: 403 })
      const buf = await readFile(abs)
      return new Response(buf, { headers: { 'content-type': mime } })
    } catch {
      // 图片缺失/无权限：返回 404，<img> 自然显示为裂图，不影响编辑器
      return new Response('not found', { status: 404 })
    }
  })
}
