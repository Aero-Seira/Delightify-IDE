# Delightify 快速参考卡

## 🎯 常用文件位置

| 要修改什么 | 去哪里找 |
|-----------|----------|
| **页面内容** | `packages/renderer/src/pages/[页面名]/index.tsx` |
| **页面样式** | `packages/renderer/src/pages/[页面名]/style.module.css` |
| **全局样式/颜色** | `packages/renderer/src/styles/global.css` |
| **中文文字** | `packages/renderer/src/i18n/locales/zh-CN.ts` |
| **英文文字** | `packages/renderer/src/i18n/locales/en.ts` |
| **侧边栏导航** | `packages/renderer/src/App.tsx` |
| **主题逻辑** | `packages/renderer/src/theme/store.ts` |
| **窗口大小** | `packages/main/src/main.ts` |

---

## 📝 常用代码片段

### 在页面中使用翻译
```tsx
import { useI18n } from '../../i18n';

const { t } = useI18n();

// 使用
<h1>{t('modManager.title')}</h1>
```

### 在页面中使用主题
```tsx
import { useTheme } from '../../theme';

const { mode, toggleMode } = useTheme();

// 使用
<button onClick={toggleMode}>当前主题: {mode}</button>
```

### 添加按钮样式
```css
.myButton {
  background-color: var(--accent);
  color: white;
  padding: 12px 24px;
  border-radius: 10px;
  border: none;
  cursor: pointer;
}

.myButton:hover {
  background-color: var(--accent-hover);
}
```

### 响应式主题色（自动适应深浅色）
```css
.myBox {
  /* 背景会自动随主题变化 */
  background-color: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border);
}
```

---

## 🎨 颜色变量速查

```css
/* 背景 */
var(--bg-primary)      /* 主背景 */
var(--bg-secondary)    /* 次背景 */

/* 强调色（蓝色） */
var(--accent)          /* 默认 */
var(--accent-hover)    /* 悬停 */
var(--accent-light)    /* 淡色背景 */

/* 文字 */
var(--text-primary)    /* 主要文字 */
var(--text-secondary)  /* 次要文字 */
var(--text-tertiary)   /* 辅助文字 */

/* 边框 */
var(--border)          /* 默认边框 */
var(--border-hover)    /* 悬停边框 */

/* 阴影 */
var(--shadow-sm)       /* 小阴影 */
var(--shadow-md)       /* 中阴影 */
var(--shadow-lg)       /* 大阴影 */
```

---

## 🔧 常用命令

```bash
# 开发（最常用）
pnpm dev

# 检查代码
pnpm typecheck

# 构建
pnpm build

# 清理
pnpm clean
```

---

## 📦 打包与发布

### 安装打包工具
```bash
cd packages/main
pnpm add -D electron-builder
```

### 打包配置（package.json）
```json
{
  "scripts": {
    "pack": "electron-builder --dir",
    "dist": "electron-builder"
  },
  "build": {
    "appId": "com.yourcompany.delightify",
    "productName": "Delightify",
    "directories": {
      "output": "../../release"
    },
    "files": [
      "dist/**/*",
      "../../config/**/*"
    ]
  }
}
```

### 打包命令
```bash
# 1. 先构建代码
cd /home/aeroseira/dev/GitRepos/Delightify
pnpm build

# 2. 打包（测试用，不生成安装器）
cd packages/main
pnpm pack          # 输出: release/win-unpacked/

# 3. 打包（生成安装程序）
pnpm dist          # 输出: release/Delightify Setup.exe
```

### 各平台输出文件
| 平台 | 文件类型 | 说明 |
|------|----------|------|
| Windows | `.exe` (nsis) | 安装程序 |
| Windows | `.exe` (portable) | 绿色版，无需安装 |
| Mac | `.dmg` | 磁盘映像安装包 |
| Linux | `.AppImage` | 可执行单文件 |
| Linux | `.deb` | Debian/Ubuntu 安装包 |

### 图标准备
```
packages/main/build/
├── icon.ico         # Windows (256x256)
├── icon.icns        # Mac (512x512)
└── icons/           # Linux (多尺寸)
    ├── 16x16.png
    ├── 32x32.png
    ├── 48x48.png
    ├── 128x128.png
    ├── 256x256.png
    └── 512x512.png
```

---

## 🐛 快速排错

### 开发调试
| 问题 | 解决方案 |
|------|----------|
| 修改没生效 | 按 `Ctrl+R` 刷新 |
| 样式不生效 | 检查类名拼写，DevTools 查看元素 |
| 报错 red 文字 | 看终端输出，通常是类型错误 |
| 页面白屏 | 检查浏览器控制台（Ctrl+Shift+I）|
| 构建失败 | 先运行 `pnpm typecheck` 看具体错误 |

### 打包问题
| 问题 | 解决方案 |
|------|----------|
| 打包后白屏 | 检查 main.ts 中 loadFile 路径 |
| 图标不显示 | 确保图标格式正确（ico/icns/png）|
| 资源缺失 | 在 package.json build.files 中添加 |
| 跨平台打包 | 必须在对应系统上打包（或用 CI）|

---

## 📦 添加新页面的步骤

1. **创建页面文件夹**
   ```bash
   mkdir packages/renderer/src/pages/MyPage
   ```

2. **创建页面文件** `index.tsx`
   ```tsx
   import React from 'react';
   import { useI18n } from '../../i18n';
   import styles from './style.module.css';
   
   export default function MyPage(): React.ReactElement {
     const { t } = useI18n();
     return (
       <div className={styles.container}>
         <h1>{t('myPage.title')}</h1>
       </div>
     );
   }
   ```

3. **创建样式文件** `style.module.css`
   ```css
   .container {
     padding: 24px;
   }
   ```

4. **添加翻译**（zh-CN.ts + en.ts）
   ```typescript
   myPage: {
     title: '我的页面',
   }
   ```

5. **添加路由**（App.tsx）
   ```tsx
   import MyPage from './pages/MyPage';
   <Route path="/mypage" element={<MyPage />} />
   ```

6. **添加导航**（App.tsx）
   ```tsx
   { to: '/mypage', label: `🌟 ${t('nav.myPage')}` },
   ```

---

保存此文件，开发时随时查阅！
