// Parse an INI-style inventory and resolve host patterns.
//
//   [webservers]
//   web1 ansible_host=192.168.56.11 ansible_user=ubuntu
//   web2 ansible_host=192.168.56.12
//
//   [dbservers]
//   db1 ansible_host=192.168.56.21
//
//   [webservers:vars]
//   http_port=80

export function parseInventory(text) {
  const hosts = {}
  const groups = { all: { hosts: [], vars: {}, children: [] } }
  if (!text) return { hosts, groups }

  let section = null // { group, kind: 'hosts'|'vars'|'children' }

  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/[#;].*$/, '').trim()
    if (!line) continue

    const sec = line.match(/^\[([^\]]+)\]$/)
    if (sec) {
      const [group, kind] = sec[1].split(':')
      if (!groups[group]) groups[group] = { hosts: [], vars: {}, children: [] }
      section = { group, kind: kind || 'hosts' }
      continue
    }

    if (!section || section.kind === 'hosts') {
      const group = section ? section.group : 'all'
      const [name, ...rest] = line.split(/\s+/)
      if (!hosts[name]) hosts[name] = { vars: {} }
      Object.assign(hosts[name].vars, parseKv(rest))
      if (!groups.all.hosts.includes(name)) groups.all.hosts.push(name)
      if (group !== 'all') {
        if (!groups[group]) groups[group] = { hosts: [], vars: {}, children: [] }
        if (!groups[group].hosts.includes(name)) groups[group].hosts.push(name)
      }
    } else if (section.kind === 'vars') {
      Object.assign(groups[section.group].vars, parseKv(line.split(/\s+/)))
    } else if (section.kind === 'children') {
      groups[section.group].children.push(line.trim())
    }
  }

  return { hosts, groups }
}

function parseKv(tokens) {
  const out = {}
  for (const tok of tokens) {
    const eq = tok.indexOf('=')
    if (eq === -1) continue
    out[tok.slice(0, eq)] = coerce(tok.slice(eq + 1))
  }
  return out
}

function coerce(v) {
  if (/^\d+$/.test(v)) return Number(v)
  if (v === 'true' || v === 'false') return v === 'true'
  return v
}

// All host names in a group (expanding children).
export function groupHosts(inv, group, seen = new Set()) {
  if (group === 'all' || group === '*') return [...inv.groups.all.hosts]
  const g = inv.groups[group]
  if (!g || seen.has(group)) return []
  seen.add(group)
  const out = [...g.hosts]
  for (const child of g.children || []) {
    for (const h of groupHosts(inv, child, seen)) if (!out.includes(h)) out.push(h)
  }
  return out
}

// Resolve an Ansible host pattern into a list of host names.
// Supports union (':' or ','), intersection ('&group') and exclusion ('!group').
export function resolvePattern(inv, pattern) {
  if (!pattern) return []
  const tokens = pattern.split(/[:,]/).map(t => t.trim()).filter(Boolean)
  let include = []
  const intersect = []
  const exclude = []

  for (const tok of tokens) {
    if (tok.startsWith('&')) intersect.push(tok.slice(1))
    else if (tok.startsWith('!')) exclude.push(tok.slice(1))
    else include.push(tok)
  }

  let result = []
  for (const tok of include) result = union(result, expand(inv, tok))
  for (const tok of intersect) {
    const set = new Set(expand(inv, tok))
    result = result.filter(h => set.has(h))
  }
  for (const tok of exclude) {
    const set = new Set(expand(inv, tok))
    result = result.filter(h => !set.has(h))
  }
  return result
}

function expand(inv, token) {
  if (token === 'all' || token === '*') return [...inv.groups.all.hosts]
  if (inv.groups[token]) return groupHosts(inv, token)
  if (inv.hosts[token]) return [token]
  // glob like web*
  if (token.includes('*')) {
    const re = new RegExp('^' + token.replace(/\*/g, '.*') + '$')
    return inv.groups.all.hosts.filter(h => re.test(h))
  }
  return []
}

function union(a, b) {
  const out = [...a]
  for (const x of b) if (!out.includes(x)) out.push(x)
  return out
}

// Merge all group vars (in order) + host vars for a host.
export function hostVars(inv, name) {
  const vars = {}
  Object.assign(vars, inv.groups.all.vars || {})
  for (const [gName, g] of Object.entries(inv.groups)) {
    if (gName === 'all') continue
    if (groupHosts(inv, gName).includes(name)) Object.assign(vars, g.vars || {})
  }
  Object.assign(vars, inv.hosts[name]?.vars || {})
  return vars
}

export function graph(inv) {
  const lines = ['@all:']
  const grouped = new Set()
  for (const [gName, g] of Object.entries(inv.groups)) {
    if (gName === 'all') continue
    lines.push(`  |--@${gName}:`)
    for (const h of groupHosts(inv, gName)) { lines.push(`  |  |--${h}`); grouped.add(h) }
  }
  const ungrouped = inv.groups.all.hosts.filter(h => !grouped.has(h))
  for (const h of ungrouped) lines.push(`  |--${h}`)
  return lines.join('\n')
}
