# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

This repo is the **implementation** of **ModPack IDE** — an "intent compiler" desktop app for Minecraft modpack authors. It was forked from an unfinished visual recipe-modding workbench called **Delightify**, so most code, branding, and docs still say "Delightify" — **same project, current direction is "ModPack IDE"**. Electron + React + TypeScript, pnpm/Turborepo monorepo. **It is early-stage.**

## ⚠️ The repo's docs are mostly PLANNING, not built — verify before trusting

This repo carries extensive Delightify docs (`AGENTS.md`, `docs/project-structure.md`, `docs/roadmap.md`, etc.) describing an intended architecture: two-tier `global.db`/`project.db`, a `data`/`semantic` relations system with global-recommendation + project-override, a three-strategy JAR parser, recipe-type metadata, etc. **Per the project owner, most of this is NOT implemented yet.** Treat those docs as *design intent*, and treat roadmap "✅ done" claims as **unverified**.

- **First task for any new session: establish ground truth by reading the actual code** — `packages/main/src/{services,ipc}`, any database/schema code, `packages/renderer/src/pages`, and the Java tool — to see what truly exists vs. what's only planned. Do not build on a doc's claim without confirming the code. → A ready-made step-by-step is in **`docs/启动清单-审计与MVP0.md`** (run it → read key files → verify each feature → audit → define MVP-0).
- Concretely present **as code** (functional completeness UNVERIFIED — read/run before trusting): `packages/main/src/services/{database (schema/client/schema-manager/batch-save), mod-data-importer, llm (+providers), recipe-types, config, paths}`, `ipc/{items,recipes,recipe-types,mod-data,project,debug}`, and **8 renderer pages** (Dashboard, ModManager, ProjectManager, ItemBrowser, RecipeBrowser, RecipeEditor, ConversionTool, DebugTools). Plus the Java bytecode analyzer (`com.delightify.modinspector`, item/block registrations). ~14.6k lines TS total; single commit "initial commit from Delightify v0.3". So this is a **real (if early) app, not a bare skeleton** — but how much actually works vs. stub/partial is unverified, and the owner states most of the *ambitious planned* architecture (the data/semantic relations graph, two-tier override model, agent migration) is not done. Note the code already moved toward a **`mod-data-importer`** (not a raw "jar-parser"), matching `ARCHITECTURE_REFACTOR_PLAN.md`.

## The design spec (read this) — vendored locally + canonical vault

The full v0 spec is **vendored locally** at **`docs/spec-snapshot/`** (`设计/01–10` + `例子/01–05`, read-only snapshot @2026-06-13) — read it there. The **canonical** source is the Obsidian planning vault at:
`/Users/aeroseira/Library/Mobile Documents/iCloud~md~obsidian/Documents/MC-Workbench/Projects/ModPack IDE/` (may be newer; if in doubt it wins; re-copy to refresh).

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
```
**No unit-test command exists** — CI only runs `pnpm typecheck`. Verify changes by `pnpm typecheck` + building/running the app.

## Intended architecture (per docs — confirm against code)

- **Monorepo**: `packages/shared` (cross-process TS types + IPC channel constants) → `packages/main` (Electron main: `ipc/` handlers, `services/`, `fs/` AppPaths) + `packages/renderer` (React + Vite: `pages/`).
- **IPC**: Electron `contextBridge`/preload only (no `nodeIntegration`); channels whitelisted in `packages/shared/src/constants/ipc.ts`; handlers return `{ success, data?, error? }`.
- **Data**: a DB layer exists at `services/database/` (schema.ts, client.ts, schema-manager.ts, batch-save.ts) using Drizzle over libsql; AppPaths in `services/paths.ts`. Intended two-tier `global.db` / per-modpack `project.db` — confirm how much of the two-tier + graph/relations schema is actually implemented vs. just the basic tables.

## Locked decisions (from the spec; see `设计/01` §2,§6 and `设计/04` §2)

- **Output**: multi-backend IR; **v1 = KubeJS emitter** (datapack/Almost Unified later).
- **v1 action tiers**: auto-executable `scale / replace_ingredient / remove(hide) / retag / rename` + composites `unify / harmonize / differentiate / 输入集校正`; **detect-and-defer only**: `add_bridge_recipe / change_recipe_type / add_item / remove_item`.
- **Safety discipline (non-negotiable)**: classify-then-act → confidence×risk gating → defer when unsure (never silently guess) → transparent decision ledger → dry-run/diff → reversible.
- **Data strategy**: offline-first; runtime export / vector search / ONNX embeddings deferred, off the v1 critical path.

## Conventions

- **Respond in Chinese.** Repo comments/docs are Chinese; match them.
- Shared types in `packages/shared/src/types/`; keep DB schema and types in sync.
- Doc landscape: `AGENTS.md` + `docs/` (project-structure, tech-stack/ADR, roadmap, import-engine, multi-loader, registration-patterns) are **planning/intent** references — useful, but not proof of built code. `README.md`/`DEVELOPER_GUIDE.md` are intro material. Stale process/bug-fix/packaging logs live in `docs/achived/`.
