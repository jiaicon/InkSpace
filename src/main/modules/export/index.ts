import { IPC } from '@shared/ipc'
import type { ExportRequest } from '@shared/types'
import { resolveHighlightTheme } from '@shared/highlightThemes'
import { handle } from '../../ipc/util'
import { createExportService } from './service'
import type { ExportThemeCss } from './compose'
import { buildKatexCss } from './katexCss'
import { renderMermaidSvg } from './mermaidRender'
import type { SettingsService } from '../settings/service'
import type { ThemeStoreHandle } from '../themes'

/** 注册 export 模块的 IPC handler（导出为 HTML / PDF）；两套主题都跟随当前设置 */
export function registerExportIpc(settings: SettingsService, themes: ThemeStoreHandle): void {
  const svc = createExportService({ katexCss: buildKatexCss, mermaid: renderMermaidSvg })

  // 代码主题 'auto' 跟随应用明暗；Markdown 主题 'auto' 表示不套主题（导出用浅色默认值）
  const resolveThemes = async (): Promise<ExportThemeCss> => {
    const s = settings.getAll()
    const markdown =
      s.markdownTheme === 'auto' ? '' : ((await themes.getCss(s.markdownTheme)) ?? '')
    return { markdown, code: resolveHighlightTheme(s.highlightTheme, s.theme).css }
  }

  handle(IPC.exportHtml, async (req) => svc.exportHtml(req as ExportRequest, await resolveThemes()))
  handle(IPC.exportPdf, async (req) => svc.exportPdf(req as ExportRequest, await resolveThemes()))
}
