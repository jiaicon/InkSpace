import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { createEditorController } from './controller'
import { createMilkdownEditor, type MarkdownEditorAdapter } from './milkdownEditor'
import { createCodeMirrorEditor, type SourceEditorAdapter } from './codemirrorEditor'
import { parseOutline } from './outline'
import type { EditorHandle, EditorMode, EditorProps } from './types'

type Adapter = MarkdownEditorAdapter | SourceEditorAdapter

export const Editor = forwardRef<EditorHandle, EditorProps>(function Editor(props, ref) {
  const { initialMarkdown, onChange, onChangeDirty, onModeChange, onOutlineChange, onRequestLink } =
    props
  const containerRef = useRef<HTMLDivElement>(null)
  const adapterRef = useRef<Adapter | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [, setMode] = useState<EditorMode>('wysiwyg')

  const controllerRef = useRef<ReturnType<typeof createEditorController> | null>(null)
  if (!controllerRef.current) {
    controllerRef.current = createEditorController(initialMarkdown, {
      onChange,
      onChangeDirty,
      onModeChange: onModeChange ?? (() => {})
    })
  }

  // 用 ref 保持 onRequestLink 最新，避免异步挂载时闭包过期
  const onRequestLinkRef = useRef(onRequestLink)
  onRequestLinkRef.current = onRequestLink

  function emitOutline(): void {
    if (onOutlineChange) onOutlineChange(parseOutline(controllerRef.current!.getMarkdown()))
  }

  // 挂载代次：异步 mount 可能并发（StrictMode 双执行 / 快速切换模式），
  // 用代次号丢弃过期实例，保证容器内始终只有一个编辑器。
  const mountSeqRef = useRef(0)

  async function mount(mode: EditorMode): Promise<void> {
    const seq = ++mountSeqRef.current
    const root = containerRef.current!
    root.innerHTML = ''
    adapterRef.current?.destroy()
    adapterRef.current = null
    const controller = controllerRef.current!
    const md = controller.getMarkdown()
    const adapter =
      mode === 'wysiwyg'
        ? await createMilkdownEditor(
            root,
            md,
            (next) => {
              controller.applyEdit(next)
              emitOutline()
            },
            { onRequestLink: () => onRequestLinkRef.current?.() }
          )
        : createCodeMirrorEditor(root, md, (next) => {
            controller.applyEdit(next)
            emitOutline()
          })
    // 本次挂载尚未完成又发起了新的 mount：丢弃这个已过期的实例
    if (seq !== mountSeqRef.current) {
      adapter.destroy()
      return
    }
    adapterRef.current = adapter
    // 异步挂载期间若内容已被 setMarkdown 切换到另一文件，补同步，避免展示旧文件内容
    const latest = controller.getMarkdown()
    if (latest !== md) adapter.setContent(latest)
  }

  function switchMode(mode: EditorMode): void {
    const controller = controllerRef.current!
    if (controller.getMode() === mode) return
    controller.setMode(mode)
    setMode(mode)
    mount(mode).catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }

  useImperativeHandle(ref, () => ({
    getMarkdown: () => controllerRef.current!.getMarkdown(),
    setMarkdown: (md) => {
      controllerRef.current!.setMarkdown(md)
      adapterRef.current?.setContent(md)
    },
    markSaved: () => controllerRef.current!.markSaved(),
    getMode: () => controllerRef.current!.getMode(),
    setMode: switchMode,
    focus: () => adapterRef.current?.focus(),
    scrollToHeading: (index) => {
      const heads = containerRef.current?.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,h6')
      heads?.[index]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    },
    insertImage: (src) => adapterRef.current?.insertImage(src),
    setLink: (href) => adapterRef.current?.setLink(href),
    hasSelection: () => adapterRef.current?.hasSelection() ?? false
  }))

  // 有意只挂载一次：mount/emitOutline 仅依赖 ref，闭包不会过期；
  // StrictMode/快速切换模式靠 mountSeqRef 丢弃过期实例，故无需补依赖。
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    mount('wysiwyg')
      .then(emitOutline)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
    return () => {
      mountSeqRef.current++
      adapterRef.current?.destroy()
      adapterRef.current = null
    }
  }, [])
  /* eslint-enable react-hooks/exhaustive-deps */

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <p>编辑器初始化失败：{error}</p>
        <button
          onClick={() => {
            setError(null)
            mount(controllerRef.current!.getMode()).catch((e) =>
              setError(e instanceof Error ? e.message : String(e))
            )
          }}
        >
          重试
        </button>
      </div>
    )
  }

  return <div ref={containerRef} style={{ height: '100%', overflow: 'auto' }} />
})
