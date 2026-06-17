import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useI18n } from '../../i18n';
import styles from './style.module.css';

interface WorkbenchTabsProps {
  pageTitle: string;
}

interface TabInfo {
  path: string;
  title: string;
}

const PINNED_PATHS = new Set(['/']);

function titleForPath(path: string, t: (key: string) => string): string {
  switch (path) {
    case '/':
      return t('nav.dashboard');
    case '/projects':
      return t('nav.projectManager');
    case '/data-import':
      return t('nav.dataImport');
    case '/items':
      return t('nav.itemBrowser');
    case '/recipes':
      return t('nav.recipeBrowser');
    case '/actions':
      return t('nav.actionWorkbench');
    case '/scripts':
      return t('nav.scriptWorkspace');
    case '/editor':
      return t('nav.recipeEditor');
    case '/convert':
      return t('nav.conversionTool');
    case '/debug':
      return t('nav.debug');
    default:
      return t('common.appName');
  }
}

export default function WorkbenchTabs({ pageTitle }: WorkbenchTabsProps): React.ReactElement {
  const { t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const [openPaths, setOpenPaths] = useState<string[]>(['/']);

  useEffect(() => {
    setOpenPaths(previous => (
      previous.includes(location.pathname) ? previous : [...previous, location.pathname]
    ));
  }, [location.pathname]);

  const tabs = useMemo<TabInfo[]>(() => openPaths.map(path => ({
    path,
    title: path === location.pathname ? pageTitle : titleForPath(path, t),
  })), [location.pathname, openPaths, pageTitle, t]);

  const closeTab = (event: React.MouseEvent, path: string): void => {
    event.preventDefault();
    event.stopPropagation();

    if (PINNED_PATHS.has(path)) {
      return;
    }

    setOpenPaths(previous => {
      const next = previous.filter(entry => entry !== path);
      if (path === location.pathname) {
        navigate(next[next.length - 1] ?? '/');
      }
      return next.length > 0 ? next : ['/'];
    });
  };

  return (
    <div className={styles.tabsBar}>
      <div className={styles.tabsScroller}>
        {tabs.map(tab => {
          const active = tab.path === location.pathname;
          return (
            <NavLink
              key={tab.path}
              to={tab.path}
              className={`${styles.tab} ${active ? styles.tabActive : ''}`}
              title={tab.title}
            >
              <span className={styles.tabTitle}>{tab.title}</span>
              {!PINNED_PATHS.has(tab.path) && (
                <button
                  type="button"
                  className={styles.closeButton}
                  onClick={event => closeTab(event, tab.path)}
                  aria-label={`Close ${tab.title}`}
                >
                  x
                </button>
              )}
            </NavLink>
          );
        })}
      </div>
    </div>
  );
}
