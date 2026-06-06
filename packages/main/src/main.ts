/**
 * Delightify Main Process - v2.0
 * 
 * Electron 主进程入口
 * 项目为中心的模式，不再使用全局数据库
 */

import * as path from 'path';

// 加载 .env 文件
const dotenv = require('dotenv');
const fs = require('fs');

const possibleEnvPaths = [
  path.resolve(__dirname, '../../../.env'),
  path.resolve(__dirname, '../../../../.env'),
  path.resolve(process.cwd(), '.env'),
];

let envLoaded = false;
for (const envPath of possibleEnvPaths) {
  if (fs.existsSync(envPath)) {
    const result = dotenv.config({ path: envPath });
    if (!result.error) {
      console.log('[Main] Loaded .env from:', envPath);
      envLoaded = true;
      break;
    }
  }
}

if (!envLoaded) {
  console.warn('[Main] No .env file found');
}

import { app, BrowserWindow } from 'electron';
import { registerAllHandlers } from './ipc';
import { appPaths } from './services/paths';
import { closeAllConnections } from './services/database';

// 开发环境检测
const isDevMode = (): boolean => {
  if (process.env.NODE_ENV === 'development') {
    return true;
  }
  const hasSrcDir = fs.existsSync(path.join(__dirname, '../src'));
  const hasRendererSrc = fs.existsSync(path.join(__dirname, '../../renderer/src'));
  return hasSrcDir || hasRendererSrc;
};

let isDev = isDevMode();

console.log('[Main] NODE_ENV:', process.env.NODE_ENV);
console.log('[Main] isDev:', isDev);

/**
 * 获取生产环境 index.html 的路径
 */
function getProductionIndexPath(): string {
  const resourcesPath = process.resourcesPath;
  const appPath = app.getAppPath();
  
  const asarRendererPath = path.join(__dirname, 'renderer', 'index.html');
  const asarDistPath = path.join(__dirname, '..', 'renderer', 'index.html');
  const devPath = path.join(__dirname, '..', '..', 'renderer', 'dist', 'index.html');
  
  const winPortablePaths = [
    path.join(resourcesPath, 'app.asar', 'dist', 'renderer', 'index.html'),
    path.join(resourcesPath, 'app', 'dist', 'renderer', 'index.html'),
    path.join(appPath, 'dist', 'renderer', 'index.html'),
    path.join(process.cwd(), 'dist', 'renderer', 'index.html'),
  ];
  
  const paths = [
    { path: asarRendererPath, name: 'asar-renderer' },
    { path: asarDistPath, name: 'asar-dist' },
    ...winPortablePaths.map((p, i) => ({ path: p, name: `win-portable-${i + 1}` })),
    { path: devPath, name: 'dev' },
  ];
  
  for (const { path: testPath, name } of paths) {
    if (fs.existsSync(testPath)) {
      console.log(`[Main] Using ${name}:`, testPath);
      return testPath;
    }
  }
  
  return asarRendererPath;
}

/**
 * 检测 Vite dev server 是否运行
 */
async function isViteDevServerRunning(): Promise<boolean> {
  try {
    const response = await fetch('http://localhost:5173');
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * 创建主窗口
 */
async function createWindow(): Promise<void> {
  const preloadPath = path.join(__dirname, 'preload.js');
  console.log('[Main] Preload path:', preloadPath);
  
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: !isDev,
    },
  });

  // 监听控制台消息
  win.webContents.on('console-message', (_event, level, message) => {
    if (message.includes('electronAPI') || level === 3) {
      console.log(`[Renderer:${level}] ${message}`);
    }
  });

  // 检测 Vite dev server
  const viteRunning = await isViteDevServerRunning();
  
  if (viteRunning && isDev) {
    console.log('[Main] Loading Vite dev server');
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    const indexPath = getProductionIndexPath();
    console.log('[Main] Loading production build:', indexPath);
    
    if (fs.existsSync(indexPath)) {
      win.loadFile(indexPath);
    } else {
      win.loadURL(`data:text/html,${encodeURIComponent(`
        <html>
          <body style="padding:40px;font-family:sans-serif">
            <h1>Delightify v2.0</h1>
            <p>生产构建文件未找到</p>
            <p>路径: ${indexPath}</p>
          </body>
        </html>
      `)}`);
    }
  }
}

/**
 * 初始化应用
 */
async function initializeApp(): Promise<void> {
  console.log('[Main] Initializing Delightify v2.0...');
  
  try {
    // 确保目录结构存在
    await appPaths.ensureDirectories();
    console.log('[Main] Directories ensured');
    
    console.log('[Main] Application initialized successfully');
  } catch (error) {
    console.error('[Main] Failed to initialize:', error);
  }
}

// 应用启动
app.whenReady().then(async () => {
  appPaths.initialize();
  
  isDev = !app.isPackaged;
  console.log('[Main] isPackaged:', app.isPackaged);
  
  await initializeApp();
  registerAllHandlers();
  await createWindow();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  console.log('[Main] Application quitting, cleaning up...');
  closeAllConnections();
});

process.on('uncaughtException', (error) => {
  console.error('[Main] Uncaught exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Main] Unhandled rejection at:', promise, 'reason:', reason);
});
