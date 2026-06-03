// VyOS CLI engine: operational + configuration mode state machine.
import {
  createTree, setPath, deletePath, diff, renderCurly, renderCommands,
  treeFromCommands, tokenize, valuesAt, isContainer, isLeaf,
} from './configTree'
import {
  showConfiguration, showInterfaces, showRoute, showNat, showFirewall,
  showDhcpLeases, showVersion, showLog,
  showOspf, showOspfNeighbor, showBgp, showBgpSummary,
} from './showCommands'
import { simulatePing } from './pingSimulator'
import { helpText, OPERATIONAL_WORDS, SHOW_WORDS, CONFIG_WORDS, CONFIG_PATHS } from './commandHelp'

const DEFAULT_COMMANDS = [
  'set interfaces ethernet eth0',
  'set interfaces ethernet eth1',
  'set interfaces ethernet eth2',
  'set interfaces loopback lo address 127.0.0.1/8',
  'set system host-name vyos',
  'set service ssh port 22',
]

export function getHostname(tree) {
  return (valuesAt(tree, ['system', 'host-name']) || ['vyos'])[0]
}

export function createDefaultState() {
  const running = treeFromCommands(DEFAULT_COMMANDS)
  return {
    hostname: getHostname(running),
    mode: 'operational',
    running,
    candidate: running,
    modified: false,
    editLevel: [],
  }
}

// Build a fresh state from a list of `set ...` commands (used to seed scenarios).
export function stateFromCommands(commands) {
  const running = treeFromCommands(commands.length ? commands : DEFAULT_COMMANDS)
  return {
    hostname: getHostname(running),
    mode: 'operational',
    running,
    candidate: running,
    modified: false,
    editLevel: [],
  }
}

export function getPrompt(state) {
  const host = state.hostname || 'vyos'
  return state.mode === 'configuration' ? `vyos@${host}# ` : `vyos@${host}:~$ `
}

// Main entry. Returns { output, state, persist? }.
export function execute(line, state) {
  const raw = line.trim()
  if (!raw) return { output: '', state }
  const tokens = tokenize(raw)
  if (state.mode === 'configuration') return handleConfiguration(tokens, raw, state)
  return handleOperational(tokens, raw, state)
}

// ---- operational mode ------------------------------------------------------

function handleOperational(tokens, raw, state) {
  const cmd = tokens[0]
  switch (cmd) {
    case 'configure':
    case 'conf':
    case 'configure-mode':
      return {
        output: '',
        state: { ...state, mode: 'configuration', candidate: clone(state.running), modified: false, editLevel: [] },
      }
    case 'show':
      return { output: handleShow(tokens.slice(1), state.running), state }
    case 'ping': {
      const target = tokens[1]
      let count = 4
      const ci = tokens.indexOf('count')
      if (ci !== -1 && tokens[ci + 1]) count = Math.min(10, Math.max(1, Number(tokens[ci + 1]) || 4))
      return { output: simulatePing(state.running, target, count), state }
    }
    case 'reset':
      return { output: 'Configuration reset to simulator defaults.', state: createDefaultState(), persist: 'clear' }
    case 'reboot':
      return { output: 'Proceeding with reboot...\n(simulator) system reloaded.', state: createDefaultState(), persist: 'clear' }
    case 'help':
    case '?':
      return { output: helpText('operational'), state }
    case 'exit':
    case 'logout':
      return { output: '(simulator) close the browser tab to end the session.', state }
    case 'set':
    case 'delete':
    case 'commit':
      return { output: `Invalid command in operational mode: ${cmd}\nEnter configuration mode first with 'configure'.`, state }
    default:
      return { output: `  Invalid command: ${cmd}`, state }
  }
}

function handleShow(args, tree) {
  if (!args.length) {
    return 'Possible completions:\n  ' + SHOW_WORDS.join('\n  ')
  }
  const a = args[0]
  switch (a) {
    case 'configuration':
      return showConfiguration(tree, args.slice(1))
    case 'interfaces':
    case 'interface':
      return showInterfaces(tree, args[1])
    case 'ip':
      if (args[1] === 'route') return showRoute(tree)
      if (args[1] === 'ospf') return args[2] === 'neighbor' ? showOspfNeighbor(tree) : showOspf(tree)
      if (args[1] === 'bgp') return args[2] === 'summary' ? showBgpSummary(tree) : showBgp(tree)
      return showInterfaces(tree)
    case 'route':
            return showRoute(tree)
    case 'nat':
      return showNat(tree, args.slice(1))
    case 'firewall':
      return showFirewall(tree, args[1])
    case 'dhcp':
      return showDhcpLeases(tree)
    case 'log':
      return showLog()
    case 'version':
      return showVersion()
    default:
      return `  Invalid command: show ${args.join(' ')}`
  }
}

// ---- configuration mode ----------------------------------------------------

function handleConfiguration(tokens, raw, state) {
  const cmd = tokens[0]
  const rest = tokens.slice(1)

  switch (cmd) {
    case 'set': {
      if (!rest.length) return { output: '  Incomplete command: set requires a configuration path', state }
      const path = [...state.editLevel, ...rest]
      const candidate = setPath(state.candidate, path)
      const modified = hasChanges(state.running, candidate)
      return { output: '', state: { ...state, candidate, modified } }
    }
    case 'delete': {
      if (!rest.length) return { output: '  Incomplete command: delete requires a configuration path', state }
      const path = [...state.editLevel, ...rest]
      const { tree, removed } = deletePath(state.candidate, path)
      if (!removed) return { output: '  Nothing to delete (the specified node does not exist)', state }
      const modified = hasChanges(state.running, tree)
      return { output: '', state: { ...state, candidate: tree, modified } }
    }
    case 'commit': {
      if (!state.modified) return { output: 'No configuration changes to commit', state }
      const running = clone(state.candidate)
      return { output: '', state: { ...state, running, modified: false, hostname: getHostname(running) } }
    }
    case 'save':
      return {
        output: "Saving configuration to '/config/config.boot'...\nDone",
        state,
        persist: 'save',
      }
    case 'discard':
      return { output: 'Changes have been discarded', state: { ...state, candidate: clone(state.running), modified: false } }
    case 'compare': {
      const d = diff(state.running, state.candidate)
      if (!d.added.length && !d.removed.length) return { output: 'No changes between working and active configurations.', state }
      const lines = []
      d.removed.forEach(l => lines.push('- ' + l))
      d.added.forEach(l => lines.push('+ ' + l))
      return { output: lines.join('\n'), state }
    }
    case 'show':
      return { output: showConfigMode(state.candidate, [...state.editLevel, ...rest], state.modified), state }
    case 'edit': {
      if (!rest.length) return { output: '  Incomplete command: edit requires a path', state }
      const path = [...state.editLevel, ...rest]
      const candidate = setPath(state.candidate, path)
      return { output: `[edit ${path.join(' ')}]`, state: { ...state, candidate, editLevel: path, modified: hasChanges(state.running, candidate) } }
    }
    case 'top':
      return { output: '', state: { ...state, editLevel: [] } }
    case 'up':
      return { output: '', state: { ...state, editLevel: state.editLevel.slice(0, -1) } }
    case 'run':
      return { output: handleShowOrOp(rest, state.running), state }
    case 'exit':
    case 'quit': {
      if (rest[0] === 'discard') {
        return { output: '', state: { ...state, mode: 'operational', candidate: clone(state.running), modified: false, editLevel: [] } }
      }
      if (state.editLevel.length > 0) {
        return { output: '', state: { ...state, editLevel: [] } }
      }
      if (state.modified) {
        return { output: "Cannot exit: configuration modified.\nUse 'commit' to apply, 'discard' to abandon, or 'exit discard' to leave anyway.", state }
      }
      return { output: '', state: { ...state, mode: 'operational', editLevel: [] } }
    }
    case 'help':
    case '?':
      return { output: helpText('configuration'), state }
    default:
      return { output: `  Invalid command: ${cmd}`, state }
  }
}

// `run <op-command>` within config mode.
function handleShowOrOp(args, tree) {
  if (args[0] === 'show') return handleShow(args.slice(1), tree)
  if (args[0] === 'ping') return simulatePing(tree, args[1], 4)
  return `  Invalid command: ${args.join(' ')}`
}

function showConfigMode(candidate, path, modified) {
  const banner = modified ? '' : ''
  let node = candidate
  for (const k of path) {
    if (!isContainer(node)) { node = undefined; break }
    node = node[k]
  }
  if (path.length === 0) {
    const curly = renderCurly(candidate)
    return curly || '(empty configuration)'
  }
  if (node === undefined) return `Configuration under "${path.join(' ')}" is empty`
  if (isLeaf(node)) {
    return node.valueless ? path[path.length - 1] : node.values.map(v => `${path[path.length - 1]} ${v}`).join('\n')
  }
  const curly = renderCurly(node)
  return curly || `${path.join(' ')} {\n}`
}

// ---- helpers ---------------------------------------------------------------

function clone(tree) {
  return JSON.parse(JSON.stringify(tree))
}

function hasChanges(running, candidate) {
  const d = diff(running, candidate)
  return d.added.length > 0 || d.removed.length > 0
}

// Tab completion: complete the current word from a context vocabulary.
export function tabComplete(input, state) {
  const trailingSpace = /\s$/.test(input)
  const tokens = input.trim().length ? input.trim().split(/\s+/) : []
  const vocab = vocabFor(tokens, state, trailingSpace)
  if (!vocab.length) return input

  if (trailingSpace || tokens.length === 0) {
    // Offer nothing concrete to append; leave input as-is.
    return input
  }
  const last = tokens[tokens.length - 1]
  const matches = vocab.filter(w => w.startsWith(last))
  if (matches.length === 1) {
    tokens[tokens.length - 1] = matches[0]
    return tokens.join(' ') + ' '
  }
  // common prefix
  const cp = commonPrefix(matches)
  if (cp.length > last.length) {
    tokens[tokens.length - 1] = cp
    return tokens.join(' ')
  }
  return input
}

function vocabFor(tokens, state, trailingSpace) {
  const first = tokens[0]
  if (state.mode === 'operational') {
    if (tokens.length <= 1 && !trailingSpace) return OPERATIONAL_WORDS
    if (first === 'show') return SHOW_WORDS
    return []
  }
  // configuration
  if (tokens.length <= 1 && !trailingSpace) return CONFIG_WORDS
  if (first === 'set' || first === 'delete' || first === 'edit') {
    // suggest path heads
    return CONFIG_PATHS.flatMap(p => p.split(' '))
  }
  if (first === 'run') return ['show', 'ping']
  return []
}

function commonPrefix(words) {
  if (!words.length) return ''
  let p = words[0]
  for (const w of words) {
    while (!w.startsWith(p)) p = p.slice(0, -1)
  }
  return p
}

export { renderCommands, renderCurly }
