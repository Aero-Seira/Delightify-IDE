# services/llm — ⚠️ 孤立模块 · AGENT 已全部搁置

> **状态（2026-06-13 审计 / 2026-06-30 更新）**：本目录当前**无任何 IPC / 页面调用**，是 Delightify 旧路线的遗留。**所有 Agent/LLM 实施已统一搁置**，待更详细的 Agent 专项规划后再启动。

## ⚠️ AGENT 搁置说明

Agent 部分（语义 Agent 主循环、Intent Spec 自动生成、LLM 驱动分类/决策、多信号置信度、Gate 审核、引导式规划）涉及 LLM 驱动的语义判断与自动规划，需要在确定性能管线充分验证、M2 可用化完成后，做更详细的专项规划（模型选型、prompt 工程、置信度校准、人机交互流程等），再启动实施。

**本模块在 Agent 搁置期间不进行任何修改，保持当前孤立状态。**

## 现状

- `providers/{openai,anthropic,ollama,base}.ts` — 三家 LLM provider 封装，**功能完整、可调用**。
- `service.ts` / `types.ts` — 统一服务入口，但它做的是旧任务：分析 **JAR 注册模式**（`registrationPattern: deferred_register / static_field / method_call...`），属已废弃的字节码分析路线，**不是规格定义的 Agent**。

## 将来重启时的参考

provider 调用层（鉴权、请求、流式、缓存）是可复用的基础设施。将来 Agent 专项规划完成并决定启动实施时，**复用 `providers/`，重写 `service.ts` 的任务逻辑**（语义识别 + 执行规划 + 置信×风险输出），不要从零造 provider 轮子。

## 需对齐的规格（重启前须重新审视，可能与届时实现有差异）

- 设计/03：Intent-Spec 决策模型
- 设计/05：引导式规划模式
- 设计/09：Agent 层
- 安全纪律：绝不静默猜测，一切可审、可逆、出 diff。
