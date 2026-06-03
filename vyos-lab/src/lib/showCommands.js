// Derives operational `show ...` output from the running config tree.
import { isContainer, isLeaf, renderCurly, renderCommands, valuesAt } from './configTree'

const IF_TYPES = ['ethernet', 'loopback', 'dummy', 'bridge', 'bond', 'wireguard']
const IF_SHORT = { ethernet: 'eth', loopback: 'lo', dummy: 'dum', bridge: 'br', bond: 'bond', wireguard: 'wg' }

// ---- Model extraction (also used by the ping simulator) --------------------

export function deriveInterfaces(tree) {
  const out = []
  const ifaces = tree.interfaces
  if (!isContainer(ifaces)) return out
  for (const type of IF_TYPES) {
    const group = ifaces[type]
    if (!isContainer(group)) continue
    for (const name of Object.keys(group)) {
      const node = group[name]
      const addresses = valuesAt(tree, ['interfaces', type, name, 'address']) || []
      const descArr = valuesAt(tree, ['interfaces', type, name, 'description']) || []
      const disabled = isContainer(node) && isLeaf(node.disable)
      out.push({
        name,
        type,
        addresses,
        description: descArr[0] || '',
        disabled,
        admin: disabled ? 'A' : 'u',
        link: disabled ? 'D' : 'u',
      })
    }
  }
  return out
}

export function deriveStaticRoutes(tree) {
  const out = []
  const routes = tree?.protocols?.static?.route
  if (!isContainer(routes)) return out
  for (const prefix of Object.keys(routes)) {
    const node = routes[prefix]
    const blackhole = isContainer(node) && (isLeaf(node.blackhole) || node.blackhole !== undefined)
    const hops = isContainer(node) && isContainer(node['next-hop']) ? Object.keys(node['next-hop']) : []
    if (hops.length) {
      for (const hop of hops) {
        const dist = valuesAt(tree, ['protocols', 'static', 'route', prefix, 'next-hop', hop, 'distance'])
        out.push({ prefix, nextHop: hop, distance: dist?.[0] || '1', blackhole: false })
      }
    } else if (blackhole) {
      out.push({ prefix, nextHop: null, distance: '1', blackhole: true })
    }
  }
  return out
}

export function deriveNatSourceRules(tree) {
  const out = []
  const rules = tree?.nat?.source?.rule
  if (!isContainer(rules)) return out
  for (const id of Object.keys(rules).sort((a, b) => Number(a) - Number(b))) {
    out.push({
      id,
      source: (valuesAt(tree, ['nat', 'source', 'rule', id, 'source', 'address']) || ['any'])[0],
      outInt: (valuesAt(tree, ['nat', 'source', 'rule', id, 'outbound-interface']) || ['any'])[0],
      translation: isLeaf(rules[id]?.translation?.address) && rules[id].translation.address.values[0]
        || (rules[id]?.translation && isContainer(rules[id].translation) && rules[id].translation.masquerade ? 'masquerade' : 'masquerade'),
    })
  }
  return out
}

// ---- show command renderers ------------------------------------------------

export function showInterfaces(tree, arg) {
  const ifaces = deriveInterfaces(tree)
  if (arg) {
    const found = ifaces.find(i => i.name === arg)
    if (!found) return `Interface "${arg}" does not exist`
    const lines = [
      `${found.name}: <BROADCAST,MULTICAST${found.disabled ? '' : ',UP,LOWER_UP'}> mtu 1500`,
      `    Description: ${found.description || '(none)'}`,
      `    Administrative state: ${found.disabled ? 'down' : 'up'}    Link: ${found.disabled ? 'down' : 'up'}`,
    ]
    if (found.addresses.length) {
      found.addresses.forEach(a => lines.push(`    inet ${a}`))
    } else {
      lines.push('    inet (no address configured)')
    }
    lines.push('    RX:  bytes  packets  errors  dropped')
    lines.push(`         ${rnd(900000)}  ${rnd(8000)}  0  0`)
    lines.push('    TX:  bytes  packets  errors  dropped')
    lines.push(`         ${rnd(700000)}  ${rnd(7000)}  0  0`)
    return lines.join('\n')
  }

  const header = [
    'Codes: S - State, L - Link, u - Up, D - Down, A - Admin Down',
    'Interface        IP Address                        S/L  Description',
    '---------        ----------                        ---  -----------',
  ]
  if (!ifaces.length) return header.concat('(no interfaces configured)').join('\n')
  const rows = ifaces.map(i => {
    const ip = i.addresses[0] || '-'
    return pad(i.name, 17) + pad(ip, 34) + pad(`${i.admin}/${i.link}`, 5) + i.description
  })
  // extra addresses on their own line
  const expanded = []
  ifaces.forEach(i => {
    expanded.push(pad(i.name, 17) + pad(i.addresses[0] || '-', 34) + pad(`${i.admin}/${i.link}`, 5) + i.description)
    i.addresses.slice(1).forEach(a => expanded.push(pad('', 17) + a))
  })
  return header.concat(expanded).join('\n')
}

export function showConfiguration(tree, tokens) {
  if (tokens && tokens[0] === 'commands') {
    const cmds = renderCommands(tree)
    return cmds.length ? cmds.join('\n') : '(empty configuration)'
  }
  const curly = renderCurly(tree)
  return curly || '(empty configuration)'
}

export function showRoute(tree) {
  const lines = [
    'Codes: K - kernel route, C - connected, S - static, B - BGP, O - OSPF',
    '       > - selected route, * - FIB route',
    '',
  ]
  const ifaces = deriveInterfaces(tree)
  ifaces.forEach(i => {
    if (i.disabled) return
    i.addresses.forEach(a => {
      lines.push(`C>* ${networkOf(a)} is directly connected, ${i.name}`)
    })
  })
  deriveStaticRoutes(tree).forEach(r => {
    if (r.blackhole) lines.push(`S>* ${r.prefix} [${r.distance}/0] is directly connected, blackhole`)
    else lines.push(`S>* ${r.prefix} [${r.distance}/0] via ${r.nextHop}`)
  })
  if (lines.length === 3) lines.push('(no routes)')
  return lines.join('\n')
}

export function showNat(tree, tokens) {
  const rules = deriveNatSourceRules(tree)
  const lines = [
    'rule  source              out-int  translation',
    '----  ------              -------  -----------',
  ]
  if (!rules.length) return lines.concat('(no source NAT rules configured)').join('\n')
  rules.forEach(r => {
    lines.push(pad(r.id, 6) + pad(r.source, 20) + pad(r.outInt, 9) + r.translation)
  })
  return lines.join('\n')
}

export function showFirewall(tree, arg) {
  const fw = tree?.firewall?.name
  if (!isContainer(fw)) return 'Firewall is not configured'
  const names = arg ? [arg] : Object.keys(fw)
  const out = []
  names.forEach(name => {
    if (!isContainer(fw[name])) { out.push(`Firewall ruleset "${name}" does not exist`); return }
    const def = (valuesAt(tree, ['firewall', 'name', name, 'default-action']) || ['drop'])[0]
    out.push(`Ruleset ${name}  (default-action: ${def})`)
    out.push('  rule  action   protocol  source            destination')
    const rules = fw[name].rule
    if (isContainer(rules)) {
      Object.keys(rules).sort((a, b) => Number(a) - Number(b)).forEach(id => {
        const action = (valuesAt(tree, ['firewall', 'name', name, 'rule', id, 'action']) || ['-'])[0]
        const proto = (valuesAt(tree, ['firewall', 'name', name, 'rule', id, 'protocol']) || ['any'])[0]
        const src = (valuesAt(tree, ['firewall', 'name', name, 'rule', id, 'source', 'address']) || ['any'])[0]
        const dst = (valuesAt(tree, ['firewall', 'name', name, 'rule', id, 'destination', 'address']) || ['any'])[0]
        out.push('  ' + pad(id, 6) + pad(action, 9) + pad(proto, 10) + pad(src, 18) + dst)
      })
    }
    out.push('')
  })
  return out.join('\n').trimEnd()
}

export function showDhcpLeases(tree) {
  const nets = tree?.service?.['dhcp-server']?.['shared-network-name']
  if (!isContainer(nets)) return 'DHCP server is not configured'
  const lines = ['IP address       MAC address        State    Lease start          Hostname', '-'.repeat(72)]
  let host = 10
  for (const netName of Object.keys(nets)) {
    const subnets = nets[netName].subnet
    if (!isContainer(subnets)) continue
    for (const sub of Object.keys(subnets)) {
      const base = sub.split('/')[0].split('.').slice(0, 3).join('.')
      for (let k = 0; k < 3; k++) {
        const ip = `${base}.${host + k}`
        lines.push(pad(ip, 17) + pad(`00:0c:29:${hex()}:${hex()}:${hex()}`, 19) + pad('active', 9) + pad(now(), 21) + `host-${host + k}`)
      }
      host += 10
    }
  }
  if (lines.length === 2) lines.push('(no active leases)')
  return lines.join('\n')
}

export function showVersion() {
  return [
    'Version:          VyOS 1.4 (sagitta)',
    'Release train:    sagitta',
    'Built by:         vyos-lab-simulator',
    'Built on:         ' + new Date().toUTCString(),
    'System type:      x86_64 KVM guest',
    'Hardware vendor:  VyOS',
    'Hardware model:   VyOS KVM',
  ].join('\n')
}

export function showLog() {
  const t = new Date().toISOString().replace('T', ' ').slice(0, 19)
  return [
    `${t}  vyos systemd[1]: Started VyOS router.`,
    `${t}  vyos kernel: [   0.42] e1000: eth0 NIC Link is Up`,
    `${t}  vyos kernel: [   0.45] e1000: eth1 NIC Link is Up`,
    `${t}  vyos dhclient: bound to lease`,
    `${t}  vyos sshd[842]: Server listening on 0.0.0.0 port 22.`,
  ].join('\n')
}

// ---- OSPF / BGP (derived from config; heuristic, not a real routing FSM) ----

export function deriveOspf(tree) {
  const ospf = tree?.protocols?.ospf
  if (!isContainer(ospf)) return { configured: false }
  const routerId = (valuesAt(tree, ['protocols', 'ospf', 'parameters', 'router-id']) || [])[0] || null
  const areas = {}
  if (isContainer(ospf.area)) {
    for (const a of Object.keys(ospf.area)) {
      areas[a] = valuesAt(tree, ['protocols', 'ospf', 'area', a, 'network']) || []
    }
  }
  const neighbors = isContainer(ospf.neighbor) ? Object.keys(ospf.neighbor) : []
  const ifaces = isContainer(ospf.interface) ? Object.keys(ospf.interface) : []
  return { configured: true, routerId, areas, neighbors, ifaces }
}

export function showOspf(tree) {
  const o = deriveOspf(tree)
  if (!o.configured) return '% OSPF instance not found'
  const areaIds = Object.keys(o.areas)
  const lines = [
    ` Routing Process "ospf" with ID ${o.routerId || '0.0.0.0'}`,
    ' Supports only single TOS(TOS0) routes',
    ` Number of areas in this router is ${areaIds.length}`,
  ]
  for (const a of areaIds) {
    lines.push(`    Area ${a}`)
    for (const n of o.areas[a]) lines.push(`        Network: ${n}`)
  }
  return lines.join('\n')
}

export function showOspfNeighbor(tree) {
  const o = deriveOspf(tree)
  if (!o.configured) return '% OSPF instance not found'
  const lines = ['Neighbor ID     Pri State           Dead Time  Address         Interface']
  if (!o.neighbors.length) {
    lines.push('(no OSPF neighbors — none statically configured and no adjacencies formed yet)')
    return lines.join('\n')
  }
  o.neighbors.forEach((ip, i) => {
    lines.push(pad(ip, 16) + pad('1', 4) + pad('Full/DR', 16) + pad(`${30 + rnd(10)}.${rnd(900)}s`, 11) + pad(ip, 16) + (o.ifaces[i] || 'eth0'))
  })
  return lines.join('\n')
}

export function deriveBgp(tree) {
  const bgp = tree?.protocols?.bgp
  if (!isContainer(bgp)) return { configured: false }
  const localAs = (valuesAt(tree, ['protocols', 'bgp', 'system-as']) || [])[0] || null
  const neighbors = []
  if (isContainer(bgp.neighbor)) {
    for (const ip of Object.keys(bgp.neighbor)) {
      const ras = (valuesAt(tree, ['protocols', 'bgp', 'neighbor', ip, 'remote-as']) || [])[0] || '?'
      neighbors.push({ ip, remoteAs: ras })
    }
  }
  const networks = valuesAt(tree, ['protocols', 'bgp', 'address-family', 'ipv4-unicast', 'network']) || []
  return { configured: true, localAs, neighbors, networks }
}

export function showBgpSummary(tree) {
  const b = deriveBgp(tree)
  if (!b.configured) return '% BGP instance not found'
  const lines = [
    `BGP router identifier 0.0.0.0, local AS number ${b.localAs || '?'} vrf-id 0`,
    'BGP table version 1',
    `RIB entries ${b.networks.length}, using ${1 + b.networks.length} KiB of memory`,
    '',
    'Neighbor        V         AS   MsgRcvd   MsgSent   Up/Down  State/PfxRcd',
  ]
  if (!b.neighbors.length) {
    lines.push('(no BGP neighbors configured)')
  } else {
    b.neighbors.forEach(n => {
      const up = `${rnd(2)}:${String(rnd(60)).padStart(2, '0')}:${String(rnd(60)).padStart(2, '0')}`
      lines.push(pad(n.ip, 16) + pad('4', 2) + pad(n.remoteAs, 11) + pad(10 + rnd(90), 10) + pad(10 + rnd(90), 10) + pad(up, 9) + rnd(5))
    })
  }
  lines.push('')
  lines.push(`Total number of neighbors ${b.neighbors.length}`)
  return lines.join('\n')
}

export function showBgp(tree) {
  const b = deriveBgp(tree)
  if (!b.configured) return '% BGP instance not found'
  const lines = [
    'BGP table version is 1, local router ID is 0.0.0.0',
    '',
    '   Network          Next Hop            Metric LocPrf Weight Path',
  ]
  if (!b.networks.length) lines.push('(no networks advertised)')
  else b.networks.forEach(n => lines.push(`*> ${pad(n, 17)}0.0.0.0              0         32768 i`))
  return lines.join('\n')
}

// ---- small formatting helpers ---------------------------------------------

function pad(s, n) {
  s = String(s)
  return s.length >= n ? s + ' ' : s + ' '.repeat(n - s.length)
}
function rnd(max) { return Math.floor(Math.random() * max) }
function hex() { return rnd(256).toString(16).padStart(2, '0') }
function now() { return new Date().toISOString().replace('T', ' ').slice(0, 19) }
function networkOf(cidr) {
  const [ip, bits] = cidr.split('/')
  const parts = ip.split('.').map(Number)
  const b = Number(bits || 32)
  // zero host bits for display
  let int = ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3]
  const mask = b === 0 ? 0 : (0xffffffff << (32 - b)) >>> 0
  int = (int & mask) >>> 0
  return `${(int >>> 24) & 255}.${(int >>> 16) & 255}.${(int >>> 8) & 255}.${int & 255}/${b}`
}
