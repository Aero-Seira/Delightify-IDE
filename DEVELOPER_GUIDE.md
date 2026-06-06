# Delightify 开发者入门指南

> 写给不熟悉技术栈的开发者：从零开始理解和修改本项目

---

## 📋 项目总览

Delightify 是一个 **桌面应用程序**，用网页技术（React）+ 桌面外壳（Electron）构建。

### 为什么要这样设计？
- **网页技术（React）**：界面开发快速、组件丰富、热更新方便
- **桌面外壳（Electron）**：能访问本地文件（读取 JAR）、独立窗口运行

---

## 🏗️ 项目结构（Monorepo）

项目分为 3 个包（package），相互依赖：

```
packages/
├── shared/          ← 共享类型定义（所有包都能用）
├── main/            ← Electron 主进程（Node.js，负责文件操作）
└── renderer/        ← React 前端（用户看到的界面）
```

### 简单类比
| 概念 | 现实类比 | 作用 |
|------|----------|------|
| `main` | 餐厅后厨 | 处理文件、数据库、系统操作 |
| `renderer` | 餐厅前台 | 展示界面、接收用户点击 |
| `shared` | 菜单价格表 | 前后台共享的信息标准 |

---

## 🎨 前端部分（renderer）

### 1. 组件文件在哪？
```
packages/renderer/src/
├── pages/           ← 5个主要页面
│   ├── ModManager/      ← 模组管理页面
│   ├── ItemBrowser/     ← 物品浏览器
│   ├── RecipeBrowser/   ← 配方浏览器
│   ├── RecipeEditor/    ← 配方编辑器
│   └── ConversionTool/  ← 转换工具
├── components/      ← 可复用组件
│   ├── LanguageSwitcher/  ← 语言切换
│   └── ThemeToggle/       ← 主题切换
├── i18n/           ← 多语言配置
├── theme/          ← 主题管理
└── styles/         ← 全局样式
```

### 2. 如何修改页面内容？

**示例：修改"模组管理"页面的标题**

打开 `packages/renderer/src/pages/ModManager/index.tsx`：

```tsx
import React from 'react';
import { useI18n } from '../../i18n';
import styles from './style.module.css';

export default function ModManagerPage(): React.ReactElement {
  const { t } = useI18n();

  return (
    <div className={styles.container}>
      {/* 修改这里：原本显示 "模组管理" */}
      <h1 className={styles.title}>{t('modManager.title')}</h1>
      
      {/* 或者直接写死文字（不推荐，但适合快速测试） */}
      <h1 className={styles.title}>我的自定义标题</h1>
      
      <p className={styles.description}>{t('modManager.description')}</p>
    </div>
  );
}
```

### 3. 如何修改样式？

**方式一：修改单个页面样式**

打开对应页面的 `style.module.css`：

```css
/* packages/renderer/src/pages/ModManager/style.module.css */

.container {
  /* 修改背景色 */
  background-color: var(--bg-secondary);
  
  /* 修改内边距 */
  padding: 40px;
  
  /* 添加边框 */
  border: 2px solid var(--accent);
}

.title {
  /* 修改文字颜色 */
  color: red;  /* 直接用颜色值，或继续使用变量如 var(--accent) */
  
  /* 修改字体大小 */
  font-size: 32px;
}
```

**方式二：修改全局样式（影响所有页面）**

打开 `packages/renderer/src/styles/global.css`：

```css
/* 修改全局背景色 */
[data-theme="light"] {
  --bg-primary: #f0f0f0;    /* 原来是 #ffffff */
  --accent: #ff6b6b;        /* 原来是蓝色，改成红色 */
}

[data-theme="dark"] {
  --bg-primary: #1a1a1a;    /* 原来是 #000000 */
  --accent: #ff6b6b;        /* 深色模式也改红色 */
}
```

### 4. 颜色变量对照表

| 变量名 | 浅色模式 | 深色模式 | 用途 |
|--------|----------|----------|------|
| `--bg-primary` | 纯白 #fff | 纯黑 #000 | 页面背景 |
| `--bg-secondary` | 灰白 #f5f5f7 | 深灰 #1c1c1e | 侧边栏背景 |
| `--accent` | 蓝 #0071e3 | 亮蓝 #0a84ff | 按钮、高亮 |
| `--text-primary` | 黑 #1d1d1f | 白 #f5f5f7 | 主要文字 |
| `--text-secondary` | 灰 #86868b | 浅灰 #a1a1a6 | 次要文字 |

---

## 🌐 国际化（多语言）

### 如何添加/修改文字？

**步骤 1**：打开语言文件
```
packages/renderer/src/i18n/locales/
├── zh-CN.ts    ← 中文
└── en.ts       ← 英文
```

**步骤 2**：添加新的翻译键

```typescript
// zh-CN.ts
export default {
  // ... 其他已有内容
  
  myNewSection: {
    title: '我的新页面',
    description: '这是页面描述',
    buttonText: '点击我',
  },
};

// en.ts
export default {
  // ... 其他已有内容
  
  myNewSection: {
    title: 'My New Page',
    description: 'This is the page description',
    buttonText: 'Click Me',
  },
};
```

**步骤 3**：在页面中使用

```tsx
import { useI18n } from '../../i18n';

function MyPage() {
  const { t } = useI18n();
  
  return (
    <div>
      <h1>{t('myNewSection.title')}</h1>
      <p>{t('myNewSection.description')}</p>
      <button>{t('myNewSection.buttonText')}</button>
    </div>
  );
}
```

### 带参数的翻译

```typescript
// 语言文件中
welcome: '你好，{{name}}！今天是{{day}}。'

// 页面中使用
t('welcome', { name: '张三', day: '星期一' })
// 结果：你好，张三！今天是星期一。
```

---

## 🎭 主题系统（深色/浅色）

### 核心概念

主题通过 CSS 变量实现。`data-theme` 属性控制使用哪套颜色：

```html
<!-- 浅色模式 -->
<html data-theme="light">

<!-- 深色模式 -->
<html data-theme="dark">
```

### 如何修改主题切换逻辑？

打开 `packages/renderer/src/theme/store.ts`：

```typescript
export const useTheme = create<ThemeState>((set, get) => ({
  mode: 'system',           // 默认跟随系统
  // 改成 'light' 或 'dark' 可强制默认主题
  
  resolvedMode: 'light',
  
  setMode: (mode) => {
    // 切换主题时执行的操作
    set({ mode, resolvedMode: resolveTheme(mode) });
    
    // 保存到本地存储（下次打开记住）
    localStorage.setItem('theme-mode', mode);
    
    // 应用到 HTML 标签
    document.documentElement.setAttribute(
      'data-theme', 
      resolveTheme(mode)
    );
  },
  
  toggleMode: () => {
    const { mode, setMode } = get();
    // 循环切换：light → dark → system → light
    const next = mode === 'light' ? 'dark' : 
                 mode === 'dark' ? 'system' : 'light';
    setMode(next);
  },
}));
```

---

## 🧩 组件开发示例

### 创建一个简单的按钮组件

**步骤 1**：创建组件目录和文件
```
packages/renderer/src/components/MyButton/
├── index.tsx
└── style.module.css
```

**步骤 2**：编写组件代码**

```tsx
// index.tsx
import React from 'react';
import styles from './style.module.css';

interface MyButtonProps {
  text: string;           // 按钮文字（必填）
  onClick?: () => void;   // 点击回调（可选）
  variant?: 'primary' | 'secondary';  // 样式变体（可选，默认 primary）
}

export default function MyButton({ 
  text, 
  onClick, 
  variant = 'primary' 
}: MyButtonProps): React.ReactElement {
  return (
    <button 
      className={`${styles.button} ${styles[variant]}`}
      onClick={onClick}
    >
      {text}
    </button>
  );
}
```

**步骤 3**：编写样式**

```css
/* style.module.css */
.button {
  padding: 12px 24px;
  border-radius: 10px;
  border: none;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

/* 主按钮样式 */
.primary {
  background-color: var(--accent);
  color: white;
}

.primary:hover {
  background-color: var(--accent-hover);
  transform: translateY(-1px);
}

/* 次要按钮样式 */
.secondary {
  background-color: var(--surface-primary);
  color: var(--text-primary);
  border: 1px solid var(--border);
}

.secondary:hover {
  background-color: var(--surface-secondary);
}
```

**步骤 4**：在页面中使用**

```tsx
import MyButton from '../../components/MyButton';

function MyPage() {
  return (
    <div>
      <MyButton 
        text="主要按钮" 
        variant="primary"
        onClick={() => alert('点击了！')}
      />
      <MyButton 
        text="次要按钮" 
        variant="secondary"
      />
    </div>
  );
}
```

---

## 📁 项目管理模块开发指南

### 模块概述

项目管理模块用于管理 Minecraft 整合包项目，包括创建、打开、编辑、删除和收藏项目。

**文件位置**：
```
packages/renderer/src/
├── pages/ProjectManager/          # 项目管理页面
│   ├── index.tsx                  # 主组件
│   └── style.module.css           # 样式
├── components/CreateProjectDialog/ # 创建项目对话框
│   ├── index.tsx
│   └── style.module.css
└── store/projectStore.ts          # 项目状态管理
```

### 核心功能

#### 1. 项目状态管理 (projectStore.ts)

```typescript
import { useProjectStore } from '../../store/projectStore';

function MyComponent() {
  const { 
    projects,              // 项目列表
    currentProject,        // 当前打开的项目
    isLoadingProjects,     // 加载状态
    loadProjects,          // 加载项目列表
    createProject,         // 创建项目
    openProject,           // 打开项目
    deleteProject,         // 删除项目
    setFavorite,           // 设置收藏
  } = useProjectStore();

  // 创建新项目
  const handleCreate = async () => {
    const project = await createProject({
      name: '我的整合包',
      path: '/path/to/modpack',
      mcVersion: '1.20.1',
      modLoader: 'forge',
      description: '项目描述',
    });
  };

  // 打开项目
  const handleOpen = async (projectId: string) => {
    await openProject(projectId);
  };
}
```

#### 2. 项目数据结构

```typescript
interface Project {
  id: string;                    // 唯一标识
  name: string;                  // 项目名称
  description?: string;          // 描述
  path: string;                  // 项目路径
  mcVersion: string;             // MC版本 (如 "1.20.1")
  modLoader: 'forge' | 'fabric' | 'neoforge' | 'quilt';
  createdAt: string;             // 创建时间
  updatedAt: string;             // 更新时间
  lastOpenedAt?: string;         // 最后打开时间
  isFavorite?: boolean;          // 是否收藏
  totalMods: number;             // 模组数量
  totalRecipes: number;          // 配方数量
  totalItems: number;            // 物品数量
}
```

#### 3. 添加项目相关 IPC 通道

在 `packages/shared/src/constants/ipc.ts` 中添加：

```typescript
export const IPC_CHANNELS = {
  // ... 其他通道
  PROJECT_LIST: 'project:list',
  PROJECT_OPEN: 'project:open',
  PROJECT_CREATE: 'project:create',
  PROJECT_UPDATE: 'project:update',
  PROJECT_DELETE: 'project:delete',
  PROJECT_GET_CURRENT: 'project:get-current',
  PROJECT_SELECT_DIRECTORY: 'project:select-directory',
};
```

#### 4. 添加国际化翻译

在 `packages/renderer/src/i18n/locales/zh-CN.ts` 中添加：

```typescript
projectManager: {
  title: '项目管理',
  description: '管理你的 Minecraft 整合包项目',
  createProject: '创建项目',
  open: '打开',
  edit: '编辑',
  delete: '删除',
  favorite: '收藏',
  searchPlaceholder: '搜索项目...',
  noProjects: '暂无项目',
  createFirst: '创建你的第一个项目',
  gridView: '网格视图',
  listView: '列表视图',
  currentProject: '当前项目',
  confirmDelete: '确认删除',
  confirmDeleteDesc: '确定要删除项目 "{{name}}" 吗？',
},
```

### 常见问题

#### Q: 项目创建后没有显示？
**A**: 检查以下几点：
1. 确保调用了 `loadProjects()` 刷新列表
2. 检查 IPC 处理器是否正确注册
3. 查看控制台是否有错误信息

#### Q: 如何修改项目的样式？
**A**: 编辑 `packages/renderer/src/pages/ProjectManager/style.module.css`，主要类名：
- `.projectGrid` - 网格容器
- `.projectCard` - 项目卡片
- `.projectListItem` - 列表项

#### Q: 如何添加新的筛选条件？
**A**: 
1. 在 `ProjectListParams` 类型中添加新字段
2. 在 store 的 `loadProjects` 中处理筛选逻辑
3. 在页面组件中添加筛选 UI

---

## 🔧 常见开发任务速查

### 1. 添加新页面

**步骤**：
1. 在 `packages/renderer/src/pages/` 创建新文件夹（如 `MyPage/`）
2. 创建 `index.tsx` 和 `style.module.css`
3. 在 `App.tsx` 中添加路由

```tsx
// App.tsx
import MyPage from './pages/MyPage';

// 在 Routes 中添加
<Route path="/mypage" element={<MyPage />} />

// 在侧边栏导航中添加
{ to: '/mypage', label: `🌟 ${t('nav.myPage')}` },
```

### 2. 修改侧边栏

打开 `packages/renderer/src/App.tsx`：

```tsx
<nav className={styles.sidebar}>
  {/* 修改 Logo */}
  <h2 className={styles.logo}>我的应用名称</h2>
  
  {/* 修改导航项 */}
  {[
    { to: '/', label: `🏠 ${t('nav.home')}` },      // 修改图标和文字
    { to: '/new', label: `✨ 新页面` },              // 添加新项
    // ...
  ].map(...)}
  
  <div className={styles.controls}>
    <ThemeToggle />
    <LanguageSwitcher />
    {/* 在这里添加新控件 */}
  </div>
</nav>
```

### 3. 修改窗口大小

打开 `packages/main/src/main.ts`：

```typescript
const win = new BrowserWindow({
  width: 1400,    // 修改宽度（默认 1280）
  height: 900,    // 修改高度（默认 800）
  // ...
});
```

### 4. 修改应用标题

打开 `packages/renderer/index.html`：

```html
<title>我的应用名称</title>
```

---

## 🚀 开发工作流

### 启动开发服务器

```bash
# 在项目根目录执行
pnpm dev
```

会同时启动：
- **主进程**（Electron）：监听文件变化自动重启
- **渲染进程**（React）：Vite 热更新，保存即刷新

### 构建生产版本

```bash
pnpm build
```

生成文件在：
- `packages/main/dist/` - 主进程代码
- `packages/renderer/dist/` - 前端代码

### 代码检查

```bash
pnpm typecheck    # TypeScript 类型检查（必过才能提交）
```

---

## 📦 Electron 打包与测试

### 什么是打包？

**开发时**：代码分散在多个文件，需要 `pnpm dev` 运行  
**打包后**：生成一个可双击运行的 `.exe`（Windows）/ `.app`（Mac）/ `.AppImage`（Linux）

### 安装打包工具

```bash
# 安装 electron-builder（只需执行一次）
cd packages/main
pnpm add -D electron-builder
```

### 配置打包

在 `packages/main/package.json` 中添加打包配置：

```json
{
  "name": "@delightify/main",
  "version": "0.1.0",
  "main": "./dist/main.js",
  "author": "Your Name",
  "description": "Delightify - Minecraft 配方魔改工具",
  
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist",
    "pack": "electron-builder --dir",
    "dist": "electron-builder"
  },
  
  "build": {
    "appId": "com.yourcompany.delightify",
    "productName": "Delightify",
    "directories": {
      "output": "../../release",
      "buildResources": "build"
    },
    "files": [
      "dist/**/*",
      "../../config/**/*",
      "!node_modules/**/*"
    ],
    "asar": true,
    "win": {
      "target": [
        {
          "target": "nsis",
          "arch": ["x64"]
        },
        {
          "target": "portable",
          "arch": ["x64"]
        }
      ],
      "icon": "build/icon.ico"
    },
    "mac": {
      "target": [
        {
          "target": "dmg",
          "arch": ["x64", "arm64"]
        }
      ],
      "icon": "build/icon.icns",
      "category": "public.app-category.utilities"
    },
    "linux": {
      "target": [
        {
          "target": "AppImage",
          "arch": ["x64"]
        },
        {
          "target": "deb",
          "arch": ["x64"]
        }
      ],
      "icon": "build/icons",
      "category": "Utility"
    }
  },
  
  "dependencies": {
    "@delightify/shared": "workspace:*",
    "drizzle-orm": "^0.30.0",
    "electron": "^30.0.0"
  },
  "devDependencies": {
    "electron-builder": "^24.0.0",
    "typescript": "^5.4.0"
  }
}
```

### 准备图标文件

打包需要应用图标，按平台准备：

```
packages/main/build/
├── icon.ico          ← Windows 图标 (256x256)
├── icon.icns         ← Mac 图标 (512x512)
└── icons/            ← Linux 图标
    ├── 16x16.png
    ├── 32x32.png
    ├── 48x48.png
    ├── 64x64.png
    ├── 128x128.png
    ├── 256x256.png
    └── 512x512.png
```

**图标生成工具推荐**：
- 在线转换：https://cloudconvert.com/
- 命令行：`pnpm add -g icon-gen` 或 `pnpm add -D electron-icon-builder`

### 打包步骤

#### 1. 确保代码已构建

```bash
# 在项目根目录
cd /home/aeroseira/dev/GitRepos/Delightify
pnpm build
```

#### 2. 复制 workspace 依赖（重要！）

```bash
cd packages/main
node scripts/copy-shared.js
```

这会将 `@delightify/shared` 复制到 `node_modules`，解决打包后找不到模块的问题。

#### 3. 打包当前平台（不生成安装程序）

```bash
pnpm pack    # 仅打包，不生成安装器，用于测试
```

输出：`release/win-unpacked/`（Windows 示例）  
可直接运行里面的 `.exe` 测试

#### 3. 打包并生成安装程序

```bash
cd packages/main
pnpm dist    # 生成完整安装包
```

输出文件：
- **Windows**：`release/Delightify Setup 0.1.0.exe`
- **Mac**：`release/Delightify-0.1.0.dmg`
- **Linux**：`release/Delightify-0.1.0.AppImage`

### 跨平台打包

**注意**：electron-builder 默认只能打包**当前所在平台**。

| 你想打包 | 你需要在 | 命令 |
|---------|---------|------|
| Windows (.exe) | Windows 电脑 | `pnpm dist` |
| Mac (.dmg) | Mac 电脑 | `pnpm dist` |
| Linux (.AppImage) | Linux 电脑 | `pnpm dist` |

**跨平台打包方案**：

1. **GitHub Actions**（推荐）：推送到 GitHub 自动打包所有平台
2. **Docker**：使用 Linux 容器打包所有平台（仅限 Windows/Linux，Mac 必须用 Mac）
3. **虚拟机**：在 Windows/Mac 虚拟机中分别打包

### GitHub Actions 自动打包配置

创建 `.github/workflows/build.yml`：

```yaml
name: Build and Release

on:
  push:
    tags:
      - 'v*'    # 推送 v 开头的标签时触发，如 v0.1.0

jobs:
  build:
    runs-on: ${{ matrix.os }}
    
    strategy:
      matrix:
        os: [macos-latest, windows-latest, ubuntu-latest]
        
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          
      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 9
          
      - name: Install dependencies
        run: pnpm install
        
      - name: Build
        run: pnpm build
        
      - name: Build Electron App
        run: |
          cd packages/main
          pnpm dist
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          
      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: ${{ matrix.os }}-build
          path: |
            release/*.exe
            release/*.dmg
            release/*.AppImage
            release/*.deb
            release/*.snap
```

### 打包前测试清单

打包前确保以下功能正常：

```markdown
## 功能测试清单

### 基础功能
- [ ] 应用能正常启动
- [ ] 窗口大小正确（1280x800）
- [ ] 标题栏显示正确（Delightify）
- [ ] 图标显示正确（任务栏/ Dock）

### 界面
- [ ] 侧边栏导航正常
- [ ] 所有页面能切换
- [ ] 深色/浅色主题切换正常
- [ ] 语言切换正常（中文/英文）

### 文件操作
- [ ] 能选择文件夹（项目选择）
- [ ] 能选择 JAR 文件
- [ ] 文件操作有正确反馈

### 性能
- [ ] 启动时间在 3 秒内
- [ ] 切换页面无卡顿
- [ ] 内存占用合理（< 500MB）
```

### 调试打包问题

#### 问题 1：打包后白屏

**原因**：渲染进程路径错误  
**解决**：检查 `main.ts` 中的 loadFile/loadURL 路径

```typescript
// 开发环境
if (isDev) {
  win.loadURL('http://localhost:5173');
} else {
  // 生产环境 - 确保路径正确
  win.loadFile(path.join(__dirname, '../../renderer/dist/index.html'));
}
```

#### 问题 2：资源文件缺失

**原因**：配置文件/图标没被打包  
**解决**：在 `package.json` 的 `build.files` 中包含

```json
"files": [
  "dist/**/*",
  "../../config/**/*",    // 包含配置
  "build/icon.*",         // 包含图标
  "!node_modules/**/*"
]
```

#### 问题 3：Node 模块找不到

**原因**：依赖没正确安装  
**解决**：确保 `dependencies` 而非 `devDependencies`

```bash
# 如果是运行时需要的模块
cd packages/main
pnpm add better-sqlite3    # 不是 -D
```

#### 问题 4：图标不显示

**原因**：图标格式或路径错误  
**解决**：
- Windows：使用 `.ico` 格式（多尺寸：16,32,48,256）
- Mac：使用 `.icns` 格式
- Linux：使用 `.png` 文件夹

### 发布新版本流程

```bash
# 1. 更新版本号（所有 package.json）
# packages/main/package.json
# packages/renderer/package.json  
# packages/shared/package.json
# package.json（根目录）

# 2. 提交代码
git add .
git commit -m "chore: bump version to v0.2.0"

# 3. 打标签
git tag v0.2.0

# 4. 推送（GitHub Actions 会自动打包）
git push origin main --tags

# 5. 等待 GitHub Actions 完成，在 Releases 页面发布
```

---

## 🐛 调试技巧

### 1. 查看界面（渲染进程）
按 `Ctrl+Shift+I`（或菜单：View → Developer → Developer Tools）

### 2. 查看主进程日志
终端会输出 `console.log` 的内容

### 3. 修改代码后没生效？
- 检查终端是否有红色报错
- 刷新页面（Ctrl+R）
- 重启 `pnpm dev`

### 4. 样式不生效？
- 检查类名是否拼写正确（CSS Modules 要求精确匹配）
- 检查 CSS 变量名是否正确
- 在 DevTools 中查看元素实际应用的样式

---

## 📚 技术栈参考

| 技术 | 用途 | 学习资源 |
|------|------|----------|
| React | 界面框架 | https://zh-hans.react.dev/ |
| TypeScript | 类型安全的 JavaScript | https://www.typescriptlang.org/zh/ |
| CSS Modules | 组件级 CSS | 文件名 `.module.css` |
| Zustand | 状态管理（比 Redux 简单） | https://docs.pmnd.rs/zustand |
| Electron | 桌面应用外壳 | https://www.electronjs.org/zh/docs/latest |

---

## 💡 最佳实践

1. **不要直接修改 `node_modules`** - 修改会被重置
2. **优先使用 CSS 变量** - 确保深色/浅色模式都能正常显示
3. **文字走 i18n** - 即使只做中文，也便于后期维护
4. **组件要独立** - 一个组件一个文件夹，包含自己的样式
5. **经常运行 `pnpm typecheck`** - 尽早发现类型错误

---

## 📋 打包相关文件索引

| 文件 | 用途 |
|------|------|
| `DEVELOPER_GUIDE.md` | 本文件，打包详细教程 |
| `QUICK_REF.md` | 打包命令速查 |
| `PACKAGE_TEST_CHECKLIST.md` | 发布前测试清单 |
| `.github/workflows/build.yml` | GitHub Actions 自动打包配置 |

---

如有其他问题，随时询问！
