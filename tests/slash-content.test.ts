import { describe, expect, it } from 'vitest'
import { hasMermaidContent } from '../src/shared/mermaid'
import {
  MATH_BLOCK_PLACEHOLDER,
  MERMAID_BLOCK_TEMPLATE
} from '../src/renderer/src/editor/slashContent'

describe('斜杠菜单插入的初始内容', () => {
  it('数学公式占位是非空 LaTeX（插入后立刻有可看的渲染结果）', () => {
    expect(MATH_BLOCK_PLACEHOLDER.trim().length).toBeGreaterThan(0)
  })

  it('Mermaid 模板以合法图表关键字开头（否则渲染器报 No diagram type detected）', () => {
    expect(MERMAID_BLOCK_TEMPLATE.trim()).toMatch(
      /^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|journey|mindmap|timeline)\b/
    )
  })

  it('Mermaid 模板能被共用判断认定为「有内容」', () => {
    expect(hasMermaidContent(MERMAID_BLOCK_TEMPLATE)).toBe(true)
  })
})
