// 提交前对暂存文件：eslint 修复 + prettier 格式化 + 全项目类型检查。
// tsc 是项目级命令（不逐文件 lint），故用函数式配置忽略 lint-staged 传入的文件列表，
// 直接跑两个 tsconfig 的 --noEmit，等价于 `pnpm typecheck`。
export default {
  '**/*.{ts,tsx}': [
    'eslint --fix',
    'prettier --write',
    () => [
      'tsc --noEmit -p tsconfig.node.json --composite false',
      'tsc --noEmit -p tsconfig.web.json --composite false'
    ]
  ],
  '**/*.{js,mjs,cjs,json,md,css,html,yml,yaml}': ['prettier --write']
}
