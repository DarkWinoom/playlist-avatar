export const en = {
  preferences: 'Preferences', close: 'Close', appearance: 'Appearance', language: 'Language',
  system: 'System', paper: 'Paper', ink: 'Ink', reducedMotion: 'Reduce motion',
  example: 'Original example', exampleArtwork: 'Four original geometric covers arranged as a mosaic',
  mosaic: 'Mosaic', playlist: 'Playlist share text', playlistPlaceholder: 'Paste a playlist link or share text',
  source: 'Music source', templates: 'Templates', adjust: 'Adjust', create: 'Make it yours',
  error: 'Something went wrong. Please try again.', unsaved: 'Not saved',
};
export type TranslationKey = keyof typeof en;
export type Locale = 'en' | 'zh-CN';
const zh: Record<TranslationKey, string> = {
  preferences: '偏好设置', close: '关闭', appearance: '外观', language: '语言',
  system: '跟随系统', paper: '纸白', ink: '墨黑', reducedMotion: '减少动态效果',
  example: '原创示例', exampleArtwork: '四张原创几何封面组成的拼贴',
  mosaic: '拼贴', playlist: '歌单分享内容', playlistPlaceholder: '粘贴歌单链接或分享内容',
  source: '音乐来源', templates: '模板', adjust: '调整', create: '把音乐做成作品',
  error: '暂时遇到问题，请重试。', unsaved: '尚未保存',
};
export function translator(locale: Locale) { return (key: TranslationKey) => (locale === 'zh-CN' ? zh : en)[key]; }
export function browserLocale(value = navigator.language): Locale {
  return /^zh(?:-cn|-hans(?:-cn)?)?$/i.test(value) ? 'zh-CN' : 'en';
}
