// Simulated managed-host state. Everything here is plain JSON (serializable to
// localStorage): packages are an array, services a map name->'started'|'stopped'.

export function createHost(name, opts = {}) {
  const distro = opts.distro || 'Ubuntu'
  const osFamily = distro === 'Ubuntu' || distro === 'Debian' ? 'Debian' : 'RedHat'
  const pkgMgr = osFamily === 'Debian' ? 'apt' : 'dnf'
  return {
    name,
    reachable: opts.reachable !== false,
    realAddress: opts.realAddress || null, // ping works only if inventory ansible_host matches
    facts: {
      ansible_hostname: name,
      ansible_distribution: distro,
      ansible_distribution_version: opts.version || (osFamily === 'Debian' ? '22.04' : '9'),
      ansible_os_family: osFamily,
      ansible_pkg_mgr: pkgMgr,
      ansible_default_ipv4: { address: opts.realAddress || '10.0.0.1' },
      ...(opts.facts || {}),
    },
    packages: [...(opts.packages || [])],
    services: { ...(opts.services || {}) },
    files: { ...(opts.files || {}) },
    users: [...(opts.users || ['root'])],
  }
}

export function hostInstalled(host, pkg) {
  return host.packages.includes(pkg)
}

export function serviceState(host, svc) {
  return host.services[svc] || 'stopped'
}

export function fileContent(host, path) {
  return Object.prototype.hasOwnProperty.call(host.files, path) ? host.files[path] : null
}

export function cloneHosts(hosts) {
  return JSON.parse(JSON.stringify(hosts))
}
