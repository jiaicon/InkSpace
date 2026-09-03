export interface DocStats {
  /** 字数：CJK 按字、拉丁按词 */
  words: number
  /** 非空白字符数 */
  chars: number
  /** 行数 */
  lines: number
}

/** 统计文档字数（CJK 字符按字、拉丁按词）、字符数与行数 */
export function countStats(md: string): DocStats {
  const cjk = (md.match(/[一-鿿]/g) ?? []).length
  const latinWords = (md.replace(/[一-鿿]/g, ' ').match(/[A-Za-z0-9]+/g) ?? []).length
  return {
    words: cjk + latinWords,
    chars: md.replace(/\s/g, '').length,
    lines: md.length === 0 ? 0 : md.split('\n').length
  }
}
