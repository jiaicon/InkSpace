import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve('src/shared'),
      '@renderer': resolve('src/renderer/src')
    }
  },
  test: {
    environment: 'node',
    // 导出模板把 export.css 以 ?raw 内联进 HTML，默认的 CSS 桩会让它变空串，故开启真实处理
    css: true,
    include: ['tests/**/*.test.ts']
  }
})
