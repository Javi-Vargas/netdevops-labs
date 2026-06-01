import { describe, it, expect } from 'vitest'
import { execute, createDefaultState } from './ansibleEngine'
import { writeFile } from './vfs'
import { parseInventory, resolvePattern, hostVars } from './inventory'
import { vaultEncrypt, vaultDecrypt, isVault } from './vault'
import { tutorials } from './tutorials'
import { troubleshootLabs } from './troubleshoot'

const run = (cmd, state) => execute(cmd, state)

// Apply a scenario's solution (file edits, then commands) from its setup state.
function solve(scenario) {
  let s = scenario.setup()
  const sol = scenario.solution || {}
  for (const [p, c] of Object.entries(sol.edits || {})) s = { ...s, vfs: writeFile(s.vfs, p, c) }
  for (const cmd of sol.commands || []) s = run(cmd, s).state
  return s
}

describe('inventory', () => {
  const inv = parseInventory(createDefaultState().vfs['inventory.ini'])

  it('parses groups and hosts', () => {
    expect(resolvePattern(inv, 'all').sort()).toEqual(['db1', 'web1', 'web2'])
    expect(resolvePattern(inv, 'webservers').sort()).toEqual(['web1', 'web2'])
    expect(resolvePattern(inv, 'web1')).toEqual(['web1'])
  })

  it('supports union and exclusion patterns', () => {
    expect(resolvePattern(inv, 'webservers:!web2')).toEqual(['web1'])
    expect(resolvePattern(inv, 'web1:db1').sort()).toEqual(['db1', 'web1'])
  })

  it('merges group vars into host vars', () => {
    expect(hostVars(inv, 'web1').http_port).toBe(80)
  })
})

describe('ad-hoc commands', () => {
  it('pings reachable hosts', () => {
    const r = run('ansible all -m ping', createDefaultState())
    expect(r.output).toMatch(/web1 \| SUCCESS/)
    expect(r.output).toContain('pong')
  })

  it('requires become for privileged modules', () => {
    const r = run('ansible web1 -m package -a "name=git state=present"', createDefaultState())
    expect(r.output).toMatch(/web1 \| FAILED/)
    expect(r.state.hosts.web1.packages).not.toContain('git')
  })

  it('is idempotent: install changes once, then reports ok', () => {
    let s = createDefaultState()
    const r1 = run('ansible web1 -m package -a "name=git state=present" -b', s)
    expect(r1.output).toMatch(/web1 \| CHANGED/)
    expect(r1.state.hosts.web1.packages).toContain('git')
    const r2 = run('ansible web1 -m package -a "name=git state=present" -b', r1.state)
    expect(r2.output).toMatch(/web1 \| SUCCESS/)
    expect(r2.output).not.toMatch(/CHANGED/)
  })
})

describe('playbook runner', () => {
  it('runs site.yml: installs, starts, deploys, with a recap', () => {
    const r = run('ansible-playbook playbooks/site.yml', createDefaultState())
    expect(r.output).toContain('PLAY RECAP')
    expect(r.output).toMatch(/TASK \[Install nginx\]/)
    expect(r.state.hosts.web1.packages).toContain('nginx')
    expect(r.state.hosts.web1.services.nginx).toBe('started')
    expect(r.state.hosts.web1.files['/var/www/html/index.html']).toBeDefined()
  })

  it('is idempotent on re-run (changed=0)', () => {
    const first = run('ansible-playbook playbooks/site.yml', createDefaultState())
    const second = run('ansible-playbook playbooks/site.yml', first.state)
    // every recap line shows changed=0 on the second run
    const recapLines = second.output.split('\n').filter(l => /: ok=/.test(l))
    expect(recapLines.length).toBeGreaterThan(0)
    expect(recapLines.every(l => /changed=0/.test(l))).toBe(true)
  })

  it('renders a template using group vars', () => {
    const s = tutorials.find(t => t.id === 'tut-vars-templates').setup()
    const r = run('ansible-playbook playbooks/template.yml', s)
    expect(r.state.hosts.web1.files['/etc/nginx/index.html']).toContain('Welcome to the web tier')
    expect(r.state.hosts.web1.packages).toEqual(expect.arrayContaining(['nginx', 'curl']))
  })

  it('reports UNREACHABLE when the inventory address is wrong', () => {
    const s = troubleshootLabs.find(t => t.id === 'ts-unreachable').setup()
    const r = run('ansible all -m ping', s)
    expect(r.output).toMatch(/db1 \| UNREACHABLE/)
    expect(r.output).toMatch(/web1 \| SUCCESS/)
  })

  it('fails a vaulted vars_file without the password, succeeds with it', () => {
    const s = troubleshootLabs.find(t => t.id === 'ts-vault').setup()
    expect(run('ansible-playbook playbooks/secure.yml', s).output).toMatch(/Attempting to decrypt/)
    const r = run('ansible-playbook playbooks/secure.yml --ask-vault-pass', s)
    expect(r.state.hosts.db1.files['/etc/app/token.conf']).toContain('vault-token-123')
  })
})

describe('vault', () => {
  it('round-trips encrypt/decrypt', () => {
    const enc = vaultEncrypt('---\napi_token: abc123\n')
    expect(isVault(enc)).toBe(true)
    expect(vaultDecrypt(enc)).toContain('api_token: abc123')
  })
})

describe('scenario validators', () => {
  for (const scenario of [...tutorials, ...troubleshootLabs]) {
    it(`"${scenario.title}" passes once solved`, () => {
      if (scenario.category === 'troubleshoot') {
        const before = scenario.validation(scenario.setup())
        expect(before.every(r => r.pass)).toBe(false)
      }
      const after = scenario.validation(solve(scenario))
      expect(after.every(r => r.pass)).toBe(true)
    })
  }
})
