// Virtual filesystem: a flat map of path -> file content string.
// Backs the in-browser editor and the `cat` / `ls` commands.

export function createVfs(files = {}) {
  return { ...files }
}

export function readFile(vfs, path) {
  const p = normalize(path)
  return Object.prototype.hasOwnProperty.call(vfs, p) ? vfs[p] : null
}

export function writeFile(vfs, path, content) {
  return { ...vfs, [normalize(path)]: content }
}

export function exists(vfs, path) {
  return Object.prototype.hasOwnProperty.call(vfs, normalize(path))
}

export function listFiles(vfs) {
  return Object.keys(vfs).sort()
}

// Files directly or transitively under a directory prefix.
export function listDir(vfs, dir) {
  const prefix = dir && dir !== '.' ? normalize(dir).replace(/\/?$/, '/') : ''
  const entries = new Set()
  for (const path of Object.keys(vfs)) {
    if (!path.startsWith(prefix)) continue
    const rest = path.slice(prefix.length)
    const slash = rest.indexOf('/')
    entries.add(slash === -1 ? rest : rest.slice(0, slash) + '/')
  }
  return [...entries].sort()
}

function normalize(path) {
  return String(path).replace(/^\.\//, '').replace(/^\/+/, '')
}
