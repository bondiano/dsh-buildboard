# @local/dsh-cult-canvas

Interactive whiteboard canvas plugin for DeepSeek Harness (DSH).
Combines freehand spatial whiteboard capabilities inspired by `cult-canvas` with the node-based multimedia generation pipeline of `dsh-infinite_canvas`, packaged following the architecture and quality standards of `dsh-role-team`.

## Features

- **Spatial Whiteboard**: Sticky notes, 7 geometric shapes with text padding compensation, borderless text cards with Shantell-like typography, freehand marker strokes with outline smoothing and eraser collision detection, and group containers.
- **Media Generation Pipeline**: Directed graph workflow nodes (script, storyboard, image, video, audio, finalcut) connected via typed semantic ports.
- **JSON Canvas 1.0 Compatibility**: Full bidirectional serialization and deserialization between native canvas models and the open `.canvas` specification.
- **Agent Tools**: Rich programmatic tools for DeepSeek Harness AI agents to read, inspect, modify, wire, and execute canvas nodes.
- **Strict Quality Gates**: Zero runtime dependencies, 100% strict TypeScript typing, and zero oxlint warnings.

## Architecture

- `types.ts`: Ambient and structural contracts for Cordis, DSH WebServer, client modules, whiteboard elements, pipeline nodes, ports, edges, and JSON Canvas 1.0.
- `canvas-model.ts`: Unified whiteboard and pipeline node models, stroke math, shape geometry helpers, in-memory `CanvasStore`, and JSON Canvas adapter.
- `graph-engine.ts`: Directed acyclic graph (DAG) sorting, cycle detection, and dependency resolution.
- `pipeline-engine.ts`: Shot segmentation, prompt assembly, bible entity matching, and node execution state machine.
- `web-route-auth.ts`: Authenticated web server wrapper enforcing loopback and LAN safety checks.
- `tools.ts`: DSH agent tools for programmatic inspection and manipulation.
- `index.ts`: Host plugin entrypoint with Cordis lifecycle hooks and disposer tracking.
- `client.ts`: Client web shell module registered via `window.__ModuleLoader__`.
