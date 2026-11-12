-- Cloudflare D1 (SQLite) Schema for Al Walaa Furniture Moving

CREATE TABLE IF NOT EXISTS site_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  phone TEXT NOT NULL,
  display_phone TEXT NOT NULL,
  whatsapp_number TEXT NOT NULL,
  working_hours TEXT NOT NULL,
  top_bar_enabled INTEGER NOT NULL DEFAULT 1,
  social_facebook TEXT NOT NULL DEFAULT '',
  social_instagram TEXT NOT NULL DEFAULT '',
  social_tiktok TEXT NOT NULL DEFAULT '',
  social_youtube TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS media_items (
  id TEXT PRIMARY KEY,
  sort_order INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('image', 'video')),
  src TEXT NOT NULL,
  thumbnail TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'moving',
  title TEXT NOT NULL,
  title_en TEXT NOT NULL DEFAULT '',
  alt TEXT NOT NULL DEFAULT '',
  alt_en TEXT NOT NULL DEFAULT '',
  desc TEXT NOT NULL DEFAULT '',
  desc_en TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO site_settings (
  id, phone, display_phone, whatsapp_number, working_hours,
  top_bar_enabled, social_facebook, social_instagram, social_tiktok, social_youtube
) VALUES (
  1,
  '201000000000',
  '+20 100 000 0000',
  '201000000000',
  'خدمة عملاء 24 ساعة / 7 أيام',
  1,
  'https://www.facebook.com/',
  'https://www.instagram.com/',
  '',
  ''
);
