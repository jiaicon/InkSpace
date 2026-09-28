import { describe, expect, it } from 'vitest'
import { addHljsClassToCodeBlocks, type HastNode } from '../src/main/modules/export/ensureCodeClass'

const text = (value: string): HastNode => ({ type: 'text', value })
const el = (tagName: string, children: HastNode[], className?: unknown): HastNode => ({
  type: 'element',
  tagName,
  properties: className === undefined ? {} : { className },
  children
})
// root → pre → code 的 className
const classesOf = (root: HastNode): unknown =>
  root.children?.[0]?.children?.[0]?.properties?.className

describe('addHljsClassToCodeBlocks', () => {
  it('无语言的代码块被补上 hljs（这是它拿到主题样式的前提）', () => {
    const tree = el('root', [el('pre', [el('code', [text('plain')])])])
    addHljsClassToCodeBlocks(tree)
    expect(classesOf(tree)).toEqual(['hljs'])
  })

  it('已有 language-xx 的代码块补成 hljs + language-xx，且 hljs 在前', () => {
    const tree = el('root', [el('pre', [el('code', [text('x')], ['language-js'])])])
    addHljsClassToCodeBlocks(tree)
    expect(classesOf(tree)).toEqual(['hljs', 'language-js'])
  })

  it('已经有 hljs 时不重复添加', () => {
    const tree = el('root', [el('pre', [el('code', [text('x')], ['hljs', 'language-js'])])])
    addHljsClassToCodeBlocks(tree)
    expect(classesOf(tree)).toEqual(['hljs', 'language-js'])
  })

  it('类名写成字符串时也能处理', () => {
    const tree = el('root', [el('pre', [el('code', [text('x')], 'language-js')])])
    addHljsClassToCodeBlocks(tree)
    expect(classesOf(tree)).toEqual(['hljs', 'language-js'])
  })

  it('嵌套在其他元素里的代码块同样处理（如引用里的代码块）', () => {
    const tree = el('root', [el('blockquote', [el('pre', [el('code', [text('x')])])])])
    addHljsClassToCodeBlocks(tree)
    expect(tree.children?.[0].children?.[0].children?.[0].properties?.className).toEqual(['hljs'])
  })

  it('行内 code（不在 pre 里）不受影响', () => {
    const tree = el('root', [el('p', [el('code', [text('inline')])])])
    addHljsClassToCodeBlocks(tree)
    expect(tree.children?.[0].children?.[0].properties?.className).toBeUndefined()
  })

  it('保留其它已有属性', () => {
    const code = el('code', [text('x')])
    code.properties = { className: ['language-js'], 'data-x': '1' }
    const tree = el('root', [el('pre', [code])])
    addHljsClassToCodeBlocks(tree)
    expect(code.properties).toEqual({ className: ['hljs', 'language-js'], 'data-x': '1' })
  })

  it('空节点 / 空 children 不抛错', () => {
    expect(() => addHljsClassToCodeBlocks(undefined)).not.toThrow()
    expect(() => addHljsClassToCodeBlocks({ type: 'element', tagName: 'pre' })).not.toThrow()
  })
})
