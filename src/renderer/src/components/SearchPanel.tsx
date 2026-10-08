import { Input, Tooltip } from 'antd'
import { useEffect, useRef, useState } from 'react'
import type { InputRef } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import type { SearchResponse } from '@shared/types'
import { workspaceApi } from '../api/workspace'

interface Props {
  workspacePath: string | null
  /** 该页签是否处于激活状态（激活时自动聚焦输入框） */
  active: boolean
  /** 点击某条命中：打开文件、在文档内查找，并前进到该文件里的第 occurrence 条匹配 */
  onOpenResult(path: string, query: string, caseSensitive: boolean, occurrence: number): void
}

/** 侧栏「搜索」页：在工作区所有 .md 里搜关键词 */
export function SearchPanel({ workspacePath, active, onOpenResult }: Props) {
  const [query, setQuery] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [result, setResult] = useState<SearchResponse | null>(null)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<InputRef>(null)
  // 请求序号：只认最后一次发出的结果，避免慢的旧请求覆盖新结果
  const seqRef = useRef(0)

  // 切到本页时聚焦输入框：用 ref 而不是查 DOM，也不赌渲染时机
  useEffect(() => {
    if (!active) return
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [active])

  useEffect(() => {
    const trimmed = query.trim()
    if (!workspacePath || trimmed === '') {
      setResult(null)
      setBusy(false)
      return
    }

    const seq = ++seqRef.current
    setBusy(true)
    const timer = setTimeout(async () => {
      try {
        const res = await workspaceApi.search(workspacePath, trimmed, caseSensitive)
        if (seq === seqRef.current) setResult(res)
      } catch {
        if (seq === seqRef.current) setResult(null)
      } finally {
        if (seq === seqRef.current) setBusy(false)
      }
    }, 250)

    return () => clearTimeout(timer)
  }, [workspacePath, query, caseSensitive])

  const summary = (): string => {
    if (!workspacePath) return ''
    if (query.trim() === '') return ''
    if (busy) return '搜索中…'
    if (!result) return ''
    if (result.totalMatches === 0) return '没有结果'
    let text = `${result.files.length} 个文件 / ${result.totalMatches} 处匹配`
    if (result.truncated) text += '（结果过多，已截断）'
    return text
  }

  return (
    <div className="ms-search">
      <div className="ms-search-bar">
        <Input
          ref={inputRef}
          size="small"
          className="ms-search-input"
          placeholder="在工作区中搜索"
          prefix={<SearchOutlined />}
          value={query}
          allowClear
          onChange={(e) => setQuery(e.target.value)}
          disabled={!workspacePath}
        />
        <Tooltip title="区分大小写">
          <span
            className={`ms-search-case ${caseSensitive ? 'is-on' : ''}`}
            onClick={() => setCaseSensitive((v) => !v)}
            role="button"
            aria-label="区分大小写"
          >
            Aa
          </span>
        </Tooltip>
      </div>

      <div className="ms-search-summary">{summary()}</div>

      {!workspacePath ? (
        <div className="ms-search-empty">先打开一个文件夹才能全局搜索</div>
      ) : (
        <div className="ms-search-results">
          {result?.files.map((file) => (
            <div key={file.path} className="ms-search-file">
              <div className="ms-search-filename" title={file.path}>
                {file.name}
                <span className="ms-search-filecount">{file.matches.length}</span>
              </div>
              {file.matches.map((m, i) => (
                <div
                  key={`${m.line}-${m.column}`}
                  className="ms-search-hit"
                  onClick={() => onOpenResult(file.path, query.trim(), caseSensitive, i)}
                  title={`第 ${m.line} 行`}
                >
                  <span className="ms-search-lineno">{m.line}</span>
                  <span className="ms-search-text">
                    {m.text.slice(0, m.column)}
                    <mark>{m.text.slice(m.column, m.column + query.trim().length)}</mark>
                    {m.text.slice(m.column + query.trim().length)}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
