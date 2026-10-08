import { readFile, stat } from 'node:fs/promises'
import { basename } from 'node:path'
import type { FileTreeNode, SearchFileResult, SearchResponse } from '@shared/types'
import { buildFileTree } from './tree'

/** 单行上下文两侧各留多少字符（命中本身不计入这个窗口） */
const CONTEXT = 40
/** 超过这个体积的文件跳过，避免个别大文件把搜索拖死 */
const MAX_FILE_BYTES = 2 * 1024 * 1024
const DEFAULT_MAX_MATCHES = 500

export interface SearchOptions {
  caseSensitive?: boolean
  /** 命中上限，超出即截断并标记 truncated */
  maxMatches?: number
}

/** 把命中行裁成一段上下文窗口，返回裁剪后的文本与命中在其中的起始列 */
export function clipLine(
  line: string,
  column: number,
  length: number,
  context = CONTEXT
): { text: string; column: number } {
  const start = Math.max(0, column - context)
  const end = Math.min(line.length, column + length + context)
  const prefix = start > 0 ? '…' : ''
  const suffix = end < line.length ? '…' : ''
  return {
    text: prefix + line.slice(start, end) + suffix,
    column: column - start + prefix.length
  }
}

/** 在一段文本里找出全部命中（逐行、逐次出现） */
export function findMatches(
  text: string,
  query: string,
  caseSensitive = false
): { line: number; text: string; column: number }[] {
  if (!query) return []
  const needle = caseSensitive ? query : query.toLowerCase()
  const results: { line: number; text: string; column: number }[] = []

  const lines = text.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const haystack = caseSensitive ? line : line.toLowerCase()
    let from = 0
    for (;;) {
      const at = haystack.indexOf(needle, from)
      if (at < 0) break
      results.push({ line: i + 1, ...clipLine(line, at, query.length) })
      from = at + needle.length
    }
  }
  return results
}

/** 把文件树摊平成文件路径列表（复用 tree.ts 的过滤规则：只 .md、跳过隐藏项） */
export function flattenTree(nodes: FileTreeNode[]): string[] {
  const paths: string[] = []
  for (const node of nodes) {
    if (node.type === 'file') paths.push(node.path)
    else if (node.children) paths.push(...flattenTree(node.children))
  }
  return paths
}

/**
 * 在工作区里搜所有 .md 的正文。
 * 只扫 tree.ts 认定的文件（跳过 node_modules/.git/隐藏项），带命中上限防止大库把界面拖死。
 */
export async function searchInWorkspace(
  root: string,
  query: string,
  opts: SearchOptions = {}
): Promise<SearchResponse> {
  const q = query.trim()
  if (!q) return { files: [], totalMatches: 0, truncated: false }

  const caseSensitive = opts.caseSensitive ?? false
  const maxMatches = opts.maxMatches ?? DEFAULT_MAX_MATCHES

  // 工作区被删/移走时 buildFileTree 会抛错，这里当作「没有可搜的文件」，
  // 让界面显示「无结果」而不是弹一个错误
  let paths: string[]
  try {
    paths = flattenTree(await buildFileTree(root))
  } catch {
    return { files: [], totalMatches: 0, truncated: false }
  }

  const files: SearchFileResult[] = []
  let totalMatches = 0
  let truncated = false

  for (const path of paths) {
    let text: string
    try {
      if ((await stat(path)).size > MAX_FILE_BYTES) continue
      text = await readFile(path, 'utf8')
    } catch {
      continue // 搜索期间文件被删/无权限，跳过即可
    }

    const matches = findMatches(text, q, caseSensitive)
    if (matches.length === 0) continue

    const room = maxMatches - totalMatches
    const kept = matches.slice(0, room)
    totalMatches += kept.length
    files.push({ path, name: basename(path), matches: kept })

    if (kept.length < matches.length || totalMatches >= maxMatches) {
      truncated = true
      break
    }
  }

  return { files, totalMatches, truncated }
}
