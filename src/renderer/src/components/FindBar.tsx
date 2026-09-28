import { Button, Input } from 'antd'
import type { InputRef } from 'antd'
import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { ArrowDownOutlined, ArrowUpOutlined, CloseOutlined, SwapOutlined } from '@ant-design/icons'
import type { SearchInfo } from '../editor'

interface Props {
  open: boolean
  /** 替换行是否展开（由宿主控制，Ctrl+H 会直接展开） */
  replaceOpen: boolean
  info: SearchInfo
  onSearch: (query: string, caseSensitive: boolean) => void
  onNext: () => void
  onPrev: () => void
  onReplace: (text: string) => void
  onReplaceAll: (text: string) => void
  onToggleReplace: () => void
  onClose: () => void
}

/**
 * 查找 / 替换条：浮在内容区右上角。
 * 两种编辑模式（所见即所得 / 源码）共用这一个界面，行为由编辑器适配器保证一致。
 */
export function FindBar({
  open,
  replaceOpen,
  info,
  onSearch,
  onNext,
  onPrev,
  onReplace,
  onReplaceAll,
  onToggleReplace,
  onClose
}: Props) {
  const [query, setQuery] = useState('')
  const [replacement, setReplacement] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const inputRef = useRef<InputRef>(null)

  // 打开时聚焦并把已有内容全选，便于直接改条件
  useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => inputRef.current?.focus({ cursor: 'all' }), 0)
    return () => clearTimeout(timer)
  }, [open])

  // 查找条件变化即重新查找（编辑器会把第一个匹配选中）
  useEffect(() => {
    if (!open) return
    onSearch(query, caseSensitive)
  }, [open, query, caseSensitive, onSearch])

  if (!open) return null

  const countText =
    query === ''
      ? ''
      : info.total === 0
        ? '无结果'
        : info.current > 0
          ? `${info.current}/${info.total}`
          : `${info.total} 个`

  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (e.shiftKey) onPrev()
      else onNext()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  return (
    <div className="ms-findbar">
      <div className="ms-findbar-row">
        <Input
          ref={inputRef}
          size="small"
          className="ms-findbar-input"
          placeholder="查找"
          value={query}
          allowClear
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <span className="ms-findbar-count">{countText}</span>
        <Button
          size="small"
          type="text"
          icon={<ArrowUpOutlined />}
          title="上一个 (Shift+Enter)"
          onClick={onPrev}
        />
        <Button
          size="small"
          type="text"
          icon={<ArrowDownOutlined />}
          title="下一个 (Enter)"
          onClick={onNext}
        />
        <Button
          size="small"
          type={caseSensitive ? 'primary' : 'text'}
          title="区分大小写"
          onClick={() => setCaseSensitive((v) => !v)}
        >
          Aa
        </Button>
        <Button
          size="small"
          type={replaceOpen ? 'primary' : 'text'}
          icon={<SwapOutlined />}
          title="替换"
          onClick={onToggleReplace}
        />
        <Button
          size="small"
          type="text"
          icon={<CloseOutlined />}
          title="关闭 (Esc)"
          onClick={onClose}
        />
      </div>

      {replaceOpen && (
        <div className="ms-findbar-row">
          <Input
            size="small"
            className="ms-findbar-input"
            placeholder="替换为"
            value={replacement}
            onChange={(e) => setReplacement(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <Button size="small" disabled={info.total === 0} onClick={() => onReplace(replacement)}>
            替换
          </Button>
          <Button
            size="small"
            disabled={info.total === 0}
            onClick={() => onReplaceAll(replacement)}
          >
            全部替换
          </Button>
        </div>
      )}
    </div>
  )
}
