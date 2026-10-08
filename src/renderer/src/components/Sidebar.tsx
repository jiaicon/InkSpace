import { Tabs } from 'antd'
import type { FileTreeNode, RecentFile } from '@shared/types'
import type { OutlineNode } from '../editor'
import { FileTree } from './FileTree'
import { Outline } from './Outline'
import { SearchPanel } from './SearchPanel'

interface SidebarProps {
  workspacePath: string | null
  tree: FileTreeNode[]
  recent: RecentFile[]
  activePath: string | null
  outline: OutlineNode[]
  /** 当前标签页（受控，便于 Ctrl+Shift+F 切到搜索） */
  tab: string
  onTabChange(tab: string): void
  onOpenWorkspace(): void
  onOpenFileDialog(): void
  onOpenFile(path: string): void
  onNewFile(dir: string): void
  onRename(path: string): void
  onDelete(path: string): void
  onReveal(path: string): void
  onClearRecent(): void
  onJumpOutline(index: number): void
  onOpenSearchResult(path: string, query: string, caseSensitive: boolean, occurrence: number): void
}

/** 左侧栏：文件 + 大纲 + 搜索 三个标签页（Typora 式） */
export function Sidebar(props: SidebarProps) {
  const items = [
    {
      key: 'files',
      label: '文件',
      children: (
        <FileTree
          workspacePath={props.workspacePath}
          tree={props.tree}
          recent={props.recent}
          activePath={props.activePath}
          onOpenWorkspace={props.onOpenWorkspace}
          onOpenFileDialog={props.onOpenFileDialog}
          onOpenFile={props.onOpenFile}
          onNewFile={props.onNewFile}
          onRename={props.onRename}
          onDelete={props.onDelete}
          onReveal={props.onReveal}
          onClearRecent={props.onClearRecent}
        />
      )
    },
    {
      key: 'outline',
      label: '大纲',
      children: <Outline outline={props.outline} onJump={props.onJumpOutline} />
    },
    {
      key: 'search',
      label: '搜索',
      children: (
        <SearchPanel
          workspacePath={props.workspacePath}
          active={props.tab === 'search'}
          onOpenResult={props.onOpenSearchResult}
        />
      )
    }
  ]

  return (
    <div
      className="ms-sidebar"
      style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
    >
      <Tabs
        size="small"
        activeKey={props.tab}
        onChange={props.onTabChange}
        items={items}
        tabBarStyle={{ margin: 0, padding: '0 8px' }}
        style={{ height: '100%' }}
      />
    </div>
  )
}
