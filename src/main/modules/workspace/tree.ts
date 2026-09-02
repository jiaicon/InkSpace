import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { FileTreeNode } from '@shared/types'

const HIDDEN_DIRS = new Set(['node_modules', '.git'])
const MD_EXT = '.md'

export interface BuildFileTreeOptions {
  maxDepth?: number
}

/** 递归扫描目录，只返回目录与 *.md，跳过隐藏项（点开头 / node_modules / .git）。 */
export async function buildFileTree(
  root: string,
  opts: BuildFileTreeOptions = {}
): Promise<FileTreeNode[]> {
  const maxDepth = opts.maxDepth ?? 32

  async function walk(dir: string, depth: number): Promise<FileTreeNode[]> {
    const entries = await readdir(dir, { withFileTypes: true })
    const nodes: FileTreeNode[] = []
    for (const ent of entries) {
      if (ent.name.startsWith('.') || (ent.isDirectory() && HIDDEN_DIRS.has(ent.name))) continue
      const full = join(dir, ent.name)
      if (ent.isDirectory()) {
        const children = depth + 1 <= maxDepth ? await walk(full, depth + 1) : []
        nodes.push({ name: ent.name, path: full, type: 'directory', children })
      } else if (ent.isFile() && ent.name.toLowerCase().endsWith(MD_EXT)) {
        nodes.push({ name: ent.name, path: full, type: 'file' })
      }
    }
    // 目录在前，文件在后；同类按名称（不区分大小写）排序
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    })
    return nodes
  }

  return walk(root, 0)
}
