# cubemux

tmux-style multi-agent cockpit: a **3×2 grid of faces** that can fold into a rotatable transparent cube (GPU compositor — stub in MVP). Each face is independently typed as **`agent`** (Cursor SDK) or **`shell`** (interactive PTY).

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Control plane (CLI + JSON IPC)                             │
│  cubemux start | stop | status --json | attach | focus ...  │
└──────────────────────────┬──────────────────────────────────┘
                           │
         ┌─────────────────┴─────────────────┐
         ▼                                   ▼
┌─────────────────────┐            ┌─────────────────────┐
│  Session plane       │            │  Compositor plane    │
│  tmux dedicated      │            │  @cubemux/compositor │
│  socket, 3×2 panes   │            │  (stub — wgpu later) │
│  agent + shell faces │            │  face → cube mapping │
└─────────────────────┘            └─────────────────────┘
```

### Session plane (implemented)

- Dedicated tmux socket: `cubemux-<project>` (under `$XDG_RUNTIME_DIR/cubemux/` by default)
- One window with a **3×2 tiled grid** of panes
- Each pane is a **face** with its own `type`:

| Index | Default name | Default type | Role        |
|------:|--------------|--------------|-------------|
| 0     | Lead         | `agent`      | lead        |
| 1     | Impl A       | `agent`      | implementer |
| 2     | Impl B       | `agent`      | implementer |
| 3     | Review       | `agent`      | reviewer    |
| 4     | Test         | `agent`      | tester      |
| 5     | Ops          | `shell`      | ops         |

**Any face can be `agent` or `shell`** — configure per slot in `cubemux.toml` or at runtime with `cubemux face set`.

- **`shell`**: runs `$SHELL` (or `command` from config) in a real tmux PTY
- **`agent`**: runs the Cursor SDK face runner (`@cursor/sdk@1.0.26`) in the pane; without `CURSOR_API_KEY` it idles with a clear message

### Compositor plane (stub)

`packages/compositor` documents the **grid → cube face mapping** for a future wgpu renderer. `cubemux fold`, `unfold`, and `rotate` are stubs that update session state only.

Run `cubemux mapping` to print the mapping.

## Install

Requires **Node ≥ 22.13**, **pnpm**, and **tmux**.

```bash
pnpm install
pnpm build
```

Link the CLI locally:

```bash
pnpm --filter @cubemux/cli link --global
# or: node packages/cli/dist/index.js
```

## Configuration

Copy the example or edit `cubemux.toml` in your project root:

```toml
[session]
project = "my-app"

[[faces]]
index = 5
name = "Ops"
type = "shell"   # interactive shell in this pane

[[faces]]
index = 0
name = "Lead"
type = "agent"   # Cursor SDK agent in this pane
prompt = "You are the lead agent."
```

## CURSOR_API_KEY

Agent faces need a Cursor API key:

```bash
export CURSOR_API_KEY=your_key_here
```

Never commit keys. See `.env.example`. Without the key, agent faces stay open and print setup instructions; shell faces work normally.

## CLI usage

```bash
cubemux start                    # start 3×2 tmux grid
cubemux status                   # human-readable status
cubemux status --json            # JSON for orchestrators / Grok Bot
cubemux attach                   # attach to flat grid (no Kitty required)
cubemux focus --index 2
cubemux send --index 5 --text "ls -la"
cubemux capture --index 0
cubemux face get --index 5
cubemux face set --index 1 --type shell
cubemux stop
```

Stubs (compositor not built yet):

```bash
cubemux fold
cubemux unfold
cubemux rotate --axis y --degrees 90
cubemux mapping
```

## Grok Bot / orchestrator integration

Use **`cubemux status --json`** for machine-readable session state (running flag, socket paths, per-face `type`, tmux pane IDs).

IPC Unix socket (line-delimited JSON) is created on start at `.cubemux/<project>.ipc.sock`:

```json
{"method":"status"}
{"method":"focus","index":2}
{"method":"send","index":5,"text":"echo hello"}
{"method":"capture","index":0}
{"method":"face.get","index":1}
{"method":"face.set","index":3,"type":"shell"}
```

Responses: `{"ok":true,"data":...}` or `{"ok":false,"error":"..."}`.

Example Grok Bot flow:

1. `cubemux start` in the repo
2. Poll `cubemux status --json` until `running: true`
3. `cubemux send --index 0 --text "review the PR"` for the lead agent face
4. `cubemux capture --index 4` to read test face output
5. `cubemux attach` only when a human needs the full TUI

## Monorepo layout

```
packages/
  core/         # config, tmux session, IPC, agent face runner
  cli/          # cubemux binary
  compositor/   # GPU stub + cube mapping
cubemux.toml    # example config (mixed agent/shell)
scripts/smoke.mjs
```

## Development

```bash
pnpm test          # unit tests (config, face types, mapping)
pnpm smoke         # build + tmux lifecycle smoke test
pnpm typecheck
```

## License

MIT
