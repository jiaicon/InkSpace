import { app } from 'electron'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import rawKatexCss from 'katex/dist/katex.min.css?raw'

/**
 * KaTeX 样式里对字体的引用，形如 url(fonts/KaTeX_Main-Regular.woff2)（可能带引号）。
 * 只内联 woff2：现代浏览器与 Electron 都支持，woff/ttf 只是回落格式。
 */
const FONT_URL_RE = /url\((['"]?)fonts\/([^'")]+?\.woff2)\1\)/g

/**
 * woff2 内联之后，剩下的 woff/ttf 回落项只会让导出物去请求不存在的文件（404），
 * 一并删掉——现代浏览器不需要这层回落。KaTeX 的每个 @font-face 都列出了 woff2，
 * 所以不会出现删空 src 的情况。
 */
const DROP_LEGACY_FONTS_RE = /,\s*url\((['"]?)fonts\/[^'")]+\1\)\s*(?:format\([^)]*\))?/g

let cached: string | null = null

/**
 * 生成自包含的 KaTeX 样式（字体内联为 data URI）。
 *
 * 公式排版依赖 KaTeX 自带字体，不内联的话导出的 HTML/PDF 会缺字错位；而导出物要能离线打开、
 * 直接分享，所以不能引用外部文件。仅当文档里真的有公式时才调用这里（见 compose.ts），
 * 没有公式的文档一点不受影响。
 */
export async function buildKatexCss(): Promise<string> {
  if (cached) return cached

  // app.getAppPath() 在开发态是项目根、打包后是 app.asar，两边都能定位到依赖
  const fontsDir = join(app.getAppPath(), 'node_modules', 'katex', 'dist', 'fonts')
  const names = [...new Set([...rawKatexCss.matchAll(FONT_URL_RE)].map((m) => m[2]))]

  const dataUris = new Map<string, string>()
  await Promise.all(
    names.map(async (name) => {
      try {
        const buf = await readFile(join(fontsDir, name))
        dataUris.set(name, `data:font/woff2;base64,${buf.toString('base64')}`)
      } catch {
        // 读不到就保持原引用：只是缺字体，不能让导出失败
      }
    })
  )

  const withFonts = rawKatexCss.replace(FONT_URL_RE, (whole, quote: string, name: string) => {
    const uri = dataUris.get(name)
    return uri ? `url(${quote}${uri}${quote})` : whole
  })

  cached = withFonts.replace(DROP_LEGACY_FONTS_RE, '')
  return cached
}

/** 只有渲染结果里真的出现了 KaTeX 元素才需要注入样式 */
export function hasMath(bodyHtml: string): boolean {
  return bodyHtml.includes('class="katex')
}
