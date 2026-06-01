// `ansible <pattern> -m <module> -a <args>` ad-hoc command execution.
import { resolvePattern, hostVars } from './inventory'
import { runModule } from './modules'
import { cloneHosts } from './hostState'

export function runAdhoc({ pattern, module = 'ping', argsString = '', become = false, check = false }, state, inv) {
  const hosts = cloneHosts(state.hosts)
  const targets = resolvePattern(inv, pattern).filter(h => hosts[h])
  const lines = []

  if (!targets.length) {
    return { lines: [`[WARNING]: Could not match supplied host pattern, ignoring: ${pattern}`], hosts: state.hosts }
  }

  for (const h of targets) {
    const host = hosts[h]
    if (!isReachable(host, inv, h)) {
      lines.push(`${h} | UNREACHABLE! => {"changed": false, "msg": "Failed to connect to the host via ssh: Connection timed out", "unreachable": true}`)
      continue
    }
    const scope = { ...hostVars(inv, h), ...host.facts, inventory_hostname: h }
    const args = (module === 'command' || module === 'shell' || module === 'raw')
      ? { _cmd: argsString }
      : parseInlineArgs(argsString)
    const ctx = { become, check, vfs: state.vfs, vars: scope }
    const res = runModule(module, host, args, ctx)

    const data = { changed: !!res.changed, ...(res.data || {}) }
    if (res.msg && !data.ping) data.msg = res.msg
    const body = JSON.stringify(data)
    if (res.failed) lines.push(`${h} | FAILED! => ${body}`)
    else if (res.changed) lines.push(`${h} | CHANGED => ${body}`)
    else lines.push(`${h} | SUCCESS => ${body}`)
  }

  return { lines, hosts }
}

function isReachable(host, inv, name) {
  if (host.reachable === false) return false
  const ah = inv.hosts[name]?.vars?.ansible_host
  if (ah && host.realAddress && ah !== host.realAddress) return false
  return true
}

function parseInlineArgs(str) {
  const out = {}
  const re = /(\w+)=("[^"]*"|'[^']*'|\S+)/g
  let m
  while ((m = re.exec(str)) !== null) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
  return out
}
