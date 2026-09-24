import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

export default defineConfig({
  main: {
    // 导出用的 markdown 链路必须打进 bundle：主进程产物是 CJS，而这些包是 ESM-only，
    // 一旦被外部化就会在 require() 时抛 ERR_REQUIRE_ESM。
    // 注意：插件按 package.json 的 dependencies 全量外部化，所以 remark 子图里凡是
    // 同时出现在 dependencies 的包（mdast-util-to-string、unist-util-visit）都要一并排除。
    plugins: [
      externalizeDepsPlugin({
        exclude: ['remark', 'remark-gfm', 'remark-html', 'mdast-util-to-string', 'unist-util-visit']
      })
    ],
    resolve: { alias: { '@shared': resolve('src/shared') } }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: { '@shared': resolve('src/shared') } }
  },
  renderer: {
    plugins: [react()],
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('src/shared')
      }
    }
  }
})
