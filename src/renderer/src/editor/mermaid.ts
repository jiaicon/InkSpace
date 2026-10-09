import { $view } from '@milkdown/kit/utils'
import { codeBlockSchema } from '@milkdown/kit/preset/commonmark'
import type { Node as PMNode } from '@milkdown/kit/prose/model'
import type { NodeView, ViewMutationRecord } from '@milkdown/kit/prose/view'
import mermaidUrl from 'mermaid/dist/mermaid.min.js?url'
import { hasMermaidContent, mermaidErrorMessage } from '@shared/mermaid'
import { resolveMermaidTheme } from '@shared/mermaidThemes'
import { editingDecoration } from './editingDecoration'

/**
 * Mermaid 图表。
 *
 * markdown 里就是普通的 ```mermaid 代码块，不引入新节点类型——存回去仍是原文，往返不丢。
 * 编辑器侧给代码块加 node view：语言是 mermaid 时渲染成图，光标进入显示源码
 * （与数学公式同一套就地编辑体验）；其它语言保持 Milkdown 默认的 <pre><code>。
 *
 * mermaid 用官方 UMD 单文件（约 5MB，已内联全部图表类型），**按需加载**：
 * 文档里没有图表就一个字节都不下载。
 */

interface MermaidApi {
  initialize(config: Record<string, unknown>): void
  render(id: string, text: string): Promise<{ svg: string }>
}

const MERMAID_LANG = 'mermaid'

const languageOf = (node: PMNode): string =>
  String(node.attrs.language ?? '')
    .trim()
    .toLowerCase()

let loading: Promise<MermaidApi> | null = null

function loadMermaid(): Promise<MermaidApi> {
  if (!loading) {
    loading = new Promise<MermaidApi>((resolve, reject) => {
      const script = document.createElement('script')
      script.src = mermaidUrl
      script.onload = () => {
        const api = (window as unknown as { mermaid?: MermaidApi }).mermaid
        if (api) resolve(api)
        else reject(new Error('mermaid 未挂载到 window'))
      }
      script.onerror = () => reject(new Error('mermaid 资源加载失败'))
      document.head.appendChild(script)
    })
  }
  return loading
}

let renderSeq = 0

/**
 * 渲染一段 mermaid 源码为 SVG。
 * 每次渲染前按当前主题 initialize：mermaid 的主题是烧进 SVG 的，不重新 initialize 就换不了色。
 * 主题从 <html> 的两个 data 属性读（与 data-theme 同一套机制）：mermaidTheme 是用户在设置里选的，
 * 缺省/auto 时回落到明暗对应的主题。
 */
async function renderDiagram(code: string): Promise<string> {
  const api = await loadMermaid()
  const root = document.documentElement
  api.initialize({
    startOnLoad: false,
    theme: resolveMermaidTheme(
      root.dataset.mermaidTheme,
      root.dataset.theme === 'dark' ? 'dark' : 'light'
    ),
    // strict 会对标签里的 HTML 做净化——图表内容来自用户文档，不能直接信任
    securityLevel: 'strict'
  })
  const { svg } = await api.render(`ms-mermaid-${++renderSeq}`, code)
  return svg
}

/**
 * 已挂载图表的「重画」回调集合。
 * mermaid 的配色是内联在 SVG 里的，切换明暗主题时改 CSS 不起作用，必须重新渲染。
 */
const mountedDraws = new Set<() => void>()

/** 重新渲染所有已挂载的图表（主题切换后由宿主调用） */
export function refreshMermaidViews(): void {
  for (const redraw of mountedDraws) redraw()
}

/** 代码块 node view：mermaid 渲染成图，其余语言保持默认结构 */
export const codeBlockView = $view(codeBlockSchema.node, () => (node): NodeView => {
  // —— 普通代码块：复刻 Milkdown 默认的 <pre data-language><code> ——
  if (languageOf(node) !== MERMAID_LANG) {
    const pre = document.createElement('pre')
    const code = document.createElement('code')
    pre.appendChild(code)
    const setLang = (n: PMNode): void => {
      const lang = languageOf(n)
      if (lang) pre.dataset.language = lang
      else delete pre.dataset.language
    }
    setLang(node)

    let current = node
    return {
      dom: pre,
      contentDOM: code,
      update: (next: PMNode) => {
        if (next.type !== current.type) return false
        // 变成 mermaid 了：DOM 结构完全不同，交回 ProseMirror 重建
        if (languageOf(next) === MERMAID_LANG) return false
        setLang(next)
        current = next
        return true
      }
    }
  }

  // —— mermaid 块：渲染层 + 源码层，由 .is-editing 决定显示哪个 ——
  const wrapper = document.createElement('div')
  wrapper.className = 'ms-mermaid'

  const preview = document.createElement('div')
  preview.className = 'ms-mermaid-render'
  preview.setAttribute('contenteditable', 'false')

  const pre = document.createElement('pre')
  pre.className = 'ms-mermaid-src'
  pre.dataset.language = MERMAID_LANG
  const code = document.createElement('code')
  pre.appendChild(code)
  wrapper.append(preview, pre)

  // token：只认最后一次渲染的结果，避免快速编辑时旧结果覆盖新结果
  let token = 0
  const draw = (text: string): void => {
    const mine = ++token
    // 空内容（含只有零宽字符的情况）不必渲染：mermaid 会报「看不出图表类型」
    if (!hasMermaidContent(text)) {
      preview.classList.remove('is-error')
      preview.textContent = ''
      return
    }
    renderDiagram(text)
      .then((svg) => {
        if (mine !== token) return
        preview.classList.remove('is-error')
        preview.innerHTML = svg
      })
      .catch((err: unknown) => {
        if (mine !== token) return
        preview.classList.add('is-error')
        preview.textContent = mermaidErrorMessage(err)
      })
  }
  draw(node.textContent)

  let current = node
  // 注册重画回调：切换明暗主题时要按新主题重新渲染（见 refreshMermaidViews）
  const redraw = (): void => draw(current.textContent)
  mountedDraws.add(redraw)

  return {
    dom: wrapper,
    contentDOM: code,
    update: (next: PMNode) => {
      if (next.type !== current.type) return false
      // 语言改成了别的：结构要换回去，交回 ProseMirror 重建
      if (languageOf(next) !== MERMAID_LANG) return false
      if (next.textContent !== current.textContent) draw(next.textContent)
      current = next
      return true
    },
    destroy: () => {
      mountedDraws.delete(redraw)
    },
    // 渲染层的变化不是文档编辑，只有源码层（contentDOM）里的才算
    ignoreMutation: (mutation: ViewMutationRecord) => !code.contains(mutation.target)
  }
})

/** 光标进入图表块时显示源码 */
export const mermaidEditing = editingDecoration(
  'MS_MERMAID_EDITING',
  (node) => node.type.name === 'code_block' && languageOf(node) === MERMAID_LANG
)

export const mermaidPlugins = [codeBlockView, mermaidEditing].flat()
