import type { D1Database } from '@cloudflare/workers-types';
import {
  getDefaultMediaItems,
  getInitialSettings,
  sanitizeMediaItems,
  sanitizeSettings,
  type MediaItem,
  type SiteSettings,
} from './settings';

interface SettingsRow {
  phone: string;
  display_phone: string;
  whatsapp_number: string;
  working_hours: string;
  top_bar_enabled: number;
  social_facebook: string;
  social_instagram: string;
  social_tiktok: string;
  social_youtube: string;
}

interface MediaRow {
  id: string;
  type: 'image' | 'video';
  src: string;
  thumbnail: string;
  category: string;
  title: string;
  title_en: string;
  alt: string;
  alt_en: string;
  desc: string;
  desc_en: string;
}

let schemaReadyForDb: WeakSet<D1Database> = new WeakSet();

export function getRuntimeEnv(locals: App.Locals): { db?: D1Database; adminKey: string } {
  const env = locals?.runtime?.env;
  const db = env?.DB;
  const adminKey = (typeof env?.ADMIN_KEY === 'string' && env.ADMIN_KEY.trim()) || 'mover-dev-2024';
  return { db, adminKey };
}

export function checkAdminAuth(request: Request, expectedKey: string): boolean {
  const headerKey =
    request.headers.get('x-admin-key') ||
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    '';
  if (!headerKey || headerKey.length !== expectedKey.length) return false;
  let mismatch = 0;
  for (let i = 0; i < headerKey.length; i++) {
    mismatch |= headerKey.charCodeAt(i) ^ expectedKey.charCodeAt(i);
  }
  return mismatch === 0;
}

async function ensureSchemaAndSeed(db: D1Database): Promise<void> {
  if (schemaReadyForDb.has(db)) return;

  await db.batch([
    db.prepare(`
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
      )
    `),
    db.prepare(`
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
      )
    `),
  ]);

  const settingsCount = await db
    .prepare('SELECT COUNT(*) AS cnt FROM site_settings')
    .first<{ cnt: number }>();

  if (!settingsCount || settingsCount.cnt === 0) {
    const def = getInitialSettings();
    await db
      .prepare(`
        INSERT OR IGNORE INTO site_settings (
          id, phone, display_phone, whatsapp_number, working_hours,
          top_bar_enabled, social_facebook, social_instagram, social_tiktok, social_youtube
        ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        def.phone,
        def.displayPhone,
        def.whatsappNumber,
        def.workingHours,
        def.topBar?.enabled !== false ? 1 : 0,
        def.social?.facebook || '',
        def.social?.instagram || '',
        def.social?.tiktok || '',
        def.social?.youtube || ''
      )
      .run();
  }

  const mediaCount = await db
    .prepare('SELECT COUNT(*) AS cnt FROM media_items')
    .first<{ cnt: number }>();

  if (!mediaCount || mediaCount.cnt === 0) {
    const defaults = getDefaultMediaItems();
    if (defaults.length > 0) {
      const stmts = defaults.map((item, idx) =>
        db
          .prepare(`
            INSERT OR IGNORE INTO media_items (
              id, sort_order, type, src, thumbnail, category, title, title_en, alt, alt_en, desc, desc_en
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `)
          .bind(
            item.id,
            idx,
            item.type,
            item.src,
            item.thumbnail || item.src,
            item.category,
            item.title,
            item.titleEn || item.title,
            item.alt || item.title,
            item.altEn || item.titleEn || item.title,
            item.desc || '',
            item.descEn || item.desc || ''
          )
      );
      await db.batch(stmts);
    }
  }

  schemaReadyForDb.add(db);
}

export async function getSiteSettings(db?: D1Database): Promise<SiteSettings> {
  if (!db) return getInitialSettings();
  try {
    await ensureSchemaAndSeed(db);
    const row = await db
      .prepare(
        'SELECT phone, display_phone, whatsapp_number, working_hours, top_bar_enabled, social_facebook, social_instagram, social_tiktok, social_youtube FROM site_settings WHERE id = 1'
      )
      .first<SettingsRow>();

    if (!row) return getInitialSettings();

    return {
      phone: row.phone,
      displayPhone: row.display_phone,
      whatsappNumber: row.whatsapp_number,
      workingHours: row.working_hours,
      topBar: {
        enabled: row.top_bar_enabled === 1,
      },
      social: {
        facebook: row.social_facebook || '',
        instagram: row.social_instagram || '',
        tiktok: row.social_tiktok || '',
        youtube: row.social_youtube || '',
      },
    };
  } catch (err) {
    console.error('D1 getSiteSettings error:', err);
    return getInitialSettings();
  }
}

export async function saveSiteSettings(
  db: D1Database,
  input: Partial<SiteSettings>
): Promise<SiteSettings> {
  await ensureSchemaAndSeed(db);
  const clean = sanitizeSettings(input);

  await db
    .prepare(`
      INSERT INTO site_settings (
        id, phone, display_phone, whatsapp_number, working_hours,
        top_bar_enabled, social_facebook, social_instagram, social_tiktok, social_youtube, updated_at
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        phone = excluded.phone,
        display_phone = excluded.display_phone,
        whatsapp_number = excluded.whatsapp_number,
        working_hours = excluded.working_hours,
        top_bar_enabled = excluded.top_bar_enabled,
        social_facebook = excluded.social_facebook,
        social_instagram = excluded.social_instagram,
        social_tiktok = excluded.social_tiktok,
        social_youtube = excluded.social_youtube,
        updated_at = CURRENT_TIMESTAMP
    `)
    .bind(
      clean.phone,
      clean.displayPhone,
      clean.whatsappNumber,
      clean.workingHours,
      clean.topBar?.enabled !== false ? 1 : 0,
      clean.social?.facebook || '',
      clean.social?.instagram || '',
      clean.social?.tiktok || '',
      clean.social?.youtube || ''
    )
    .run();

  return clean;
}

export async function getMediaItems(db?: D1Database): Promise<MediaItem[]> {
  if (!db) return getDefaultMediaItems();
  try {
    await ensureSchemaAndSeed(db);
    const result = await db
      .prepare(
        'SELECT id, type, src, thumbnail, category, title, title_en, alt, alt_en, desc, desc_en FROM media_items ORDER BY sort_order ASC'
      )
      .all<MediaRow>();

    return (result.results || []).map((row) => ({
      id: row.id,
      type: row.type,
      src: row.src,
      thumbnail: row.thumbnail || row.src,
      category: row.category,
      title: row.title,
      titleEn: row.title_en || row.title,
      alt: row.alt || row.title,
      altEn: row.alt_en || row.title_en || row.title,
      desc: row.desc,
      descEn: row.desc_en || row.desc,
    }));
  } catch (err) {
    console.error('D1 getMediaItems error:', err);
    return getDefaultMediaItems();
  }
}

export async function replaceMediaItems(
  db: D1Database,
  rawItems: unknown
): Promise<MediaItem[]> {
  await ensureSchemaAndSeed(db);
  const clean = sanitizeMediaItems(rawItems);

  const stmts = [
    db.prepare('DELETE FROM media_items'),
    ...clean.map((item, idx) =>
      db
        .prepare(`
          INSERT INTO media_items (
            id, sort_order, type, src, thumbnail, category, title, title_en, alt, alt_en, desc, desc_en
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          item.id,
          idx,
          item.type,
          item.src,
          item.thumbnail || item.src,
          item.category,
          item.title,
          item.titleEn || item.title,
          item.alt || item.title,
          item.altEn || item.titleEn || item.title,
          item.desc || '',
          item.descEn || item.desc || ''
        )
    ),
  ];

  await db.batch(stmts);
  return clean;
}
