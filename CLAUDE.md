# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

This repo is the **implementation** of **Delightify** — a ModPack IDE / "intent compiler" desktop app for Minecraft modpack authors. **Delightify is the product name**; "ModPack IDE" describes the product category and the planning/spec direction, not a replacement name. Electron + React + TypeScript, pnpm/Turborepo monorepo, with the NeoForge runtime exporter vendored as `packages/exporter`. **It is early-stage.**

## ⚠️ The repo's docs are mostly PLANNING, not built — verify before trusting

This repo carries extensive archived Delightify planning docs (`docs/archive/planning/`, `docs/archive/import-engine/`, etc.) describing older intended architecture: two-tier `global.db`/`project.db`, a `data`/`semantic` relations system with global-recommendation + project-override, a three-strategy JAR parser, recipe-type metadata, etc. **Most of this is NOT current implementation.** Treat archived docs as background only, and treat roadmap "done" claims as historical unless verified against code.

- **First task for any new session: establish ground truth by reading the actual code** — `packages/main/src/{services,ipc}`, database/schema code, `packages/renderer/src/pages`, and `packages/exporter` — to see what truly exists vs. what's only planned. Do not build on a doc's claim without confirming the code.
- Concretely present **as code** (functional completeness UNVERIFIED — read/run before trusting): `packages/main/src/services/{database, mod-data-importer, unify, export, llm (+providers), recipe-types, config, paths}`, `ipc/{items,recipes,recipe-types,mod-data,project,unify,export,debug}`, **8 renderer pages** (Dashboard, ModManager, ProjectManager, ItemBrowser, RecipeBrowser, RecipeEditor, ConversionTool, DebugTools), and the NeoForge exporter in `packages/exporter`. This is a **real (if early) app, not a bare skeleton** — but how much actually works vs. stub/partial must still be verified from code and commands.

## The design spec (read this) — vendored locally + canonical vault

The full v0 spec is **vendored locally** at **`docs/spec-snapshot/`** (`设计/01–10` + `例子/01–05`, read-only snapshot @2026-06-13) — read it there. The **canonical** source is the Obsidian planning vault at:
`/Users/aeroseira/Library/Mobile Documents/iCloud~md~obsidian/Documents/MC-Workbench/Projects/ModPack IDE/` (the planning vault still uses the product-category name; may be newer; if in doubt it wins; re-copy to refresh).

- `设计/01-核心设计与决策模型.md` = **single source of truth**; `设计/03–10` = complete spec (Intent Spec, engine semantics, guided-planning, data layer, KubeJS output, UI, LLM/Agent, MVP roadmap); `例子/01–05` = behavioral specs / test cases. **Implement against that spec.**
- One-line direction: author states a *goal* → Agent perceives the modpack, classifies each case semantically, plans how to apply it pack-wide. **(a) semantic recognition + (b) execution planning = Agent's job; (c) design/balance judgment = author's.** High-confidence+low-risk → auto (reviewable); uncertain/high-blast-radius → defer queue; over-broad/mostly-(c) requests → guided planning (read-only decision-support view).
- Note: the spec's `设计/10` defines **MVP-0 = offline ingest one modpack → catalog/graph → ONE workflow (unify same-named items) end-to-end → reviewable diff → KubeJS output**. That's the recommended first build target. Most of the data layer (`设计/06`) is still ahead — Delightify's *planned* three-strategy parser is a useful reference design, but appears unbuilt; verify.

## Useful alignment (intent-level, not built)

The Delightify *planned* architecture happens to align well with the spec, so its planning docs are a good design reference: the `data`/`semantic` relations + global-recommendation/project-override + confidence/top-k/provenance model ≈ the spec's Intent-Spec decision model (`设计/03`) and Agent layer (`设计/09`) — `data:*` = deterministic facts, `sem:*` = Agent proposals the author accepts/overrides. Building this is ahead of us, not behind.

## Commands

```bash
pnpm install          # Node >=18, pnpm >=9
pnpm dev              # build all + launch Electron (fastest preview)
pnpm dev:full         # Vite HMR + Electron (frontend dev; localhost:5173 auto-detected)
pnpm dev:web          # Vite only, in browser
pnpm dev:safe         # Electron with GPU accel disabled (compat testing)
pnpm build            # turbo run build  (the `shared` package must build first)
pnpm typecheck        # turbo run typecheck  — this is what CI runs
pnpm clean
pnpm dist:win | dist:mac | dist:linux   # package
pnpm exporter:build   # build the NeoForge exporter in packages/exporter
pnpm exporter:compile # compile Java only
pnpm exporter:runClient | exporter:runServer
```
**No unit-test command exists** — CI only runs `pnpm typecheck`. Verify changes by `pnpm typecheck` + building/running the app.

## Intended architecture (per docs — confirm against code)

- **Monorepo**: `packages/shared` (cross-process TS types + IPC channel constants) → `packages/main` (Electron main: `ipc/` handlers, `services/`, `fs/` AppPaths) + `packages/renderer` (React + Vite: `pages/`) + `packages/exporter` (NeoForge 1.21.1 runtime data exporter, Gradle/Java 21).
- **IPC**: Electron `contextBridge`/preload only (no `nodeIntegration`); channels whitelisted in `packages/shared/src/constants/ipc.ts`; handlers return `{ success, data?, error? }`.
- **Data**: a DB layer exists at `services/database/` (schema.ts, client.ts, schema-manager.ts) using Drizzle over libsql; AppPaths in `services/paths.ts`. Current MVP-0 work is project-db/exporter-v1-first; archived `global.db` / graph/relations plans are not current ground truth.

## Locked decisions (from the spec; see `设计/01` §2,§6 and `设计/04` §2)

- **Output**: multi-backend IR; **v1 = KubeJS emitter** (datapack/Almost Unified later).
- **v1 action tiers**: auto-executable `scale / replace_ingredient / remove(hide) / retag / rename` + composites `unify / harmonize / differentiate / 输入集校正`; **detect-and-defer only**: `add_bridge_recipe / change_recipe_type / add_item / remove_item`.
- **Safety discipline (non-negotiable)**: classify-then-act → confidence×risk gating → defer when unsure (never silently guess) → transparent decision ledger → dry-run/diff → reversible.
- **Data strategy**: offline-first; runtime export / vector search / ONNX embeddings deferred, off the v1 critical path.

## Conventions

- **Respond in Chinese.** Repo comments/docs are Chinese; match them.
- Shared types in `packages/shared/src/types/`; keep DB schema and types in sync.
- Doc landscape: start at `docs/README.md`. Current decisions live in `docs/current/`; the vendored spec lives in `docs/spec-snapshot/`; old planning, stale audits and legacy implementation logs live in `docs/archive/`.
