// Downloads better-sqlite3 native prebuilds for BOTH the Electron runtime and
// the local Node runtime, and places them under
//   node_modules/better-sqlite3/lib/binding/node-v{abi}-{platform}-{arch}/
//
// The `bindings` package (used by better-sqlite3) resolves better_sqlite3.node
// from that directory keyed by `process.versions.modules`, so the two ABI
// builds coexist: the packaged app loads the Electron ABI build, while unit
// tests (vitest) load the local Node ABI build.
//
// GitHub is unreachable from this network, so prebuilds are fetched from the
// npmmirror binary mirror instead of `prebuild-install`'s default GitHub host.
// Extraction is done in pure Node (zlib + a minimal tar parser) rather than
// the system `tar`, because Windows' bsdtar misreads `C:\...` paths as a
// remote host (`Cannot connect to C: resolve failed`).

import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// Electron 31.x exposes ABI 125. Bump this whenever the Electron major changes.
const ELECTRON_ABI = 125
const NODE_ABI = process.versions.modules
const platform = process.platform
const arch = process.arch

const pkgPath = join(ROOT, 'node_modules/better-sqlite3/package.json')
if (!existsSync(pkgPath)) {
  console.log('[setup-better-sqlite3] better-sqlite3 not installed yet; skipping.')
  process.exit(0)
}

const version = JSON.parse(readFileSync(pkgPath, 'utf8')).version
const MIRROR = 'https://registry.npmmirror.com/-/binary/better-sqlite3'

const targets = [
  { runtime: 'electron', abi: ELECTRON_ABI },
  { runtime: 'node', abi: NODE_ABI }
]

// 最小 ustar tar 解析：返回名字以 `name` 结尾的成员内容，找不到返回 null。
function extractFromTar(tarBuf, name) {
  let offset = 0
  while (offset + 512 <= tarBuf.length) {
    const header = tarBuf.subarray(offset, offset + 512)
    if (header.every((b) => b === 0)) return null // 两个零块表示归档结束
    const entryName = header.subarray(0, 100).toString('utf8').replace(/\0[\s\S]*$/, '')
    const sizeStr = header.subarray(124, 136).toString('utf8').replace(/\0[\s\S]*$/, '').trim()
    const size = parseInt(sizeStr || '0', 8) || 0
    const dataStart = offset + 512
    if (entryName.endsWith(name)) {
      return tarBuf.subarray(dataStart, dataStart + size)
    }
    offset = dataStart + Math.ceil(size / 512) * 512
  }
  return null
}

async function main() {
  for (const { runtime, abi } of targets) {
    const file = `better-sqlite3-v${version}-${runtime}-v${abi}-${platform}-${arch}.tar.gz`
    const url = `${MIRROR}/v${version}/${file}`
    const destDir = join(ROOT, 'node_modules/better-sqlite3/lib/binding', `node-v${abi}-${platform}-${arch}`)
    const dest = join(destDir, 'better_sqlite3.node')

    if (existsSync(dest)) {
      console.log(`[setup-better-sqlite3] already present: ${runtime} (ABI ${abi})`)
      continue
    }

    console.log(`[setup-better-sqlite3] downloading ${url}`)
    const res = await fetch(url)
    if (!res.ok) {
      console.warn(`[setup-better-sqlite3] download failed (HTTP ${res.status}) for ${runtime} ABI ${abi}; skipping`)
      continue
    }

    const tarBuf = gunzipSync(Buffer.from(await res.arrayBuffer()))
    const nodeBuf = extractFromTar(tarBuf, 'better_sqlite3.node')
    if (!nodeBuf) {
      console.warn(`[setup-better-sqlite3] could not find better_sqlite3.node in archive for ${runtime}`)
      continue
    }

    mkdirSync(destDir, { recursive: true })
    writeFileSync(dest, nodeBuf)
    console.log(`[setup-better-sqlite3] installed ${runtime} build -> ${dest}`)
  }
}

main().catch((err) => {
  console.error('[setup-better-sqlite3]', err)
  process.exitCode = 1
})
