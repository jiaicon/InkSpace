import { Dropdown, Tabs } from 'antd'
import type { Tab } from '../stores/workspace'

interface TabBarProps {
  tabs: Tab[]
  activePath: string | null
  onChange(path: string): void
  onClose(path: string): void
  /** 是否允许把 tab 移到新窗口 —— 分离窗口里就没必要再移一次 */
  canOpenInNewWindow: boolean
  /** 右键 tab →「在新窗口打开」（把该文档**移**到新窗口，本窗口的 tab 会被关掉） */
  onOpenInNewWindow(path: string): void
}

export function TabBar({
  tabs,
  activePath,
  onChange,
  onClose,
  canOpenInNewWindow,
  onOpenInNewWindow
}: TabBarProps) {
  const items = tabs.map((t) => {
    const label = (
      <span>
        {t.dirty && <span style={{ color: '#faad14', marginRight: 4 }}>●</span>}
        {t.title}
      </span>
    )
    return {
      key: t.path,
      // 右键 tab 出菜单。包在 label 上：菜单只覆盖标题区域，点关闭按钮不受影响
      label: canOpenInNewWindow ? (
        <Dropdown
          trigger={['contextMenu']}
          menu={{
            items: [{ key: 'new-window', label: '在新窗口打开' }],
            onClick: () => onOpenInNewWindow(t.path)
          }}
        >
          {label}
        </Dropdown>
      ) : (
        label
      ),
      closable: true
    }
  })

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
