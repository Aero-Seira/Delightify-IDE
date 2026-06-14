# Exporter 快照样例目录

这个目录用于临时放置游戏内 `/mpide_export dump` 生成的真实 `export.sqlite`，方便本地验证 importer、ItemBrowser、RecipeBrowser 和 MVP-0 smoke。

默认策略：

- 目录本身纳入 Git，便于统一约定样例放置位置。
- 真实 SQLite 快照、WAL/SHM 文件不纳入 Git，避免提交大体积二进制文件或本地整合包数据。
- 如确实需要提交一个脱敏、体积可控的固定样例，先在 PR 里说明来源、用途和大小，再显式调整忽略规则或使用 `git add -f`。

推荐命令：

```bash
pnpm smoke:mvp0 -- --data-file examples/export-snapshots/export.sqlite --query 铜锭 --target minecraft:copper_ingot
```
