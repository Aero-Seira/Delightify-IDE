import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../../i18n';
import { electronAPI } from '../../ipc';
import { useProjectStore } from '../../store/projectStore';
import styles from './style.module.css';

// Icons
const GithubIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

const ArrowRightIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
);

const RocketIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
    <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
    <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
    <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
  </svg>
);

// Resource Card Component
interface ResourceCardProps {
  icon: React.FC;
  title: string;
  description: string;
  link: string;
}

const ResourceCard: React.FC<ResourceCardProps> = ({ icon: Icon, title, description, link }) => {
  return (
    <a href={link} target="_blank" rel="noopener noreferrer" className={styles.resourceCard}>
      <div className={styles.resourceIcon}>
        <Icon />
      </div>
      <div className={styles.resourceContent}>
        <h3 className={styles.resourceTitle}>{title}</h3>
        <p className={styles.resourceDescription}>{description}</p>
      </div>
    </a>
  );
};

type DashboardStats = {
  modCount: number;
  itemCount: number;
  recipeCount: number;
};

export default function Dashboard(): React.ReactElement {
  const { t } = useI18n();
  const {
    currentProject,
    projects,
    isLoadingProjects,
    loadProjects,
  } = useProjectStore();
  const [projectStats, setProjectStats] = useState<DashboardStats | null>(null);
  const hasRequestedProjects = useRef(false);

  useEffect(() => {
    if (!hasRequestedProjects.current && projects.length === 0 && !isLoadingProjects) {
      hasRequestedProjects.current = true;
      void loadProjects();
    }
  }, [isLoadingProjects, loadProjects, projects.length]);

  useEffect(() => {
    let canceled = false;

    if (!currentProject) {
      setProjectStats(null);
      return;
    }

    setProjectStats(null);

    const loadProjectStats = async () => {
      try {
        const result = await electronAPI().projectGetStats(currentProject.path);
        if (!canceled && result.success && result.data) {
          setProjectStats({
            modCount: result.data.modCount,
            itemCount: result.data.itemCount,
            recipeCount: result.data.recipeCount,
          });
          return;
        }
      } catch (error) {
        console.error('加载项目统计失败:', error);
      }

      if (!canceled) {
        setProjectStats(null);
      }
    };

    void loadProjectStats();

    return () => {
      canceled = true;
    };
  }, [currentProject]);

  const formatProjectStat = (value: number | undefined): string => {
    return currentProject && value !== undefined ? value.toLocaleString() : '—';
  };

  // Get greeting based on time
  const getGreeting = (): string => {
    const hour = new Date().getHours();
    if (hour < 12) return t('dashboard.greetingMorning');
    if (hour < 18) return t('dashboard.greetingAfternoon');
    return t('dashboard.greetingEvening');
  };

  const steps = [
    {
      number: 1,
      title: t('dashboard.step1.title'),
      description: t('dashboard.step1.description'),
      action: t('dashboard.step1.action'),
      link: '/mods',
    },
    {
      number: 2,
      title: t('dashboard.step2.title'),
      description: t('dashboard.step2.description'),
      action: t('dashboard.step2.action'),
      link: '/items',
    },
    {
      number: 3,
      title: t('dashboard.step3.title'),
      description: t('dashboard.step3.description'),
      action: t('dashboard.step3.action'),
      link: '/recipes',
    },
  ];

  const resources: ResourceCardProps[] = [
    {
      icon: GithubIcon,
      title: t('dashboard.resourceGithub'),
      description: t('dashboard.resourceGithubDesc'),
      link: 'https://github.com/Aero-Seira/Delightify',
    },
  ];

  return (
    <div className={styles.dashboard}>
      {/* Welcome Section */}
      <section className={styles.welcomeSection}>
        <h1 className={styles.greeting}>
          {getGreeting()}，{t('dashboard.welcome')}
        </h1>
        <p className={styles.subtitle}>{t('dashboard.subtitle')}</p>
      </section>

      {/* Stats Section */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <RocketIcon />
          {t('dashboard.quickStats')}
        </h2>
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{formatProjectStat(projectStats?.modCount)}</div>
            <div className={styles.statLabel}>{t('dashboard.statsMods')}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{formatProjectStat(projectStats?.itemCount)}</div>
            <div className={styles.statLabel}>{t('dashboard.statsItems')}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{formatProjectStat(projectStats?.recipeCount)}</div>
            <div className={styles.statLabel}>{t('dashboard.statsRecipes')}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{projects.length.toLocaleString()}</div>
            <div className={styles.statLabel}>{t('dashboard.statsProjects')}</div>
          </div>
        </div>
      </section>

      {/* Quick Start Section */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('dashboard.quickStart')}</h2>
        <div className={styles.steps}>
          {steps.map((step) => (
            <div key={step.number} className={styles.stepCard}>
              <div className={styles.stepNumber}>{step.number}</div>
              <div className={styles.stepContent}>
                <h3 className={styles.stepTitle}>{step.title}</h3>
                <p className={styles.stepDescription}>{step.description}</p>
                <Link to={step.link} className={styles.stepAction}>
                  {step.action}
                  <ArrowRightIcon />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Resources Section */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('dashboard.resources')}</h2>
        <div className={styles.resourceGrid}>
          {resources.map((resource) => (
            <ResourceCard
              key={resource.title}
              icon={resource.icon}
              title={resource.title}
              description={resource.description}
              link={resource.link}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
