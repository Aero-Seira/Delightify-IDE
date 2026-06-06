/**
 * 浏览器文件系统适配器 - v2.1
 * 使用 File System Access API 模拟 Electron 的 fs/dialog 功能
 */

// 检查是否支持 File System Access API
export function supportsFileSystemAccess(): boolean {
  return 'showOpenFilePicker' in window && 'showDirectoryPicker' in window;
}

/**
 * 选择目录（替代 dialog.showOpenDialog）
 */
export async function selectDirectory(): Promise<{ canceled: boolean; filePaths?: string[] }> {
  if (!supportsFileSystemAccess()) {
    // 回退到传统 input file
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      (input as any).webkitdirectory = true;
      (input as any).directory = true;
      input.onchange = () => {
        if (input.files && input.files.length > 0) {
          // 获取第一个文件的父目录路径
          const path = input.files[0].webkitRelativePath.split('/')[0];
          resolve({ canceled: false, filePaths: [path] });
        } else {
          resolve({ canceled: true });
        }
      };
      input.click();
    });
  }

  try {
    const dirHandle = await (window as any).showDirectoryPicker();
    // 保存 handle 以便后续访问
    await saveDirectoryHandle(dirHandle);
    return { canceled: false, filePaths: [dirHandle.name] };
  } catch (e) {
    return { canceled: true };
  }
}

// 保存目录句柄到 IndexedDB
async function saveDirectoryHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openDB('fs-handles', 1);
  await db.put('handles', handle, handle.name);
}

// 简单的 IndexedDB 封装
function openDB(name: string, version: number): Promise<any> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (e: any) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('handles')) {
        db.createObjectStore('handles');
      }
    };
  });
}
