// Top-level command dispatcher for the simulated control node.
import { parseInventory, graph, groupHosts } from './inventory'
import { runAdhoc } from './adhoc'
import { runPlaybook, PlaybookError } from './playbook'
import { readFile, writeFile, exists, listDir, listFiles } from './vfs'
import { lookupDoc } from './ansibleDoc'
import { createDefaultState } from './seed'
import { isVault, vaultEncrypt, vaultDecrypt } from './vault'

export { createDefaultState }

export function getPrompt() {
  return '[ansible@control ~]$ '
}

export function getInventory(state) {
  const text = readFile(state.vfs, 'inventory.ini') ?? readFile(state.vfs, 'inventory') ?? ''
  return parseInventory(text)
}

// Returns { output, state, clear? }
export function execute(line, state) {
  const raw = line.trim()
  if (!raw) return { output: '', state }
  const argv = tokenizeArgv(raw)
  const cmd = argv[0]
  const rest = argv.slice(1)

  switch (cmd) {
    case 'help': case '?': return { output: helpText(), state }
    case 'clear': return { output: '', state, clear: true }
    case 'reset': return { output: 'Control node reset to defaults (hosts + files restored).', state: createDefaultState(), persist: 'clear' }
    case 'pwd': return { output: '/home/ansible', state }
    case 'whoami': return { output: 'ansible', state }
    case 'echo': return { output: rest.join(' '), state }
    case 'ls': return { output: cmdLs(rest, state), state }
    case 'cat': return { output: cmdCat(rest, state), state }
    case 'ansible': return cmdAnsible(rest, state)
    case 'ansible-playbook': return cmdPlaybook(rest, state)
    case 'ansible-inventory': return { output: cmdInventory(rest, state), state }
    case 'ansible-doc': return { output: lookupDoc(rest[0]), state }
    case 'ansible-galaxy': return cmdGalaxy(rest, state)
    case 'ansible-vault': return cmdVault(rest, state)
    default:
      return { output: `${cmd}: command not found. Type 'help' for available commands.`, state }
  }
}

// ---- filesystem commands ---------------------------------------------------

function cmdLs(args, state) {
  const dir = args.find(a => !a.startsWith('-'))
  const entries = listDir(state.vfs, dir || '')
  if (!entries.length) return dir ? `ls: cannot access '${dir}': No such file or directory` : '(empty)'
  return entries.join('\n')
}

function cmdCat(args, state) {
  const file = args.find(a => !a.startsWith('-'))
  if (!file) return 'cat: missing file operand'
  const content = readFile(state.vfs, file)
  if (content === null) return `cat: ${file}: No such file or directory`
  return content
}

// ---- ansible (ad-hoc) ------------------------------------------------------

function cmdAnsible(args, state) {
  if (args.includes('--version')) return { output: versionBanner(), state }
  const f = parseFlags(args, { '-m': 'module', '-a': 'argsString', '-l': 'limit', '-i': 'inv', '-e': 'extra', '-u': 'user' })
  const pattern = f._[0]
  if (!pattern) return { output: 'ERROR! Missing target hosts', state }
  const inv = getInventory(state)
  const { lines, hosts } = runAdhoc({
    pattern,
    module: f.module || 'command',
    argsString: f.argsString || '',
    become: f.flags.has('-b') || f.flags.has('--become'),
    check: f.flags.has('-C') || f.flags.has('--check'),
  }, state, inv)
  return { output: lines.join('\n'), state: { ...state, hosts }, persist: 'save' }
}

// ---- ansible-playbook ------------------------------------------------------

function cmdPlaybook(args, state) {
  if (args.includes('--version')) return { output: versionBanner(), state }
  const f = parseFlags(args, { '-l': 'limit', '--limit': 'limit', '-t': 'tags', '--tags': 'tags', '-i': 'inv', '-e': 'extra' })
  const file = f._[0]
  if (!file) return { output: 'ERROR! You must specify a playbook file to run', state }
  const content = readFile(state.vfs, file) ?? readFile(state.vfs, `playbooks/${file}`)
  if (content === null) return { output: `ERROR! the playbook: ${file} could not be found`, state }

  const inv = getInventory(state)
  const opts = {
    check: f.flags.has('-C') || f.flags.has('--check'),
    become: f.flags.has('-b') || f.flags.has('--become'),
    limit: f.limit,
    tags: f.tags ? f.tags.split(',') : null,
    extraVars: f.extra ? parseInlineArgs(f.extra) : {},
    vaultUnlocked: state.vaultUnlocked || f.flags.has('--ask-vault-pass'),
  }
  try {
    const { lines, hosts } = runPlaybook(content, state, inv, opts)
    return { output: lines.join('\n'), state: { ...state, hosts }, persist: 'save' }
  } catch (e) {
    if (e instanceof PlaybookError) return { output: e.message, state }
    return { output: `ERROR! ${e.message}`, state }
  }
}

// ---- ansible-inventory -----------------------------------------------------

function cmdInventory(args, state) {
  const inv = getInventory(state)
  if (args.includes('--graph')) return graph(inv)
  if (args.includes('--list') || args.length === 0) {
    const out = { _meta: { hostvars: {} } }
    for (const [g, data] of Object.entries(inv.groups)) {
      if (g === 'all') continue
      out[g] = { hosts: groupHosts(inv, g) }
      if (data.vars && Object.keys(data.vars).length) out[g].vars = data.vars
    }
    for (const [h, data] of Object.entries(inv.hosts)) out._meta.hostvars[h] = data.vars
    return JSON.stringify(out, null, 2)
  }
  return graph(inv)
}

// ---- ansible-galaxy --------------------------------------------------------

function cmdGalaxy(args, state) {
  const sub = args[0]
  if (sub === 'init') {
    const role = args.find((a, i) => i > 0 && !a.startsWith('-'))
    if (!role) return { output: 'ERROR! the role name must be specified', state }
    let vfs = state.vfs
    const files = {
      [`roles/${role}/tasks/main.yml`]: `---\n# tasks file for ${role}\n`,
      [`roles/${role}/handlers/main.yml`]: `---\n# handlers file for ${role}\n`,
      [`roles/${role}/defaults/main.yml`]: `---\n# default vars for ${role}\n`,
      [`roles/${role}/vars/main.yml`]: `---\n# vars for ${role}\n`,
      [`roles/${role}/templates/.keep`]: '',
      [`roles/${role}/meta/main.yml`]: `---\ngalaxy_info:\n  role_name: ${role}\n`,
    }
    for (const [p, c] of Object.entries(files)) vfs = writeFile(vfs, p, c)
    return { output: `- Role ${role} was created successfully`, state: { ...state, vfs }, persist: 'save' }
  }
  if (sub === 'list') {
    const roles = [...new Set(listFiles(state.vfs).filter(p => p.startsWith('roles/')).map(p => p.split('/')[1]))]
    return { output: roles.length ? roles.map(r => `- ${r}`).join('\n') : '# no roles found', state }
  }
  if (sub === 'install') return { output: `- downloading role from galaxy...\n- extracting role\n(simulator) install complete`, state }
  return { output: `usage: ansible-galaxy [init|list|install] ...`, state }
}

// ---- ansible-vault ---------------------------------------------------------

function cmdVault(args, state) {
  const sub = args[0]
  const file = args.find((a, i) => i > 0 && !a.startsWith('-'))
  if (!sub) return { output: 'usage: ansible-vault [encrypt|decrypt|view|create] <file>', state }
  if (sub === 'create') return { output: '(simulator) interactive editor unavailable — create the file in the Files tab, then `ansible-vault encrypt <file>`.', state }
  if (!file) return { output: `ERROR! a file is required for ${sub}`, state }
  const content = readFile(state.vfs, file)
  if (content === null) return { output: `ERROR! ${file}: No such file or directory`, state }

  if (sub === 'encrypt') {
    if (isVault(content)) return { output: `ERROR! ${file} is already encrypted`, state }
    return { output: 'Encryption successful', state: { ...state, vfs: writeFile(state.vfs, file, vaultEncrypt(content)) }, persist: 'save' }
  }
  if (sub === 'decrypt') {
    if (!isVault(content)) return { output: `ERROR! input is not vault encrypted data for ${file}`, state }
    return { output: 'Decryption successful', state: { ...state, vfs: writeFile(state.vfs, file, vaultDecrypt(content)), vaultUnlocked: true }, persist: 'save' }
  }
  if (sub === 'view') {
    return { output: isVault(content) ? vaultDecrypt(content) : content, state }
  }
  return { output: `usage: ansible-vault [encrypt|decrypt|view|create] <file>`, state }
}

// ---- helpers ---------------------------------------------------------------

function tokenizeArgv(line) {
  const tokens = []
  const re = /'([^']*)'|"([^"]*)"|(\S+)/g
  let m
  while ((m = re.exec(line)) !== null) tokens.push(m[1] ?? m[2] ?? m[3])
  return tokens
}

// Parse argv into { _: positionals, flags: Set, ...namedValues }.
// `valueFlags` maps a flag to the property name that should capture its value.
function parseFlags(args, valueFlags = {}) {
  const out = { _: [], flags: new Set() }
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (Object.prototype.hasOwnProperty.call(valueFlags, a)) {
      out[valueFlags[a]] = args[++i]
    } else if (a.startsWith('-')) {
      out.flags.add(a)
    } else {
      out._.push(a)
    }
  }
  return out
}

function parseInlineArgs(str) {
  const out = {}
  const re = /(\w+)=("[^"]*"|'[^']*'|\S+)/g
  let m
  while ((m = re.exec(str)) !== null) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
  return out
}

function versionBanner() {
  return ['ansible [core 2.16.0]  (simulator)', '  config file = /etc/ansible/ansible.cfg', '  python version = 3.11.x', '  executable location = /usr/bin/ansible'].join('\n')
}

function helpText() {
  return [
    'Ansible Lab — available commands:',
    '  ansible <pattern> -m <module> [-a "args"] [-b] [--check]   Ad-hoc command',
    '  ansible-playbook <file> [-b] [--check] [--limit H] [--tags T] [--ask-vault-pass]',
    '  ansible-inventory --list | --graph                        Inspect inventory',
    '  ansible-doc <module>                                      Module documentation',
    '  ansible-galaxy init <role> | list | install              Roles',
    '  ansible-vault encrypt|decrypt|view <file>                Secrets',
    '  cat <file> | ls [dir] | echo | pwd                       Files',
    '  reset                                                    Restore defaults',
    '  clear                                                    Clear the screen',
    '',
    "Patterns: all, a group (webservers), a host (web1), unions (web1:db1), exclusions (all:!db1).",
    'Edit inventory/playbooks in the Files tab — the interpreter runs what you save.',
  ].join('\n')
}
