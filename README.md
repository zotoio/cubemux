# cubemux

tmux-style multi-agent cockpit: a **3×2 grid of faces** that fold into a **rotatable transparent cube** (wgpu viewer). Each face is independently typed as **`agent`** (Cursor SDK) or **`shell`** (interactive PTY).

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Control plane (CLI + JSON IPC)                             │
│  cubemux start | fold | rotate | status --json | attach ... │
└──────────────────────────┬──────────────────────────────────┘
                           │
         ┌─────────────────┴─────────────────┐
         ▼                                   ▼
┌─────────────────────┐            ┌─────────────────────┐
│  Session plane       │            │  Compositor plane    │
│  tmux dedicated      │            │  cubemux-cube-viewer │
│  socket, 3×2 panes   │            │  (Rust wgpu + winit) │
│  agent + shell faces │            │  transparent window  │
└─────────────────────┘            └─────────────────────┘
```

### Session plane

- Dedicated tmux socket: `cubemux-<project>` (under `$XDG_RUNTIME_DIR/cubemux/` by default)
- One window with a **3×2 tiled grid** of panes
- `cubemux attach` — flat grid TUI (works in Grok Bot box terminals without Kitty)

| Index | Default name | Default type | Cube face |
|------:|--------------|--------------|-----------|
| 0     | Lead         | `agent`      | Front     |
| 1     | Impl A       | `agent`      | Right     |
| 2     | Impl B       | `agent`      | Back      |
| 3     | Review       | `agent`      | Left      |
| 4     | Test         | `agent`      | Top       |
| 5     | Ops          | `shell`      | Bottom    |

**Any face can be `agent` or `shell`** — configure per slot in `cubemux.toml` or at runtime with `cubemux face set`.

### Compositor plane (wgpu cube viewer)

`packages/cube-viewer` is a native **transparent wgpu/winit window** that:

- Samples live tmux pane text via `tmux capture-pane` every ~250ms
- Rasterizes terminal output to per-face textures (monospace font)
- Renders six translucent cube faces (default alpha **0.85**; active face **0.95**)
- Animates **fold** (flat 3×2 grid → cube) and **unfold** (cube → grid)
- Supports **mouse drag** and **arrow keys** for yaw/pitch; CLI `rotate --yaw/--pitch` updates `state.json`

**Terminal paths:**

| Path | Status |
|------|--------|
| Native wgpu transparent window (Linux desktop) | **Implemented** — default for `cubemux fold` / `cubemux cube` |
| Kitty graphics protocol | Planned — would stream GPU textures directly into Kitty |
| `cubemux attach` flat tmux grid | Always available; independent of cube viewer |

## Install

Requires **Node ≥ 22.13**, **pnpm**, **tmux**, **Rust ≥ 1.83** (for cube viewer), and a monospace font (e.g. `fonts-dejavu-core`).

```bash
pnpm install
pnpm build          # builds Rust viewer + TypeScript packages
```

Link the CLI locally:

```bash
pnpm --filter @cubemux/cli link --global
# or: node packages/cli/dist/index.js
```

## Cube usage

```bash
cubemux start                         # tmux 3×2 grid
cubemux fold                          # fold into cube + open wgpu viewer
cubemux rotate --yaw 30 --pitch 10    # headless rotation (GUI reads state.json)
cubemux cube                          # open viewer without changing fold flag
cubemux unfold                        # animate back + close viewer
cubemux attach                        # flat grid (still works alongside cube)
```

**Viewer controls** (when cube window is focused):

- Drag with left mouse — yaw/pitch
- Arrow keys — rotate
- `0`–`5` — highlight face (more opaque)
- `Esc` — close viewer

## Configuration

See `cubemux.toml` for mixed agent/shell faces. Agent faces use `@cursor/sdk@1.0.26` and need `CURSOR_API_KEY`:

```bash
export CURSOR_API_KEY=your_key_here
```

Never commit keys. See `.env.example`.

## CLI reference

```bash
cubemux start | stop | status [--json] | attach
cubemux focus --index N | send --index N --text "..." | capture --index N
cubemux face get|set --index N [--type agent|shell]
cubemux fold | unfold | cube
cubemux rotate [--yaw N] [--pitch N]   # or legacy --axis y --degrees 90
cubemux mapping
```

## Grok Bot / orchestrator integration

`cubemux status --json` returns `folded`, `foldProgress`, `rotation.{yaw,pitch}`, `viewerRunning`, and per-face metadata.

IPC Unix socket at `.cubemux/<project>.ipc.sock` (line-delimited JSON):

```json
{"method":"status"}
{"method":"fold"}
{"method":"unfold"}
{"method":"rotate","yaw":15,"pitch":-5}
{"method":"focus","index":2}
{"method":"send","index":5,"text":"echo hello"}
{"method":"capture","index":0}
{"method":"face.set","index":3,"type":"shell"}
```

Fold/unfold/rotate work **without a GUI** — state is persisted for the viewer to pick up when opened.

## Monorepo layout

```
packages/
  core/           # config, tmux session, IPC, viewer launcher
  cli/            # cubemux binary
  compositor/     # cube mapping + Compositor API
  cube-viewer/    # Rust wgpu transparent cube (cubemux-cube-viewer)
cubemux.toml
scripts/smoke.mjs
```

## Development

```bash
pnpm build:viewer   # cargo build --release only
pnpm test           # unit tests (mapping, fold state, config)
pnpm smoke          # tmux + fold/rotate/unfold lifecycle
pnpm typecheck
```

## License

MIT
