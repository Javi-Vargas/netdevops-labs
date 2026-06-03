// VyOS configuration tree — pure data structure.
//
// The tree is a nested plain object. A key maps to either:
//   - a CONTAINER: a plain object whose own keys are children, or
//   - a LEAF:      { __leaf: true, valueless: bool, values: [...] }
//
// VyOS itself resolves node kinds from its interface-definition schema. We don't
// ship that schema, so we use a compact heuristic (LEAF_SPEC) keyed by the leaf
// token name. This is accurate for the curated command space the labs use and
// degrades gracefully for unknown paths (a trailing unknown token becomes an
// empty container, e.g. `set service ssh`).

// Leaf nodes: which final tokens are values vs. valueless flags, and which may
// hold multiple values.
const LEAF_SPEC = {
  // system / login
  'host-name': {}, 'domain-name': {}, 'time-zone': {}, 'gateway-address': {},
  'name-server': { multi: true }, 'name-servers-dhcp': {},
  'plaintext-password': {}, 'encrypted-password': {}, 'full-name': {},
  'public-keys': {}, 'level': {},
  // interfaces
  'address': { multi: true }, 'description': {}, 'mtu': {}, 'speed': {},
  'duplex': {}, 'mac': {}, 'hw-id': {}, 'disable': { valueless: true },
  'vrf': {}, 'redirect': {},
  // nat / firewall
  'outbound-interface': {}, 'inbound-interface': {},
  'protocol': {}, 'port': {}, 'action': {}, 'default-action': {},
  'state': { multi: true }, 'log': { valueless: true }, 'enable-default-log': { valueless: true },
  'source-address': {}, 'destination-address': {},
  // dhcp / dns
  'default-router': {}, 'domain-search': { multi: true }, 'start': {}, 'stop': {},
  'lease': {}, 'ip-address': {}, 'mac-address': {},
  'listen-address': { multi: true }, 'allow-from': { multi: true },
  'cache-size': {}, 'dns-server': { multi: true },
  'authoritative': { valueless: true }, 'subnet-id': {},
  // routing / vpn
  'distance': {}, 'blackhole': { valueless: true },
  'network': { multi: true }, 'router-id': {}, 'remote-as': {}, 'metric': {},
  'private-key': {}, 'public-key': {}, 'allowed-ips': { multi: true },
  'endpoint': {}, 'persistent-keepalive': {}, 'port-number': {},
  // dynamic routing (OSPF / BGP, VyOS 1.4)
  'system-as': {}, 'passive': { valueless: true }, 'route-reflector-client': { valueless: true },
}

// Container keys whose immediate child is an instance name. Used only to render
// the curly `{ }` format the VyOS way (`ethernet eth0 { ... }`).
const TAG_NODES = new Set([
  'ethernet', 'loopback', 'dummy', 'bridge', 'bond', 'wireguard', 'vif', 'vti',
  'tunnel', 'pseudo-ethernet', 'rule', 'name', 'ipv6-name', 'zone', 'group',
  'address-group', 'network-group', 'port-group', 'interface-group',
  'shared-network-name', 'subnet', 'static-mapping', 'route', 'route6',
  'next-hop', 'peer', 'neighbor', 'user', 'server', 'tunnel-interface',
  'area', 'interface',
])

export function createTree() {
  return {}
}

export function isLeaf(node) {
  return !!node && typeof node === 'object' && node.__leaf === true
}

export function isContainer(node) {
  return !!node && typeof node === 'object' && node.__leaf !== true
}

function clone(tree) {
  return JSON.parse(JSON.stringify(tree))
}

function quote(v) {
  return /[\s'"]/.test(v) ? `'${v}'` : v
}

function addValue(parent, key, value, multi) {
  const existing = isLeaf(parent[key]) ? parent[key] : null
  if (multi && existing && !existing.valueless) {
    if (!existing.values.includes(value)) existing.values.push(value)
  } else {
    parent[key] = { __leaf: true, valueless: false, values: [value] }
  }
}

// Apply `set <tokens>` to a copy of the tree and return the new tree.
export function setPath(tree, tokens) {
  if (!tokens.length) return tree
  const t = clone(tree)
  let node = t
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i]
    const spec = LEAF_SPEC[tok]
    const isLast = i === tokens.length - 1

    if (spec && spec.valueless) {
      node[tok] = { __leaf: true, valueless: true, values: [] }
      return t
    }
    if (spec && !spec.valueless && i === tokens.length - 2) {
      addValue(node, tok, tokens[i + 1], !!spec.multi)
      return t
    }
    if (spec && !spec.valueless && isLast) {
      // Known value leaf set with no value — create an empty value leaf.
      if (!isLeaf(node[tok])) node[tok] = { __leaf: true, valueless: false, values: [] }
      return t
    }
    if (isLast) {
      // Unknown trailing token => empty container (e.g. `set service ssh`).
      if (node[tok] === undefined) node[tok] = {}
      return t
    }
    if (!isContainer(node[tok])) node[tok] = {}
    node = node[tok]
  }
  return t
}

function navigate(tree, path) {
  let node = tree
  for (const k of path) {
    if (!isContainer(node)) return null
    node = node[k]
    if (node === undefined) return null
  }
  return node
}

// Apply `delete <tokens>`. Returns { tree, removed }.
export function deletePath(tree, tokens) {
  if (!tokens.length) return { tree, removed: false }
  const t = clone(tree)
  const n = tokens.length

  // Case A: remove a single value from a (multi-)value leaf.
  if (n >= 2) {
    const leafParent = navigate(t, tokens.slice(0, n - 2))
    const leafName = tokens[n - 2]
    const value = tokens[n - 1]
    if (isContainer(leafParent) && isLeaf(leafParent[leafName]) &&
        leafParent[leafName].values.includes(value)) {
      leafParent[leafName].values = leafParent[leafName].values.filter(v => v !== value)
      if (leafParent[leafName].values.length === 0) delete leafParent[leafName]
      pruneAlong(t, tokens.slice(0, n - 1))
      return { tree: t, removed: true }
    }
  }

  // Case B: delete a node/leaf at the full path.
  const parent = navigate(t, tokens.slice(0, n - 1))
  const key = tokens[n - 1]
  if (isContainer(parent) && parent[key] !== undefined) {
    delete parent[key]
    pruneAlong(t, tokens.slice(0, n - 1))
    return { tree: t, removed: true }
  }
  return { tree: t, removed: false }
}

// VyOS removes parent containers left empty by a delete.
function pruneAlong(tree, path) {
  for (let i = path.length - 1; i >= 0; i--) {
    const p = navigate(tree, path.slice(0, i))
    const k = path[i]
    if (isContainer(p) && isContainer(p[k]) && Object.keys(p[k]).length === 0) {
      delete p[k]
    } else {
      break
    }
  }
}

// Flat `set ...` command lines (like `show configuration commands`).
export function renderCommands(tree, prefix = []) {
  const keys = Object.keys(tree)
  if (keys.length === 0) {
    return prefix.length ? ['set ' + prefix.join(' ')] : []
  }
  const lines = []
  for (const key of keys.sort()) {
    const node = tree[key]
    const path = [...prefix, key]
    if (isLeaf(node)) {
      if (node.valueless || node.values.length === 0) {
        lines.push('set ' + path.join(' '))
      } else {
        for (const v of node.values) lines.push('set ' + path.join(' ') + ' ' + quote(v))
      }
    } else {
      lines.push(...renderCommands(node, path))
    }
  }
  return lines
}

// VyOS curly `{ }` format (like `show configuration`).
export function renderCurly(tree) {
  const body = renderBody(tree, 0)
  return body.join('\n')
}

function pad(indent) {
  return '    '.repeat(indent)
}

function renderBody(node, indent) {
  const lines = []
  for (const key of Object.keys(node).sort()) {
    const child = node[key]
    if (isLeaf(child)) {
      if (child.valueless || child.values.length === 0) {
        lines.push(pad(indent) + key)
      } else {
        for (const v of child.values) lines.push(pad(indent) + key + ' ' + quote(v))
      }
    } else if (TAG_NODES.has(key)) {
      for (const instance of Object.keys(child).sort()) {
        lines.push(...renderBlock(`${key} ${instance}`, child[instance], indent))
      }
    } else {
      lines.push(...renderBlock(key, child, indent))
    }
  }
  return lines
}

function renderBlock(label, node, indent) {
  const inner = renderBody(node, indent + 1)
  if (inner.length === 0) return [pad(indent) + label + ' {', pad(indent) + '}']
  return [pad(indent) + label + ' {', ...inner, pad(indent) + '}']
}

// Diff between two trees, by command-line set. Returns { added, removed }.
export function diff(a, b) {
  const A = new Set(renderCommands(a))
  const B = new Set(renderCommands(b))
  const added = [...B].filter(x => !A.has(x))
  const removed = [...A].filter(x => !B.has(x))
  return { added, removed }
}

export function isEmpty(tree) {
  return Object.keys(tree).length === 0
}

// ---- Validator helpers -----------------------------------------------------

const stripQuotes = s => s.replace(/'/g, '')

// Does the tree contain exactly this `set` line (without the leading "set ")?
export function configHas(tree, line) {
  const want = stripQuotes('set ' + line.trim())
  return renderCommands(tree).map(stripQuotes).includes(want)
}

// Does the tree contain any command starting with this path prefix?
export function configHasPrefix(tree, prefix) {
  const p = stripQuotes('set ' + prefix.trim())
  return renderCommands(tree).map(stripQuotes).some(l => l === p || l.startsWith(p + ' '))
}

// Values present at a leaf path (array), or null if the path is not a leaf.
export function valuesAt(tree, tokens) {
  const parent = navigate(tree, tokens.slice(0, -1))
  if (!isContainer(parent)) return null
  const leaf = parent[tokens[tokens.length - 1]]
  if (isLeaf(leaf)) return leaf.valueless ? [] : leaf.values
  return null
}

// Build a tree from a list of `set ...` command strings (used to seed scenarios).
export function treeFromCommands(commands) {
  let tree = createTree()
  for (const cmd of commands) {
    const tokens = tokenize(cmd.replace(/^set\s+/, ''))
    tree = setPath(tree, tokens)
  }
  return tree
}

// Split a command line into tokens, honoring single/double quoted values.
export function tokenize(line) {
  const tokens = []
  const re = /'([^']*)'|"([^"]*)"|(\S+)/g
  let m
  while ((m = re.exec(line)) !== null) {
    tokens.push(m[1] ?? m[2] ?? m[3])
  }
  return tokens
}
