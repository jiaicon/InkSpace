import { describe, expect, it } from 'vitest'
import {
  SLASH_GROUP_LABELS,
  SLASH_GROUP_ORDER,
  filterSlashItems,
  groupSlashItems,
  slashItems,
  type SlashItemMeta
} from '../src/renderer/src/editor/slashItems'

const meta = (
  id: string,
  group: SlashItemMeta['group'],
  label: string | undefined,
  tooltip: string,
  keywords: string[]
): SlashItemMeta => ({ id, group, icon: id, label, tooltip, keywords })

// 构造样本时不复用真实定义，避免测试与实现同源、失去约束力
const sample: SlashItemMeta[] = [
  meta('h1', 'heading', undefined, '一级标题', ['h1', 'heading 1']),
  meta('h2', 'heading', undefined, '二级标题', ['h2', 'heading 2']),
  meta('bullet', 'list', '无序列表', '无序列表', ['list', 'bullet']),
  meta('ordered', 'list', '有序列表', '有序列表', ['ordered list']),
  meta('math', 'insert', '数学公式', '数学公式', ['math', 'latex'])
]

describe('filterSlashItems', () => {
  it('空 query 返回全部', () => {
    expect(filterSlashItems(sample, '')).toHaveLength(5)
  })

  it('按 label 中文匹配', () => {
    expect(filterSlashItems(sample, '有序').map((i) => i.id)).toEqual(['ordered'])
  })

  it('按 keywords 匹配，大小写不敏感', () => {
    expect(filterSlashItems(sample, 'LATEX').map((i) => i.id)).toEqual(['math'])
  })

  it('无 label 的项靠 tooltip 命中（H1–H6 只显示代号）', () => {
    expect(filterSlashItems(sample, '一级').map((i) => i.id)).toEqual(['h1'])
  })

  it('query 首尾空白被忽略', () => {
    expect(filterSlashItems(sample, '  math  ').map((i) => i.id)).toEqual(['math'])
  })

  it('无匹配返回空数组', () => {
    expect(filterSlashItems(sample, 'zzzzz')).toEqual([])
  })
})

describe('groupSlashItems', () => {
  it('按固定组顺序归类，并带上组标题', () => {
    // 输入乱序：list, heading, insert
    const groups = groupSlashItems([sample[2], sample[0], sample[4]])
    expect(groups.map((g) => g.group)).toEqual(['heading', 'list', 'insert'])
    expect(groups.map((g) => g.label)).toEqual(['标题', '列表', '插入'])
  })

  it('空组被丢弃（样本里没有的组不出现）', () => {
    const groups = groupSlashItems(sample)
    // 期望值从样本自身推导，而不是写死「除某组之外的全部组」——
    // 否则以后新增一个分组（如 callout）时这条断言会无故失败
    expect(groups.map((g) => g.group)).toEqual(
      SLASH_GROUP_ORDER.filter((g) => sample.some((i) => i.group === g))
    )
  })

  it('组内保持输入顺序', () => {
    const groups = groupSlashItems(sample)
    expect(groups.find((g) => g.group === 'heading')?.items.map((i) => i.id)).toEqual(['h1', 'h2'])
  })

  it('空输入返回空数组', () => {
    expect(groupSlashItems([])).toEqual([])
  })
})

describe('slashItems 定义', () => {
  it('H1–H6 只显示代号（无 label），功能名放进 tooltip', () => {
    for (let level = 1; level <= 6; level++) {
      const item = slashItems.find((i) => i.id === `h${level}`)!
      expect(item, `h${level} 应存在`).toBeDefined()
      expect(item.label).toBeUndefined()
      expect(item.icon).toBe(`H${level}`)
      expect(item.tooltip).toBe(
        `${{ 1: '一', 2: '二', 3: '三', 4: '四', 5: '五', 6: '六' }[level]}级标题`
      )
    }
  })

  it('包含新增的三项：数学公式、Mermaid 图、图片', () => {
    const labels = slashItems.map((i) => i.label)
    expect(labels).toContain('数学公式')
    expect(labels).toContain('Mermaid 图')
    expect(labels).toContain('图片')
  })

  it('相似功能同组：有序与无序列表在同一组', () => {
    const ordered = slashItems.find((i) => i.id === 'ordered')!
    const bullet = slashItems.find((i) => i.id === 'bullet')!
    expect(ordered.group).toBe(bullet.group)
  })

  it('id 唯一', () => {
    const ids = slashItems.map((i) => i.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('补齐的已有能力', () => {
  it('有「正文」项，把当前块转回普通段落（非技术用户的退路）', () => {
    const text = slashItems.find((i) => i.id === 'text')
    expect(text, 'text 项应存在').toBeDefined()
    expect(text!.label).toBe('正文')
    expect(text!.group).toBe('block')
  })

  it('拼音首字母能命中对应项', () => {
    const ids = (q: string) => filterSlashItems(slashItems, q).map((i) => i.id)
    expect(ids('gs')).toEqual(['math']) // 公式
    expect(ids('zw')).toEqual(['text']) // 正文
    expect(ids('bt')).toEqual(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']) // 标题
    expect(ids('lb')).toEqual(['bullet', 'ordered', 'task']) // 列表
    expect(ids('tp')).toEqual(['image']) // 图片
    expect(ids('fgx')).toEqual(['hr']) // 分割线
    expect(ids('yy')).toEqual(['quote']) // 引用
  })
})

describe('提示块面板项', () => {
  it('5 种 callout 各一项，归在 callout 组', () => {
    const ids = [
      'callout-note',
      'callout-tip',
      'callout-important',
      'callout-warning',
      'callout-caution'
    ]
    for (const id of ids) {
      const item = slashItems.find((i) => i.id === id)
      expect(item, `${id} 应存在`).toBeDefined()
      expect(item!.group).toBe('callout')
      expect(item!.label).toBeTruthy()
    }
  })

  it('callout 组排在基础块之后、插入之前', () => {
    expect(SLASH_GROUP_ORDER).toEqual(['heading', 'list', 'block', 'callout', 'insert'])
    expect(SLASH_GROUP_LABELS.callout).toBe('提示块')
  })

  it('新增别名精确命中，不与既有别名撞车', () => {
    const ids = (q: string) => filterSlashItems(slashItems, q).map((i) => i.id)
    expect(ids('ts')).toEqual(['callout-note'])
    expect(ids('jy')).toEqual(['callout-tip'])
    expect(ids('zy')).toEqual(['callout-important'])
    expect(ids('jg')).toEqual(['callout-warning'])
    expect(ids('caution')).toEqual(['callout-caution'])
    // 「危险」刻意不给 wx —— 否则会与「无序列表」的 wxlb 歧义命中
    expect(ids('wx')).toEqual(['bullet'])
  })
})
