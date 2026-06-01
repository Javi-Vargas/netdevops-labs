// Default control-node state: managed hosts + seed virtual filesystem.
import { createHost } from './hostState'
import { createVfs } from './vfs'

export const DEFAULT_INVENTORY = `# Inventory for the lab fleet
[webservers]
web1 ansible_host=192.168.56.11
web2 ansible_host=192.168.56.12

[dbservers]
db1 ansible_host=192.168.56.21

[webservers:vars]
http_port=80
`

const SITE_YML = `---
- name: Configure web servers
  hosts: webservers
  become: true
  tasks:
    - name: Install nginx
      package:
        name: nginx
        state: present

    - name: Start and enable nginx
      service:
        name: nginx
        state: started
        enabled: true

    - name: Deploy index page
      copy:
        content: "Hello from {{ inventory_hostname }}"
        dest: /var/www/html/index.html
      notify: reload nginx

  handlers:
    - name: reload nginx
      service:
        name: nginx
        state: reloaded
`

const WEB_VARS = `---
http_port: 80
welcome_message: "Welcome to the web tier"
`

const INDEX_J2 = `<!doctype html>
<html>
  <head><title>{{ welcome_message }}</title></head>
  <body>
    <h1>{{ welcome_message }}</h1>
    <p>Served by {{ inventory_hostname }} on port {{ http_port }}</p>
  </body>
</html>
`

export function createDefaultHosts() {
  return {
    web1: createHost('web1', { distro: 'Ubuntu', realAddress: '192.168.56.11' }),
    web2: createHost('web2', { distro: 'Ubuntu', realAddress: '192.168.56.12' }),
    db1: createHost('db1', { distro: 'Rocky', version: '9', realAddress: '192.168.56.21' }),
  }
}

export function createDefaultVfs() {
  return createVfs({
    'inventory.ini': DEFAULT_INVENTORY,
    'playbooks/site.yml': SITE_YML,
    'group_vars/webservers.yml': WEB_VARS,
    'templates/index.html.j2': INDEX_J2,
  })
}

export function createDefaultState() {
  return {
    hosts: createDefaultHosts(),
    vfs: createDefaultVfs(),
    vaultUnlocked: false,
  }
}
