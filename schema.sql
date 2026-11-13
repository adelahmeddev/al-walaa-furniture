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

CREATE TABLE IF NOT EXISTS uploaded_images (
  id TEXT PRIMARY KEY,
  mime_type TEXT NOT NULL,
  data BLOB NOT NULL,
  size_bytes INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS page_visits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT '',
  visited_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_visits_date ON page_visits(visited_at);
CREATE INDEX IF NOT EXISTS idx_visits_city ON page_visits(city);

CREATE TABLE IF NOT EXISTS blog_posts (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  lang TEXT NOT NULL DEFAULT 'ar',
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  content TEXT NOT NULL,
  excerpt TEXT NOT NULL,
  cover_image TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'tips',
  tags TEXT NOT NULL DEFAULT '',
  read_time TEXT NOT NULL DEFAULT '5 دقائق',
  published INTEGER NOT NULL DEFAULT 1,
  featured INTEGER NOT NULL DEFAULT 0,
  views INTEGER NOT NULL DEFAULT 0,
  faq_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_blog_slug_lang ON blog_posts(slug, lang);
CREATE INDEX IF NOT EXISTS idx_blog_published ON blog_posts(published);
CREATE INDEX IF NOT EXISTS idx_blog_category ON blog_posts(category);

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
