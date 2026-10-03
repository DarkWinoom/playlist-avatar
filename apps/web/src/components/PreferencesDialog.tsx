import * as Dialog from '@radix-ui/react-dialog';
import type { Dispatch, SetStateAction } from 'react';
import type { Preferences } from '../preferences.ts';
import { translator } from '../i18n.ts';
import { Icon } from './Icon.tsx';

export function PreferencesDialog({ value, onChange }: { value: Preferences; onChange: Dispatch<SetStateAction<Preferences>> }) {
  const t = translator(value.locale);
  return <Dialog.Root><Dialog.Trigger asChild><button className="icon-button" aria-label={t('preferences')}><Icon name="settings" /></button></Dialog.Trigger>
    <Dialog.Portal><Dialog.Overlay className="dialog-overlay" /><Dialog.Content className="dialog-content" aria-describedby={undefined}>
      <div className="dialog-heading"><Dialog.Title>{t('preferences')}</Dialog.Title><Dialog.Close asChild><button className="quiet-button">{t('close')}</button></Dialog.Close></div>
      <fieldset><legend>{t('appearance')}</legend><div className="segmented">
        {(['system', 'paper', 'ink'] as const).map(theme => <button key={theme} aria-pressed={value.theme === theme}
          onClick={() => onChange(previous => ({ ...previous, theme }))}>{t(theme)}</button>)}
      </div></fieldset>
      <fieldset><legend>{t('language')}</legend><div className="segmented">
        {(['en', 'zh-CN'] as const).map(locale => <button key={locale} aria-pressed={value.locale === locale}
          onClick={() => onChange(previous => ({ ...previous, locale }))}>{locale === 'en' ? 'English' : '简体中文'}</button>)}
      </div></fieldset>
      <button className="toggle-row" role="switch" aria-checked={value.reduceMotion}
        onClick={() => onChange(previous => ({ ...previous, reduceMotion: !previous.reduceMotion }))}>
        <span>{t('reducedMotion')}</span><span className="switch-track" data-checked={value.reduceMotion}><span /></span>
      </button>
    </Dialog.Content></Dialog.Portal></Dialog.Root>;
}
