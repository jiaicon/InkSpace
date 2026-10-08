import { describe, expect, it } from 'vitest'
import { CALLOUTS, calloutMarkerText, calloutMeta, parseCalloutMarker } from '../src/shared/callout'

describe('parseCalloutMarker', () => {
  it('识别 5 种类型', () => {
    expect(parseCalloutMarker('[!NOTE]')).toBe('NOTE')
    expect(parseCalloutMarker('[!TIP]')).toBe('TIP')
    expect(parseCalloutMarker('[!IMPORTANT]')).toBe('IMPORTANT')
    expect(parseCalloutMarker('[!WARNING]')).toBe('WARNING')
    expect(parseCalloutMarker('[!CAUTION]')).toBe('CAUTION')
  })

  it('容忍小写与前后空白', () => {
    expect(parseCalloutMarker('  [!note]  ')).toBe('NOTE')
    expect(parseCalloutMarker('[!Caution]')).toBe('CAUTION')
  })

  it('标记与内容同段不识别（spec §5.1 已知限制）', () => {
    expect(parseCalloutMarker('[!NOTE]\n内容')).toBeNull()
  })

  it('标记后面跟正文不识别', () => {
    expect(parseCalloutMarker('[!NOTE] 跟上正文')).toBeNull()
  })

  it('未知类型不识别', () => {
    expect(parseCalloutMarker('[!FOO]')).toBeNull()
  })

  it('普通文本与空串不识别', () => {
    expect(parseCalloutMarker('普通引用')).toBeNull()
    expect(parseCalloutMarker('')).toBeNull()
  })
})

describe('类型表', () => {
  it('5 种类型齐全，类名与中文标题符合约定', () => {
    expect(CALLOUTS.map((c) => c.type)).toEqual(['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION'])
    expect(calloutMeta('WARNING')).toEqual({ type: 'WARNING', slug: 'warning', title: '警告' })
    expect(calloutMeta('CAUTION').title).toBe('危险')
  })

  it('calloutMarkerText 产出大写标记', () => {
    expect(calloutMarkerText('NOTE')).toBe('[!NOTE]')
  })
})
