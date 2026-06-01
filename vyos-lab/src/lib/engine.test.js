import { describe, it, expect } from 'vitest'
import {
  createTree, setPath, deletePath, diff, renderCommands, renderCurly,
  treeFromCommands, tokenize, configHas, configHasPrefix,
} from './configTree'
import {
  execute, getPrompt, createDefaultState, stateFromCommands, getHostname,
} from './vyosEngine'
import { isReachable } from './pingSimulator'
import { buildScenarios, troubleshootScenarios } from './scenarios'

// Thread a list of CLI lines through the engine.
function run(state, lines) {
  for (const line of lines) state = execute(line, state).state
  return state
}

describe('configTree', () => {
  it('sets and renders a single-value leaf', () => {
    const t = setPath(createTree(), tokenize('system host-name r1'))
    expect(renderCommands(t)).toEqual(['set system host-name r1'])
  })

  it('replaces a single-value leaf on re-set', () => {
    let t = setPath(createTree(), tokenize('system host-name r1'))
    t = setPath(t, tokenize('system host-name r2'))
    expect(renderCommands(t)).toEqual(['set system host-name r2'])
  })

  it('appends multiple values for a multi-value leaf (address)', () => {
    let t = setPath(createTree(), tokenize('interfaces ethernet eth0 address 10.0.0.1/24'))
    t = setPath(t, tokenize('interfaces ethernet eth0 address 10.0.1.1/24'))
    const cmds = renderCommands(t)
    expect(cmds).toContain('set interfaces ethernet eth0 address 10.0.0.1/24')
    expect(cmds).toContain('set interfaces ethernet eth0 address 10.0.1.1/24')
  })

  it('handles valueless flags (disable)', () => {
    const t = setPath(createTree(), tokenize('interfaces ethernet eth0 disable'))
    expect(renderCommands(t)).toEqual(['set interfaces ethernet eth0 disable'])
  })

  it('creates an empty container for a trailing unknown token', () => {
    const t = setPath(createTree(), tokenize('service ssh'))
    expect(renderCommands(t)).toEqual(['set service ssh'])
  })

  it('deletes a single value from a multi-value leaf', () => {
    let t = treeFromCommands([
      'set interfaces ethernet eth0 address 10.0.0.1/24',
      'set interfaces ethernet eth0 address 10.0.1.1/24',
    ])
    const res = deletePath(t, tokenize('interfaces ethernet eth0 address 10.0.0.1/24'))
    expect(res.removed).toBe(true)
    expect(renderCommands(res.tree)).toEqual(['set interfaces ethernet eth0 address 10.0.1.1/24'])
  })

  it('deletes a node and prunes empty parents', () => {
    const t = treeFromCommands(['set protocols static route 0.0.0.0/0 next-hop 1.2.3.4'])
    const res = deletePath(t, tokenize('protocols static route 0.0.0.0/0'))
    expect(res.removed).toBe(true)
    expect(renderCommands(res.tree)).toEqual([])
  })

  it('reports nothing-to-delete for a missing path', () => {
    const res = deletePath(createTree(), tokenize('system host-name r1'))
    expect(res.removed).toBe(false)
  })

  it('renders the curly format with tag nodes merged', () => {
    const t = treeFromCommands(['set interfaces ethernet eth0 address 10.0.0.1/24'])
    const curly = renderCurly(t)
    expect(curly).toContain('ethernet eth0 {')
    expect(curly).toContain('address 10.0.0.1/24')
  })

  it('computes a diff', () => {
    const a = treeFromCommands(['set system host-name r1'])
    const b = treeFromCommands(['set system host-name r2'])
    const d = diff(a, b)
    expect(d.added).toContain('set system host-name r2')
    expect(d.removed).toContain('set system host-name r1')
  })
})

describe('vyosEngine', () => {
  it('starts in operational mode with a default config', () => {
    const s = createDefaultState()
    expect(s.mode).toBe('operational')
    expect(getPrompt(s)).toBe('vyos@vyos:~$ ')
  })

  it('enters configuration mode on `configure`', () => {
    const s = execute('configure', createDefaultState()).state
    expect(s.mode).toBe('configuration')
    expect(getPrompt(s)).toBe('vyos@vyos# ')
  })

  it('set → commit → show reflects state, and hostname updates', () => {
    let s = createDefaultState()
    s = run(s, ['configure', 'set system host-name r1', 'set interfaces ethernet eth0 address 192.168.1.1/24'])
    expect(s.modified).toBe(true)
    // not yet committed: running still has default hostname
    expect(getHostname(s.running)).toBe('vyos')
    s = execute('commit', s).state
    expect(s.modified).toBe(false)
    expect(s.hostname).toBe('r1')
    expect(configHas(s.running, 'interfaces ethernet eth0 address 192.168.1.1/24')).toBe(true)
    const out = execute('show interfaces', { ...s, mode: 'operational' }).output
    expect(out).toContain('192.168.1.1/24')
  })

  it('compare shows pending changes; discard reverts them', () => {
    let s = run(createDefaultState(), ['configure', 'set system host-name changed'])
    const cmp = execute('compare', s).output
    expect(cmp).toContain('+ set system host-name changed')
    s = execute('discard', s).state
    expect(s.modified).toBe(false)
    expect(getHostname(s.candidate)).toBe('vyos')
  })

  it('blocks exit with uncommitted changes', () => {
    const s = run(createDefaultState(), ['configure', 'set system host-name x'])
    const res = execute('exit', s)
    expect(res.output).toMatch(/Cannot exit/)
    expect(res.state.mode).toBe('configuration')
  })

  it('rejects set in operational mode', () => {
    const res = execute('set system host-name r1', createDefaultState())
    expect(res.output).toMatch(/Invalid command in operational mode/)
  })
})

describe('pingSimulator', () => {
  it('reaches an on-link host', () => {
    const t = treeFromCommands(['set interfaces ethernet eth0 address 192.168.1.1/24'])
    expect(isReachable(t, '192.168.1.50').ok).toBe(true)
  })

  it('fails to reach the internet without a default route', () => {
    const t = treeFromCommands(['set interfaces ethernet eth0 address 192.168.1.1/24'])
    expect(isReachable(t, '8.8.8.8').ok).toBe(false)
  })

  it('reaches the internet once a default route exists', () => {
    const t = treeFromCommands([
      'set interfaces ethernet eth0 address 192.168.1.1/24',
      'set protocols static route 0.0.0.0/0 next-hop 192.168.1.254',
    ])
    expect(isReachable(t, '8.8.8.8').ok).toBe(true)
  })
})

describe('scenario validators', () => {
  const solutionLines = (scenario) =>
    scenario.commands
      .map(c => c.cmd)
      .filter(cmd => cmd.startsWith('set ') || cmd.startsWith('delete '))

  for (const scenario of [...buildScenarios, ...troubleshootScenarios]) {
    it(`"${scenario.title}" passes once solved`, () => {
      let s = stateFromCommands(scenario.initialCommands || [])
      // Troubleshoot labs should NOT pass at the broken starting point.
      if (scenario.category === 'troubleshoot') {
        const before = scenario.validation(s)
        expect(before.every(r => r.pass)).toBe(false)
      }
      s = run(s, ['configure', ...solutionLines(scenario), 'commit'])
      const after = scenario.validation(s)
      expect(after.every(r => r.pass)).toBe(true)
    })
  }
})
