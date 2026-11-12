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
    db.prepare(`
      CREATE TABLE IF NOT EXISTS uploaded_images (
        id TEXT PRIMARY KEY,
        mime_type TEXT NOT NULL,
        data BLOB NOT NULL,
        size_bytes INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS page_visits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        path TEXT NOT NULL,
        city TEXT NOT NULL DEFAULT '',
        country TEXT NOT NULL DEFAULT '',
        user_agent TEXT NOT NULL DEFAULT '',
        visited_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_visits_date ON page_visits(visited_at)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_visits_city ON page_visits(city)'),
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

  // Prune uploaded images no longer referenced by any media item
  const referencedIds = new Set<string>();
  for (const item of clean) {
    for (const field of [item.src, item.thumbnail]) {
      const match = field.match(/^\/api\/images\/([a-zA-Z0-9-]+)$/);
      if (match) referencedIds.add(match[1]);
    }
  }
  const existing = await db.prepare('SELECT id FROM uploaded_images').all<{ id: string }>();
  const orphanStmts = (existing.results || [])
    .filter((row) => !referencedIds.has(row.id))
    .map((row) => db.prepare('DELETE FROM uploaded_images WHERE id = ?').bind(row.id));
  if (orphanStmts.length > 0) {
    await db.batch(orphanStmts);
  }

  return clean;
}

const MAX_UPLOAD_BYTES = 1_500_000;

export async function saveUploadedImage(
  db: D1Database,
  bytes: Uint8Array,
  mimeType: string
): Promise<{ id: string; url: string; sizeBytes: number }> {
  await ensureSchemaAndSeed(db);

  if (!mimeType.startsWith('image/')) {
    throw new Error('Only image files are allowed');
  }
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error('Image must be under 1.5 MB after compression');
  }

  const id = crypto.randomUUID();
  await db
    .prepare(
      'INSERT INTO uploaded_images (id, mime_type, data, size_bytes) VALUES (?, ?, ?, ?)'
    )
    .bind(id, mimeType, bytes, bytes.byteLength)
    .run();

  return {
    id,
    url: `/api/images/${id}`,
    sizeBytes: bytes.byteLength,
  };
}

export async function getUploadedImage(
  db: D1Database,
  id: string
): Promise<{ data: Uint8Array; mimeType: string } | null> {
  await ensureSchemaAndSeed(db);
  const row = await db
    .prepare('SELECT mime_type, data FROM uploaded_images WHERE id = ?')
    .bind(id)
    .first<{ mime_type: string; data: unknown }>();

  if (!row || !row.data) return null;

  let bytes: Uint8Array;
  if (row.data instanceof Uint8Array) {
    bytes = row.data;
  } else if (row.data instanceof ArrayBuffer) {
    bytes = new Uint8Array(row.data);
  } else if (Array.isArray(row.data)) {
    bytes = new Uint8Array(row.data);
  } else {
    return null;
  }

  return { data: bytes, mimeType: row.mime_type || 'image/webp' };
}

export type TrafficRange = 'today' | '7d' | '30d' | 'all';

export interface TrafficCityItem {
  city: string;
  country: string;
  visits: number;
}

export interface TrafficDailyItem {
  date: string;
  visits: number;
}

export interface TrafficPageItem {
  path: string;
  visits: number;
}

export interface TrafficStats {
  range: TrafficRange;
  totalVisits: number;
  todayVisits: number;
  uniqueCities: number;
  topCity: TrafficCityItem | null;
  cities: TrafficCityItem[];
  dailyVisits: TrafficDailyItem[];
  topPages: TrafficPageItem[];
}

export async function recordPageVisit(
  db: D1Database,
  visit: { path: string; city?: string; country?: string; userAgent?: string }
): Promise<void> {
  try {
    await ensureSchemaAndSeed(db);
    const path = String(visit.path || '/').slice(0, 255);
    const city = String(visit.city || '').trim().slice(0, 120);
    const country = String(visit.country || '').trim().slice(0, 16);
    const userAgent = String(visit.userAgent || '').trim().slice(0, 300);

    await db
      .prepare('INSERT INTO page_visits (path, city, country, user_agent) VALUES (?, ?, ?, ?)')
      .bind(path, city, country, userAgent)
      .run();
  } catch (err) {
    console.error('D1 recordPageVisit error:', err);
  }
}

function getDateRangeWhereClause(range: TrafficRange): string {
  switch (range) {
    case 'today':
      return "WHERE visited_at >= datetime('now', 'start of day')";
    case '7d':
      return "WHERE visited_at >= datetime('now', '-6 days', 'start of day')";
    case '30d':
      return "WHERE visited_at >= datetime('now', '-29 days', 'start of day')";
    case 'all':
    default:
      return '';
  }
}

function buildDailySeries(
  range: TrafficRange,
  rows: TrafficDailyItem[]
): TrafficDailyItem[] {
  if (range === 'all') {
    return rows.slice(-30);
  }

  const daysCount = range === 'today' ? 1 : range === '7d' ? 7 : 30;
  const countsByDate = new Map(rows.map((r) => [r.date, r.visits]));
  const result: TrafficDailyItem[] = [];
  const now = new Date();

  for (let i = daysCount - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    const isoDate = d.toISOString().slice(0, 10);
    result.push({
      date: isoDate,
      visits: countsByDate.get(isoDate) || 0,
    });
  }

  return result;
}

export async function getTrafficStats(
  db?: D1Database,
  rawRange: string = '7d'
): Promise<TrafficStats> {
  const range: TrafficRange =
    rawRange === 'today' || rawRange === '7d' || rawRange === '30d' || rawRange === 'all'
      ? rawRange
      : '7d';

  if (!db) {
    return {
      range,
      totalVisits: 0,
      todayVisits: 0,
      uniqueCities: 0,
      topCity: null,
      cities: [],
      dailyVisits: buildDailySeries(range, []),
      topPages: [],
    };
  }

  try {
    await ensureSchemaAndSeed(db);
    const whereClause = getDateRangeWhereClause(range);

    const [totalRow, todayRow, citiesRes, dailyRes, pagesRes] = await Promise.all([
      db
        .prepare(`SELECT COUNT(*) AS cnt FROM page_visits ${whereClause}`)
        .first<{ cnt: number }>(),
      db
        .prepare("SELECT COUNT(*) AS cnt FROM page_visits WHERE visited_at >= datetime('now', 'start of day')")
        .first<{ cnt: number }>(),
      db
        .prepare(
          `SELECT TRIM(city) AS city, TRIM(country) AS country, COUNT(*) AS visits
           FROM page_visits
           ${whereClause}
           GROUP BY TRIM(city), TRIM(country)
           ORDER BY visits DESC
           LIMIT 25`
        )
        .all<TrafficCityItem>(),
      db
        .prepare(
          `SELECT date(visited_at) AS date, COUNT(*) AS visits
           FROM page_visits
           ${whereClause}
           GROUP BY date(visited_at)
           ORDER BY date ASC`
        )
        .all<TrafficDailyItem>(),
      db
        .prepare(
          `SELECT path, COUNT(*) AS visits
           FROM page_visits
           ${whereClause}
           GROUP BY path
           ORDER BY visits DESC
           LIMIT 10`
        )
        .all<TrafficPageItem>(),
    ]);

    const cities = (citiesRes.results || []).map((row) => ({
      city: row.city || '',
      country: row.country || '',
      visits: Number(row.visits || 0),
    }));

    const knownCities = cities.filter((c) => c.city !== '');
    const topCity = knownCities[0] || cities[0] || null;

    return {
      range,
      totalVisits: Number(totalRow?.cnt || 0),
      todayVisits: Number(todayRow?.cnt || 0),
      uniqueCities: knownCities.length,
      topCity,
      cities,
      dailyVisits: buildDailySeries(
        range,
        (dailyRes.results || []).map((r) => ({
          date: r.date,
          visits: Number(r.visits || 0),
        }))
      ),
      topPages: (pagesRes.results || []).map((p) => ({
        path: p.path,
        visits: Number(p.visits || 0),
      })),
    };
  } catch (err) {
    console.error('D1 getTrafficStats error:', err);
    return {
      range,
      totalVisits: 0,
      todayVisits: 0,
      uniqueCities: 0,
      topCity: null,
      cities: [],
      dailyVisits: buildDailySeries(range, []),
      topPages: [],
    };
  }
}
