// 让主进程能够 import 本地 .sql 文件为字符串（Vite 的 ?raw 导入）
declare module '*?raw' {
  const content: string
  export default content
}
