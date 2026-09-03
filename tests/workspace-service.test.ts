import { describe, expect, it } from 'vitest'
import { openDatabase } from '../src/main/db/database'
import { migrate } from '../src/main/db/migrate'
import { createWorkspaceService } from '../src/main/modules/workspace/service'

function setup() {
  const db = openDatabase(':memory:')
  migrate(db)
  return createWorkspaceService(db)
}

describe('workspace service (settings + recent)', () => {
  it('stores and reads last workspace (null 起跳)', () => {
    const svc = setup()
    expect(svc.getLastWorkspace()).toBeNull()
    svc.setLastWorkspace('D:/docs')
    expect(svc.getLastWorkspace()).toBe('D:/docs')
  })

  it('upserts recent by path and orders by recency desc', () => {
    const svc = setup()
    svc.addRecent('D:/a.md', 'a')
    svc.addRecent('D:/b.md', 'b')
    // 再次打开 a，应排到最前（毫秒时间戳保证顺序）
    svc.addRecent('D:/a.md', 'a')
    const list = svc.listRecent()
    expect(list).toHaveLength(2)
    expect(list[0].path).toBe('D:/a.md')
    expect(list[1].path).toBe('D:/b.md')
  })

  it('removes recent', () => {
    const svc = setup()
    svc.addRecent('D:/a.md', 'a')
    svc.removeRecent('D:/a.md')
    expect(svc.listRecent()).toHaveLength(0)
  })

  it('clears all recent records (清空记录，不删文件)', () => {
    const svc = setup()
    svc.addRecent('D:/a.md', 'a')
    svc.addRecent('D:/b.md', 'b')
    svc.clearRecent()
    expect(svc.listRecent()).toHaveLength(0)
  })
})
