import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

export default defineConfig({
  main: {
    // 只把「不能打包」的依赖留作外部 require：electron 与原生模块 better-sqlite3。
    // 其余一律打进 bundle —— 主进程产物是 CJS，而 remark / rehype / lowlight 这类包是
    // ESM-only，一旦被外部化就会在 require() 时抛 ERR_REQUIRE_ESM。
    //
    // 这里不用 externalizeDepsPlugin：它按 package.json 的 dependencies 全量外部化，
    // 每加一个 ESM 依赖都得记得手工排除，漏了只在打包后才暴露（已经踩过一次）。
    // 显式列出「必须外部化」的两项，从根本上消除这类问题。
    build: { rollupOptions: { external: ['electron', 'better-sqlite3'] } },
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
