import { Button, Dropdown, Tree, Typography } from 'antd'
import type { MenuProps } from 'antd'
import type { DataNode } from 'antd/es/tree'
import { FolderOpenOutlined, FileTextOutlined } from '@ant-design/icons'
import type { FileTreeNode, RecentFile } from '@shared/types'
import { titleFromPath } from '../utils/path'

interface FileTreeProps {
  workspacePath: string | null
  tree: FileTreeNode[]
  recent: RecentFile[]
  activePath: string | null
  onOpenWorkspace(): void
  onOpenFileDialog(): void
  onOpenFile(path: string): void
  onNewFile(dir: string): void
  onRename(path: string): void
  onDelete(path: string): void
  onReveal(path: string): void
  onClearRecent(): void
}

function fileMenu(n: FileTreeNode): MenuProps['items'] {
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
  const {
    workspacePath,
    tree,
    recent,
    activePath,
    onOpenWorkspace,
    onOpenFileDialog,
    onOpenFile,
    onNewFile,
    onRename,
    onDelete,
    onReveal,
    onClearRecent
  } = props

  const toData = (nodes: FileTreeNode[]): DataNode[] =>
    nodes.map((n) => ({
      key: n.path,
      title: (
        <Dropdown
          trigger={['contextMenu']}
          menu={{
            items: fileMenu(n),
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
    <div
      className="ms-filetree"
      style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
    >
      <div className="ms-filetree-header">
        {workspacePath ? (
          <span className="ms-filetree-title">{titleFromPath(workspacePath)}</span>
        ) : (
          <span />
        )}
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Button
            type="text"
            size="small"
            icon={<FileTextOutlined />}
            title="打开文件"
            onClick={onOpenFileDialog}
          />
          <Button
            type="text"
            size="small"
            icon={<FolderOpenOutlined />}
            title={workspacePath ? '切换文件夹' : '打开文件夹'}
            onClick={onOpenWorkspace}
          />
        </span>
      </div>

      {recent.length > 0 && (
        <div style={{ padding: '0 12px 8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              最近打开
            </Typography.Text>
            <Button type="text" size="small" onClick={onClearRecent} style={{ fontSize: 12 }}>
              清除
            </Button>
          </div>
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
            selectedKeys={activePath ? [activePath] : []}
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
