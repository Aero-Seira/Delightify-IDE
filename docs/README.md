# Delightify 文档索引

> 本目录同时包含当前决策、规格快照和历史归档。`archive/` 内文档只作背景，不代表当前实现；实现状态以代码和实跑命令为准。

## ⚠️ AGENT 全部搁置

**所有 Agent/LLM 相关内容已统一搁置，待更详细的 Agent 专项规划后再启动。** 规格中的 `设计/03`（Intent-Spec 契约）、`设计/05`（引导式规划）、`设计/09`（LLM-Agent 集成）以及里程碑 M3-M5 均属于搁置范围。当前工作范围仅限确定性引擎（不接 LLM）。

读取 `spec-snapshot/` 中的 Agent 相关规格时，应视为**远景设计参考，非当前实施目标**。

## 推荐阅读顺序

1. 先读根目录 [`CLAUDE.md`](../CLAUDE.md)，确认项目命名、当前方向、Agent 搁置决策和代码核实原则。
2. 做当前实现决策时读 [`current/`](./current/)。
3. 需要完整产品规格时读 [`spec-snapshot/`](./spec-snapshot/)（注意其中 Agent 相关内容已搁置）。
4. 排查旧实现、旧规划或迁移记录时读 [`archive/`](./archive/)。

## 目录结构

### `current/`

当前仍在指导后续实现的文档。

- [`mvp0-data-foundation.md`](./current/mvp0-data-foundation.md)：MVP-0 数据地基方案，后续 schema/importer/unify/KubeJS 实现依据。
- [`exporter-contract-v1.md`](./current/exporter-contract-v1.md)：Delightify Exporter v1 SQLite 契约草案。
- [`m2-usability-plan.md`](./current/m2-usability-plan.md)：M2 可用化路线，把项目推进为面向 Minecraft 实例的手动改包 IDE。
- [`m2-action-engine-plan.md`](./current/m2-action-engine-plan.md)：M2 确定性动作引擎路线与已完成的后端 IR / IPC 记录。
- [`进度.md`](./current/进度.md)：近期决策与进展记录。

### `spec-snapshot/`

从规划库 vendored 的只读规格快照。`设计/01-核心设计与决策模型.md` 是产品规格入口。

### `guides/`

操作指南。

- [`windows-build.md`](./guides/windows-build.md)

### `archive/`

历史实现日志、旧路线资料和遗留 Delightify 文档。只作为排查背景，不作为当前路线依据。

- [`archive/audits/`](./archive/audits/)：已过期的代码审计与一次性启动清单。
- [`archive/hand-offs/`](./archive/hand-offs/)：历史会话交接、样本数据和迁移记录。
- [`archive/planning/`](./archive/planning/)：旧架构、路线图、技术栈和项目结构规划。
- [`archive/completed/`](./archive/completed/)：已完成或已失效的迁移方案。
- [`archive/import-engine/`](./archive/import-engine/)：旧 import-engine / Java bytecode analyzer 路线资料。
- [`archive/m3/`](./archive/m3/)：M3 配方浏览器阶段记录。
- [`archive/legacy-delightify/`](./archive/legacy-delightify/)：旧 Delightify 文档与修复记录。
