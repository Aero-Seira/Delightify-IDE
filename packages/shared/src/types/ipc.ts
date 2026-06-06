/**
 * IPC Types - v2.0
 * 
 * IPC 通信相关的类型定义
 */

/** IPC 响应通用类型 */
export interface IpcResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/** 进度回调类型 */
export type ProgressCallback<T> = (progress: T) => void;

/** 取消订阅函数 */
export type Unsubscribe = () => void;
