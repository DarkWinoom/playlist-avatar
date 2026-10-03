import type { ErrorCode } from '@playlist-avatar/contracts';
import type { Locale } from './i18n.ts';

const messages: Record<Locale, Record<ErrorCode, string>> = {
  en: {
    INVALID_INPUT: 'Please use a playlist share link.', UNSUPPORTED_SOURCE: 'This source is not supported.',
    NOT_PUBLIC_OR_UNAVAILABLE: 'This playlist is unavailable. Try another public link or local images.',
    INCOMPLETE_SOURCE: 'Only part of the collection could be read.', UPSTREAM_TIMEOUT: 'Reading took too long. Please retry.',
    RATE_LIMITED: 'The source is busy. Please try again shortly.', IMAGE_UNAVAILABLE: 'This cover could not be loaded.',
    RESPONSE_TOO_LARGE: 'The source returned more data than this import can handle.', CANCELLED: 'Reading cancelled.',
    UNCONFIGURED_SOURCE: 'This import method is not configured.', CONNECTION_REQUIRED: 'Reconnect this library to continue.',
    INVALID_IMAGE: 'Please choose a supported image within the size limit.', UNSUPPORTED_FORMAT: 'This browser cannot encode that format. Try PNG.',
    INVALID_PACKAGE: 'This artwork file is incomplete or unsupported.', INTERNAL_ERROR: 'Something went wrong. Your current artwork is still here.',
  },
  'zh-CN': {
    INVALID_INPUT: '请使用歌单分享链接。', UNSUPPORTED_SOURCE: '暂不支持这个来源。',
    NOT_PUBLIC_OR_UNAVAILABLE: '暂时无法读取这个歌单，可换一个公开链接或使用本地图片。',
    INCOMPLETE_SOURCE: '目前只读取了部分内容。', UPSTREAM_TIMEOUT: '读取超时，请重试。',
    RATE_LIMITED: '来源暂时繁忙，请稍后重试。', IMAGE_UNAVAILABLE: '这张封面暂时无法加载。',
    RESPONSE_TOO_LARGE: '来源返回的数据超过了本次读取上限。', CANCELLED: '已取消读取。',
    UNCONFIGURED_SOURCE: '当前部署尚未配置这种导入方式。', CONNECTION_REQUIRED: '请重新连接这个音乐库。',
    INVALID_IMAGE: '请选择大小符合要求的 PNG、JPEG 或 WebP 图片。', UNSUPPORTED_FORMAT: '此浏览器无法编码这种格式，请改用 PNG。',
    INVALID_PACKAGE: '作品文件不完整或版本暂不支持。', INTERNAL_ERROR: '暂时遇到问题，当前作品已保留。',
  },
};
export function errorMessage(code: ErrorCode, locale: Locale) { return messages[locale][code]; }
