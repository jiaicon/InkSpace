import { describe, expect, it } from 'vitest'
import { hasMermaidContent, mermaidErrorMessage } from '../src/shared/mermaid'

/** 用码点拼不可见字符，避免测试文件本身被这些字符弄坏 */
const chars = (...codes: number[]): string => String.fromCharCode(...codes)

describe('hasMermaidContent', () => {
  it('正常图表源码算有内容', () => {
    expect(hasMermaidContent('graph TD;\n  A --> B')).toBe(true)
  })

  it('空串与纯空白算没有内容', () => {
    expect(hasMermaidContent('')).toBe(false)
    expect(hasMermaidContent('   \n\t  ')).toBe(false)
  })

  it('零宽字符 / 不换行空格 / 词连接符 / BOM 也算没有内容（trim 去不掉它们）', () => {
    expect(hasMermaidContent(chars(0x200b))).toBe(false)
    expect(hasMermaidContent(chars(0x200b, 0x200c, 0xfeff))).toBe(false)
    expect(hasMermaidContent(chars(0x00a0))).toBe(false)
    expect(hasMermaidContent(chars(0x2060))).toBe(false)
  })

  it('夹杂零宽字符的真实内容仍然算有内容', () => {
    expect(hasMermaidContent(chars(0x200b) + 'graph TD')).toBe(true)
  })
})

describe('mermaidErrorMessage', () => {
  it('“看不出图表类型”翻译成人话，并给出怎么改', () => {
    const msg = mermaidErrorMessage(
      new Error('No diagram type detected matching given configuration for text: ')
    )
    expect(msg).toContain('看不出图表类型')
    expect(msg).toContain('graph')
    expect(msg).not.toContain('No diagram type detected')
  })

  it('其它语法错误保留原文并标明是语法问题', () => {
    const msg = mermaidErrorMessage(new Error('Parse error on line 2'))
    expect(msg).toContain('语法有误')
    expect(msg).toContain('Parse error on line 2')
  })

  it('非 Error 对象也能处理', () => {
    expect(mermaidErrorMessage('boom')).toContain('boom')
    expect(mermaidErrorMessage(undefined)).toContain('语法有误')
  })
})
