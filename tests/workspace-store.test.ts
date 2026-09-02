import { describe, expect, it, beforeEach } from 'vitest'
import { useWorkspaceStore } from '../src/renderer/src/stores/workspace'

const initial = {
  workspacePath: null as string | null,
  tree: [] as import('@shared/types').FileTreeNode[],
  recent: [] as import('@shared/types').RecentFile[],
  tabs: [] as import('../src/renderer/src/stores/workspace').Tab[],
  activePath: null as string | null,
  contents: {} as Record<string, string>
}

describe('workspace store', () => {
  beforeEach(() => useWorkspaceStore.setState(initial))

  it('addTab upserts 并激活', () => {
    const s = useWorkspaceStore.getState()
    s.addTab('D:/a.md', 'a', '# a')
    s.addTab('D:/b.md', 'b', '# b')
    s.addTab('D:/a.md', 'a', '# a2')
    const st = useWorkspaceStore.getState()
    expect(st.tabs).toHaveLength(2)
    expect(st.activePath).toBe('D:/a.md')
    expect(st.contents['D:/a.md']).toBe('# a2')
  })

  it('removeTab 激活相邻 tab', () => {
    const s = useWorkspaceStore.getState()
    s.addTab('D:/a.md', 'a', '# a')
    s.addTab('D:/b.md', 'b', '# b')
    s.addTab('D:/c.md', 'c', '# c')
    s.removeTab('D:/b.md')
    const st = useWorkspaceStore.getState()
    expect(st.tabs.map((t) => t.path)).toEqual(['D:/a.md', 'D:/c.md'])
    expect(st.activePath).toBe('D:/c.md')
    expect(st.contents['D:/b.md']).toBeUndefined()
  })

  it('renameTab 迁移路径与内容', () => {
    const s = useWorkspaceStore.getState()
    s.addTab('D:/a.md', 'a', '# a')
    s.renameTab('D:/a.md', 'D:/b.md', 'b')
    const st = useWorkspaceStore.getState()
    expect(st.tabs[0]).toMatchObject({ path: 'D:/b.md', title: 'b' })
    expect(st.activePath).toBe('D:/b.md')
    expect(st.contents['D:/b.md']).toBe('# a')
    expect(st.contents['D:/a.md']).toBeUndefined()
  })

  it('onEdit 记内容并置 dirty，markSaved 清除', () => {
    const s = useWorkspaceStore.getState()
    s.addTab('D:/a.md', 'a', '# a')
    s.onEdit('D:/a.md', '# a1')
    expect(useWorkspaceStore.getState().tabs[0].dirty).toBe(true)
    s.markSaved('D:/a.md')
    expect(useWorkspaceStore.getState().tabs[0].dirty).toBe(false)
  })
})
