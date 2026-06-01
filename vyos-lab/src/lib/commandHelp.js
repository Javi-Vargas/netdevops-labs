// Help text and tab-completion vocabulary.

export const OPERATIONAL_WORDS = ['show', 'ping', 'configure', 'reset', 'reboot', 'help']
export const SHOW_WORDS = ['configuration', 'interfaces', 'ip', 'route', 'nat', 'firewall', 'dhcp', 'log', 'version']
export const CONFIG_WORDS = ['set', 'delete', 'commit', 'save', 'discard', 'compare', 'show', 'edit', 'top', 'up', 'run', 'exit', 'help']

// Common config paths offered for completion after `set ` / `delete `.
export const CONFIG_PATHS = [
  'interfaces ethernet', 'interfaces loopback', 'interfaces wireguard',
  'system host-name', 'system name-server', 'system time-zone',
  'service ssh', 'service dhcp-server', 'service dns forwarding',
  'nat source rule', 'nat destination rule',
  'firewall name', 'firewall', 'protocols static route', 'protocols bgp', 'protocols ospf',
]

export function helpText(mode) {
  if (mode === 'configuration') {
    return [
      'Configuration mode commands:',
      '  set <path> [value]      Create or modify a configuration node',
      '  delete <path> [value]   Remove a configuration node or value',
      '  show [path]             Show the candidate (working) configuration',
      '  compare                 Show pending changes vs. the running config',
      '  commit                  Apply the candidate configuration',
      '  save                    Persist the running configuration to disk',
      '  discard                 Abandon uncommitted changes',
      '  edit <path>             Descend into a configuration subtree',
      '  top / up                Return to the top / go up one level',
      '  run <op-command>        Run an operational command (e.g. run show interfaces)',
      '  exit [discard]          Leave configuration mode',
    ].join('\n')
  }
  return [
    'Operational mode commands:',
    '  configure               Enter configuration mode',
    '  show configuration      Show the running configuration',
    '  show interfaces         Show interface status',
    '  show ip route           Show the routing table',
    '  show nat source rules   Show source NAT rules',
    '  show firewall [name]    Show firewall rulesets',
    '  show dhcp server leases Show DHCP leases',
    '  show log                Show recent system log',
    '  show version            Show VyOS version',
    '  ping <host> [count N]   Ping a host',
    '  reset                   Reset the simulator to defaults',
  ].join('\n')
}
