import React, { useEffect, useState, useMemo } from 'react';
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useI18n } from './i18n';
import { initializeTheme } from './theme';
import ErrorBoundary from './components/ErrorBoundary';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
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
        
        <main className={styles.mainContent}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/projects" element={<ProjectManagerPage />} />
            <Route path="/data-import" element={<DataImportPage />} />
            <Route path="/items" element={<ItemBrowserPage />} />
            <Route path="/recipes" element={<RecipeBrowserPage />} />
            <Route path="/actions" element={<ActionWorkbenchPage />} />
            <Route path="/editor" element={<RecipeEditorPage />} />
            <Route path="/convert" element={<ConversionToolPage />} />
            <Route path="/debug" element={<DebugToolsPage />} />
          </Routes>
        </main>
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
