# 会话交接与迁移记录 - 2026-06-14

> 这是当前会话的事实快照和迁移交接，不是路线图完成声明。后续实现仍以真实代码、实跑构建和样本数据库为准。

> 更新：NeoForge exporter 已从上级兄弟仓并入本仓 `packages/exporter`，作为 monorepo 子包维护。兄弟仓 `../modpack-ide-exporter` 仅是迁入来源快照，不再作为主开发路径。

## 读法

新会话或迁移后，优先按这个顺序恢复上下文：

1. 根目录 `CLAUDE.md`
2. 本文件
3. `docs/current/exporter-contract-v1.md`
4. `docs/current/mvp0-data-foundation.md`
5. 实际代码：`packages/main/src/services`、`packages/main/src/ipc`、`packages/renderer/src/pages`

## 仓库与路径

当前仓库仍在 ExFAT 外置盘上，macOS 下不适合作为 Electron 开发目录。

| 名称 | 当前路径 | 远端 |
| --- | --- | --- |
| Delightify monorepo | `/Users/aeroseira/repos/Delightify-IDE` | `https://github.com/Aero-Seira/Delightify-IDE.git` |
| NeoForge exporter | `packages/exporter` | 已并入 Delightify monorepo |

建议迁移到 APFS 本机路径：

```bash
~/Repos/Delightify-IDE
~/Transmation/export.sqlite
```

不要复制 `node_modules`。迁移后重新安装依赖。

## 当前事实快照

### 产品与方向

- 正式产品名是 Delightify。
- "ModPack IDE" 是产品定位/品类描述，也是旧规划库目录名，不作为产品改名。
- 当前首要工程目标：把 exporter 产出的运行时事实库接入 Delightify importer，作为 MVP-0 数据地基。

### Delightify IDE 主仓

当前主仓 HEAD 在本文件写入前为 `93ac0a0`。

已验证：

```bash
pnpm build
pnpm typecheck
```

两者均通过。

没有单元测试命令；当前 CI 语义主要是类型检查。

macOS 启动状态：

- 源码构建和类型检查正常。
- 仓库位于 ExFAT 时，Electron 的 `.app` bundle 无法可靠安装在 `node_modules`，默认 `pnpm dev` 会报：

```text
Electron failed to install correctly
```

- 使用 APFS 缓存中的 Electron 二进制后，已验证 Electron 主进程能启动、IPC 注册成功、renderer `dist/index.html` 加载成功、preload 暴露成功。

临时启动命令：

```bash
ELECTRON_OVERRIDE_DIST_PATH="$HOME/Library/Caches/delightify/electron-v29.4.0-darwin-arm64" pnpm dev
```

长期方案：把仓库迁到 APFS 路径后重新 `pnpm install`，不要依赖这个 override。

### Exporter 子包

当前 `packages/exporter` 迁入自 exporter HEAD `ce7d14b`。

近期关键提交：

```text
ce7d14b fix: tolerate recipe export failures
fe5f8be fix: lower neoforge runtime minimum
98d2998 feat: export structured recipes
95e46e3 feat: export item tags and translations
958057e Implement mod and item registry sources
```

已完成并验证：

- `ModListSource`
- `ItemRegistrySource`
- `ItemTagSource`
- `TranslationSource`
- `RecipeSource`
- SQLite schema v1 写出
- NeoForge runtime 最低版本降到 `21.1.1`
- 默认 Gradle 构建通过
- 最低 NeoForge 编译检查通过

验证命令：

```bash
pnpm exporter:build
cd packages/exporter && ./gradlew compileJava -Pneo_version=21.1.1 --rerun-tasks --quiet
```

运行时容错：

- TACZ 的 `tacz:gun_smith_table_crafting` 在 `Recipe.CODEC.encodeStart(...)` 内部会抛 `UnsupportedOperationException`。
- exporter 已改为单配方 fail-open：坏配方写入 `recipes`，`raw_json = NULL`，`unparsed = 1`，不会中断整次导出。
- 明显的流体 ingredient JSON 不再按 item `Ingredient` 强行解析，减少日志噪音。

### Labpack 样本导出

样本路径：

```bash
/Volumes/SSD-1/Transmation/export.sqlite
/Volumes/SSD-1/Transmation/游戏日志 - Labpack-1.21.1.log
```

注意：该日志文件仍是旧的 `19:08` 失败日志；真正的新证据是同目录 `19:36` 的 `export.sqlite`。

数据库验证：

```bash
sqlite3 'file:/Volumes/SSD-1/Transmation/export.sqlite?mode=ro&immutable=1' 'PRAGMA integrity_check;'
```

结果：`ok`

manifest：

| key | value |
| --- | --- |
| `schema_version` | `1` |
| `exporter_version` | `0.1.0` |
| `loader` | `neoforge` |
| `mc_version` | `1.21.1` |
| `neo_version` | `21.1.227` |
| `environment` | `integrated` |
| `world_name` | `新的世界` |

数据规模：

| 表 | 行数 |
| --- | ---: |
| `mods` | 194 |
| `items` | 8295 |
| `blocks` | 6488 |
| `item_creative_tabs` | 7412 |
| `item_tags` | 12334 |
| `recipes` | 10341 |
| `recipe_inputs` | 31301 |
| `recipe_outputs` | 8005 |
| `translations` | 365731 |

配方质量检查：

- `recipes.raw_json IS NULL` 共 173 条，全部来自 `tacz:gun_smith_table_crafting`。
- `unparsed = 1` 共 2317 条，主要是 Create/自定义机器配方或无法安全结构化的配方。
- `recipe_outputs.item_id` 指向缺失 item：0 条。
- `recipe_inputs.kind = 'item'` 指向缺失 item：0 条。

SQLite 读取注意：

- 在当前外置 ExFAT 路径上，`sqlite3 -readonly /path/export.sqlite` 可能因锁文件语义失败。
- `immutable=1` 可以读取。
- IDE importer 读取外部导出文件时，建议二选一：
  - 先复制到应用本地缓存目录再打开；
  - 或用只读 immutable URI 打开。

## APFS 迁移步骤

### 1. 克隆主仓

```bash
mkdir -p ~/Repos
cd ~/Repos
git clone git@github.com:Aero-Seira/Delightify-IDE.git
cd Delightify-IDE
pnpm install
pnpm build
pnpm typecheck
pnpm dev
```

### 2. 构建 monorepo 内置 exporter

```bash
cd ~/Repos/Delightify-IDE
pnpm exporter:build
```

### 3. 复制样本数据

```bash
mkdir -p ~/Transmation
cp "/Volumes/SSD-1/Transmation/export.sqlite" ~/Transmation/
cp "/Volumes/SSD-1/Transmation/游戏日志 - Labpack-1.21.1.log" ~/Transmation/
```

### 4. 新会话恢复提示

迁移后开启新会话时，给 agent 的最短上下文：

```text
仓库在 ~/Repos/Delightify-IDE。先读 CLAUDE.md 和 docs/README.md；本交接文件已归档，仅作历史背景。
目标是把 ~/Transmation/export.sqlite 按 docs/current/exporter-contract-v1.md 接入 Delightify importer。
```

## 下一步工程目标

下一步建议做：IDE importer v1 接入 exporter SQLite。

边界：

- 不再从 JAR 解析事实作为主路径。
- exporter SQLite 是 `data:*` 确定性事实来源。
- importer 先完成数据落库和浏览器可用，不先做语义 Agent。

建议任务拆分：

1. 审计现有 `packages/main/src/services/mod-data-importer`、database schema、IPC、renderer store。
2. 对齐 `exporter-contract-v1.md`，确定导入目标表和缺口。
3. 实现外部 `export.sqlite` 读取：复制到本地缓存或 immutable read-only。
4. 导入 `mods/items/blocks/item_tags/translations/recipes/recipe_inputs/recipe_outputs`。
5. 在 UI 中确认物品浏览器、配方浏览器能基于新数据工作。
6. 用 Labpack 样本库做 smoke 验证。

完成判定：

- `pnpm build` 通过。
- `pnpm typecheck` 通过。
- 选择样本 `export.sqlite` 后，IDE 能展示 items 和 recipes。
- `unparsed` 配方不会导致 UI 或 importer 崩溃。
