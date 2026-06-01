// Training labs. Validators inspect the COMMITTED running config tree, so
// objectives only turn green after the user runs `commit`.
import { configHas, configHasPrefix } from './configTree'

const DEFAULTS = [
  'set interfaces ethernet eth0',
  'set interfaces ethernet eth1',
  'set interfaces ethernet eth2',
  'set interfaces loopback lo address 127.0.0.1/8',
  'set system host-name vyos',
  'set service ssh port 22',
]

const ok = (pass, label) => ({ pass: !!pass, label })

// ---- Build labs ------------------------------------------------------------

export const buildScenarios = [
  {
    id: 'build-interfaces',
    title: 'Interface addressing & basics',
    category: 'build',
    difficulty: 'beginner',
    duration: '5 min',
    description: 'Set a hostname, address the LAN interface, and point the router at a DNS resolver.',
    brief: 'Bring a fresh router online: name it r1, give eth0 a LAN address, and add an upstream name-server.',
    objectives: [
      "Set the system host-name to 'r1'",
      'Assign 192.168.10.1/24 to eth0',
      'Add a description to eth0',
      'Configure name-server 1.1.1.1',
    ],
    commands: [
      { cmd: 'configure', why: 'Enter configuration mode.' },
      { cmd: 'set system host-name r1', why: 'Rename the router (the prompt updates after commit).' },
      { cmd: 'set interfaces ethernet eth0 address 192.168.10.1/24', why: 'Give eth0 its LAN gateway address.' },
      { cmd: "set interfaces ethernet eth0 description 'LAN'", why: 'Label the interface.' },
      { cmd: 'set system name-server 1.1.1.1', why: 'Upstream DNS resolver for the router.' },
      { cmd: 'commit', why: 'Apply the candidate configuration.' },
      { cmd: 'save', why: 'Persist it across reboots.' },
    ],
    initialCommands: DEFAULTS,
    validation: (s) => {
      const t = s.running
      return [
        ok(configHas(t, 'system host-name r1'), 'host-name r1'),
        ok(configHas(t, 'interfaces ethernet eth0 address 192.168.10.1/24'), 'eth0 address'),
        ok(configHasPrefix(t, 'interfaces ethernet eth0 description'), 'eth0 description'),
        ok(configHas(t, 'system name-server 1.1.1.1'), 'name-server'),
      ]
    },
  },
  {
    id: 'build-nat',
    title: 'Source NAT (internet masquerade)',
    category: 'build',
    difficulty: 'intermediate',
    duration: '6 min',
    description: 'Let the LAN reach the internet by masquerading its traffic out the WAN interface.',
    brief: 'eth0 is the LAN (192.168.20.1/24) and eth1 is the WAN (203.0.113.2/24) with a default route. Add source NAT so the LAN can browse.',
    objectives: [
      'Create source NAT rule 100 matching LAN 192.168.20.0/24',
      'Set rule 100 outbound-interface to eth1',
      'Set rule 100 translation to masquerade',
    ],
    commands: [
      { cmd: 'configure', why: 'Enter configuration mode.' },
      { cmd: 'set nat source rule 100 source address 192.168.20.0/24', why: 'Match traffic originating from the LAN.' },
      { cmd: 'set nat source rule 100 outbound-interface eth1', why: 'NAT only on the WAN-facing interface.' },
      { cmd: 'set nat source rule 100 translation address masquerade', why: 'Rewrite source to the WAN address dynamically.' },
      { cmd: 'commit ; save', why: 'Apply and persist.' },
    ],
    initialCommands: [
      ...DEFAULTS,
      'set interfaces ethernet eth0 address 192.168.20.1/24',
      'set interfaces ethernet eth1 address 203.0.113.2/24',
      'set protocols static route 0.0.0.0/0 next-hop 203.0.113.1',
    ],
    validation: (s) => {
      const t = s.running
      return [
        ok(configHas(t, 'nat source rule 100 source address 192.168.20.0/24'), 'source match'),
        ok(configHas(t, 'nat source rule 100 outbound-interface eth1'), 'outbound-interface'),
        ok(configHas(t, 'nat source rule 100 translation address masquerade'), 'masquerade'),
      ]
    },
  },
  {
    id: 'build-dhcp',
    title: 'DHCP server for the LAN',
    category: 'build',
    difficulty: 'intermediate',
    duration: '7 min',
    description: 'Hand out addresses to LAN clients with a DHCP pool, gateway, and DNS.',
    brief: 'eth1 is the LAN gateway at 192.168.30.1/24. Stand up a DHCP server for 192.168.30.0/24.',
    objectives: [
      'Create shared-network LAN with subnet 192.168.30.0/24',
      'Configure a DHCP range 192.168.30.100–200',
      'Set the default-router to 192.168.30.1',
      'Provide a DNS name-server to clients',
    ],
    commands: [
      { cmd: 'configure', why: 'Enter configuration mode.' },
      { cmd: 'set service dhcp-server shared-network-name LAN subnet 192.168.30.0/24 subnet-id 1', why: 'Define the DHCP subnet (subnet-id required in 1.4).' },
      { cmd: 'set service dhcp-server shared-network-name LAN subnet 192.168.30.0/24 range 0 start 192.168.30.100', why: 'Start of the lease pool.' },
      { cmd: 'set service dhcp-server shared-network-name LAN subnet 192.168.30.0/24 range 0 stop 192.168.30.200', why: 'End of the lease pool.' },
      { cmd: 'set service dhcp-server shared-network-name LAN subnet 192.168.30.0/24 default-router 192.168.30.1', why: 'Gateway handed to clients.' },
      { cmd: 'set service dhcp-server shared-network-name LAN subnet 192.168.30.0/24 name-server 1.1.1.1', why: 'DNS handed to clients.' },
      { cmd: 'commit ; save', why: 'Apply and persist.' },
    ],
    initialCommands: [
      ...DEFAULTS,
      'set interfaces ethernet eth1 address 192.168.30.1/24',
    ],
    validation: (s) => {
      const t = s.running
      const base = 'service dhcp-server shared-network-name LAN subnet 192.168.30.0/24'
      return [
        ok(configHasPrefix(t, base), 'shared-network + subnet'),
        ok(configHas(t, `${base} range 0 start 192.168.30.100`) && configHas(t, `${base} range 0 stop 192.168.30.200`), 'range'),
        ok(configHas(t, `${base} default-router 192.168.30.1`), 'default-router'),
        ok(configHasPrefix(t, `${base} name-server`), 'name-server'),
      ]
    },
  },
  {
    id: 'build-routing',
    title: 'Static & default routes',
    category: 'build',
    difficulty: 'intermediate',
    duration: '6 min',
    description: 'Add a default route to the internet and a static route to a remote network with a custom distance.',
    brief: 'eth0 is LAN (192.168.40.1/24) and eth1 is WAN (203.0.113.2/24). Route traffic to the internet and to a remote 10.50.0.0/16 network.',
    objectives: [
      'Add a default route via 203.0.113.1',
      'Add a static route to 10.50.0.0/16 via 192.168.40.254',
      'Set administrative distance 10 on the 10.50.0.0/16 route',
    ],
    commands: [
      { cmd: 'configure', why: 'Enter configuration mode.' },
      { cmd: 'set protocols static route 0.0.0.0/0 next-hop 203.0.113.1', why: 'Default route via the WAN gateway.' },
      { cmd: 'set protocols static route 10.50.0.0/16 next-hop 192.168.40.254', why: 'Reach the remote network via a LAN router.' },
      { cmd: 'set protocols static route 10.50.0.0/16 next-hop 192.168.40.254 distance 10', why: 'Prefer/deprefer this route with an admin distance.' },
      { cmd: 'commit ; save', why: 'Apply and persist. Verify with: run show ip route' },
    ],
    initialCommands: [
      ...DEFAULTS,
      'set interfaces ethernet eth0 address 192.168.40.1/24',
      'set interfaces ethernet eth1 address 203.0.113.2/24',
    ],
    validation: (s) => {
      const t = s.running
      return [
        ok(configHasPrefix(t, 'protocols static route 0.0.0.0/0 next-hop 203.0.113.1'), 'default route'),
        ok(configHasPrefix(t, 'protocols static route 10.50.0.0/16 next-hop 192.168.40.254'), 'static route'),
        ok(configHas(t, 'protocols static route 10.50.0.0/16 next-hop 192.168.40.254 distance 10'), 'distance'),
      ]
    },
  },
]

// ---- Troubleshooting labs --------------------------------------------------

export const troubleshootScenarios = [
  {
    id: 'ts-interface-down',
    title: 'LAN interface is down',
    category: 'troubleshoot',
    difficulty: 'beginner',
    duration: '4 min',
    description: 'eth0 is the LAN gateway but clients report no connectivity. Find out why and bring it back up.',
    brief: 'eth0 already has 192.168.10.1/24 but the LAN is down. Diagnose with `show interfaces` and fix it.',
    objectives: [
      'eth0 is administratively up (disable removed)',
      'eth0 keeps its address 192.168.10.1/24',
    ],
    commands: [
      { cmd: 'run show interfaces', why: 'Notice eth0 shows admin-down (A/D).' },
      { cmd: 'show interfaces ethernet eth0', why: 'Inspect the candidate — see the `disable` node.' },
      { cmd: 'delete interfaces ethernet eth0 disable', why: 'Remove the administrative shutdown.' },
      { cmd: 'commit ; save', why: 'Apply the fix.' },
    ],
    initialCommands: [
      ...DEFAULTS,
      'set interfaces ethernet eth0 address 192.168.10.1/24',
      'set interfaces ethernet eth0 description LAN',
      'set interfaces ethernet eth0 disable',
    ],
    validation: (s) => {
      const t = s.running
      return [
        ok(!configHas(t, 'interfaces ethernet eth0 disable'), 'enabled'),
        ok(configHas(t, 'interfaces ethernet eth0 address 192.168.10.1/24'), 'address intact'),
      ]
    },
  },
  {
    id: 'ts-firewall-return',
    title: 'Firewall blocks return traffic',
    category: 'troubleshoot',
    difficulty: 'intermediate',
    duration: '6 min',
    description: 'A WAN-IN ruleset drops everything — including replies to connections the router started. Allow established sessions.',
    brief: "Firewall ruleset WAN-IN has default-action drop and no allow rules, so even return traffic is blocked. Add a rule that accepts established connections.",
    objectives: [
      'WAN-IN rule 10 action is accept',
      'WAN-IN rule 10 matches established connections',
    ],
    commands: [
      { cmd: 'run show firewall', why: 'See WAN-IN drops everything with no rules.' },
      { cmd: 'set firewall name WAN-IN rule 10 action accept', why: 'Permit matching traffic.' },
      { cmd: 'set firewall name WAN-IN rule 10 state established', why: 'Match traffic for already-established sessions.' },
      { cmd: 'set firewall name WAN-IN rule 10 state related', why: 'Also allow related (e.g. ICMP errors, FTP data).' },
      { cmd: 'commit ; save', why: 'Apply the fix.' },
    ],
    initialCommands: [
      ...DEFAULTS,
      'set interfaces ethernet eth1 address 203.0.113.2/24',
      'set firewall name WAN-IN default-action drop',
      'set interfaces ethernet eth1 firewall in name WAN-IN',
    ],
    validation: (s) => {
      const t = s.running
      return [
        ok(configHas(t, 'firewall name WAN-IN rule 10 action accept'), 'accept'),
        ok(configHas(t, 'firewall name WAN-IN rule 10 state established'), 'established'),
      ]
    },
  },
  {
    id: 'ts-dns-forwarding',
    title: 'DNS forwarder not resolving',
    category: 'troubleshoot',
    difficulty: 'intermediate',
    duration: '6 min',
    description: 'The DNS forwarder is enabled but LAN clients get no answers. It has no upstream resolver, no listen address, and no allowed clients.',
    brief: 'eth0 is the LAN gateway (192.168.10.1/24). Make the DNS forwarder listen on the LAN, allow the LAN subnet, and forward upstream.',
    objectives: [
      'Forwarder listens on 192.168.10.1',
      'An upstream name-server is configured',
      'The LAN subnet is allowed to query (allow-from 192.168.10.0/24)',
    ],
    commands: [
      { cmd: 'show service dns', why: 'Inspect the candidate — only cache-size is set.' },
      { cmd: 'set service dns forwarding listen-address 192.168.10.1', why: 'Listen on the LAN gateway address.' },
      { cmd: 'set service dns forwarding allow-from 192.168.10.0/24', why: 'Permit queries from the LAN.' },
      { cmd: 'set service dns forwarding name-server 1.1.1.1', why: 'Forward queries to an upstream resolver.' },
      { cmd: 'commit ; save', why: 'Apply the fix.' },
    ],
    initialCommands: [
      ...DEFAULTS,
      'set interfaces ethernet eth0 address 192.168.10.1/24',
      'set service dns forwarding cache-size 1000',
    ],
    validation: (s) => {
      const t = s.running
      return [
        ok(configHas(t, 'service dns forwarding listen-address 192.168.10.1'), 'listen-address'),
        ok(configHasPrefix(t, 'service dns forwarding name-server'), 'name-server'),
        ok(configHas(t, 'service dns forwarding allow-from 192.168.10.0/24'), 'allow-from'),
      ]
    },
  },
  {
    id: 'ts-wireguard',
    title: 'WireGuard tunnel won’t come up',
    category: 'troubleshoot',
    difficulty: 'advanced',
    duration: '8 min',
    description: 'A WireGuard interface wg0 is half-configured: it has keys and a peer endpoint but no address, no listen port, and the peer has no allowed-ips.',
    brief: 'Finish the wg0 site-to-site tunnel: give it a tunnel address, a listen port, and tell the OFFICE peer which networks it carries.',
    objectives: [
      'wg0 has a tunnel address',
      'wg0 has a listen port',
      'Peer OFFICE has allowed-ips configured',
    ],
    commands: [
      { cmd: 'show interfaces wireguard', why: 'Inspect wg0 — address/port/allowed-ips are missing.' },
      { cmd: 'set interfaces wireguard wg0 address 10.10.0.1/24', why: 'Tunnel-side address.' },
      { cmd: 'set interfaces wireguard wg0 port 51820', why: 'UDP port WireGuard listens on.' },
      { cmd: 'set interfaces wireguard wg0 peer OFFICE allowed-ips 10.20.0.0/24', why: 'Networks routed across the tunnel to the peer.' },
      { cmd: 'commit ; save', why: 'Apply the fix.' },
    ],
    initialCommands: [
      ...DEFAULTS,
      'set interfaces wireguard wg0 private-key SIM_PRIVATE_KEY',
      'set interfaces wireguard wg0 peer OFFICE public-key SIM_PEER_PUBKEY',
      'set interfaces wireguard wg0 peer OFFICE endpoint 203.0.113.50:51820',
    ],
    validation: (s) => {
      const t = s.running
      return [
        ok(configHasPrefix(t, 'interfaces wireguard wg0 address'), 'address'),
        ok(configHasPrefix(t, 'interfaces wireguard wg0 port'), 'port'),
        ok(configHasPrefix(t, 'interfaces wireguard wg0 peer OFFICE allowed-ips'), 'allowed-ips'),
      ]
    },
  },
]
