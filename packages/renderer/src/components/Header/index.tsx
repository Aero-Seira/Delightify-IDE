import React, { useState, useRef, useEffect } from 'react';
import { useI18n } from '../../i18n';
import { useTheme } from '../../theme';
import { electronAPI } from '../../ipc';
import styles from './style.module.css';
import type { Language } from '@delightify/shared';

// Icons
const MenuIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" x2="20" y1="12" y2="12" />
    <line x1="4" x2="20" y1="6" y2="6" />
    <line x1="4" x2="20" y1="18" y2="18" />
  </svg>
);

const SettingsIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const SunIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

const MoonIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const ChevronDownIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m6 9 6 6 6-6" />
  </svg>
);

const GithubIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

interface HeaderProps {
  onToggleSidebar: () => void;
  pageTitle: string;
}

export default function Header({ onToggleSidebar, pageTitle }: HeaderProps): React.ReactElement {
  const { t, currentLanguage, setLanguage } = useI18n();
  const { resolvedMode, toggleMode } = useTheme();
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const langDropdownRef = useRef<HTMLDivElement>(null);

  const languages: { value: Language; label: string; flag: string }[] = [
    { value: 'zh-CN', label: '中文', flag: '🇨🇳' },
    { value: 'en', label: 'English', flag: '🇬🇧' },
  ];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (langDropdownRef.current && !langDropdownRef.current.contains(event.target as Node)) {
        setLangDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
    setLangDropdownOpen(false);
  };

  const currentLang = languages.find(l => l.value === currentLanguage);

  return (
    <header className={styles.header}>
      {/* Left Section */}
      <div className={styles.leftSection}>
        <button className={styles.menuButton} onClick={onToggleSidebar} title={t('sidebar.toggle')}>
          <MenuIcon />
        </button>
        <h1 className={styles.pageTitle}>{pageTitle}</h1>
      </div>

      {/* Right Section */}
      <div className={styles.rightSection}>
        {/* Theme Toggle */}
        <button
          className={styles.iconButton}
          onClick={toggleMode}
          title={t('theme.toggle')}
        >
          {resolvedMode === 'light' ? <SunIcon /> : <MoonIcon />}
        </button>

        {/* Language Selector */}
        <div className={styles.languageSelector} ref={langDropdownRef}>
          <button
            className={styles.languageButton}
            onClick={() => setLangDropdownOpen(!langDropdownOpen)}
          >
            <span>{currentLang?.flag}</span>
            <span>{currentLang?.label}</span>
            <ChevronDownIcon />
          </button>
          
          {langDropdownOpen && (
            <div className={styles.dropdownMenu}>
              {languages.map((lang) => (
                <button
                  key={lang.value}
                  className={`${styles.dropdownItem} ${currentLanguage === lang.value ? styles.dropdownItemActive : ''}`}
                  onClick={() => handleLanguageChange(lang.value)}
                >
                  <span className={styles.dropdownFlag}>{lang.flag}</span>
                  <span>{lang.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={styles.divider} />

        {/* GitHub Link */}
        <button
          className={styles.iconButton}
          onClick={() => {
            const api = electronAPI();
            api.openExternal('https://github.com/Aero-Seira/Delightify');
          }}
          title={t('header.github')}
        >
          <GithubIcon />
        </button>

        {/* Settings */}
        <button className={styles.iconButton} title={t('header.settings')}>
          <SettingsIcon />
        </button>
      </div>
    </header>
  );
}
