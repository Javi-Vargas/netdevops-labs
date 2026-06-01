// Parse playbook YAML and run it against managed-host state, Ansible-style.
import yaml from 'js-yaml'
import { resolvePattern, hostVars, groupHosts } from './inventory'
import { isModule, runModule } from './modules'
import { evalWhen, renderDeep, render, lookup } from './jinja'
import { readFile } from './vfs'
import { cloneHosts } from './hostState'
import { isVault, vaultDecrypt } from './vault'

export class PlaybookError extends Error {}

// opts: { check, limit, tags, become, extraVars, vaultUnlocked }
export function runPlaybook(text, state, inv, opts = {}) {
  let plays
  try {
    const doc = yaml.load(text)
    plays = Array.isArray(doc) ? doc : (doc ? [doc] : [])
  } catch (e) {
    throw new PlaybookError(`ERROR! Syntax Error while loading YAML.\n  ${e.message}`)
  }
  if (!plays.length) throw new PlaybookError('ERROR! playbook is empty')

  const hosts = cloneHosts(state.hosts)
  const vfs = state.vfs
  const lines = []
  const recap = {}
  const ensure = (h) => (recap[h] ||= { ok: 0, changed: 0, unreachable: 0, failed: 0, skipped: 0 })

  const limitSet = opts.limit ? new Set(resolvePattern(inv, opts.limit)) : null
  const tagsSet = opts.tags && opts.tags.length ? new Set(opts.tags) : null

  for (const play of plays) {
    const pattern = String(play.hosts ?? 'all')
    let targets = resolvePattern(inv, pattern).filter(h => hosts[h])
    if (limitSet) targets = targets.filter(h => limitSet.has(h))

    lines.push(head(`PLAY [${play.name || pattern}]`))

    // Expand roles, then play tasks.
    let tasks = []
    let handlers = normalizeTasks(play.handlers)
    const roleVars = {}
    for (const roleName of asList(play.roles)) {
      const role = loadRole(vfs, typeof roleName === 'object' ? roleName.role : roleName)
      Object.assign(roleVars, role.vars)
      tasks.push(...role.tasks)
      handlers.push(...role.handlers)
      if (role.missing) lines.push(`[WARNING]: role '${roleName}' not found`)
    }
    tasks.push(...normalizeTasks(play.tasks))

    // Play vars + vars_files (with vault detection).
    const playVars = { ...(play.vars || {}) }
    for (const vf of asList(play.vars_files)) {
      const content = readFile(vfs, vf)
      if (content === null) { lines.push(`[WARNING]: vars_file '${vf}' not found`); continue }
      if (isVault(content) && !opts.vaultUnlocked) {
        throw new PlaybookError(`ERROR! Attempting to decrypt but no vault secrets found.\n  Decryption failed on ${vf} (try --ask-vault-pass)`)
      }
      try {
        const parsed = yaml.load(isVault(content) ? vaultDecrypt(content) : content)
        Object.assign(playVars, parsed || {})
      } catch { /* ignore parse errors in vars file */ }
    }

    const gather = play.gather_facts !== false && play.gather_facts !== 'no'
    const failed = new Set()
    const unreachable = new Set()
    const notified = {}
    const scopes = {}

    for (const h of targets) {
      ensure(h)
      scopes[h] = {
        ...hostVars(inv, h), ...loadVarFiles(vfs, inv, h, opts), ...playVars, ...roleVars, ...(opts.extraVars || {}),
        ...hosts[h].facts, inventory_hostname: h,
      }
      if (!isReachable(hosts[h], inv, h)) {
        lines.push(`fatal: [${h}]: UNREACHABLE! => {"changed": false, "msg": "Failed to connect to the host via ssh: Connection timed out"}`)
        ensure(h).unreachable++
        unreachable.add(h)
      }
    }

    const live = () => targets.filter(h => !failed.has(h) && !unreachable.has(h))

    if (gather && live().length) {
      lines.push(head('TASK [Gathering Facts]'))
      for (const h of live()) { lines.push(`ok: [${h}]`); ensure(h).ok++ }
    }

    for (const task of tasks) {
      if (tagsSet && task.tags && !task.tags.some(t => tagsSet.has(t))) continue
      const { mod, args } = identifyModule(task)
      lines.push(head(`TASK [${task.name || mod || 'task'}]`))
      if (!mod) { for (const h of live()) { lines.push(`fatal: [${h}]: FAILED! => {"msg": "no recognized module in task"}`); ensure(h).failed++; failed.add(h) } continue }
      const becomeTask = resolveBecome(task, play, opts)

      for (const h of live()) {
        const scope = scopes[h]
        if (task.when !== undefined && !evalWhen(task.when, scope)) {
          lines.push(`skipping: [${h}]`); ensure(h).skipped++; continue
        }
        const ctx = { become: becomeTask, check: opts.check, vfs, vars: scope }
        const res = runTask(mod, args, task, hosts[h], ctx, scope)

        if (res.facts) Object.assign(scope, res.facts)
        if (task.register) scope[task.register] = { changed: res.changed, failed: !!res.failed, msg: res.msg, ...(res.data || {}) }

        if (res.failed && !truthy(task.ignore_errors)) {
          lines.push(`fatal: [${h}]: FAILED! => {"changed": false, "msg": "${esc(res.msg)}"}`)
          ensure(h).failed++; failed.add(h); continue
        }
        if (res.failed) {
          lines.push(`fatal: [${h}]: FAILED! => {"msg": "${esc(res.msg)}"}...ignoring`); ensure(h).ok++
        } else if (res.changed) {
          lines.push(`changed: [${h}]`); ensure(h).changed++; ensure(h).ok++
          for (const n of asList(task.notify)) (notified[h] ||= new Set()).add(n)
        } else {
          lines.push(`ok: [${h}]`); ensure(h).ok++
        }
      }
    }

    // Handlers (only those notified, in handler-definition order, run once).
    for (const handler of handlers) {
      const hName = handler.name
      const hostsNotified = live().filter(h => notified[h]?.has(hName))
      if (!hostsNotified.length) continue
      const { mod, args } = identifyModule(handler)
      lines.push(head(`RUNNING HANDLER [${hName}]`))
      const becomeH = resolveBecome(handler, play, opts)
      for (const h of hostsNotified) {
        const ctx = { become: becomeH, check: opts.check, vfs, vars: scopes[h] }
        const res = runTask(mod, args, handler, hosts[h], ctx, scopes[h])
        if (res.failed) { lines.push(`fatal: [${h}]: FAILED! => {"msg": "${esc(res.msg)}"}`); ensure(h).failed++ }
        else if (res.changed) { lines.push(`changed: [${h}]`); ensure(h).changed++; ensure(h).ok++ }
        else { lines.push(`ok: [${h}]`); ensure(h).ok++ }
      }
    }
  }

  lines.push('')
  lines.push(head('PLAY RECAP'))
  for (const h of Object.keys(recap).sort()) {
    const r = recap[h]
    lines.push(`${h.padEnd(26)}: ok=${r.ok}    changed=${r.changed}    unreachable=${r.unreachable}    failed=${r.failed}    skipped=${r.skipped}`)
  }

  return { lines, recap, hosts }
}

function runTask(mod, args, task, host, ctx, scope) {
  const items = task.loop ?? task.with_items
  if (items === undefined) {
    return runModule(mod, host, renderDeep(args, scope), ctx)
  }
  const list = resolveLoop(items, scope)
  let changed = false
  let firstFail = null
  for (const item of list) {
    const itemScope = { ...scope, item }
    const res = runModule(mod, host, renderDeep(args, itemScope), { ...ctx, vars: itemScope })
    if (res.changed) changed = true
    if (res.failed && !firstFail) firstFail = res
  }
  if (firstFail) return { failed: true, msg: firstFail.msg, changed }
  return { changed, msg: `loop over ${list.length} item(s)` }
}

function resolveLoop(items, scope) {
  if (Array.isArray(items)) return items
  if (typeof items === 'string') {
    const inner = items.replace(/^\{\{\s*|\s*\}\}$/g, '')
    const val = lookup(inner, scope)
    if (Array.isArray(val)) return val
    return [render(items, scope)]
  }
  return [items]
}

function identifyModule(task) {
  if (!task || typeof task !== 'object') return { mod: null, args: {} }
  for (const key of Object.keys(task)) {
    const base = key.replace(/^ansible\.[a-z_]+\./, '')
    if (isModule(base)) {
      let args = task[key]
      if (typeof args === 'string') {
        args = (base === 'command' || base === 'shell' || base === 'raw')
          ? { _cmd: args }
          : parseInlineArgs(args)
      }
      return { mod: base, args: args || {} }
    }
  }
  return { mod: null, args: {} }
}

function parseInlineArgs(str) {
  const out = {}
  const re = /(\w+)=("[^"]*"|'[^']*'|\S+)/g
  let m
  while ((m = re.exec(str)) !== null) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
  return out
}

function normalizeTasks(tasks) {
  return asList(tasks).map(t => {
    const task = { ...t }
    if (task.tags && !Array.isArray(task.tags)) task.tags = [task.tags]
    return task
  })
}

function loadRole(vfs, name) {
  const tasksText = readFile(vfs, `roles/${name}/tasks/main.yml`)
  if (tasksText === null) return { tasks: [], handlers: [], vars: {}, missing: true }
  const parse = (p) => { const c = readFile(vfs, p); if (!c) return null; try { return yaml.load(c) } catch { return null } }
  const tasks = normalizeTasks(safeArray(yaml.load(tasksText)))
  const handlers = normalizeTasks(safeArray(parse(`roles/${name}/handlers/main.yml`)))
  const vars = { ...(parse(`roles/${name}/defaults/main.yml`) || {}), ...(parse(`roles/${name}/vars/main.yml`) || {}) }
  return { tasks, handlers, vars, missing: false }
}

// Auto-load group_vars/ and host_vars/ files from the VFS (Ansible behavior).
function loadVarFiles(vfs, inv, host, opts) {
  const out = {}
  const tryMerge = (path) => {
    const c = readFile(vfs, path)
    if (c === null) return
    const text = isVault(c) ? (opts.vaultUnlocked ? vaultDecrypt(c) : null) : c
    if (text === null) return
    try { Object.assign(out, yaml.load(text) || {}) } catch { /* ignore */ }
  }
  tryMerge('group_vars/all.yml'); tryMerge('group_vars/all.yaml')
  for (const g of Object.keys(inv.groups)) {
    if (g === 'all') continue
    if (groupHosts(inv, g).includes(host)) { tryMerge(`group_vars/${g}.yml`); tryMerge(`group_vars/${g}.yaml`) }
  }
  tryMerge(`host_vars/${host}.yml`); tryMerge(`host_vars/${host}.yaml`)
  return out
}

function isReachable(host, inv, name) {
  if (host.reachable === false) return false
  const ah = inv.hosts[name]?.vars?.ansible_host
  if (ah && host.realAddress && ah !== host.realAddress) return false
  return true
}

function resolveBecome(task, play, opts) {
  if (task.become !== undefined) return truthy(task.become)
  if (play.become !== undefined) return truthy(play.become)
  return !!opts.become
}

const asList = (v) => (v == null ? [] : Array.isArray(v) ? v : [v])
const safeArray = (v) => (Array.isArray(v) ? v : [])
const truthy = (v) => v === true || v === 'yes' || v === 'true' || v === 1
const esc = (s) => String(s).replace(/"/g, '\\"')
const head = (prefix) => (prefix + ' ').padEnd(72, '*')
