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
  {
    id: 'build-interfaces-multi',
    title: 'Address multiple interfaces',
    category: 'build',
    difficulty: 'beginner',
    duration: '6 min',
    description: 'Reps on interface configuration: address two interfaces, tune the MTU, label them, and inspect in config mode.',
    brief: 'Bring up eth1 and eth2 with addresses, set a jumbo-ish MTU on eth1, describe eth2, then verify with show — both in configuration mode and operationally.',
    objectives: [
      'Assign 10.1.1.1/24 to eth1',
      'Assign 10.2.2.1/24 to eth2',
      'Set eth1 MTU to 1400',
      'Add a description to eth2',
    ],
    commands: [
      { cmd: 'configure', why: 'Enter configuration mode.' },
      { cmd: 'set interfaces ethernet eth1 address 10.1.1.1/24', why: 'Address the first interface.' },
      { cmd: 'set interfaces ethernet eth2 address 10.2.2.1/24', why: 'Address the second interface.' },
      { cmd: 'set interfaces ethernet eth1 mtu 1400', why: 'Tune the MTU on eth1.' },
      { cmd: "set interfaces ethernet eth2 description 'UPLINK'", why: 'Label eth2.' },
      { cmd: 'show interfaces ethernet', why: 'Review the candidate interfaces subtree (config-mode show).' },
      { cmd: 'commit', why: 'Apply the candidate configuration.' },
      { cmd: 'run show interfaces', why: 'Verify operational state (S/L) and addresses.' },
      { cmd: 'save', why: 'Persist it.' },
    ],
    initialCommands: DEFAULTS,
    validation: (s) => {
      const t = s.running
      return [
        ok(configHas(t, 'interfaces ethernet eth1 address 10.1.1.1/24'), 'eth1 address'),
        ok(configHas(t, 'interfaces ethernet eth2 address 10.2.2.1/24'), 'eth2 address'),
        ok(configHas(t, 'interfaces ethernet eth1 mtu 1400'), 'eth1 mtu'),
        ok(configHasPrefix(t, 'interfaces ethernet eth2 description'), 'eth2 description'),
      ]
    },
  },
  {
    id: 'build-ospf',
    title: 'OSPF single area',
    category: 'build',
    difficulty: 'intermediate',
    duration: '7 min',
    description: 'Bring up OSPF: set a router-id, advertise two connected networks into area 0, and define a neighbor.',
    brief: 'eth0 (10.0.0.1/24) faces the LAN and eth1 (10.0.12.1/24) faces a peer at 10.0.12.2. Advertise both into OSPF area 0.',
    objectives: [
      'Set the OSPF router-id to 1.1.1.1',
      'Advertise 10.0.0.0/24 into area 0',
      'Advertise 10.0.12.0/24 into area 0',
      'Statically define OSPF neighbor 10.0.12.2',
    ],
    commands: [
      { cmd: 'configure', why: 'Enter configuration mode.' },
      { cmd: 'set protocols ospf parameters router-id 1.1.1.1', why: 'Pin a stable router-id.' },
      { cmd: 'set protocols ospf area 0 network 10.0.0.0/24', why: 'Advertise the LAN into the backbone area.' },
      { cmd: 'set protocols ospf area 0 network 10.0.12.0/24', why: 'Advertise the transit link into area 0.' },
      { cmd: 'set protocols ospf neighbor 10.0.12.2', why: 'Define the peer as a neighbor.' },
      { cmd: 'commit', why: 'Apply the configuration.' },
      { cmd: 'run show ip ospf neighbor', why: 'Verify the adjacency.' },
      { cmd: 'save', why: 'Persist it.' },
    ],
    initialCommands: [
      ...DEFAULTS,
      'set interfaces ethernet eth0 address 10.0.0.1/24',
      'set interfaces ethernet eth1 address 10.0.12.1/24',
    ],
    validation: (s) => {
      const t = s.running
      return [
        ok(configHas(t, 'protocols ospf parameters router-id 1.1.1.1'), 'router-id'),
        ok(configHas(t, 'protocols ospf area 0 network 10.0.0.0/24'), 'area 0 network LAN'),
        ok(configHas(t, 'protocols ospf area 0 network 10.0.12.0/24'), 'area 0 network transit'),
        ok(configHasPrefix(t, 'protocols ospf neighbor 10.0.12.2'), 'neighbor'),
      ]
    },
  },
  {
    id: 'build-bgp',
    title: 'eBGP peering',
    category: 'build',
    difficulty: 'advanced',
    duration: '7 min',
    description: 'Establish an eBGP session with an upstream and advertise a prefix (VyOS 1.4 syntax).',
    brief: 'eth1 (203.0.113.1/24) connects to ISP 203.0.113.2 in AS 65002. You are AS 65001 — peer up and advertise 10.0.0.0/24.',
    objectives: [
      'Set the local AS to 65001',
      'Configure eBGP neighbor 203.0.113.2 with remote-as 65002',
      'Advertise 10.0.0.0/24 via address-family ipv4-unicast',
    ],
    commands: [
      { cmd: 'configure', why: 'Enter configuration mode.' },
      { cmd: 'set protocols bgp system-as 65001', why: 'Set this router’s local AS.' },
      { cmd: 'set protocols bgp neighbor 203.0.113.2 remote-as 65002', why: 'Define the eBGP peer and its AS.' },
      { cmd: 'set protocols bgp address-family ipv4-unicast network 10.0.0.0/24', why: 'Advertise the prefix into BGP.' },
      { cmd: 'commit', why: 'Apply the configuration.' },
      { cmd: 'run show ip bgp summary', why: 'Confirm the peer reaches Established.' },
      { cmd: 'save', why: 'Persist it.' },
    ],
    initialCommands: [
      ...DEFAULTS,
      'set interfaces ethernet eth1 address 203.0.113.1/24',
    ],
    validation: (s) => {
      const t = s.running
      return [
        ok(configHas(t, 'protocols bgp system-as 65001'), 'local AS'),
        ok(configHas(t, 'protocols bgp neighbor 203.0.113.2 remote-as 65002'), 'neighbor remote-as'),
        ok(configHas(t, 'protocols bgp address-family ipv4-unicast network 10.0.0.0/24'), 'advertised network'),
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
  {
    id: 'ts-ospf-area-mismatch',
    title: 'OSPF adjacency won’t form',
    category: 'troubleshoot',
    difficulty: 'advanced',
    duration: '6 min',
    description: 'OSPF is configured with a router-id and a neighbor, but the transit link never comes up. The link network was never advertised into area 0.',
    brief: 'eth1 (10.0.12.1/24) faces neighbor 10.0.12.2, but only the LAN 10.0.0.0/24 is in area 0 — the transit network 10.0.12.0/24 is missing. Add it.',
    objectives: [
      'The transit network 10.0.12.0/24 is advertised into area 0',
    ],
    commands: [
      { cmd: 'run show ip ospf', why: 'Notice only one network is in area 0.' },
      { cmd: 'show protocols ospf', why: 'Inspect the candidate — the transit network is missing.' },
      { cmd: 'set protocols ospf area 0 network 10.0.12.0/24', why: 'Advertise the transit link so the adjacency can form.' },
      { cmd: 'commit ; save', why: 'Apply the fix.' },
    ],
    initialCommands: [
      ...DEFAULTS,
      'set interfaces ethernet eth0 address 10.0.0.1/24',
      'set interfaces ethernet eth1 address 10.0.12.1/24',
      'set protocols ospf parameters router-id 1.1.1.1',
      'set protocols ospf area 0 network 10.0.0.0/24',
      'set protocols ospf neighbor 10.0.12.2',
    ],
    validation: (s) => {
      const t = s.running
      return [
        ok(configHas(t, 'protocols ospf area 0 network 10.0.12.0/24'), 'transit network in area 0'),
      ]
    },
  },
]
