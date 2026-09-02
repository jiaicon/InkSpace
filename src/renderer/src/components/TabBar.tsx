import { Tabs } from 'antd'
import type { Tab } from '../stores/workspace'

interface TabBarProps {
  tabs: Tab[]
  activePath: string | null
  onChange(path: string): void
  onClose(path: string): void
}

export function TabBar({ tabs, activePath, onChange, onClose }: TabBarProps) {
  const items = tabs.map((t) => ({
    key: t.path,
    label: (
      <span>
        {t.dirty && <span style={{ color: '#faad14', marginRight: 4 }}>●</span>}
        {t.title}
      </span>
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
