import { Dropdown, Tabs } from 'antd'
import type { Tab } from '../stores/workspace'

interface TabBarProps {
  tabs: Tab[]
  activePath: string | null
  onChange(path: string): void
  onClose(path: string): void
  /** 右键 tab →「在新窗口打开」 */
  onOpenInNewWindow(path: string): void
}

export function TabBar({ tabs, activePath, onChange, onClose, onOpenInNewWindow }: TabBarProps) {
  const items = tabs.map((t) => ({
    key: t.path,
    label: (
      // 右键 tab 出菜单。包在 label 上：菜单只覆盖标题区域，点关闭按钮不受影响
      <Dropdown
        trigger={['contextMenu']}
        menu={{
          items: [{ key: 'new-window', label: '在新窗口打开' }],
          onClick: () => onOpenInNewWindow(t.path)
        }}
      >
        <span>
          {t.dirty && <span style={{ color: '#faad14', marginRight: 4 }}>●</span>}
          {t.title}
        </span>
      </Dropdown>
    ),
    closable: true
  }))

  return (
    <Tabs
      type="editable-card"
      hideAdd
      size="small"
      activeKey={activePath ?? undefined}
      items={items}
      onChange={onChange}
      onEdit={(key, action) => {
        if (action === 'remove' && typeof key === 'string') onClose(key)
      }}
      tabBarStyle={{ marginBottom: 0 }}
    />
  )
}
