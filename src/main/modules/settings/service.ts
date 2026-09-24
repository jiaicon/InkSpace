import { isAbsolute } from 'node:path'
import type { AppSettings, ImageStorageMode, ThemeMode } from '@shared/types'
import type { SettingsRepository } from './repository'

const IMAGE_STORAGE_MODES: readonly ImageStorageMode[] = ['unified', 'relative']
const THEMES: readonly ThemeMode[] = ['light', 'dark']
// 子目录名不得含路径分隔符或 Windows 非法字符，避免被用来跳出文档目录
const INVALID_SUBDIR = /[\\/:*?"<>|]/

export function defaultSettings(defaultImageDir: string): AppSettings {
  return {
    theme: 'light',
    imageStorage: 'unified',
    imageDir: defaultImageDir,
    imageSubdir: 'assets'
  }
}

export interface SettingsService {
  getAll(): AppSettings
  /** 校验并写入一项设置；非法值直接抛错（IPC 边界会转成错误返回） */
  set(key: string, value: string): void
}

/**
 * 设置业务 service：读取时把库里的字符串值收敛成合法枚举，缺失项回落到默认值。
 * 不 import Electron（默认目录由调用方注入），可用 ':memory:' 单测。
 */
export function createSettingsService(
  repo: SettingsRepository,
  defaultImageDir: string
): SettingsService {
  const defaults = defaultSettings(defaultImageDir)

  return {
    getAll: () => {
      const stored = repo.getAll()
      return {
        theme: THEMES.includes(stored.theme as ThemeMode)
          ? (stored.theme as ThemeMode)
          : defaults.theme,
        imageStorage: IMAGE_STORAGE_MODES.includes(stored.imageStorage as ImageStorageMode)
          ? (stored.imageStorage as ImageStorageMode)
          : defaults.imageStorage,
        imageDir: stored.imageDir || defaults.imageDir,
        imageSubdir: stored.imageSubdir || defaults.imageSubdir
      }
    },

    set: (key, value) => {
      if (!(key in defaults)) throw new Error(`未知的设置项：${key}`)
      if (key === 'theme' && !THEMES.includes(value as ThemeMode)) {
        throw new Error(`未知的主题：${value}`)
      }
      if (key === 'imageStorage' && !IMAGE_STORAGE_MODES.includes(value as ImageStorageMode)) {
        throw new Error(`未知的图片存放模式：${value}`)
      }
      if (key === 'imageDir' && !isAbsolute(value)) {
        throw new Error(`图片目录必须是绝对路径：${value}`)
      }
      if (key === 'imageSubdir' && (value === '' || INVALID_SUBDIR.test(value))) {
        throw new Error(`子目录名不能为空或包含非法字符：${value}`)
      }
      repo.set(key, value)
    }
  }
}
