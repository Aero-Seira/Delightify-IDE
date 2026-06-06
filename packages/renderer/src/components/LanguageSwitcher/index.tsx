import React from 'react';
import { useI18n } from '../../i18n';
import type { Language } from '@delightify/shared';
import styles from './style.module.css';

const languages: { value: Language; label: string; flag: string }[] = [
  { value: 'zh-CN', label: '中文', flag: '🇨🇳' },
  { value: 'en', label: 'English', flag: '🇬🇧' },
];

export default function LanguageSwitcher(): React.ReactElement {
  const { currentLanguage, setLanguage } = useI18n();

  return (
    <div className={styles.container}>
      <select
        value={currentLanguage}
        onChange={(e) => setLanguage(e.target.value as Language)}
        className={styles.select}
      >
        {languages.map((lang) => (
          <option key={lang.value} value={lang.value}>
            {lang.flag} {lang.label}
          </option>
        ))}
      </select>
    </div>
  );
}
