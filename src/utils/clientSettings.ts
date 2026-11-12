import type { SiteSettings } from './settings';

export function syncClientSettings(storageKey = 'mover_settings') {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return;
    const customSettings: Partial<SiteSettings> = JSON.parse(raw);
    if (!customSettings) return;

    if (customSettings.phone) {
      document.querySelectorAll('[data-contact-tel]').forEach((el) => {
        el.setAttribute('href', `tel:${customSettings.phone}`);
      });
      document.querySelectorAll('[data-contact-phone-display]').forEach((el) => {
        el.textContent = customSettings.displayPhone || customSettings.phone || '';
      });
    }

    if (customSettings.whatsappNumber) {
      document.querySelectorAll('[data-contact-whatsapp]').forEach((el) => {
        const currentHref = el.getAttribute('href') || '';
        const matchText = currentHref.match(/text=([^&]+)/);
        const queryText = matchText ? `?text=${matchText[1]}` : '';
        el.setAttribute('href', `https://wa.me/${customSettings.whatsappNumber}${queryText}`);
      });

      const waDigits = String(customSettings.whatsappNumber).replace(/\D/g, '');
      const waFormatted =
        customSettings.whatsappNumber === customSettings.phone && customSettings.displayPhone
          ? customSettings.displayPhone
          : waDigits.startsWith('20') && waDigits.length === 12
            ? `+${waDigits.slice(0, 2)} ${waDigits.slice(2, 5)} ${waDigits.slice(5, 8)} ${waDigits.slice(8)}`
            : `+${waDigits || customSettings.whatsappNumber}`;

      document.querySelectorAll('[data-contact-whatsapp-display]').forEach((el) => {
        el.textContent = waFormatted;
      });
    }

    if (customSettings.workingHours) {
      document.querySelectorAll('[data-contact-hours]').forEach((el) => {
        el.textContent = customSettings.workingHours || '';
      });
    }

    const topBarRoot = document.querySelector('[data-topbar-root]');
    if (topBarRoot && customSettings.topBar) {
      topBarRoot.classList.toggle('hidden', customSettings.topBar.enabled === false);
    }

    if (customSettings.social && typeof customSettings.social === 'object') {
      ['facebook', 'instagram', 'tiktok', 'youtube'].forEach((key) => {
        const rawUrl = (customSettings.social?.[key] || '').trim();
        let safeHref = '';
        if (rawUrl) {
          try {
            const parsed = new URL(rawUrl, window.location.origin);
            if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
              safeHref = parsed.href;
            }
          } catch {}
        }
        document.querySelectorAll(`[data-social-key="${key}"]`).forEach((link) => {
          if (safeHref) {
            link.setAttribute('href', safeHref);
            link.classList.remove('hidden');
          } else {
            link.classList.add('hidden');
          }
        });
      });
    }
  } catch (err) {
    console.error('Error syncing client settings:', err);
  }
}
