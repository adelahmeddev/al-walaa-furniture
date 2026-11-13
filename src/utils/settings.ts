import defaultSettings from '../data/settings.json';
import defaultMedia from '../data/media.json';

export interface SiteSettings {
  phone: string;
  displayPhone: string;
  whatsappNumber: string;
  displayWhatsapp: string;
  workingHours: string;
  topBar?: {
    enabled?: boolean;
  };
  social?: {
    facebook?: string;
    instagram?: string;
    tiktok?: string;
    youtube?: string;
    [key: string]: string | undefined;
  };
}

export interface MediaItem {
  id: string;
  type: 'image' | 'video';
  src: string;
  thumbnail: string;
  category: string;
  title: string;
  titleEn?: string;
  alt?: string;
  altEn?: string;
  desc: string;
  descEn?: string;
}

export interface SocialLinkItem {
  key: 'facebook' | 'instagram' | 'tiktok' | 'youtube';
  label: string;
  url: string;
}

export const SOCIAL_PLATFORMS: Array<{ key: SocialLinkItem['key']; label: string }> = [
  { key: 'facebook', label: 'Facebook' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'tiktok', label: 'TikTok' },
  { key: 'youtube', label: 'YouTube' },
];

export function getSocialLinks(settings: SiteSettings): SocialLinkItem[] {
  return SOCIAL_PLATFORMS.map((platform) => ({
    key: platform.key,
    label: platform.label,
    url: (settings.social?.[platform.key] || '').trim(),
  }));
}

export function formatEgyptPhone(raw: string, fallback: string = ''): string {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.startsWith('20') && digits.length === 12) {
    return `+${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  }
  return digits ? `+${digits}` : fallback;
}

export function buildWhatsAppLink(number: string, messageText: string): string {
  let cleanNumber = String(number || '').replace(/\D/g, '');
  if (cleanNumber.startsWith('01') && cleanNumber.length === 11) {
    cleanNumber = `2${cleanNumber}`;
  }
  const encoded = encodeURIComponent(messageText);
  return `https://wa.me/${cleanNumber}?text=${encoded}`;
}

export function getInitialSettings(): SiteSettings {
  return defaultSettings as SiteSettings;
}

export function getDefaultMediaItems(): MediaItem[] {
  return defaultMedia.items as MediaItem[];
}

function safeUrlOrEmpty(raw: unknown): string {
  const val = String(raw || '').trim();
  if (!val) return '';
  if (val.startsWith('/')) return val;
  try {
    const parsed = new URL(val);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : '';
  } catch {
    return '';
  }
}

export function sanitizeSettings(input: Partial<SiteSettings>): SiteSettings {
  const base = getInitialSettings();
  const phone = String(input.phone ?? base.phone).replace(/[^\d+]/g, '').trim() || base.phone;
  let whatsappNumber =
    String(input.whatsappNumber ?? base.whatsappNumber).replace(/[^\d+]/g, '').trim() || base.whatsappNumber;
  const displayPhone = String(input.displayPhone ?? base.displayPhone).trim() || formatEgyptPhone(phone, base.displayPhone);
  const displayWhatsapp =
    String(input.displayWhatsapp ?? base.displayWhatsapp ?? '').trim() ||
    (whatsappNumber.startsWith('01') ? whatsappNumber : formatEgyptPhone(whatsappNumber, displayPhone));
  const workingHours = String(input.workingHours ?? base.workingHours).trim() || base.workingHours;

  return {
    phone,
    displayPhone,
    whatsappNumber,
    displayWhatsapp,
    workingHours,
    topBar: {
      enabled: input.topBar?.enabled !== false,
    },
    social: {
      facebook: safeUrlOrEmpty(input.social?.facebook),
      instagram: safeUrlOrEmpty(input.social?.instagram),
      tiktok: safeUrlOrEmpty(input.social?.tiktok),
      youtube: safeUrlOrEmpty(input.social?.youtube),
    },
  };
}

export function sanitizeMediaItems(items: unknown): MediaItem[] {
  if (!Array.isArray(items)) return [];
  const validCategories = new Set(['moving', 'packing', 'team', 'storage']);

  return items
    .map((raw, index): MediaItem | null => {
      if (!raw || typeof raw !== 'object') return null;
      const item = raw as Record<string, unknown>;
      const type = item.type === 'video' ? 'video' : 'image';
      const src = safeUrlOrEmpty(item.src);
      const title = String(item.title || '').trim();
      if (!src || !title) return null;

      const rawThumb = safeUrlOrEmpty(item.thumbnail);
      const thumbnail = rawThumb || (type === 'video' ? '/media/truck-loading-cairo.jpg' : src);
      const category = validCategories.has(String(item.category)) ? String(item.category) : 'moving';

      return {
        id: String(item.id || `${Date.now()}-${index}`).trim(),
        type,
        src,
        thumbnail,
        category,
        title,
        titleEn: String(item.titleEn || title).trim(),
        alt: String(item.alt || title).trim(),
        altEn: String(item.altEn || item.titleEn || title).trim(),
        desc: String(item.desc || '').trim(),
        descEn: String(item.descEn || item.desc || '').trim(),
      };
    })
    .filter((item): item is MediaItem => item !== null);
}
