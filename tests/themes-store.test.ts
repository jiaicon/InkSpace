import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { mkdtemp, mkdir, rm, writeFile, readFile, access } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createThemeStore, isSafeThemeId, toThemeId } from '../src/main/modules/themes/store'
import { PRESET_THEMES, buildThemeTemplate } from '../src/main/modules/themes/presets'

let root: string
const store = () => createThemeStore(root)

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'ms-themes-'))
})
afterAll(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('isSafeThemeId（id 会拼进路径，必须挡住穿越）', () => {
  it('接受常规 id', () => {
    expect(isSafeThemeId('my-theme')).toBe(true)
    expect(isSafeThemeId('theme_1.2')).toBe(true)
  })

  it('拒绝路径穿越与分隔符', () => {
    expect(isSafeThemeId('../evil')).toBe(false)
    expect(isSafeThemeId('a/b')).toBe(false)
    expect(isSafeThemeId('a\\b')).toBe(false)
    expect(isSafeThemeId('..')).toBe(false)
    expect(isSafeThemeId('.hidden')).toBe(false)
  })

  it("拒绝 'auto'（它是设置里的保留值，不是磁盘主题）", () => {
    expect(isSafeThemeId('auto')).toBe(false)
  })
})

describe('toThemeId', () => {
  it('把非法字符换成 -', () => {
    expect(toThemeId('My Theme.css')).toBe('My-Theme')
  })

  it('非 ASCII 名称退化为默认 id（id 只允许 ASCII，与 userData 用 ASCII 同一理由）', () => {
    expect(toThemeId('我的 主题.css')).toBe('theme')
  })

  it('去掉开头的点，避免生成隐藏目录', () => {
    expect(toThemeId('.hidden.css')).toBe('hidden')
  })

  it('结果为空时回落到 theme', () => {
    expect(toThemeId('...')).toBe('theme')
  })
})

describe('createThemeStore', () => {
  it('list 至少包含全部内置主题', async () => {
    const list = await store().list()
    for (const preset of PRESET_THEMES) {
      expect(list.some((t) => t.id === preset.id && t.builtin)).toBe(true)
    }
  })

  it('getCss 能取到内置主题的 CSS', async () => {
    const css = await store().getCss('juejin')
    expect(css).toContain('--ms-accent')
    expect(css).toContain('.milkdown')
  })

  it('getCss 对不存在的主题返回 null', async () => {
    expect(await store().getCss('no-such-theme')).toBeNull()
    expect(await store().getCss('../evil')).toBeNull()
  })

  it('导入 .css 后出现在列表里，且能读回内容', async () => {
    const src = join(root, '..', `import-src-${Date.now()}.css`)
    await writeFile(src, '.milkdown { --ms-accent: #ff0000; }', 'utf8')

    const info = await store().importFromFile(src)
    expect(info.builtin).toBe(false)

    const list = await store().list()
    expect(list.some((t) => t.id === info.id && !t.builtin)).toBe(true)
    expect(await store().getCss(info.id)).toContain('#ff0000')

    await rm(src, { force: true })
  })

  it('重复导入同名主题不会覆盖，而是加后缀', async () => {
    const src = join(root, '..', `dup-${Date.now()}.css`)
    await writeFile(src, '.milkdown { --ms-accent: #00ff00; }', 'utf8')
    const a = await store().importFromFile(src)
    const b = await store().importFromFile(src)
    expect(b.id).not.toBe(a.id)
    expect(await store().getCss(a.id)).toContain('#00ff00')
    expect(await store().getCss(b.id)).toContain('#00ff00')
    await rm(src, { force: true })
  })

  it('没有 theme.css 的目录不算主题（避免列出垃圾目录）', async () => {
    await mkdir(join(root, 'not-a-theme'), { recursive: true })
    const list = await store().list()
    expect(list.some((t) => t.id === 'not-a-theme')).toBe(false)
  })

  it('theme.json 损坏时仍能列出主题（名称回落到目录名）', async () => {
    await mkdir(join(root, 'broken-meta'), { recursive: true })
    await writeFile(join(root, 'broken-meta', 'theme.css'), '.milkdown{}', 'utf8')
    await writeFile(join(root, 'broken-meta', 'theme.json'), '{ not json', 'utf8')
    const list = await store().list()
    const found = list.find((t) => t.id === 'broken-meta')
    expect(found?.name).toBe('broken-meta')
  })

  it('theme.json 里的 name 会被采用', async () => {
    await mkdir(join(root, 'named'), { recursive: true })
    await writeFile(join(root, 'named', 'theme.css'), '.milkdown{}', 'utf8')
    await writeFile(
      join(root, 'named', 'theme.json'),
      JSON.stringify({ name: '我的主题', description: '测试' }),
      'utf8'
    )
    const found = (await store().list()).find((t) => t.id === 'named')
    expect(found?.name).toBe('我的主题')
    expect(found?.description).toBe('测试')
  })

  it('导出主题到文件，内容含主题 CSS 与说明头', async () => {
    const target = join(root, '..', `export-${Date.now()}.css`)
    await store().exportToFile('nord', target)
    const text = await readFile(target, 'utf8')
    expect(text).toContain('由「墨境」导出')
    expect(text).toContain('--ms-bg: #2e3440')
    await rm(target, { force: true })
  })

  it('导出不存在的主题时给出模板，而不是写空文件', async () => {
    const target = join(root, '..', `export-missing-${Date.now()}.css`)
    await store().exportToFile('no-such', target)
    expect(await readFile(target, 'utf8')).toContain('--ms-accent')
    expect(buildThemeTemplate()).toContain('.milkdown')
    await rm(target, { force: true })
  })

  it('ensureDir 会创建目录并返回路径', async () => {
    const nested = createThemeStore(join(root, 'a', 'b'))
    const dir = await nested.ensureDir()
    await expect(access(dir)).resolves.toBeUndefined()
  })
})
