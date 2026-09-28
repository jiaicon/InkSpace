import { rm } from 'node:fs/promises'

/** 删除实现，可注入以便确定性地测试重试逻辑 */
export type FileRemover = (file: string) => Promise<void>

const defaultRemover: FileRemover = (file) => rm(file, { force: true })

/**
 * 尽力删除临时文件。
 *
 * 这是收尾工作，**失败绝不能影响导出结果**：之前的实现在 finally 里直接 rm 临时目录，
 * Windows 上只要文件句柄没及时释放（杀毒扫描、渲染进程尚未退出等）就会抛 ENOTEMPTY，
 * 而那个异常会覆盖掉已经成功生成的 PDF，用户看到「导出失败」且拿不到文件。
 *
 * 句柄释放有延迟，所以做几次退避重试；仍然失败就放弃（返回 false），
 * 留下的只是一个系统临时文件，无害。
 */
export async function removeTempFile(
  file: string,
  attempts = 5,
  delayMs = 100,
  remover: FileRemover = defaultRemover
): Promise<boolean> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      await remover(file)
      return true
    } catch {
      if (attempt < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs))
      }
    }
  }
  return false
}
