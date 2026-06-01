// Module registry. Each module mutates the host and returns:
//   { changed, failed?, unreachable?, msg, data?, facts? }
// `ctx` = { become, check, vfs, vars }.
import { readFile } from './vfs'
import { render } from './jinja'

const PRIVILEGED = new Set(['package', 'apt', 'yum', 'dnf', 'service', 'systemd', 'user'])
const PROTECTED_DIRS = ['/etc', '/usr', '/var', '/opt', '/root']

export function isModule(name) {
  return Object.prototype.hasOwnProperty.call(registry, name)
}

export function moduleNames() {
  return Object.keys(registry).sort()
}

export function runModule(name, host, args, ctx) {
  const fn = registry[name]
  if (!fn) return { failed: true, msg: `module ${name} not found` }
  // Privilege gate for clearly privileged modules.
  if (PRIVILEGED.has(name) && !ctx.become) {
    return { failed: true, msg: `Permission denied (you may need to use become/sudo to run "${name}")` }
  }
  return fn(host, args || {}, ctx)
}

function needsBecomeForPath(path, ctx) {
  if (!path) return false
  if (ctx.become) return false
  return PROTECTED_DIRS.some(d => path === d || path.startsWith(d + '/'))
}

function asList(v) {
  if (v == null) return []
  return Array.isArray(v) ? v : [v]
}

const registry = {
  ping(host) {
    return { changed: false, msg: 'pong', data: { ping: 'pong' } }
  },

  debug(host, args, ctx) {
    if (args.var !== undefined) {
      const val = ctx.vars[args.var]
      return { changed: false, msg: `${args.var}: ${val === undefined ? 'VARIABLE IS NOT DEFINED!' : JSON.stringify(val)}` }
    }
    return { changed: false, msg: render(args.msg != null ? String(args.msg) : 'Hello world!', ctx.vars) }
  },

  command(host, args) {
    const cmd = args._cmd || args.cmd || ''
    if (args.creates && host.files[args.creates] !== undefined) {
      return { changed: false, msg: `skipped, since ${args.creates} exists` }
    }
    return { changed: true, msg: cmd, data: { cmd, rc: 0 } }
  },
  shell(host, args) {
    return registry.command(host, args)
  },
  raw(host, args) {
    return registry.command(host, args)
  },

  package(host, args) {
    const state = args.state || 'present'
    const names = asList(args.name)
    if (!names.length) return { failed: true, msg: 'missing required argument: name' }
    let changed = false
    for (const n of names) {
      const has = host.packages.includes(n)
      if (state === 'absent') {
        if (has) { host.packages = host.packages.filter(p => p !== n); changed = true }
      } else { // present | latest
        if (!has) { host.packages.push(n); changed = true }
      }
    }
    return { changed, msg: `${names.join(', ')} ${state}` }
  },

  service(host, args) {
    const name = args.name
    if (!name) return { failed: true, msg: 'missing required argument: name' }
    const state = args.state
    let changed = false
    if (state === 'started' || (args.enabled && !state)) {
      if (host.services[name] !== 'started') { host.services[name] = 'started'; changed = true }
    } else if (state === 'stopped') {
      if (host.services[name] !== 'stopped') { host.services[name] = 'stopped'; changed = true }
    } else if (state === 'restarted' || state === 'reloaded') {
      host.services[name] = 'started'; changed = true
    }
    return { changed, msg: `service ${name} ${state || (args.enabled ? 'enabled' : '')}`.trim() }
  },

  copy(host, args, ctx) {
    const dest = args.dest
    if (!dest) return { failed: true, msg: 'missing required argument: dest' }
    if (needsBecomeForPath(dest, ctx)) return { failed: true, msg: `Permission denied writing ${dest} (need become)` }
    let content
    if (args.content !== undefined) content = render(String(args.content), ctx.vars)
    else if (args.src) {
      content = readFile(ctx.vfs, args.src)
      if (content === null) return { failed: true, msg: `src not found: ${args.src}` }
    } else return { failed: true, msg: 'copy requires content or src' }
    const changed = host.files[dest] !== content
    if (changed && !ctx.check) host.files[dest] = content
    return { changed, msg: `copied to ${dest}` }
  },

  template(host, args, ctx) {
    const dest = args.dest
    if (!args.src || !dest) return { failed: true, msg: 'template requires src and dest' }
    if (needsBecomeForPath(dest, ctx)) return { failed: true, msg: `Permission denied writing ${dest} (need become)` }
    const tpl = readFile(ctx.vfs, args.src)
    if (tpl === null) return { failed: true, msg: `template src not found: ${args.src}` }
    const content = render(tpl, ctx.vars)
    const changed = host.files[dest] !== content
    if (changed && !ctx.check) host.files[dest] = content
    return { changed, msg: `templated ${args.src} -> ${dest}` }
  },

  file(host, args, ctx) {
    const path = args.path || args.dest
    if (!path) return { failed: true, msg: 'missing required argument: path' }
    if (needsBecomeForPath(path, ctx)) return { failed: true, msg: `Permission denied on ${path} (need become)` }
    const state = args.state || 'file'
    let changed = false
    if (state === 'absent') {
      if (host.files[path] !== undefined) { delete host.files[path]; changed = true }
    } else if (state === 'directory') {
      const key = path.replace(/\/?$/, '/')
      if (host.files[key] === undefined) { host.files[key] = '<directory>'; changed = true }
    } else { // touch | file
      if (host.files[path] === undefined) { host.files[path] = ''; changed = true }
    }
    return { changed, msg: `${path} ${state}` }
  },

  lineinfile(host, args, ctx) {
    const path = args.path || args.dest
    const line = render(String(args.line ?? ''), ctx.vars)
    if (!path) return { failed: true, msg: 'missing required argument: path' }
    if (needsBecomeForPath(path, ctx)) return { failed: true, msg: `Permission denied on ${path} (need become)` }
    const content = host.files[path] || ''
    const lines = content ? content.split('\n') : []
    if (lines.includes(line)) return { changed: false, msg: `line already present in ${path}` }
    lines.push(line)
    if (!ctx.check) host.files[path] = lines.join('\n')
    return { changed: true, msg: `line added to ${path}` }
  },

  user(host, args) {
    const name = args.name
    if (!name) return { failed: true, msg: 'missing required argument: name' }
    const state = args.state || 'present'
    let changed = false
    if (state === 'absent') {
      if (host.users.includes(name)) { host.users = host.users.filter(u => u !== name); changed = true }
    } else {
      if (!host.users.includes(name)) { host.users.push(name); changed = true }
    }
    return { changed, msg: `user ${name} ${state}` }
  },

  set_fact(host, args, ctx) {
    const facts = {}
    for (const [k, v] of Object.entries(args)) {
      if (k.startsWith('_')) continue
      facts[k] = typeof v === 'string' ? render(v, ctx.vars) : v
    }
    return { changed: false, msg: 'set_fact', facts }
  },

  setup(host) {
    return { changed: false, msg: 'facts gathered', data: host.facts }
  },
  gather_facts(host) {
    return registry.setup(host)
  },
}
