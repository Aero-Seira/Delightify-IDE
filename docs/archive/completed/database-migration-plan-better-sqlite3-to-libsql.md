# 数据库迁移方案：better-sqlite3 → libsql

## 背景

当前使用 better-sqlite3 遇到的问题是：
- Native 模块需要针对 Electron 版本重新编译
- 跨平台部署复杂
- CI/CD 流程需要处理编译环境

## 目标方案：libsql

### 为什么选择 libsql？

1. **纯 JavaScript 实现**：无需 native 编译，跨平台零成本
2. **API 兼容**：与 better-sqlite3 API 高度相似
3. **Drizzle ORM 支持**：官方支持 libsql 驱动
4. **现代架构**：支持 Turso 云数据库，未来可无缝扩展
5. **性能优秀**：纯 JS 实现性能接近 native

### 迁移步骤

```bash
# 1. 安装依赖
pnpm remove better-sqlite3
pnpm add @libsql/client

# 2. 修改数据库客户端代码（见下方示例）
# 3. 测试验证
# 4. 更新打包配置
```

### 代码变更示例

```typescript
// 之前：better-sqlite3
import Database from 'better-sqlite3';
const db = new Database(dbPath);

// 之后：libsql
import { createClient } from '@libsql/client';
const client = createClient({ url: `file:${dbPath}` });
```

### 风险评估

- **低风险**：libsql 经过大规模生产验证（Turso 云服务）
- **低工作量**：API 兼容，主要是驱动层变更
- **长期收益**：彻底摆脱 native 模块噩梦

## 备选方案

如果 libsql 不满足需求，可考虑：
- **sql.js**: 纯 WebAssembly SQLite
- **better-sqlite3 + 预编译缓存**: 维护当前方案但优化构建流程
