import { useState } from 'react';
import { translator } from './i18n.ts';
import { usePreferences } from './preferences.ts';
import { PreferencesDialog } from './components/PreferencesDialog.tsx';
import { Icon } from './components/Icon.tsx';
import styles from './App.module.css';

export function App() {
  const [preferences, setPreferences] = usePreferences();
  const [share, setShare] = useState('');
  const t = translator(preferences.locale);
  return <div className={styles.app}>
    <header className={styles.header}><div className={styles.brand}><Icon name="grid" /><span>Playlist Avatar</span></div>
      <div className={styles.headerActions}><span className={styles.sourceBadge}>{t('example')}</span><PreferencesDialog value={preferences} onChange={setPreferences} /></div></header>
    <main className={styles.workspace}>
      <aside className={styles.left}><h1>{t('create')}</h1><label htmlFor="share">{t('playlist')}</label>
        <textarea id="share" value={share} onChange={event => setShare(event.target.value)} placeholder={t('playlistPlaceholder')} rows={3} />
        <div className={styles.sectionTitle}>{t('templates')}</div><button className={styles.templateCard} aria-pressed="true">
          <span className={styles.miniature}><i /><i /><i /><i /></span><span>{t('mosaic')}</span></button>
      </aside>
      <section className={styles.stage} aria-label={t('exampleArtwork')}>
        <div className={styles.stageLabel}><span>Mosaic</span><span>{t('unsaved')}</span></div>
        <div className={styles.example} role="img" aria-label={t('exampleArtwork')}><i /><i /><i /><i /></div>
      </section>
    </main>
  </div>;
}
