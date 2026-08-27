import { describe, expect, it, vi } from 'vitest'
import { createEditorController } from '../src/renderer/src/editor/controller'

function makeHooks() {
  return { onChange: vi.fn(), onChangeDirty: vi.fn(), onModeChange: vi.fn() }
}

describe('createEditorController', () => {
  it('starts clean and not dirty', () => {
    const hooks = makeHooks()
    const c = createEditorController('# hi', hooks)
    expect(c.getMarkdown()).toBe('# hi')
    expect(c.isDirty()).toBe(false)
  })

  it('marks dirty and fires onChange on edit', () => {
    const hooks = makeHooks()
    const c = createEditorController('# hi', hooks)
    c.applyEdit('# hello')
    expect(c.getMarkdown()).toBe('# hello')
    expect(c.isDirty()).toBe(true)
    expect(hooks.onChange).toHaveBeenCalledWith('# hello')
    expect(hooks.onChangeDirty).toHaveBeenCalledWith(true)
  })

  it('does not fire onChange for a no-op edit (initial re-serialize)', () => {
    const hooks = makeHooks()
    const c = createEditorController('# hi', hooks)
    c.applyEdit('# hi')
    expect(hooks.onChange).not.toHaveBeenCalled()
    expect(hooks.onChangeDirty).not.toHaveBeenCalled()
  })

  it('fires onChangeDirty(false) only on transition back to clean', () => {
    const hooks = makeHooks()
    const c = createEditorController('# hi', hooks)
    c.applyEdit('# hello')
    c.applyEdit('# hello again')
    expect(hooks.onChangeDirty).toHaveBeenCalledTimes(1)
    c.markSaved()
    expect(c.isDirty()).toBe(false)
    expect(hooks.onChangeDirty).toHaveBeenLastCalledWith(false)
  })

  it('setMarkdown resets baseline and does not fire onChange', () => {
    const hooks = makeHooks()
    const c = createEditorController('# hi', hooks)
    c.applyEdit('# changed')
    expect(c.isDirty()).toBe(true)
    c.setMarkdown('# other')
    expect(c.getMarkdown()).toBe('# other')
    expect(c.isDirty()).toBe(false)
    expect(hooks.onChange).toHaveBeenCalledTimes(1)
    expect(hooks.onChangeDirty).toHaveBeenLastCalledWith(false)
  })

  it('switches mode and notifies', () => {
    const hooks = makeHooks()
    const c = createEditorController('# hi', hooks)
    c.setMode('source')
    expect(c.getMode()).toBe('source')
    expect(hooks.onModeChange).toHaveBeenCalledWith('source')
  })
})
