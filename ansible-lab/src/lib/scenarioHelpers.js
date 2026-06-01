// Shared helpers for authoring tutorials & troubleshooting labs.
import { createDefaultState } from './seed'
import { writeFile, readFile } from './vfs'

// Build a scenario state from defaults, overlaying extra files and host tweaks.
export function baseState(extraFiles = {}, hostMutator) {
  const s = createDefaultState()
  for (const [p, c] of Object.entries(extraFiles)) s.vfs = writeFile(s.vfs, p, c)
  if (hostMutator) hostMutator(s.hosts)
  return s
}

export const installed = (s, h, pkg) => !!s.hosts[h]?.packages.includes(pkg)
export const running = (s, h, svc) => s.hosts[h]?.services[svc] === 'started'
export const fileExists = (s, h, path) => s.hosts[h]?.files[path] !== undefined
export const fileHas = (s, h, path, sub) =>
  typeof s.hosts[h]?.files[path] === 'string' && s.hosts[h].files[path].includes(sub)
export const vfsHas = (s, path, sub) => {
  const c = readFile(s.vfs, path)
  return c !== null && (sub === undefined || c.includes(sub))
}
export const ok = (pass, label) => ({ pass: !!pass, label })
