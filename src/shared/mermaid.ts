/**
 * Mermaid 相关的共用判断：编辑器的 node view 与导出的块替换都要用，
 * 所以放在 shared，避免两边规则不一致。
 */

/**
 * 不可见字符的码点区间。
 * 用码点拼出正则、而不是在源码里直接嵌这些字符——字面量会把源文件本身弄坏
 * （U+2028 之类在正则字面量里非法，直接编译失败）。
 */
const INVISIBLE_RANGES: [number, number][] = [
  [0x0000, 0x001f], // C0 控制字符
  [0x007f, 0x007f], // DEL
  [0x00a0, 0x00a0], // 不换行空格
  [0x200b, 0x200f], // 零宽空格/连接符/非连接符、方向标记
  [0x2028, 0x2029], // 行分隔符、段分隔符
  [0x202f, 0x202f], // 窄不换行空格
  [0x2060, 0x2060], // 词连接符
  [0xfeff, 0xfeff] // BOM
]

const INVISIBLE_RE = new RegExp(
  '[' +
    INVISIBLE_RANGES.map(
      ([from, to]) => `${String.fromCharCode(from)}-${String.fromCharCode(to)}`
    ).join('') +
    ']',
  'g'
)

/**
 * 去掉不可见字符后是否还有真实内容。
 * `trim()` 去不掉零宽字符，于是「看起来是空的」块会被送去渲染并报
 * “No diagram type detected”——所以这里主动剔除后再判断。
 */
export function hasMermaidContent(code: string): boolean {
  return code.replace(INVISIBLE_RE, '').trim().length > 0
}

/**
 * 把 mermaid 的报错转成用户能看懂的提示。
 * mermaid 原文是面向库使用者的（“No diagram type detected …”），直接抛给用户没意义。
 */
export function mermaidErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err)
  if (/No diagram type detected/i.test(raw)) {
    return '看不出图表类型：Mermaid 需要以 graph、flowchart、sequenceDiagram 等关键字开头'
  }
  return `语法有误：${raw}`
}
