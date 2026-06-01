// Guided, teaching-first tutorials. `setup()` returns the engine state to load;
// `validation(state)` inspects real host/VFS state; `solution` drives tests.
import { baseState, installed, running, fileExists, fileHas, vfsHas, ok } from './scenarioHelpers'

const TEMPLATE_YML = `---
- name: Templated web config
  hosts: webservers
  become: true
  vars:
    packages:
      - nginx
      - curl
  tasks:
    - name: Install packages (loop)
      package:
        name: "{{ item }}"
        state: present
      loop: "{{ packages }}"

    - name: Render index from a Jinja2 template
      template:
        src: templates/index.html.j2
        dest: /etc/nginx/index.html

    - name: Report the port
      debug:
        msg: "nginx will serve on port {{ http_port }}"
`

const ROLE_TASKS = `---
- name: Install Apache
  package:
    name: "{{ apache_pkg }}"
    state: present

- name: Start and enable Apache
  service:
    name: "{{ apache_pkg }}"
    state: started
    enabled: true

- name: Deploy a page that carries the secret
  copy:
    content: "secret token: {{ api_token }}"
    dest: /var/www/secret.txt
`

const ROLE_DEFAULTS = `---
apache_pkg: httpd
`

const ROLE_PLAYBOOK = `---
- name: Apply the apache role
  hosts: dbservers
  become: true
  vars_files:
    - secrets.yml
  roles:
    - apache
`

const PLAIN_SECRETS = `---
api_token: s3cr3t-token
`

export const tutorials = [
  {
    id: 'tut-inventory-adhoc',
    title: 'Inventory & ad-hoc commands',
    category: 'tutorial',
    difficulty: 'beginner',
    duration: '6 min',
    description: 'Meet the fleet, then drive it with one-off ad-hoc commands and host patterns.',
    brief: 'Ping the hosts, gather facts, then use ad-hoc modules to actually change them.',
    steps: [
      { instruction: 'Confirm every host is reachable.', cmd: 'ansible all -m ping', note: 'pong = the control node can reach it.' },
      { instruction: 'Gather facts from the webservers.', cmd: 'ansible webservers -m setup', note: 'Facts like ansible_os_family drive conditionals later.' },
      { instruction: 'Visualize the inventory groups.', cmd: 'ansible-inventory --graph' },
      { instruction: 'Use an ad-hoc module to create a marker file on ALL hosts.', cmd: 'ansible all -m file -a "path=/tmp/ansible-was-here state=touch"' },
      { instruction: 'Install a package on the webservers (needs become).', cmd: 'ansible webservers -m package -a "name=htop state=present" -b', note: 'Without -b this fails with permission denied — try it!' },
    ],
    objectives: [
      'Marker file /tmp/ansible-was-here exists on web1, web2 and db1',
      'Package htop is installed on the webservers',
    ],
    commands: [
      { cmd: 'ansible all -m ping', why: 'Verify connectivity.' },
      { cmd: 'ansible all -m file -a "path=/tmp/ansible-was-here state=touch"', why: 'Create a file on every host.' },
      { cmd: 'ansible webservers -m package -a "name=htop state=present" -b', why: 'Install htop on the web group, with sudo.' },
    ],
    setup: () => baseState(),
    solution: {
      commands: [
        'ansible all -m file -a "path=/tmp/ansible-was-here state=touch"',
        'ansible webservers -m package -a "name=htop state=present" -b',
      ],
    },
    validation: (s) => [
      ok(['web1', 'web2', 'db1'].every(h => fileExists(s, h, '/tmp/ansible-was-here')), 'marker on all hosts'),
      ok(installed(s, 'web1', 'htop') && installed(s, 'web2', 'htop'), 'htop on webservers'),
    ],
  },

  {
    id: 'tut-first-playbook',
    title: 'Your first playbook',
    category: 'tutorial',
    difficulty: 'beginner',
    duration: '8 min',
    description: 'Run a playbook that installs and starts nginx and deploys a page — then see idempotency.',
    brief: 'playbooks/site.yml installs nginx, starts it, and deploys an index page with a handler. Run it, then run it again.',
    steps: [
      { instruction: 'Read the playbook (also openable in the Files tab).', cmd: 'cat playbooks/site.yml' },
      { instruction: 'Run it.', cmd: 'ansible-playbook playbooks/site.yml', note: 'Watch the PLAY RECAP: changed=3 on each web host.' },
      { instruction: 'Run it AGAIN.', cmd: 'ansible-playbook playbooks/site.yml', note: 'Now changed=0 — Ansible is idempotent. The handler does not fire.' },
      { instruction: 'Preview changes without applying them.', cmd: 'ansible-playbook playbooks/site.yml --check' },
    ],
    objectives: [
      'nginx is installed on web1 and web2',
      'nginx service is started on web1 and web2',
      'The index page is deployed to /var/www/html/index.html',
    ],
    commands: [
      { cmd: 'cat playbooks/site.yml', why: 'Understand the play, tasks, and handler.' },
      { cmd: 'ansible-playbook playbooks/site.yml', why: 'Apply the configuration (idempotent on re-run).' },
    ],
    setup: () => baseState(),
    solution: { commands: ['ansible-playbook playbooks/site.yml'] },
    validation: (s) => [
      ok(installed(s, 'web1', 'nginx') && installed(s, 'web2', 'nginx'), 'nginx installed'),
      ok(running(s, 'web1', 'nginx') && running(s, 'web2', 'nginx'), 'nginx started'),
      ok(fileExists(s, 'web1', '/var/www/html/index.html') && fileExists(s, 'web2', '/var/www/html/index.html'), 'index deployed'),
    ],
  },

  {
    id: 'tut-vars-templates',
    title: 'Variables, loops & templates',
    category: 'tutorial',
    difficulty: 'intermediate',
    duration: '9 min',
    description: 'Install a list of packages with a loop and render a config file from a Jinja2 template using group variables.',
    brief: 'playbooks/template.yml loops over a package list and renders templates/index.html.j2 using vars from group_vars/webservers.yml.',
    steps: [
      { instruction: 'Look at the group variables.', cmd: 'cat group_vars/webservers.yml', note: 'http_port and welcome_message are available to webservers.' },
      { instruction: 'Look at the template.', cmd: 'cat templates/index.html.j2', note: 'It uses {{ welcome_message }}, {{ inventory_hostname }}, {{ http_port }}.' },
      { instruction: 'Run the playbook.', cmd: 'ansible-playbook playbooks/template.yml', note: 'The loop installs nginx and curl; the template renders per-host.' },
      { instruction: 'Edit group_vars/webservers.yml in the Files tab, change welcome_message, and re-run to see the template change.' },
    ],
    objectives: [
      'nginx and curl are installed on the webservers (loop)',
      'The template rendered to /etc/nginx/index.html with the welcome message',
    ],
    commands: [
      { cmd: 'cat group_vars/webservers.yml', why: 'See the variables the play will use.' },
      { cmd: 'ansible-playbook playbooks/template.yml', why: 'Loop install + template render.' },
    ],
    setup: () => baseState({ 'playbooks/template.yml': TEMPLATE_YML }),
    solution: { commands: ['ansible-playbook playbooks/template.yml'] },
    validation: (s) => [
      ok(installed(s, 'web1', 'nginx') && installed(s, 'web1', 'curl') && installed(s, 'web2', 'curl'), 'loop installed nginx+curl'),
      ok(fileHas(s, 'web1', '/etc/nginx/index.html', 'Welcome to the web tier'), 'template rendered'),
    ],
  },

  {
    id: 'tut-roles-vault',
    title: 'Roles & Vault',
    category: 'tutorial',
    difficulty: 'advanced',
    duration: '10 min',
    description: 'Apply a reusable role to the database host, then protect its secrets file with Ansible Vault.',
    brief: 'The apache role installs/starts httpd and writes a secret page. After applying it, encrypt secrets.yml so the token is not stored in plaintext.',
    steps: [
      { instruction: 'Inspect the pre-scaffolded role (ansible-galaxy init creates this layout).', cmd: 'cat roles/apache/tasks/main.yml' },
      { instruction: 'Apply the role to the dbservers.', cmd: 'ansible-playbook playbooks/role.yml', note: 'httpd is installed and started on db1.' },
      { instruction: 'See the secret currently sits in plaintext.', cmd: 'cat secrets.yml' },
      { instruction: 'Encrypt it with Vault.', cmd: 'ansible-vault encrypt secrets.yml', note: 'View it again with: ansible-vault view secrets.yml' },
    ],
    objectives: [
      'httpd is installed on db1 via the role',
      'httpd service is started on db1',
      'secrets.yml is encrypted with Ansible Vault',
    ],
    commands: [
      { cmd: 'ansible-galaxy init apache', why: 'Scaffold a role (already provided here).' },
      { cmd: 'ansible-playbook playbooks/role.yml', why: 'Apply the role to dbservers.' },
      { cmd: 'ansible-vault encrypt secrets.yml', why: 'Protect the secret at rest.' },
    ],
    setup: () => baseState({
      'roles/apache/tasks/main.yml': ROLE_TASKS,
      'roles/apache/defaults/main.yml': ROLE_DEFAULTS,
      'playbooks/role.yml': ROLE_PLAYBOOK,
      'secrets.yml': PLAIN_SECRETS,
    }),
    solution: { commands: ['ansible-playbook playbooks/role.yml', 'ansible-vault encrypt secrets.yml'] },
    validation: (s) => [
      ok(installed(s, 'db1', 'httpd'), 'httpd installed via role'),
      ok(running(s, 'db1', 'httpd'), 'httpd started'),
      ok(vfsHas(s, 'secrets.yml', '$ANSIBLE_VAULT'), 'secrets.yml encrypted'),
    ],
  },
]
