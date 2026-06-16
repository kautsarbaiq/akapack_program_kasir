// Build frontend AKAPACK jadi situs statis (out/) untuk dibungkus Tauri.
// `output: 'export'` Next.js tidak mengizinkan middleware, jadi proxy.ts
// disingkirkan sementara lalu dikembalikan (pakai try/finally agar aman).
import { renameSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'

const proxy = 'src/proxy.ts'
const backup = 'src/proxy.ts.tauribak'
let moved = false

if (existsSync(proxy)) {
  renameSync(proxy, backup)
  moved = true
  console.log('• proxy.ts disingkirkan sementara (export tanpa middleware)')
}

try {
  execSync('npx next build', { stdio: 'inherit', env: { ...process.env, TAURI_BUILD: '1' } })
  console.log('\n✅ Export selesai → folder out/ siap dibungkus Tauri')
} finally {
  if (moved) {
    renameSync(backup, proxy)
    console.log('• proxy.ts dikembalikan')
  }
}
