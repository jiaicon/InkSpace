/**
 * 提示块（GitHub Alerts）的共用规则：编辑器的装饰插件与导出的块转换都要用，
 * 所以放 shared，避免两边判断不一致（同 shared/mermaid.ts 的理由）。
 *
 * 语法：blockquote 的**首段**整段恰为 `[!TYPE]`，如
 *   > [!NOTE]
 *   >
 *   > 内容
 * 标记与内容写在同一段（无空 `>` 行）**不识别**——见 spec §5.1 的已知限制。
 */

export type CalloutType = 'NOTE' | 'TIP' | 'IMPORTANT' | 'WARNING' | 'CAUTION'

export interface CalloutMeta {
  type: CalloutType
  /** css 类后缀：note → callout-note */
  slug: string
  /** 展示用中文标题 */
  title: string
}

export const CALLOUTS: readonly CalloutMeta[] = [
  { type: 'NOTE', slug: 'note', title: '提示' },
  { type: 'TIP', slug: 'tip', title: '建议' },
  { type: 'IMPORTANT', slug: 'important', title: '重要' },
  { type: 'WARNING', slug: 'warning', title: '警告' },
  { type: 'CAUTION', slug: 'caution', title: '危险' }
]

const BY_TYPE = new Map(CALLOUTS.map((c) => [c.type, c]))

export function calloutMeta(type: CalloutType): CalloutMeta {
  return BY_TYPE.get(type) as CalloutMeta
}

const MARKER_RE = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]$/i

/** 整段文本是否为 callout 标记；不是则返回 null */
export function parseCalloutMarker(text: string): CalloutType | null {
  const m = MARKER_RE.exec(text.trim())
  return m ? (m[1].toUpperCase() as CalloutType) : null
}

/** 写入文档时统一用大写标记 */
export function calloutMarkerText(type: CalloutType): string {
  return `[!${type}]`
}
