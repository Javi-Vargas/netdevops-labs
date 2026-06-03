# Running the labs

Two ways to boot the labs — **plain Node** (no Docker) or **Docker**. Use
whichever you like; they edit the same source and both hot-reload. All commands
assume you start from the repository root (`netdevops-labs/`).

| Lab | URL |
|-----|-----|
| vyos-lab | http://localhost:5173 |
| ansible-lab | http://localhost:5174 |

> **One rule:** don't run the *same* lab via both methods at once — they share
> the same port. Stop one before starting the other. (ansible-lab uses a strict
> port and will refuse to start if 5174 is taken; vyos-lab would silently move to
> another port.)

---

## A) Without Docker

**Prerequisites:** Node.js 18+ and npm. Run `npm install` inside a lab the first
time only (or after its dependencies change); after that, `npm run dev` is enough.

### A1) Both labs
Open **two terminals**, one per lab.

Terminal 1:
```bash
cd vyos-lab
npm install        # first time only
npm run dev        # → http://localhost:5173
```

Terminal 2:
```bash
cd ansible-lab
npm install        # first time only
npm run dev        # → http://localhost:5174
```

### A2) Just the VyOS lab
```bash
cd vyos-lab
npm install        # first time only
npm run dev        # → http://localhost:5173
```

### A3) Just the Ansible lab
```bash
cd ansible-lab
npm install        # first time only
npm run dev        # → http://localhost:5174
```

**Stop:** press `Ctrl+C` in the terminal running the lab.

---

## B) With Docker

**Prerequisites:** Docker with Compose v2+ (`docker compose ...`). Run these from
the repository root, where `docker-compose.yml` lives. The first run builds the
images (a minute or two); later runs are fast. Source is bind-mounted, so edits
on your machine hot-reload in the browser.

### B1) Both labs
```bash
docker compose up            # foreground (logs in the terminal; Ctrl+C to stop)
# or
docker compose up -d         # background (detached)
```
→ vyos-lab on http://localhost:5173, ansible-lab on http://localhost:5174

### B2) Just the VyOS lab
```bash
docker compose up vyos-lab       # add -d to run in the background
```
→ http://localhost:5173

### B3) Just the Ansible lab
```bash
docker compose up ansible-lab    # add -d to run in the background
```
→ http://localhost:5174

**Stop:**
```bash
docker compose down          # stop AND remove the containers
# or
docker compose stop          # stop but keep them (faster to start again)
docker compose stop vyos-lab # stop just one
```

**Other handy commands:**
```bash
docker compose ps                  # what's running
docker compose logs -f vyos-lab    # follow a lab's logs
docker compose build ansible-lab   # rebuild after changing a lab's package.json
```

> The Docker dev servers publish only to `127.0.0.1` (your machine), not the LAN.

---

## Switching between the two methods

Because each lab uses a fixed port, stop one method before starting the other:

- Going **Docker → local**: `docker compose down`, then `npm run dev`.
- Going **local → Docker**: `Ctrl+C` the `npm run dev` process, then `docker compose up`.
