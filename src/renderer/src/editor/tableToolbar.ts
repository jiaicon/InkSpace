import { commandsCtx, editorViewCtx } from '@milkdown/kit/core'
import {
  addRowBeforeCommand,
  addRowAfterCommand,
  addColBeforeCommand,
  addColAfterCommand,
  selectRowCommand,
  selectColCommand,
  selectTableCommand,
  deleteSelectedCellsCommand,
  getCellsInCol
} from '@milkdown/kit/preset/gfm'
import { isInTable, selectedRect } from '@milkdown/kit/prose/tables'
import { $prose } from '@milkdown/kit/utils'
import { Plugin, PluginKey } from '@milkdown/kit/prose/state'
import type { EditorView } from '@milkdown/kit/prose/view'
import type { Ctx } from '@milkdown/kit/ctx'

type TableAlign = 'left' | 'center' | 'right'

const ALIGNS: { value: TableAlign; title: string; label: string }[] = [
  { value: 'left', title: '左对齐', label: '靠左' },
  { value: 'center', title: '居中对齐', label: '居中' },
  { value: 'right', title: '右对齐', label: '靠右' }
]

interface TableButton {
  title: string
  label: string
  run: () => void
  danger?: boolean
}

/** 把光标所在列的整列（表头 + 所有单元格）设为指定对齐方式 */
function alignColumn(view: EditorView, alignment: TableAlign): void {
  const { state } = view
  if (!isInTable(state)) return
  const rect = selectedRect(state)
  const cells = getCellsInCol(rect.left, state.selection)
  if (!cells?.length) return
  const tr = state.tr
  for (const cell of cells) {
    if (cell.node.attrs.alignment !== alignment) {
      tr.setNodeMarkup(cell.pos, null, { ...cell.node.attrs, alignment })
    }
  }
  if (tr.steps.length) view.dispatch(tr)
  view.focus()
}

/** 读取光标所在列当前的对齐方式（用于高亮激活按钮） */
function currentAlign(view: EditorView): TableAlign | null {
  const { state } = view
  if (!isInTable(state)) return null
  const rect = selectedRect(state)
  const cell = getCellsInCol(rect.left, state.selection)?.[0]
  return (cell?.node.attrs.alignment as TableAlign) ?? null
}

function createButtons(ctx: Ctx): TableButton[] {
  const manager = () => ctx.get(commandsCtx)
  const view = () => ctx.get(editorViewCtx)

  // 删除当前行：先按当前行索引选中整行，再删除选中单元格
  const deleteRow = () => {
    const v = view()
    const rect = selectedRect(v.state)
    manager().call(selectRowCommand.key, { index: rect.top })
    manager().call(deleteSelectedCellsCommand.key)
  }
  const deleteCol = () => {
    const v = view()
    const rect = selectedRect(v.state)
    manager().call(selectColCommand.key, { index: rect.left })
    manager().call(deleteSelectedCellsCommand.key)
  }
  const deleteTable = () => {
    manager().call(selectTableCommand.key)
    manager().call(deleteSelectedCellsCommand.key)
  }

  return [
    { title: '在上方插入一行', label: '行↑', run: () => manager().call(addRowBeforeCommand.key) },
    { title: '在下方插入一行', label: '行↓', run: () => manager().call(addRowAfterCommand.key) },
    { title: '在左侧插入一列', label: '列←', run: () => manager().call(addColBeforeCommand.key) },
    { title: '在右侧插入一列', label: '列→', run: () => manager().call(addColAfterCommand.key) },
    { title: '删除当前行', label: '删行', run: deleteRow, danger: true },
    { title: '删除当前列', label: '删列', run: deleteCol, danger: true },
    { title: '删除整个表格', label: '删表', run: deleteTable, danger: true }
  ]
}

/**
 * 表格工具条：光标位于表格内时浮出。
 * 左侧为「对齐方式」（按列整列对齐），右侧为增删行/列、删除表格等操作。
 * 与 selectionToolbar 同构的 vanilla-DOM 插件，点击用 mousedown.preventDefault
 * 保持编辑器焦点，再执行对应表格命令。
 */
export const tableToolbar = $prose((ctx) => {
  const bar = document.createElement('div')
  bar.className = 'ms-table-toolbar'
  bar.setAttribute('data-show', 'false')

  let view: EditorView | null = null

  // 左组：对齐方式
  const alignGroup = document.createElement('div')
  alignGroup.className = 'ms-table-align-group'
  const alignBtns: HTMLButtonElement[] = []
  for (const a of ALIGNS) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'ms-table-btn ms-table-align-btn'
    btn.dataset.align = a.value
    btn.textContent = a.label
    btn.title = a.title
    btn.addEventListener('mousedown', (e) => e.preventDefault())
    btn.addEventListener('click', () => alignColumn(ctx.get(editorViewCtx), a.value))
    alignGroup.appendChild(btn)
    alignBtns.push(btn)
  }
  bar.appendChild(alignGroup)

  // 右组：增删行/列、删除表格
  const opGroup = document.createElement('div')
  opGroup.className = 'ms-table-op-group'
  createButtons(ctx).forEach((b) => {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'ms-table-btn' + (b.danger ? ' is-danger' : '')
    btn.textContent = b.label
    btn.title = b.title
    btn.addEventListener('mousedown', (e) => e.preventDefault())
    btn.addEventListener('click', () => {
      b.run()
      view?.focus()
    })
    opGroup.appendChild(btn)
  })
  bar.appendChild(opGroup)

  const refreshActive = (v: EditorView) => {
    const align = currentAlign(v)
    for (const btn of alignBtns) {
      btn.classList.toggle('is-active', btn.dataset.align === align)
    }
  }

  const show = (v: EditorView) => {
    let rect
    try {
      rect = selectedRect(v.state)
    } catch {
      return
    }
    const topCoords = v.coordsAtPos(rect.tableStart)
    bar.style.left = `${topCoords.left}px`
    // 视口自适应：表格顶部太靠近视口上沿时，把工具条翻转到表格下方
    if (topCoords.top - 44 >= 8) {
      bar.style.top = `${topCoords.top - 44}px`
    } else {
      const bottomCoords = v.coordsAtPos(rect.tableStart + rect.table.nodeSize)
      bar.style.top = `${bottomCoords.bottom + 6}px`
    }
    bar.setAttribute('data-show', 'true')
    if (!bar.parentElement) document.body.appendChild(bar)
    refreshActive(v)
  }
  const hide = () => bar.setAttribute('data-show', 'false')
  const onScroll = () => hide()
  window.addEventListener('scroll', onScroll, true)

  return new Plugin({
    key: new PluginKey('MS_TABLE_TOOLBAR'),
    view: (v) => {
      view = v
      return {
        update: (v) => {
          const { selection } = v.state
          const inTable = isInTable(v.state) && selection.empty
          if (inTable && v.hasFocus()) show(v)
          else hide()
        },
        destroy: () => {
          window.removeEventListener('scroll', onScroll, true)
          bar.remove()
        }
      }
    }
  })
})
