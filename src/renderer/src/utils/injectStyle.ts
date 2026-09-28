/** 向 <head> 写入（或更新）一个 <style>，用于运行时切换样式表（如代码块主题） */
export function upsertStyle(id: string, css: string): void {
  let el = document.getElementById(id) as HTMLStyleElement | null
  if (!el) {
    el = document.createElement('style')
    el.id = id
    document.head.appendChild(el)
  }
  el.textContent = css
}
