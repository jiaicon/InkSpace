export interface Debounced<A extends unknown[], R> {
  (...args: A): void
  flush(): R | undefined
  cancel(): void
}

/** 防抖：窗口内合并调用；flush 立即执行最新一次（返回其返回值）；cancel 丢弃。 */
export function debounce<A extends unknown[], R = void>(
  fn: (...args: A) => R,
  ms: number
): Debounced<A, R> {
  let timer: ReturnType<typeof setTimeout> | null = null
  let lastArgs: A | null = null

  const run = (): R | undefined => {
    timer = null
    if (lastArgs) {
      const args = lastArgs
      lastArgs = null
      return fn(...args)
    }
    return undefined
  }

  const debounced = ((...args: A) => {
    lastArgs = args
    if (timer) clearTimeout(timer)
    timer = setTimeout(run, ms)
  }) as Debounced<A, R>

  debounced.flush = () => (timer ? (clearTimeout(timer), run()) : undefined)
  debounced.cancel = () => {
    if (timer) clearTimeout(timer)
    timer = null
    lastArgs = null
  }
  return debounced
}
