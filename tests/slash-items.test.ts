import { describe, expect, it } from 'vitest'
import {
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

  it('空组被丢弃（样本里没有 基础块）', () => {
    const groups = groupSlashItems(sample)
    expect(groups.map((g) => g.group)).toEqual(SLASH_GROUP_ORDER.filter((g) => g !== 'block'))
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
