// Randomized practice drills. Each generate() returns a fresh, self-contained
// question whose `solution` set-lines satisfy its `check(state)` — so the same
// object powers the UI, the "Show answer" reveal, and the tests.
//
// Drills are state-changing (so they can be auto-graded against the committed
// running config). `verifyWith` suggests the matching read-only `show` command
// as a habit-builder — it is not auto-graded.
import { configHas, configHasPrefix } from './configTree'

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
const octet = () => randInt(0, 250)

// ---- interfaces ------------------------------------------------------------

function genInterface() {
  const iface = pick(['eth1', 'eth2'])
  const variant = pick(['addr-desc', 'addr-mtu', 'disable'])

  if (variant === 'disable') {
    return {
      topic: 'interfaces',
      prompt: `Administratively disable interface ${iface}, then commit.`,
      hint: 'set interfaces ethernet <if> disable',
      verifyWith: `show interfaces ethernet ${iface}`,
      initialCommands: [`set interfaces ethernet ${iface} address 10.${octet()}.0.1/24`],
      solution: [`set interfaces ethernet ${iface} disable`],
      check: (s) => configHas(s.running, `interfaces ethernet ${iface} disable`),
    }
  }

  const ip = `10.${octet()}.${octet()}.1/${pick(['24', '30'])}`
  if (variant === 'addr-mtu') {
    const mtu = pick(['1400', '1492', '9000'])
    return {
      topic: 'interfaces',
      prompt: `Give ${iface} the address ${ip} and set its MTU to ${mtu}, then commit.`,
      hint: 'set interfaces ethernet <if> address <cidr> / mtu <n>',
      verifyWith: `show interfaces ethernet ${iface}`,
      initialCommands: [],
      solution: [
        `set interfaces ethernet ${iface} address ${ip}`,
        `set interfaces ethernet ${iface} mtu ${mtu}`,
      ],
      check: (s) => configHas(s.running, `interfaces ethernet ${iface} address ${ip}`) &&
        configHas(s.running, `interfaces ethernet ${iface} mtu ${mtu}`),
    }
  }

  const label = pick(['LAN', 'WAN', 'UPLINK', 'CORE', 'EDGE', 'TRANSIT'])
  return {
    topic: 'interfaces',
    prompt: `Configure ${iface} with address ${ip} and description ${label}, then commit.`,
    hint: 'set interfaces ethernet <if> address <cidr> / description <text>',
    verifyWith: `show interfaces ethernet ${iface}`,
    initialCommands: [],
    solution: [
      `set interfaces ethernet ${iface} address ${ip}`,
      `set interfaces ethernet ${iface} description ${label}`,
    ],
    check: (s) => configHas(s.running, `interfaces ethernet ${iface} address ${ip}`) &&
      configHasPrefix(s.running, `interfaces ethernet ${iface} description`),
  }
}

// ---- OSPF ------------------------------------------------------------------

function genOspf() {
  const variant = pick(['area-network', 'neighbor', 'interface-area'])
  const area = pick(['0', '1', '10'])

  if (variant === 'neighbor') {
    const nbr = `10.${octet()}.${octet()}.${randInt(2, 250)}`
    return {
      topic: 'ospf',
      prompt: `Statically define OSPF neighbor ${nbr}, then commit.`,
      hint: 'set protocols ospf neighbor <ip>',
      verifyWith: 'run show ip ospf neighbor',
      initialCommands: [],
      solution: [`set protocols ospf neighbor ${nbr}`],
      check: (s) => configHasPrefix(s.running, `protocols ospf neighbor ${nbr}`),
    }
  }

  if (variant === 'interface-area') {
    const iface = pick(['eth0', 'eth1', 'eth2'])
    return {
      topic: 'ospf',
      prompt: `Enable OSPF on interface ${iface} in area ${area}, then commit.`,
      hint: 'set protocols ospf interface <if> area <n>',
      verifyWith: 'run show ip ospf',
      initialCommands: [],
      solution: [`set protocols ospf interface ${iface} area ${area}`],
      check: (s) => configHas(s.running, `protocols ospf interface ${iface} area ${area}`),
    }
  }

  const rid = `${randInt(1, 9)}.${randInt(1, 9)}.${randInt(1, 9)}.${randInt(1, 9)}`
  const net = `10.${octet()}.${octet()}.0/24`
  return {
    topic: 'ospf',
    prompt: `Enable OSPF: set router-id ${rid} and advertise ${net} into area ${area}, then commit.`,
    hint: 'set protocols ospf parameters router-id <id> / area <n> network <cidr>',
    verifyWith: 'run show ip ospf',
    initialCommands: [],
    solution: [
      `set protocols ospf parameters router-id ${rid}`,
      `set protocols ospf area ${area} network ${net}`,
    ],
    check: (s) => configHas(s.running, `protocols ospf parameters router-id ${rid}`) &&
      configHas(s.running, `protocols ospf area ${area} network ${net}`),
  }
}

// ---- BGP -------------------------------------------------------------------

function genBgp() {
  const localAs = randInt(64512, 65534)
  const remoteAs = randInt(64512, 65534)
  const peer = `203.0.113.${randInt(2, 250)}`
  const variant = pick(['peer', 'peer-network'])

  if (variant === 'peer') {
    return {
      topic: 'bgp',
      prompt: `Set local AS ${localAs} and configure eBGP neighbor ${peer} in remote AS ${remoteAs}, then commit.`,
      hint: 'set protocols bgp system-as <as> / neighbor <ip> remote-as <as>',
      verifyWith: 'run show ip bgp summary',
      initialCommands: [],
      solution: [
        `set protocols bgp system-as ${localAs}`,
        `set protocols bgp neighbor ${peer} remote-as ${remoteAs}`,
      ],
      check: (s) => configHas(s.running, `protocols bgp system-as ${localAs}`) &&
        configHas(s.running, `protocols bgp neighbor ${peer} remote-as ${remoteAs}`),
    }
  }

  const net = `10.${octet()}.0.0/24`
  return {
    topic: 'bgp',
    prompt: `Local AS ${localAs}: peer with ${peer} (AS ${remoteAs}) and advertise ${net}, then commit.`,
    hint: 'system-as / neighbor remote-as / address-family ipv4-unicast network <cidr>',
    verifyWith: 'run show ip bgp summary',
    initialCommands: [],
    solution: [
      `set protocols bgp system-as ${localAs}`,
      `set protocols bgp neighbor ${peer} remote-as ${remoteAs}`,
      `set protocols bgp address-family ipv4-unicast network ${net}`,
    ],
    check: (s) => configHas(s.running, `protocols bgp system-as ${localAs}`) &&
      configHas(s.running, `protocols bgp neighbor ${peer} remote-as ${remoteAs}`) &&
      configHas(s.running, `protocols bgp address-family ipv4-unicast network ${net}`),
  }
}

export const drillTopics = [
  { id: 'interfaces', label: 'Interfaces', generate: genInterface },
  { id: 'ospf', label: 'OSPF', generate: genOspf },
  { id: 'bgp', label: 'BGP', generate: genBgp },
  { id: 'mixed', label: 'Mixed', generate: () => pick([genInterface, genOspf, genBgp])() },
]

export function generateDrill(topicId) {
  const topic = drillTopics.find(t => t.id === topicId) || drillTopics[0]
  return topic.generate()
}
