# Windows 打包空白界面修复总结

## 问题描述
Windows 打包后的 EXE 文件运行时，侧边栏正常显示，但主内容区域为空白（黑色）。

## 根本原因
1. **React Router 使用了 BrowserRouter**：在 Electron 打包应用中加载本地文件（`file://` 协议）时，`BrowserRouter` 依赖的 HTML5 history API 无法正常工作
2. **生产环境检测不准确**：`process.env.NODE_ENV` 在打包后的应用中不可靠
3. **路径查找不够健壮**：Windows 便携版的路径结构可能有差异

## 修复内容

### 1. 修复 React Router（packages/renderer/src/App.tsx）
```typescript
// 改造前
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
<BrowserRouter>
  <AppContent />
</BrowserRouter>

// 改造后
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
<HashRouter>
  <AppContent />
</HashRouter>
```

### 2. 增强生产环境检测（packages/main/src/main.ts）
```typescript
// 使用多种方式检测开发环境
const isDevMode = (): boolean => {
  if (process.env.NODE_ENV === 'development') {
    return true;
  }
  
  // 检查是否存在源码目录（开发模式特征）
  const hasSrcDir = fs.existsSync(path.join(__dirname, '../src'));
  const hasRendererSrc = fs.existsSync(path.join(__dirname, '../../renderer/src'));
  
  return hasSrcDir || hasRendererSrc;
};

// 在 app.whenReady 后使用 app.isPackaged 再次确认
app.whenReady().then(async () => {
  isDev = !app.isPackaged;
  // ...
});
```

### 3. 增强路径查找逻辑（packages/main/src/main.ts）
```typescript
function getProductionIndexPath(): string {
  // 添加了 Windows 便携版特定路径
  const winPortablePaths = [
    path.join(resourcesPath, 'app.asar', 'dist', 'renderer', 'index.html'),
    path.join(resourcesPath, 'app', 'dist', 'renderer', 'index.html'),
    path.join(appPath, 'dist', 'renderer', 'index.html'),
    path.join(process.cwd(), 'dist', 'renderer', 'index.html'),
  ];
  
  // 增强的调试信息
  console.log('[Main] platform:', process.platform);
  // 列出目录内容以便调试
}
```

### 4. 更新 electron-builder 配置（packages/main/package.json）
```json
{
  "asarUnpack": [
    "dist/renderer/**/*"
  ],
  "win": {
    "target": [
      {
        "target": "portable",
        "arch": ["x64"]
      },
      {
        "target": "nsis",
        "arch": ["x64"]
      }
    ],
    "icon": "build/icon.ico",
    "publisherName": "Aero Seira",
    "verifyUpdateCodeSignature": false
  },
  "nsis": {
    "oneClick": false,
    "allowToChangeInstallationDirectory": true,
    "createDesktopShortcut": true,
    "createStartMenuShortcut": true,
    "shortcutName": "Delightify"
  }
}
```

## 重新打包步骤

```powershell
# 1. 清理之前的构建
pnpm clean

# 2. 重新构建所有包
pnpm build

# 3. 打包 Windows 版本
pnpm dist:win

# 4. 测试生成的 exe 文件
# 输出位置: release/Delightify.exe
```

## 调试方法

如果问题仍然存在，打开 DevTools 查看控制台输出：

1. 打包后的应用会自动打开 DevTools（生产环境调试用，可在 main.ts 中移除）
2. 检查控制台中的 `[Main]` 日志，确认路径查找过程
3. 检查 `[Renderer]` 日志，确认是否有 JavaScript 错误

## 测试验证

- [ ] 开发模式 (`pnpm dev`) 正常工作
- [ ] Windows 便携版 (`pnpm dist:win`) 正常显示内容
- [ ] 路由导航正常工作（HashRouter 会在 URL 中添加 `#/`）
- [ ] 侧边栏和主内容区域都正常显示

## 注意事项

1. 使用 `HashRouter` 后，URL 会变成 `file:///path/to/app.exe#/route` 的形式
2. `BrowserRouter` 在 Electron 中只适用于使用自定义协议（如 `app://`）的情况
3. 如果将来需要更美观的 URL，可以考虑使用 MemoryRouter 或自定义协议
