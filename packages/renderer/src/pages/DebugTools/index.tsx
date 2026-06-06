import React, { useState, useEffect } from 'react';
import { electronAPI } from '../../ipc';
import { useProjectStore } from '../../store/projectStore';
import styles from './style.module.css';

interface TableInfo {
  name: string;
  rowCount: number;
}

export default function DebugToolsPage(): React.ReactElement {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [queryResult, setQueryResult] = useState<unknown[] | null>(null);
  const [query, setQuery] = useState('SELECT * FROM items LIMIT 10');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const { currentProject } = useProjectStore();

  // 加载数据库信息
  const loadInfo = async () => {
    if (!currentProject) {
      setMessage('请先打开一个项目');
      return;
    }
    
    try {
      setLoading(true);
      const api = electronAPI();
      
      // 获取表信息
      const tablesRes = await api.debugDbTables(currentProject.path);
      if (tablesRes.success) {
        setTables(tablesRes.data || []);
      }
    } catch (err) {
      console.error('Failed to load debug info:', err);
      setMessage('加载失败: ' + String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInfo();
  }, []);

  // 执行查询
  const executeQuery = async () => {
    if (!currentProject) {
      setMessage('请先打开一个项目');
      return;
    }
    
    try {
      setLoading(true);
      const api = electronAPI();
      const result = await api.debugDbQuery(currentProject.path, query);
      if (result.success) {
        setQueryResult(result.data || []);
        setMessage(null);
      } else {
        setMessage('查询失败: ' + result.error);
      }
    } catch (err) {
      setMessage('查询失败: ' + String(err));
    } finally {
      setLoading(false);
    }
  };

  // 清空数据库
  const clearAll = async () => {
    if (!currentProject) {
      setMessage('请先打开一个项目');
      return;
    }
    
    if (!confirm('⚠️ 危险操作！\n\n确定要清空整个数据库吗？\n所有数据（模组、物品、配方）都将被删除！')) return;
    if (!confirm('再次确认：真的要清空所有数据吗？此操作不可恢复！')) return;
    
    try {
      setLoading(true);
      const api = electronAPI();
      const result = await api.debugClearData(currentProject.path);
      if (result.success) {
        setMessage('数据库已清空');
        setQueryResult(null);
        loadInfo();
      } else {
        setMessage('清空失败: ' + result.error);
      }
    } catch (err) {
      setMessage('清空失败: ' + String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>数据库管理工具</h1>
      
      {message && (
        <div className={styles.message}>
          {message}
          <button onClick={() => setMessage(null)}>×</button>
        </div>
      )}

      {/* 项目信息 */}
      <section className={styles.section}>
        <h2>当前项目</h2>
        {currentProject ? (
          <div className={styles.pathList}>
            <div className={styles.pathItem}>
              <span className={styles.pathLabel}>项目名称:</span>
              <code className={styles.pathValue}>{currentProject.name}</code>
            </div>
            <div className={styles.pathItem}>
              <span className={styles.pathLabel}>项目路径:</span>
              <code className={styles.pathValue}>{currentProject.path}</code>
            </div>
          </div>
        ) : (
          <p className={styles.warning}>请先打开一个项目</p>
        )}
      </section>

      {/* 表统计 */}
      <section className={styles.section}>
        <h2>数据表统计</h2>
        <div className={styles.tableGrid}>
          {tables.map(table => (
            <div key={table.name} className={styles.tableCard}>
              <span className={styles.tableName}>{table.name}</span>
              <span className={styles.tableCount}>{table.rowCount} 行</span>
            </div>
          ))}
        </div>
      </section>

      {/* 查询工具 */}
      <section className={styles.section}>
        <h2>SQL 查询工具</h2>
        <div className={styles.queryBox}>
          <textarea
            className={styles.queryInput}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            rows={3}
            placeholder="输入 SELECT 查询..."
          />
          <button 
            className={styles.queryBtn}
            onClick={executeQuery}
            disabled={loading}
          >
            执行查询
          </button>
        </div>
        
        {queryResult && (
          <div className={styles.resultBox}>
            <h3>查询结果 ({queryResult.length} 行)</h3>
            <pre className={styles.resultPre}>
              {JSON.stringify(queryResult, null, 2)}
            </pre>
          </div>
        )}
      </section>

      {/* 危险操作 */}
      <section className={styles.section}>
        <h2 className={styles.dangerTitle}>⚠️ 危险操作</h2>
        <div className={styles.dangerZone}>
          <button 
            className={styles.clearBtn}
            onClick={clearAll}
            disabled={loading}
          >
            🗑️ 清空整个数据库
          </button>
          <p className={styles.warning}>
            此操作将删除所有数据，包括模组、物品、配方和材质缓存。
          </p>
        </div>
      </section>

      {/* 刷新按钮 */}
      <button 
        className={styles.refreshBtn}
        onClick={loadInfo}
        disabled={loading}
      >
        {loading ? '加载中...' : '🔄 刷新信息'}
      </button>
    </div>
  );
}
