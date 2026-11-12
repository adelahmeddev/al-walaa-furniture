import defaultSettings from '../data/settings.json';

export interface SiteSettings {
  phone: string;
  displayPhone: string;
  whatsappNumber: string;
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
  const cleanNumber = String(number || '').replace(/\D/g, '');
  const encoded = encodeURIComponent(messageText);
  return `https://wa.me/${cleanNumber}?text=${encoded}`;
}

export function getInitialSettings(): SiteSettings {
  return defaultSettings as SiteSettings;
}
