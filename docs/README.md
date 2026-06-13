# Delightify 文档索引

> 本目录同时包含当前决策、规划参考和历史归档。除 `spec-snapshot/` 与 `current/` 外，不要把文档中的“已完成”描述直接当成实现状态；实现以代码和实跑结果为准。

## 推荐阅读顺序

1. 先读根目录 [`CLAUDE.md`](../CLAUDE.md)，确认项目命名、当前方向和代码审计原则。
2. 做当前实现决策时读 [`current/`](./current/)。
3. 需要完整产品规格时读 [`spec-snapshot/`](./spec-snapshot/)。
4. 需要历史设计背景时读 [`reference/`](./reference/)。
5. 排查旧实现或迁移记录时读 [`archive/`](./archive/)。

## 目录结构

### `current/`

当前仍在指导后续实现的文档。

- [`mvp0-data-foundation.md`](./current/mvp0-data-foundation.md)：MVP-0 数据地基方案，后续 schema/importer/unify/KubeJS 实现依据。
- [`exporter-contract-v1.md`](./current/exporter-contract-v1.md)：Delightify Exporter v1 SQLite 契约草案。
- [`现状审计.md`](./current/现状审计.md)：基于真实代码的现状审计。
- [`启动清单-审计与MVP0.md`](./current/启动清单-审计与MVP0.md)：新会话审计清单。
- [`进度.md`](./current/进度.md)：近期决策与进展记录。

### `spec-snapshot/`

从规划库 vendored 的只读规格快照。`设计/01-核心设计与决策模型.md` 是产品规格入口。

### `reference/`

仍有参考价值、但不代表当前实现状态的规划与架构文档。

- [`architecture.md`](./reference/architecture.md)
- [`project-structure.md`](./reference/project-structure.md)
- [`tech-stack.md`](./reference/tech-stack.md)
- [`roadmap.md`](./reference/roadmap.md)
- [`database-migration-plan.md`](./reference/database-migration-plan.md)
- [`registration-patterns-config.md`](./reference/registration-patterns-config.md)
- [`version-compatibility-solution.md`](./reference/version-compatibility-solution.md)

### `guides/`

操作指南。

- [`windows-build.md`](./guides/windows-build.md)

### `archive/`

历史实现日志、旧路线资料和遗留 Delightify 文档。只作为排查背景，不作为当前路线依据。

- [`archive/import-engine/`](./archive/import-engine/)：旧 import-engine / Java bytecode analyzer 路线资料。
- [`archive/m3/`](./archive/m3/)：M3 配方浏览器阶段记录。
- [`archive/legacy-delightify/`](./archive/legacy-delightify/)：旧 Delightify 文档与修复记录。
