import { Typography } from 'antd'
import type { OutlineNode } from '../editor'

interface OutlineProps {
  outline: OutlineNode[]
  onJump(index: number): void
}

/** 大纲面板：渲染文档标题层级，点击滚动定位 */
export function Outline({ outline, onJump }: OutlineProps) {
  if (outline.length === 0) {
    return (
      <Typography.Text type="secondary" style={{ display: 'block', padding: 12, fontSize: 13 }}>
        暂无标题
      </Typography.Text>
    )
  }

  return (
    <div className="ms-outline">
      {outline.map((h, i) => (
        <div
          key={`${h.id}-${i}`}
          className="ms-outline-item"
          style={{ paddingLeft: 12 + (h.level - 1) * 14 }}
          title={h.text}
          onClick={() => onJump(i)}
        >
          {h.text}
        </div>
      ))}
    </div>
  )
}
