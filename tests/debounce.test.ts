import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { debounce } from '../src/renderer/src/utils/debounce'

describe('debounce', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('合并窗口内的多次调用', () => {
    const fn = vi.fn()
    const d = debounce(fn, 100)
    d('a')
    d('b')
    d('c')
    vi.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('c')
  })

  it('flush 立即用最新参数执行且不再重复', () => {
    const fn = vi.fn()
    const d = debounce(fn, 100)
    d('x')
    d.flush()
    expect(fn).toHaveBeenCalledWith('x')
    vi.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('cancel 丢弃待执行调用', () => {
    const fn = vi.fn()
    const d = debounce(fn, 100)
    d('x')
    d.cancel()
    vi.advanceTimersByTime(100)
    expect(fn).not.toHaveBeenCalled()
  })
})
