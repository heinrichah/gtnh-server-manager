# GTNH Server Manager

A cross-platform Electron desktop application for managing [GregTech: New Horizons](https://github.com/GTNewHorizons) (GTNH) Minecraft servers running on remote Linux machines. Connect via SSH and handle the full server lifecycle — installation, configuration, updates, log monitoring, and more — from a single GUI.

---

## Features

### Server Management
- Manage multiple remote servers from one interface
- SSH authentication via password or private key (with passphrase support)
- Connection testing before committing credentials
- Per-server status tracking with last-checked timestamp

### Server Control
- Start and stop the server (graceful `/stop` with reboot countdown abort)
- Send arbitrary console commands to a running server
- Real-time status polling (every 10 seconds)
- World wipe: delete `World/` and `config/JourneyMapServer/`

### Installation Wizard
Full automated installation of GTNH on a fresh Linux machine:

1. Update and upgrade system packages
2. Add Adoptium repository and install Temurin 21 JRE, `unzip`, `screen`
3. Create the server directory
4. Download the GTNH server archive (direct URL or GitHub artifact)
5. Extract files (handles GitHub's nested zip structure)
6. Set file permissions
7. Apply any configured drop-in mods
8. Accept the EULA

Live installation output is streamed to the UI. A 90-second watchdog resets stale installs.

### Update Wizard
Update an existing server to a new version:

1. Back up current server files
2. Remove old mods, configs, libraries, scripts
3. Download and extract the new version
4. Restore JourneyMap server config from backup
5. Set permissions
6. Re-apply drop-in mods
7. Clean up temp files

### Configuration Management

| Setting | Description |
|---|---|
| Memory | JVM min/max heap (`-Xms`/`-Xmx`) in GB, written to `startserver-java9.sh` |
| Pollution | Toggle the "Activate Pollution" flag in `GregTech/Pollution.cfg` |
| Backups | Enable, set interval (minutes), and set max backup count |
| Chunk Claiming | Enable/disable chunk claiming |
| Chunk Loading | Enable/disable chunk loading |
| Ranks | Enable/disable the ranks system |
| Server Properties | Raw `server.properties` editor |
| Whitelist | Add/remove players by name; UUID resolved via Mojang API (offline mode falls back to generated UUID) |
| Ops | Add/remove operators, same UUID resolution |
| Config Browser | Browse and edit any file in the remote `config/` directory |

Settings changes require the server to be stopped.

### Change Tracker
Every edit made through the config browser is recorded in `gtnh-manager-state.json` on the remote server. After an update, tracked changes can be reviewed and re-applied without manually hunting down each setting.

### Drop-in Mods
- Download mod JARs from any URL (via `wget` on the remote machine)
- Two deployment modes:
  - **Drop-in**: copy JAR into `mods/`
  - **Replace**: overwrite a specific existing mod file
- Mod metadata (source URL, mode, target) persisted in `mods-dropin/state.json`

### GitHub Integration
Browse and download build artifacts from `GTNewHorizons/DreamAssemblerXXL` (the official GTNH build pipeline) using a personal access token. Lists up to 50 recent artifacts with metadata.

### Log Viewer
- Real-time log streaming via a dedicated SSH connection
- Displays the last 200 lines on connect, then tails live
- Auto-scroll with manual override
- Detects `/fml confirm` prompts for one-click action
- Console input bar for sending commands without leaving the log view

---

## Limitations

- **Settings changes require a stopped server.** Writes to config files are blocked while the server is running.
- **Polling-based status.** The server status is checked every 10 seconds, so there is up to a 10-second latency on status changes.
- **GitHub token required for artifact downloads.** The `DreamAssemblerXXL` artifact list requires a valid GitHub personal access token.
- **Mojang UUID resolution has a 5-second timeout.** If the Mojang API is unreachable, a random UUID is generated instead (suitable for offline-mode servers).
- **No automatic update checking.** Updates must be triggered manually through the UI.
- **Credentials stored unencrypted.** SSH passwords and passphrases are stored in plain text in `gtnh-servers.json` in the Electron userData directory. See the Security section below.
- **Ubuntu and Debian only.** The installation wizard uses `apt-get` and assumes `sudo` (Ubuntu) or `su` (Debian) for privilege escalation. Other distributions are not supported.
- **Single screen session per host.** All managed servers on a given host must share the session name `MC`. Managing two GTNH servers on the same machine is not supported.
- **x64 architecture only.** Electron 31 does not ship ARM builds for all platforms.

---

## Getting Started

### Prerequisites

**Local machine:**
- Node.js 18 or later
- npm

**Remote server:**
- Ubuntu 20.04+ or Debian 10+
- SSH server enabled and reachable
- A user account with `sudo` (Ubuntu) or `su` (Debian) access
- Internet access for downloading packages and the server archive
- ~3 GB free disk space for a GTNH installation

### Install dependencies

```bash
npm install
```

### Run in development

```bash
npm run dev
```

Starts the Vite dev server on `http://localhost:5173` and launches Electron against it.

### Build for distribution

```bash
npm run build
npm run dist
```

Produces a Windows NSIS installer in `dist/`. The installer allows custom installation directory selection.

### Type checking

```bash
npm run typecheck
```

---

## Technical Specification

### Stack

| Layer | Technology | Version |
|---|---|---|
| Desktop shell | Electron | 31.0.2 |
| UI framework | React | 18.3.1 |
| Language | TypeScript | 5.4.5 |
| Build tool | Vite | 5.3.1 |
| Styling | Tailwind CSS | 3.4.4 |
| SSH client | node-ssh | 13.2.0 |
| State management | Zustand | 4.5.2 |
| Routing | React Router | 6.23.1 |
| UI primitives | Radix UI | various |
| Icons | Lucide React | 0.395.0 |
| Packaging | electron-builder | 24.13.3 |

### Project Structure

```
src/
├── main/                 # Electron main process (Node.js)
│   ├── index.ts          # App entry point, window creation
│   ├── preload.ts        # Typed IPC bridge exposed to renderer
│   ├── ipc/              # IPC handler files (9 modules)
│   ├── services/         # Business logic (8 service modules)
│   ├── store/            # JSON-file persistence layer
│   └── utils/
├── renderer/             # React frontend
│   ├── main.tsx
│   ├── App.tsx
│   ├── components/       # 21 React components
│   ├── hooks/            # useServerStatus, useLogStream, useSettings
│   ├── ipc/              # Type-safe IPC client wrappers
│   └── store/            # Zustand stores
└── shared/
    ├── types.ts           # Shared types and IPC channel constants
    └── cfg-parser.ts      # Round-trip config file parser
```

### Process Architecture

The application uses a standard Electron two-process model:

- **Main process** (Node.js): All SSH, file I/O, and OS operations. Exposes functionality via IPC.
- **Renderer process** (React): UI only. Communicates with main exclusively through the preload bridge.
- **Preload script**: Exposes a typed `window.api` object to the renderer. Context isolation is enabled; sandbox is disabled (required for SSH and file operations).

### IPC Channels

All channel names are defined as constants in `src/shared/types.ts`.

| Channel | Direction | Description |
|---|---|---|
| `servers:list` | invoke | List all saved server configs |
| `servers:create` | invoke | Create a new server |
| `servers:update` | invoke | Update server config |
| `servers:delete` | invoke | Delete a server |
| `servers:testConnection` | invoke | Test SSH with saved credentials |
| `servers:testDirect` | invoke | Test SSH with provided credentials |
| `control:start` | invoke | Start the server |
| `control:stop` | invoke | Graceful server stop |
| `control:status` | invoke | Get current running status |
| `control:send` | invoke | Send a console command |
| `control:wipeWorld` | invoke | Delete World and JourneyMapServer |
| `install:start` | invoke | Begin installation |
| `install:progress` | push | Streaming installation step updates |
| `update:start` | invoke | Begin update |
| `update:progress` | push | Streaming update step updates |
| `settings:read` | invoke | Read all settings from remote |
| `settings:persist` | invoke | Write settings to remote |
| `whitelist:read` | invoke | Get whitelist entries |
| `whitelist:add` | invoke | Add a player |
| `whitelist:remove` | invoke | Remove a player |
| `ops:read` | invoke | Get ops list |
| `ops:add` | invoke | Add an operator |
| `ops:remove` | invoke | Remove an operator |
| `logs:start` | invoke | Start log streaming |
| `logs:stop` | invoke | Stop log streaming |
| `logs:chunk` | push | Live log data chunks |
| `configs:listDir` | invoke | List remote directory contents |
| `configs:read` | invoke | Read a remote config file |
| `configs:write` | invoke | Write a remote config file (with optional change tracking) |
| `tracker:read` | invoke | Get tracked config changes |
| `tracker:remove` | invoke | Remove a tracked change entry |
| `tracker:reapply` | invoke | Re-apply tracked changes to remote files |
| `github:listArtifacts` | invoke | List DreamAssemblerXXL artifacts |
| `mods-dropin:read` | invoke | Get drop-in mod state |
| `mods-dropin:download` | invoke | Download a mod JAR to the remote |
| `mods-dropin:delete` | invoke | Remove a drop-in mod |
| `mods-dropin:configure` | invoke | Set mode/target for a mod |
| `mods-dropin:apply` | invoke | Copy all configured mods to `mods/` |

### Services

| Service | Responsibility |
|---|---|
| `ssh.service.ts` | Connection pool, command execution, streaming, file upload/download |
| `screen.service.ts` | GNU screen session lifecycle (start, stop, status, send command) |
| `config.service.ts` | Read/write all server config files, whitelist, ops, Mojang UUID resolution |
| `install.service.ts` | Full installation orchestration with progress streaming |
| `update.service.ts` | Update orchestration with backup and JourneyMap config preservation |
| `modsDropin.service.ts` | Mod download, state persistence, deployment (dropin/replace) |
| `configTracker.service.ts` | Record, persist, and re-apply config field changes |

### Persistent Storage

**Local** — Electron userData (`~/.config/gtnh-server-manager/` on Linux, `%APPDATA%\gtnh-server-manager\` on Windows):

`gtnh-servers.json` — array of server configurations including SSH credentials, install path, installed version, and last known status.

**Remote** — stored inside `${installPath}/` on the server:

`gtnh-manager-state.json` — tracks which config fields were modified and when, for re-application after updates.

`mods-dropin/state.json` — tracks downloaded drop-in mods (source URL, mode, replace target).

### SSH Commands Executed

All commands are executed on the remote server over SSH.

**Package management (installation only):**
```bash
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get upgrade -y
apt-get install -y gnupg wget
wget -qO - https://packages.adoptium.net/.../key/public | gpg --batch --yes --dearmor -o /etc/apt/trusted.gpg.d/adoptium.gpg
echo "deb https://packages.adoptium.net/artifactory/deb $VERSION_CODENAME main" | tee /etc/apt/sources.list.d/adoptium.list
apt-get install -y temurin-21-jre unzip screen
```

**File system:**
```bash
rm -rf ${filesPath} && mkdir -p ${filesPath}
chmod -R 777 ${filesPath}
ls -1p "${dir}" 2>/dev/null
cat ${remotePath}
cat > ${remotePath} << 'GTNH_EOF'
${content}
GTNH_EOF
```

**Download and extract:**
```bash
wget -O /tmp/gtnh-server.zip ${url}
# GitHub artifact download (with bearer token):
curl -fL --progress-bar -H "Authorization: Bearer ${token}" -H "Accept: application/octet-stream" -o /tmp/gtnh-server.zip ${apiUrl}
unzip -o /tmp/gtnh-server.zip -d ${filesPath}
```

**Server lifecycle (GNU screen):**
```bash
# Status check:
screen -ls 2>/dev/null | grep -q "\.MC" && echo running || echo stopped

# Start (with log capture):
rm -f /tmp/gtnh-screen.log && cd ${filesPath}/server-files && screen -L -Logfile /tmp/gtnh-screen.log -dmS MC ./startserver-java9.sh

# Attach log to existing session:
screen -S MC -X logfile /tmp/gtnh-screen.log 2>/dev/null
screen -S MC -X log on 2>/dev/null

# Stop:
screen -S MC -X stuff "$(printf '/stop\r')"

# Send command:
screen -S MC -X stuff "$(printf '${command}\r')"

# Kill session:
screen -S MC -X quit

# Tail log:
tail -n 200 -F /tmp/gtnh-screen.log 2>/dev/null
```

**Memory configuration:**
```bash
sed -i \
  -e 's/-Xms[0-9]*[GgMm]/-Xms${min}G/g' \
  -e 's/-Xmx[0-9]*[GgMm]/-Xmx${max}G/g' \
  ${filesPath}/server-files/startserver-java9.sh
```

**World wipe:**
```bash
rm -rf ${filesPath}/server-files/World ${filesPath}/server-files/config/JourneyMapServer
```

**Drop-in mods:**
```bash
mkdir -p ${dropin} && wget -O ${destPath} ${url}
cp -f ${src} ${dst}
```

**Update process:**
```bash
# Backup:
cp -r ${filesPath} ${backupPath}

# Remove old files:
cd ${filesPath}/server-files && rm -rf config libraries mods resources scripts
rm -f startserver.sh startserver-java9.sh startserver-java9.bat java9args.txt lwjgl3ify-forgePatches.jar

# Restore new files (repeated per directory):
cp -r /tmp/gtnh-update/config ${filesPath}/server-files/
cp -r /tmp/gtnh-update/mods   ${filesPath}/server-files/
# ... libraries, resources, scripts

# Restore scripts:
cp /tmp/gtnh-update/startserver*.sh /tmp/gtnh-update/*.bat ${filesPath}/server-files/
```

**Privilege escalation:**
```bash
# Ubuntu:
echo ${password} | sudo -S ${cmd}

# Debian:
echo ${password} | su - -c ${cmd}
```

### Electron Window Defaults

| Property | Value |
|---|---|
| Default size | 1280 × 800 |
| Minimum size | 900 × 600 |
| Background colour | `#0f172a` |
| Title | GTNH Server Manager |
| App ID | `com.gtnh.server-manager` |
| Dev server port | 5173 |

### Build Output

| Target | Path |
|---|---|
| Renderer bundle | `dist/renderer/` |
| Main process | `dist/main/` |
| Windows installer | `dist/GTNH Server Manager Setup x.x.x.exe` |

---

## Security Notes

- **Credentials at rest:** SSH passwords and key passphrases are stored unencrypted in `gtnh-servers.json` in the Electron userData directory. The file is only accessible to the current OS user, but it is not additionally encrypted.
- **Credentials in transit (IPC):** Passwords and passphrases are redacted (`••••••••`) in all IPC responses sent to the renderer process.
- **GitHub tokens:** Stored alongside server credentials in `gtnh-servers.json`.
- **Context isolation:** Enabled. The renderer cannot directly access Node.js APIs.
- **Sandbox:** Disabled (required for SSH and file system operations in the main process).
- **Command injection:** All remote commands are constructed in the main process from typed inputs; the renderer cannot submit arbitrary shell commands except through the designated "send console command" channel, which forwards input verbatim to the screen session.