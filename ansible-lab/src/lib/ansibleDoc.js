// Short, simulator-flavored module docs for `ansible-doc <module>`.
export const docs = {
  ping: 'PING\n  Try to connect to host, verify a usable python and return "pong" on success.\n  (takes no arguments)',
  debug: 'DEBUG\n  Print statements during execution.\n  - msg: the message to print\n  - var: a variable name to dump',
  command: 'COMMAND\n  Execute a command on the target. Not processed through a shell.\n  - creates: skip if this path already exists\n  Note: not idempotent unless guarded with creates/removes.',
  shell: 'SHELL\n  Run a command through the shell (/bin/sh). Supports pipes/redirects.\n  Note: prefer a real module over shell where one exists.',
  package: 'PACKAGE\n  Generic OS package manager.\n  - name: package name (or list)\n  - state: present | absent | latest',
  service: 'SERVICE\n  Control services.\n  - name: service name\n  - state: started | stopped | restarted | reloaded\n  - enabled: yes | no',
  copy: 'COPY\n  Copy a file to the remote host.\n  - content OR src: the data to write\n  - dest: destination path',
  template: 'TEMPLATE\n  Render a Jinja2 template (.j2) and write it to the remote host.\n  - src: template path\n  - dest: destination path',
  file: 'FILE\n  Manage files/directories.\n  - path: target path\n  - state: file | touch | directory | absent',
  lineinfile: 'LINEINFILE\n  Ensure a particular line is present in a file (idempotent).\n  - path: file to modify\n  - line: the line to ensure is present',
  user: 'USER\n  Manage user accounts.\n  - name: username\n  - state: present | absent',
  set_fact: 'SET_FACT\n  Set host variables (facts) at runtime.\n  - key: value pairs become available to later tasks',
  setup: 'SETUP\n  Gather facts about remote hosts (ansible_distribution, ansible_os_family, ...).',
}

export function lookupDoc(name) {
  const base = name?.replace(/^ansible\.[a-z_]+\./, '')
  return docs[base] || `[WARNING]: module ${name} not found in simulator docs. Try: ${Object.keys(docs).join(', ')}`
}
