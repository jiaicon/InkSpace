/**
 * 斜杠菜单「插入」类条目的初始内容。
 * 单独成模块（不依赖 Milkdown）以便单测 —— 尤其 Mermaid 模板一插入就要能渲染，
 * 否则会踩到「空白块报 No diagram type detected」那个坑（见 shared/mermaid.ts）。
 */

/** 数学公式初始 LaTeX：一插入就有可看的渲染结果，用户在此基础上改 */
export const MATH_BLOCK_PLACEHOLDER = 'a^2 + b^2 = c^2'

/** Mermaid 图初始模板：必须以合法图表关键字开头，渲染器才认得出类型 */
export const MERMAID_BLOCK_TEMPLATE = 'graph TD\n  A[开始] --> B[结束]'
