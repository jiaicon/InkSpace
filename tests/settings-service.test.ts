import { describe, expect, it } from 'vitest'
import { createSettingsService } from '../src/main/modules/settings/service'
import type { SettingsRepository } from '../src/main/modules/settings/repository'

// 用内存 Map 冒充 repository：这里要测的是 service 的默认值/收敛/校验逻辑，
// 不依赖真实 SQLite（原生模块在本机 CI 上存在 ABI 限制）。
function fakeRepo(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial))
  return {
    get: (key: string) => store.get(key),
    getAll: () => Object.fromEntries(store),
    set: (key: string, value: string) => {
      store.set(key, value)
    },
    dump: () => Object.fromEntries(store)
  } satisfies SettingsRepository & { dump(): Record<string, string> }
}

const DEFAULT_DIR = 'D:/Pictures/InkSpace'

describe('settings service', () => {
  it('无存量时返回默认值：统一目录为主、浅色主题', () => {
    expect(createSettingsService(fakeRepo(), DEFAULT_DIR).getAll()).toEqual({
      theme: 'light',
      imageStorage: 'unified',
      imageDir: DEFAULT_DIR,
      imageSubdir: 'assets'
    })
  })

  it('读取库里的存量值', () => {
    const repo = fakeRepo({
      theme: 'dark',
      imageStorage: 'relative',
      imageDir: 'D:/图库',
      imageSubdir: 'img'
    })
    expect(createSettingsService(repo, DEFAULT_DIR).getAll()).toEqual({
      theme: 'dark',
      imageStorage: 'relative',
      imageDir: 'D:/图库',
      imageSubdir: 'img'
    })
  })

  it('库里的非法枚举值回落到默认，避免脏数据导致行为异常', () => {
    const repo = fakeRepo({ theme: 'rainbow', imageStorage: 'whatever' })
    const s = createSettingsService(repo, DEFAULT_DIR).getAll()
    expect(s.theme).toBe('light')
    expect(s.imageStorage).toBe('unified')
  })

  it('空字符串的目录/子目录名回落到默认', () => {
    const s = createSettingsService(
      fakeRepo({ imageDir: '', imageSubdir: '' }),
      DEFAULT_DIR
    ).getAll()
    expect(s.imageDir).toBe(DEFAULT_DIR)
    expect(s.imageSubdir).toBe('assets')
  })

  it('写入合法值后能读回', () => {
    const svc = createSettingsService(fakeRepo(), DEFAULT_DIR)
    svc.set('theme', 'dark')
    svc.set('imageStorage', 'relative')
    svc.set('imageDir', 'E:/pics')
    svc.set('imageSubdir', 'img')
    expect(svc.getAll()).toEqual({
      theme: 'dark',
      imageStorage: 'relative',
      imageDir: 'E:/pics',
      imageSubdir: 'img'
    })
  })

  describe('校验（IPC 边界，非法值必须挡下）', () => {
    const svc = () => createSettingsService(fakeRepo(), DEFAULT_DIR)

    it('拒绝未知设置项', () => {
      expect(() => svc().set('nope', 'x')).toThrow(/未知的设置项/)
    })

    it('拒绝未知主题与未知图片模式', () => {
      expect(() => svc().set('theme', 'rainbow')).toThrow(/未知的主题/)
      expect(() => svc().set('imageStorage', 'cloud')).toThrow(/未知的图片存放模式/)
    })

    it('拒绝相对路径的图片目录', () => {
      expect(() => svc().set('imageDir', './assets')).toThrow(/绝对路径/)
    })

    it('拒绝空或含路径分隔符的子目录名（防跳出文档目录）', () => {
      expect(() => svc().set('imageSubdir', '')).toThrow(/非法字符/)
      expect(() => svc().set('imageSubdir', '../evil')).toThrow(/非法字符/)
      expect(() => svc().set('imageSubdir', 'a\\b')).toThrow(/非法字符/)
    })

    it('校验失败时不写入任何内容', () => {
      const repo = fakeRepo()
      const s = createSettingsService(repo, DEFAULT_DIR)
      expect(() => s.set('theme', 'rainbow')).toThrow()
      expect(repo.dump()).toEqual({})
    })
  })
})
