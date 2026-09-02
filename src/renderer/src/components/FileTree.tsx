import { Button, Dropdown, Space, Tree, Typography } from 'antd'
import type { MenuProps } from 'antd'
import type { DataNode } from 'antd/es/tree'
import { FolderOpenOutlined } from '@ant-design/icons'
import type { FileTreeNode, RecentFile } from '@shared/types'
import { titleFromPath } from '../utils/path'

interface FileTreeProps {
  workspacePath: string | null
  tree: FileTreeNode[]
  recent: RecentFile[]
  onOpenWorkspace(): void
  onOpenFile(path: string): void
  onNewFile(dir: string): void
  onRename(path: string): void
  onDelete(path: string): void
  onReveal(path: string): void
}

function fileMenu(n: FileTreeNode, props: FileTreeProps): MenuProps['items'] {
  if (n.type === 'file') {
    return [
      { key: 'rename', label: '重命名' },
      { key: 'delete', label: '删除' },
      { key: 'reveal', label: '在文件夹中显示' }
    ]
  }
  return [{ key: 'new', label: '新建文件' }]
}

export function FileTree(props: FileTreeProps) {
  const { workspacePath, tree, recent, onOpenWorkspace, onOpenFile, onNewFile, onRename, onDelete, onReveal } = props

  const toData = (nodes: FileTreeNode[]): DataNode[] =>
    nodes.map((n) => ({
      key: n.path,
      title: (
        <Dropdown
          trigger={['contextMenu']}
          menu={{
            items: fileMenu(n, props),
            onClick: ({ key }) => {
              if (key === 'rename') onRename(n.path)
              else if (key === 'delete') onDelete(n.path)
              else if (key === 'reveal') onReveal(n.path)
              else if (key === 'new') onNewFile(n.path)
            }
          }}
        >
          <span>{n.name}</span>
        </Dropdown>
      ),
      isLeaf: n.type === 'file',
      children: n.type === 'directory' ? toData(n.children ?? []) : undefined
    }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: 12 }}>
        <Button block icon={<FolderOpenOutlined />} onClick={onOpenWorkspace}>
          {workspacePath ? '切换文件夹' : '打开文件夹'}
        </Button>
      </div>

      {recent.length > 0 && (
        <div style={{ padding: '0 12px 8px' }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            最近打开
          </Typography.Text>
          {recent.slice(0, 5).map((r) => (
            <div key={r.path}>
              <Button
                type="link"
                size="small"
                style={{ padding: 0 }}
                onClick={() => onOpenFile(r.path)}
              >
                {titleFromPath(r.path)}
              </Button>
            </div>
          ))}
        </div>
      )}

      <div style={{ flex: 1, overflow: 'auto', padding: '0 4px 8px' }}>
        {tree.length > 0 ? (
          <Tree
            showIcon
            blockNode
            treeData={toData(tree)}
            defaultExpandAll
            onSelect={(keys) => {
              const key = keys[0] as string | undefined
              if (key && key.toLowerCase().endsWith('.md')) onOpenFile(key)
            }}
          />
        ) : (
          <Typography.Text type="secondary" style={{ display: 'block', padding: 12 }}>
            尚未打开工作区
          </Typography.Text>
        )}
      </div>
    </div>
  )
}
