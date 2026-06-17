import React, { Suspense, lazy, useEffect, useState, useMemo } from 'react';
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useI18n } from './i18n';
import { initializeTheme } from './theme';
import ErrorBoundary from './components/ErrorBoundary';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import StatusBar from './components/StatusBar';
import WorkbenchTabs from './components/WorkbenchTabs';
import InspectorPanel from './components/InspectorPanel';
import BottomPanel from './components/BottomPanel';
import Dashboard from './pages/Dashboard';
import ProjectManagerPage from './pages/ProjectManager';
import DataImportPage from './pages/ModManager';
import ItemBrowserPage from './pages/ItemBrowser';
import RecipeBrowserPage from './pages/RecipeBrowser';
import ActionWorkbenchPage from './pages/ActionWorkbench';
import RecipeEditorPage from './pages/RecipeEditor';
import ConversionToolPage from './pages/ConversionTool';
import DebugToolsPage from './pages/DebugTools';
import styles from './App.module.css';

const ScriptWorkspacePage = lazy(() => import('./pages/ScriptWorkspace'));

// Inner component that has access to router
function AppContent(): React.ReactElement {
  const { t } = useI18n();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const location = useLocation();
  
  const pageTitle = useMemo(() => {
    const path = location.pathname;
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
  }, [location.pathname, t]);

  return (
    <div className={styles.appContainer}>
      <Sidebar 
        collapsed={sidebarCollapsed} 
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)} 
      />
      
      <div className={`${styles.mainWrapper} ${sidebarCollapsed ? styles.mainWrapperCollapsed : ''}`}>
        <Header 
          pageTitle={pageTitle}
          onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)} 
        />
        <WorkbenchTabs pageTitle={pageTitle} />

        <div className={styles.workbenchBody}>
          <main className={styles.mainContent}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/projects" element={<ProjectManagerPage />} />
              <Route path="/data-import" element={<DataImportPage />} />
              <Route path="/items" element={<ItemBrowserPage />} />
              <Route path="/recipes" element={<RecipeBrowserPage />} />
              <Route path="/actions" element={<ActionWorkbenchPage />} />
              <Route
                path="/scripts"
                element={(
                  <Suspense fallback={<div className={styles.routeLoading}>{t('common.loading')}</div>}>
                    <ScriptWorkspacePage />
                  </Suspense>
                )}
              />
              <Route path="/editor" element={<RecipeEditorPage />} />
              <Route path="/convert" element={<ConversionToolPage />} />
              <Route path="/debug" element={<DebugToolsPage />} />
            </Routes>
          </main>
          <InspectorPanel />
        </div>
        <BottomPanel />
        <StatusBar />
      </div>
    </div>
  );
}

export default function App(): React.ReactElement {
  // 初始化主题
  useEffect(() => {
    initializeTheme();
  }, []);

  return (
    <ErrorBoundary>
      <HashRouter>
        <AppContent />
      </HashRouter>
    </ErrorBoundary>
  );
}
