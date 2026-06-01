// Simulated Ansible Vault. NOT real encryption — a reversible base64 encoding
// behind the standard header, so labs can lock/unlock files believably.

export const VAULT_MARKER = '$ANSIBLE_VAULT;1.1;AES256'

export function isVault(content) {
  return typeof content === 'string' && content.startsWith('$ANSIBLE_VAULT')
}

function b64encode(s) {
  return btoa(unescape(encodeURIComponent(s)))
}
function b64decode(s) {
  try { return decodeURIComponent(escape(atob(s))) } catch { return '' }
}

export function vaultEncrypt(plain) {
  const body = b64encode(plain).match(/.{1,60}/g) || ['']
  return VAULT_MARKER + '\n' + body.join('\n') + '\n'
}

export function vaultDecrypt(enc) {
  const body = enc.split('\n').slice(1).join('').trim()
  return b64decode(body)
}
