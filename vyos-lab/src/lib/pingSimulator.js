// Simulates `ping <target>` reachability from the running config tree.
import { deriveInterfaces, deriveStaticRoutes } from './showCommands'
import { inSubnet, isValidIpv4 } from './ipUtils'

const PUBLIC_HOSTS = new Set(['8.8.8.8', '1.1.1.1', '9.9.9.9', 'google.com', 'vyos.io'])

export function isReachable(tree, target) {
  const ifaces = deriveInterfaces(tree).filter(i => !i.disabled)

  // Own / on-link addresses.
  for (const i of ifaces) {
    for (const a of i.addresses) {
      const bare = a.split('/')[0]
      if (bare === target) return { ok: true, via: i.name }
      if (isValidIpv4(target) && inSubnet(target, a)) return { ok: true, via: i.name }
    }
  }

  const routes = deriveStaticRoutes(tree)
  const hasDefault = routes.some(r => r.prefix === '0.0.0.0/0' && !r.blackhole)

  // Covered by a specific static route.
  if (isValidIpv4(target)) {
    for (const r of routes) {
      if (r.blackhole) continue
      if (r.prefix !== '0.0.0.0/0' && inSubnet(target, r.prefix)) return { ok: true, via: r.nextHop }
    }
  }

  // Internet hosts need a default route.
  if (PUBLIC_HOSTS.has(target) || !isValidIpv4(target)) {
    if (hasDefault) return { ok: true, via: 'default' }
    return { ok: false, reason: 'no-route' }
  }

  if (hasDefault) return { ok: true, via: 'default' }
  return { ok: false, reason: 'no-route' }
}

export function simulatePing(tree, target, count = 4) {
  if (!target) return 'ping: missing host operand'
  const res = isReachable(tree, target)
  const lines = [`PING ${target} (${target}): 56 data bytes`]
  if (res.ok) {
    for (let i = 0; i < count; i++) {
      const ms = (Math.random() * 8 + 0.3).toFixed(3)
      lines.push(`64 bytes from ${target}: icmp_seq=${i} ttl=64 time=${ms} ms`)
    }
    lines.push('')
    lines.push(`--- ${target} ping statistics ---`)
    lines.push(`${count} packets transmitted, ${count} packets received, 0% packet loss`)
  } else {
    for (let i = 0; i < count; i++) lines.push(`Request timeout for icmp_seq ${i}`)
    lines.push('')
    lines.push(`--- ${target} ping statistics ---`)
    lines.push(`${count} packets transmitted, 0 packets received, 100% packet loss`)
  }
  return lines.join('\n')
}
