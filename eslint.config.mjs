import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import eslintConfigPrettier from 'eslint-config-prettier'

export default tseslint.config(
  {
    ignores: ['out/**', 'release/**', 'dist/**', 'node_modules/**']
  },
  ...tseslint.configs.recommended,
  {
    plugins: {
      'react-hooks': reactHooks
    },
    rules: {
      // 只启用核心两条规则，react-hooks v7 的 recommended 集合过激进
      //（immutability / purity / static-components 等会误报常见写法）
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn'
    }
  },
  eslintConfigPrettier,
  {
    // CommonJS 文件：Electron 的 preload 不支持 ESM，驱动脚本也以 CJS 跑在主进程里，
    // require 是这些文件唯一可行的写法
    files: ['**/*.cjs'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off'
    }
  }
)
