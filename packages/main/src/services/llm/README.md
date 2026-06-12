# services/llm — ⚠️ 孤立模块，待重写为规格 Agent

> **状态（2026-06-13 审计）**：本目录当前**无任何 IPC / 页面调用**，是 Delightify 旧路线的遗留。

## 现状

- `providers/{openai,anthropic,ollama,base}.ts` — 三家 LLM provider 封装，**功能完整、可调用**。
- `service.ts` / `types.ts` — 统一服务入口，但它做的是旧任务：分析 **JAR 注册模式**（`registrationPattern: deferred_register / static_field / method_call...`），属已废弃的字节码分析路线，**不是规格定义的 Agent**。

## 为什么保留

provider 调用层（鉴权、请求、流式、缓存）是可复用的基础设施。将来按规格（`docs/spec-snapshot/设计/09`）实现 Agent 层时，**复用 `providers/`，重写 `service.ts` 的任务逻辑**（语义识别 + 执行规划 + 置信×风险输出），不要从零造 provider 轮子。

## 重写时要对齐的规格

- 设计/03：Intent-Spec 决策模型（`data:*` 事实 / `sem:*` Agent 提案）
- 设计/09：Agent 层（分类 → 置信×风险门 → 高置信低风险自动、不确定搁置）
- 安全纪律：绝不静默猜测，一切可审、可逆、出 diff。
