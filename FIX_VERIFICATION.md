# Windows 打包空白界面修复验证清单

## 已修改的文件

| 文件路径 | 修改类型 | 修改内容 |
|---------|---------|---------|
| `packages/renderer/src/App.tsx` | 修改 | `BrowserRouter` → `HashRouter` |
| `packages/main/src/main.ts` | 修改 | 增强生产环境检测和路径查找 |
| `packages/main/package.json` | 修改 | 更新 electron-builder 配置，添加 Windows 支持 |

## 重新打包步骤

```powershell
# 1. 进入项目根目录
cd C:\Users\aeroseira\Repositories\Delightify

# 2. 清理之前的构建
pnpm clean

# 3. 重新构建所有包
pnpm build

# 4. 打包 Windows 版本（便携版）
pnpm dist:win

# 5. 或打包为安装程序
pnpm dist:win:dir
```

## 验证清单

打包完成后，测试以下项目：

### 基本功能
- [ ] 应用启动后显示主界面（非空白）
- [ ] 侧边栏菜单项可点击
- [ ] 首页/仪表盘正常显示内容
- [ ] 路由切换时 URL 变为 `...exe#/route` 格式

### 各页面
- [ ] 首页 (/#/)
- [ ] 项目管理 (/#/projects)
- [ ] 模组管理 (/#/mods)
- [ ] 物品浏览器 (/#/items)
- [ ] 配方浏览器 (/#/recipes)
- [ ] 配方编辑器 (/#/editor)
- [ ] 转换工具 (/#/convert)
- [ ] 数据库管理 (/#/debug)

### 界面元素
- [ ] 侧边栏显示正常
- [ ] 顶部标题栏显示正确
- [ ] 主题切换（深色/浅色）工作正常
- [ ] 窗口大小调整正常

## 如果仍然空白

1. **打开 DevTools**（应用会自动打开）
2. **查看 Console 标签页**，检查是否有红色错误信息
3. **查看 Network 标签页**，检查资源加载是否失败
4. **查看主进程日志**（Windows 可以在命令行运行 exe 查看控制台输出）

## 常见问题

### 问题：HashRouter 的 URL 不美观
**解决**：Electron 打包应用使用 `file://` 协议，`HashRouter` 会在 URL 中添加 `#/`，这是正常现象。例如：
```
file:///C:/Users/.../Delightify.exe#/projects
```

### 问题：开发模式正常，打包后空白
**原因**：`BrowserRouter` 在 `file://` 协议下无法工作
**修复**：已修改为 `HashRouter`

### 问题：找不到 index.html
**检查**：查看控制台 `[Main]` 日志，确认路径查找过程
**可能原因**：
- `prepack.js` 未正确运行
- `dist/renderer` 目录未正确复制

## 联系方式

如果问题仍然存在，请提供：
1. 打包命令的输出日志
2. 运行时的控制台截图
3. `release` 目录下的文件列表
