# M2 Script Workspace File Operations

## Goal

Make Script Workspace usable as a focused Minecraft instance editor, while keeping Delightify from becoming an unrestricted filesystem editor. File operations must support professional manual work without weakening managed output protections or future agent safety boundaries.

## Architecture Fit

Script Workspace follows the existing Electron layering:

- `packages/shared`: typed IPC contracts and channel constants.
- `packages/main/src/services/script-workspace.ts`: source of truth for path policy, ownership classification, and filesystem mutation.
- `packages/main/src/ipc`: thin IPC handlers that call the service.
- `packages/main/src/preload.ts`: renderer-safe API bridge.
- `packages/renderer`: UI state, file tree, editor tabs, and confirmation flows.
- `packages/renderer/src/ipc/mock.ts`: browser-mode parity for manual UI checks.

Renderer must not decide whether a path is safe. It may request an operation, but main must normalize, classify, and reject unsafe mutations.

## Workspace Scope

Editable text areas are intentionally limited to Minecraft instance structures:

- `kubejs/server_scripts/**/*.js`
- `kubejs/client_scripts/**/*.js`
- `kubejs/startup_scripts/**/*.js`
- `kubejs/assets/**/*.{json,json5,mcmeta}`
- `kubejs/data/**/*.{json,json5,mcfunction,mcmeta}`
- `config/**/*.{cfg,conf,json,json5,properties,toml,txt,yaml,yml}`
- `datapacks/**/*.{json,json5,mcfunction,mcmeta}`
- `resourcepacks/**/*.{json,json5,lang,mcmeta,properties,txt}`

Explicitly denied areas:

- `.git/**`
- `.delightify/**`
- `mods/**`
- `libraries/**`
- `versions/**`
- unknown binary files

## Ownership Model

| Kind | Meaning | Edit | Create | Rename | Delete |
| --- | --- | --- | --- | --- | --- |
| `managed` | Delightify-owned JS, via marker or manifest | Yes, marker-protected | Yes, script-only | Only manual marker-owned files, later | No |
| `user` | Safe user-authored text files | Yes, confirmed save | Yes | Yes, confirmed | Soft delete, confirmed |
| `manifest` | Delightify ownership manifest | No | No | No | No |
| `readonly` | Unsafe, large, generated, or non-editable files | No | No | No | No |

M2 file deletion is intentionally narrow: only `user` files can be deleted, and deletion is implemented as a move into an internal trash directory under `.delightify/script-workspace-trash/`. This makes the user-facing operation reversible by manual recovery while still keeping `.delightify/**` outside the editable workspace.

## IPC/API Plan

Existing:

- `scriptWorkspaceList(projectPath)`
- `scriptWorkspaceRead(projectPath, relativePath)`
- `scriptWorkspaceSave(projectPath, relativePath, content, options)`
- `scriptWorkspaceCreateManaged(projectPath, relativePath?)`
- `scriptWorkspaceCreateUser(projectPath, relativePath?)`
- `scriptWorkspaceCopyAsManaged(projectPath, sourceRelativePath, targetRelativePath?)`

New:

- `scriptWorkspaceCreateDirectory(projectPath, relativePath)`
  - Creates a directory inside an allowed workspace root.
  - Rejects existing files.
  - Does not create unsafe roots.
- `scriptWorkspaceRename(projectPath, sourceRelativePath, targetRelativePath, options)`
  - Source must classify as `user` for this stage.
  - Target must be a safe text workspace path.
  - Rejects overwrite.
  - Requires `confirmUserFileWrite` for user file mutation.
- `scriptWorkspaceDelete(projectPath, relativePath, options)`
  - Source must classify as `user`.
  - Moves the file to `.delightify/script-workspace-trash/<timestamp>/<relativePath>`.
  - Rejects managed, manifest, readonly, unsafe, and missing files.
  - Requires `confirmUserFileWrite`.

## UI Plan

Script Workspace UI should remain IDE-like:

- File tree is the navigation center.
- Editor tabs are edit sessions.
- File operations live near the file tree header first; context menus can come later.
- New file, new folder, and rename use an in-workbench form, not `window.prompt`.
- Delete uses explicit confirmation and reports the internal backup path.
- Dirty tabs are preserved while navigating.
- All visible text must be in i18n.

## Future Agent Space

The service boundary is intentionally reusable by future agent work:

- Agents should call the same service methods.
- Agent writes to user files must still carry explicit confirmation or a future scoped approval token.
- Managed outputs remain marker/manifest protected.
- Future patch preview can be layered above these APIs without changing path policy.
