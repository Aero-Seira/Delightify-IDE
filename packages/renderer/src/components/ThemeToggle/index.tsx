import React from 'react';
import { useTheme } from '../../theme';
import styles from './style.module.css';

// Sun Icon
const SunIcon: React.FC = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);

// Moon Icon
const MoonIcon: React.FC = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

// Monitor Icon (for system preference)
const MonitorIcon: React.FC = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);

export default function ThemeToggle(): React.ReactElement {
  const { mode, resolvedMode, setMode, toggleMode } = useTheme();

  // 长按或右键显示菜单时的处理
  const handleClick = () => {
    toggleMode();
  };

  // 获取当前显示的图标
  const getIcon = () => {
    if (mode === 'system') {
      return resolvedMode === 'light' ? <SunIcon /> : <MoonIcon />;
    }
    return mode === 'light' ? <SunIcon /> : <MoonIcon />;
  };

  // 获取标题提示
  const getTitle = () => {
    if (mode === 'system') {
      return `Theme: Auto (${resolvedMode})`;
    }
    return `Theme: ${mode.charAt(0).toUpperCase() + mode.slice(1)}`;
  };

  return (
    <div className={styles.container}>
      
      <div className={styles.menu}>
        <button
          className={`${styles.menuItem} ${mode === 'light' ? styles.active : ''}`}
          onClick={() => setMode('light')}
          title="Light"
        >
          <SunIcon />
        </button>
        <button
          className={`${styles.menuItem} ${mode === 'dark' ? styles.active : ''}`}
          onClick={() => setMode('dark')}
          title="Dark"
        >
          <MoonIcon />
        </button>
        <button
          className={`${styles.menuItem} ${mode === 'system' ? styles.active : ''}`}
          onClick={() => setMode('system')}
          title="Auto"
        >
          <MonitorIcon />
        </button>
      </div>
    </div>
  );
}
