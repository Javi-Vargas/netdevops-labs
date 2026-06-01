// Minimal IPv4 helpers for the reachability/route simulation.

export function ipToInt(ip) {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some(p => Number.isNaN(p) || p < 0 || p > 255)) return null
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3]
}

export function parseCidr(cidr) {
  const [ip, bitsStr] = cidr.split('/')
  const bits = bitsStr === undefined ? 32 : Number(bitsStr)
  const ipInt = ipToInt(ip)
  if (ipInt === null || Number.isNaN(bits) || bits < 0 || bits > 32) return null
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0
  return { ip, ipInt, bits, mask, network: (ipInt & mask) >>> 0 }
}

// Is a bare IPv4 address inside the given CIDR network?
export function inSubnet(ip, cidr) {
  const target = ipToInt(ip)
  const net = parseCidr(cidr)
  if (target === null || !net) return false
  return ((target & net.mask) >>> 0) === net.network
}

export function isValidIpv4(ip) {
  return ipToInt(ip) !== null
}
