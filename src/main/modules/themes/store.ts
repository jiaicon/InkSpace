import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import type { MarkdownThemeInfo } from '@shared/types'
import { PRESET_THEMES, buildThemeTemplate, type PresetTheme } from './presets'

/** 主题 id 会被拼进文件路径，必须限制字符集，避免路径穿越 */
const SAFE_ID = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/

/** 'auto'（跟随明暗）不是磁盘主题；其余只允许安全字符且不得含 .. */
export function isSafeThemeId(id: string): boolean {
  return id !== 'auto' && SAFE_ID.test(id) && !id.includes('..')
}

const CSS_FILE = 'theme.css'
const META_FILE = 'theme.json'

interface ThemeMeta {
  name?: string
  description?: string
}

/** 目录名 → 安全的主题 id（去扩展名、非法字符换 '-'） */
export function toThemeId(name: string): string {
  const stem = basename(name, extname(name))
  const cleaned = stem.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/^[.-]+/, '')
  return cleaned.slice(0, 64) || 'theme'
}

/**
 * 主题存储：内置主题写在代码里，自定义主题放在 `<rootDir>/<id>/{theme.json, theme.css}`。
 * 不 import Electron，可用临时目录单测。
 */
export function createThemeStore(rootDir: string) {
  const dirOf = (id: string): string => join(rootDir, id)

  async function readMeta(id: string): Promise<ThemeMeta> {
    try {
      return JSON.parse(await readFile(join(dirOf(id), META_FILE), 'utf8')) as ThemeMeta
    } catch {
      // 没有或解析失败都用默认值，不影响主题可用
      return {}
    }
  }

  async function isThemeDir(id: string): Promise<boolean> {
    try {
      const s = await stat(join(dirOf(id), CSS_FILE))
      return s.isFile()
    } catch {
      return false
    }
  }

  return {
    dir: () => rootDir,

    /** 打开主题目录前确保它存在 */
    async ensureDir(): Promise<string> {
      await mkdir(rootDir, { recursive: true })
      return rootDir
    },

    /** 内置主题 + 磁盘上的自定义主题 */
    async list(): Promise<MarkdownThemeInfo[]> {
      const builtin: MarkdownThemeInfo[] = PRESET_THEMES.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        builtin: true
      }))

      let ids: string[] = []
      try {
        const entries = await readdir(rootDir, { withFileTypes: true })
        ids = entries.filter((e) => e.isDirectory() && isSafeThemeId(e.name)).map((e) => e.name)
      } catch {
        // 目录还不存在，说明还没有自定义主题
      }

      const custom: MarkdownThemeInfo[] = []
      for (const id of ids.sort()) {
        if (!(await isThemeDir(id))) continue
        const meta = await readMeta(id)
        custom.push({
          id,
          name: meta.name?.trim() || id,
          description: meta.description?.trim(),
          builtin: false
        })
      }

      return [...builtin, ...custom]
    },

    /** 取主题 CSS；内置优先，其次磁盘；找不到返回 null */
    async getCss(id: string): Promise<string | null> {
      const preset = PRESET_THEMES.find((t) => t.id === id)
      if (preset) return (preset as PresetTheme).css
      if (!isSafeThemeId(id)) return null
      try {
        return await readFile(join(dirOf(id), CSS_FILE), 'utf8')
      } catch {
        return null
      }
    },

    /** 把外部 .css 导入为自定义主题；重名时自动加后缀，不覆盖已有主题 */
    async importFromFile(sourcePath: string): Promise<MarkdownThemeInfo> {
      const css = await readFile(sourcePath, 'utf8')
      const base = toThemeId(sourcePath)

      await mkdir(rootDir, { recursive: true })
      let id = base
      for (let n = 2; await isThemeDir(id); n++) id = `${base}-${n}`

      const target = join(dirOf(id), CSS_FILE)
      await mkdir(dirOf(id), { recursive: true })
      await writeFile(target, css, 'utf8')
      await writeFile(
        join(dirOf(id), META_FILE),
        JSON.stringify({ name: id, description: '导入的自定义主题' }, null, 2),
        'utf8'
      )
      return { id, name: id, description: '导入的自定义主题', builtin: false }
    },

    /** 把主题 CSS 写到指定文件，方便用户改完再导入 */
    async exportToFile(id: string, targetPath: string): Promise<void> {
      const css = await this.getCss(id)
      const content = css ?? buildThemeTemplate()
      const header = '/* 由「墨境」导出。改完此文件后，用「导入主题…」把它加回应用。 */\n\n'
      await writeFile(targetPath, header + content, 'utf8')
    }
  }
}
