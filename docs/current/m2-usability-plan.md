# M2 可用化实施方案

> 状态：当前路线（2026-06-16）。本方案基于用户确认的产品方向：先把 Delightify 做成可用的手动改包 IDE，再接 Agent/LLM。旧规格和历史规划只作背景；实现以当前代码为准。

## 1. 定位

M2 可用化不是“补一个配方编辑器”，也不是“只做动作按钮页”。目标是让 Delightify 在不接 LLM/Agent 的情况下，成为一个面向 Minecraft 客户端实例的手动改包工作台：

- 项目以 Minecraft 客户端实例为中心，而不是普通空目录。
- 专业用户既可以使用结构化动作，也可以查看/编辑 Delightify 管理的脚本产物。
- 所有自动生成或受控编辑的产物必须可审、可撤销，不覆盖用户手写脚本。
- 未来 Agent 只是在同一套 plan / action / diff 管线上帮助用户生成方案，不推翻 M2 交互模型。

## 2. 不做

本阶段明确不实现：

- LLM provider UI、自然语言意图解析、Agent 主循环。
- 向量检索、自动平衡设计、自动执行高风险动作。
- `add_item`、真实执行 `change_recipe_type`、真实生成桥接配方。
- scale 的完整 KubeJS 重建发射、JEI hide 发射、datapack / Almost Unified 后端。
- 自由覆盖或直接改写用户已有 KubeJS 手写脚本。

## 3. 用户能力目标

### 3.1 项目管理

项目应绑定 Minecraft 客户端实例目录，并围绕实例结构做体检和管理。

首批支持的实例信号：

- `.minecraft/` 或实例根目录。
- `mods/`、`config/`、`kubejs/`、`saves/`、`resourcepacks/`。
- exporter 输出：`mpide-exporter/export.sqlite`、`.mpide-exporter/export.sqlite` 等现有探测路径。
- Git 仓库状态：是否为 Git repo、当前分支、是否有未提交修改。
- Delightify 状态：`.delightify/project.db`、导入历史、生成文件清单、上次 modlist hash。

创建/打开项目时，应展示实例体检摘要：

- Minecraft 版本、loader、mod 数量。
- 是否存在 KubeJS。
- 是否存在 exporter 快照。
- 是否已导入、导入时间、数据源能力。
- Git 状态与工作区风险。
- Delightify 生成文件是否存在、是否可撤销。

### 3.2 结构化手动动作

第一版手动动作闭环只做 4 个基础动作：

- `replace`：替换配方输入。
- `retag`：增删 tag 成员。
- `remove_recipe`：删除配方。
- `rename`：修改显示名，不改注册 id。

每个动作都走同一条管线：

1. 选择目标和参数。
2. 计算 blast 影响范围。
3. dry-run 生成操作、风险、diff、deferred 项。
4. 用户确认允许确认的操作。
5. 导出 Delightify 管理的文件。
6. 支持一键撤销。

后续再接入复合动作：

- `constrain_inputs`
- `differentiate`
- `harmonize`

scale / hide 在当前后端已有 IR 语义，但输出层未定，UI 中只能作为“可分析、暂不可导出”的动作展示。

### 3.3 专业脚本工作区

Monaco 作为专业用户入口，但不是唯一编辑入口。

脚本分为两类：

- Delightify managed：IDE 可以写入、预览、撤销，也允许用户在 Monaco 中编辑。
- User scripts：默认只读查看，不直接覆盖；后续可做“复制为 Delightify 管理脚本”或“显式接管”。

首批 Monaco 用途：

- 查看生成的 KubeJS server script。
- 查看 rename 生成的 lang json。
- 查看 Delightify 生成清单和产物状态。
- 编辑 Delightify managed 手动脚本文件。

暂不把 Monaco 做成主要配方编辑器，避免项目退化成普通脚本编辑器。

### 3.4 Plan 概念

M2 可以引入轻量 plan，但不做 Agent。

Plan 是用户手动构建的一组修改方案，未来 Agent 生成的结果也应落到同一结构。首批 plan 可以只保存在项目库或本地 JSON，不要求复杂版本管理。

Plan 至少记录：

- action 列表及参数。
- dry-run 结果摘要。
- 用户确认过的 operation id。
- deferred 建议。
- change set。
- 生成文件列表。
- 可选的 Monaco 手动 patch。
- 用户备注。

## 4. 页面结构建议

### Project Hub

项目/实例首页，展示实例体检、Git 状态、导入状态、生成产物状态和常用入口。

### Data Import

保留现有数据导入页，强化为实例快照管理入口：探测、验证、导入、历史记录、失败原因。

### Item Browser / Recipe Browser

保留浏览能力，接入 `engine:blast` 显示引用关系、tag 连带、输出引用、未结构化关联和风险信号。

### Action Workbench

新增结构化动作工作台：

- 动作选择器。
- 参数选择器（物品、tag、配方、语言）。
- dry-run 结果。
- 风险和 blast。
- operation 台账。
- deferred 确认。
- 导出 / 撤销。

首批只支持 `replace / retag / remove_recipe / rename`。

### Script Workspace

Monaco 文件工作区：

- 生成文件预览。
- Delightify managed 文件编辑。
- User scripts 只读查看。
- 文件归属和撤销状态提示。

### Plan Review

计划审阅页或工作台内面板：

- action 列表。
- diff。
- 生成文件。
- deferred 项。
- 导出状态。

## 5. 实施顺序

### U0：路线固化与小断点修复

- 新增本方案文档并更新文档索引。
- 修正 ProjectManager “导入数据”跳转到不存在 `/mods` 路由的问题。
- 验证：`pnpm typecheck`。

### U1：实例项目体检

- 新增实例结构探测服务：识别 `mods/config/kubejs/saves/resourcepacks`、exporter 快照、Git 状态。
- 扩展 ProjectManager / Dashboard 为 Project Hub 雏形。
- 创建/打开项目时展示实例健康摘要。
- 验证：`pnpm typecheck && pnpm build`，手动打开真实实例目录核对。

### U2：只读 blast 强化

- ItemBrowser 详情接 `engine:blast`。
- RecipeBrowser 或 RecipeCard 展示相关输入/输出引用。
- 将 blast 结果做成可复用组件。
- 验证：`pnpm typecheck && pnpm build`，真实项目手动核对引用清单。

### U3：Action Workbench 基础动作

- 新增 `ActionWorkbench` 页面、路由和侧边栏入口。
- 支持 `replace / retag / remove_recipe / rename`。
- 接 `engine:dry-run`、`export:kubejs`、`export:kubejs:revert`。
- 支持 `confirmedOperationIds` 的确认流。
- 验证：`pnpm typecheck && pnpm build && pnpm smoke:engine-dispatch`，手动跑 app。

### U4：生成产物预览

- 工作台展示 fileset 输出结果。
- 展示 Delightify managed 文件、operation count、撤销状态。
- 不允许覆盖 user scripts。
- 验证：`pnpm typecheck && pnpm build && pnpm smoke:mvp0`，手动导出/撤销。

### U5：Script Workspace / Monaco

- 接入 Monaco。
- 首批只编辑 Delightify managed 文件。
- User scripts 只读查看。
- 保存前做归属校验，避免覆盖手写文件。
- 验证：`pnpm typecheck && pnpm build`，手动编辑 managed 文件并撤销。

### U6：轻量 Plan

- 定义 plan 存储结构。
- 工作台支持保存/打开 plan。
- Plan 记录 actions、确认项、deferred、生成文件和备注。
- 验证：`pnpm typecheck && pnpm build`，手动保存/恢复方案。

### U7：复合动作接入

- 在 Action Workbench 中接入 `constrain_inputs / differentiate / harmonize`。
- scale / hide 只展示 IR 语义和输出层待定状态，不导出。
- 验证：`pnpm typecheck && pnpm build`，运行对应 M2 smoke。

## 6. 验收标准

M2 可用化完成时，用户应能：

- 打开一个真实 Minecraft 实例并看懂项目状态。
- 导入 exporter 快照并浏览物品/配方/tag。
- 对物品或配方查看 blast 影响范围。
- 用结构化工作台完成 replace/retag/remove_recipe/rename 的 dry-run、确认、导出和撤销。
- 在脚本工作区查看生成产物，并编辑 Delightify 管理文件。
- 保存一个手动 plan，未来可作为 Agent 输出目标。

最低命令验收：

```bash
pnpm typecheck
pnpm build
pnpm smoke:mvp0
pnpm smoke:engine-dispatch
```

UI 验收需要真实 Electron 运行，因为仓库当前没有 UI 自动化测试。
