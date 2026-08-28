import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { createEditorController } from './controller'
import { createMilkdownEditor, type MarkdownEditorAdapter } from './milkdownEditor'
import { createCodeMirrorEditor, type SourceEditorAdapter } from './codemirrorEditor'
import { parseOutline } from './outline'
import type { EditorHandle, EditorMode, EditorProps } from './types'

type Adapter = MarkdownEditorAdapter | SourceEditorAdapter

export const Editor = forwardRef<EditorHandle, EditorProps>(function Editor(props, ref) {
  const { initialMarkdown, onChange, onChangeDirty, onModeChange, onOutlineChange } = props
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

  function emitOutline(): void {
    if (onOutlineChange) onOutlineChange(parseOutline(controllerRef.current!.getMarkdown()))
  }

  async function mount(mode: EditorMode): Promise<void> {
    const root = containerRef.current!
    root.innerHTML = ''
    adapterRef.current?.destroy()
    const controller = controllerRef.current!
    const md = controller.getMarkdown()
    adapterRef.current =
      mode === 'wysiwyg'
        ? await createMilkdownEditor(root, md, (next) => {
            controller.applyEdit(next)
            emitOutline()
          })
        : createCodeMirrorEditor(root, md, (next) => {
            controller.applyEdit(next)
            emitOutline()
          })
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
    focus: () => adapterRef.current?.focus()
  }))

  useEffect(() => {
    mount('wysiwyg').then(emitOutline).catch((e) => setError(e instanceof Error ? e.message : String(e)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
