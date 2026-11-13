import type { D1Database } from '@cloudflare/workers-types';
import {
  getDefaultMediaItems,
  getInitialSettings,
  sanitizeMediaItems,
  sanitizeSettings,
  type MediaItem,
  type SiteSettings,
} from './settings';
import {
  getDefaultBlogPosts,
  type BlogPost,
  type BlogFaqItem,
} from '../data/blog-posts';

export type { BlogPost, BlogFaqItem };

interface SettingsRow {
  phone: string;
  display_phone: string;
  whatsapp_number: string;
  display_whatsapp?: string;
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

interface BlogRow {
  id: string;
  slug: string;
  lang: string;
  title: string;
  description: string;
  content: string;
  excerpt: string;
  cover_image: string;
  category: string;
  tags: string;
  read_time: string;
  published: number;
  featured: number;
  views: number;
  faq_json: string;
  created_at: string;
  updated_at: string;
}

let schemaReadyForDb: WeakSet<D1Database> = new WeakSet();

export function getRuntimeEnv(locals: App.Locals | Record<string, unknown>): { db?: D1Database; adminKey: string } {
  const env = (locals as { runtime?: { env?: { DB?: D1Database; ADMIN_KEY?: string } } })?.runtime?.env;
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
        display_whatsapp TEXT NOT NULL DEFAULT '',
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
      CREATE TABLE IF NOT EXISTS uploaded_file_chunks (
        file_id TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        data BLOB NOT NULL,
        PRIMARY KEY (file_id, chunk_index)
      )
    `),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_chunks_file_id ON uploaded_file_chunks(file_id)'),
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
    db.prepare(`
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
      )
    `),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_blog_slug_lang ON blog_posts(slug, lang)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_blog_published ON blog_posts(published)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_blog_category ON blog_posts(category)'),
  ]);

  try {
    await db.prepare("ALTER TABLE site_settings ADD COLUMN display_whatsapp TEXT NOT NULL DEFAULT ''").run();
  } catch {
    // Column already exists or fresh table
  }

  const settingsCount = await db
    .prepare('SELECT COUNT(*) AS cnt FROM site_settings')
    .first<{ cnt: number }>();

  if (!settingsCount || settingsCount.cnt === 0) {
    const def = getInitialSettings();
    await db
      .prepare(`
        INSERT OR IGNORE INTO site_settings (
          id, phone, display_phone, whatsapp_number, display_whatsapp, working_hours,
          top_bar_enabled, social_facebook, social_instagram, social_tiktok, social_youtube
        ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        def.phone,
        def.displayPhone,
        def.whatsappNumber,
        def.displayWhatsapp,
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

  const blogCount = await db
    .prepare('SELECT COUNT(*) AS cnt FROM blog_posts')
    .first<{ cnt: number }>();

  if (!blogCount || blogCount.cnt === 0) {
    const defaultPosts = getDefaultBlogPosts();
    if (defaultPosts.length > 0) {
      const blogStmts = defaultPosts.map((post) =>
        db
          .prepare(`
            INSERT OR IGNORE INTO blog_posts (
              id, slug, lang, title, description, content, excerpt, cover_image,
              category, tags, read_time, published, featured, views, faq_json,
              created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `)
          .bind(
            post.id,
            post.slug,
            post.lang,
            post.title,
            post.description,
            post.content,
            post.excerpt,
            post.coverImage,
            post.category,
            post.tags.join(', '),
            post.readTime,
            post.published ? 1 : 0,
            post.featured ? 1 : 0,
            post.views || 0,
            JSON.stringify(post.faq || []),
            post.createdAt,
            post.updatedAt
          )
      );
      await db.batch(blogStmts);
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
        'SELECT phone, display_phone, whatsapp_number, display_whatsapp, working_hours, top_bar_enabled, social_facebook, social_instagram, social_tiktok, social_youtube FROM site_settings WHERE id = 1'
      )
      .first<SettingsRow>();

    if (!row) return getInitialSettings();

    const def = getInitialSettings();
    return {
      phone: row.phone,
      displayPhone: row.display_phone,
      whatsappNumber: row.whatsapp_number,
      displayWhatsapp: row.display_whatsapp || (row.whatsapp_number.startsWith('01') ? row.whatsapp_number : def.displayWhatsapp || row.display_phone),
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
        id, phone, display_phone, whatsapp_number, display_whatsapp, working_hours,
        top_bar_enabled, social_facebook, social_instagram, social_tiktok, social_youtube, updated_at
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        phone = excluded.phone,
        display_phone = excluded.display_phone,
        whatsapp_number = excluded.whatsapp_number,
        display_whatsapp = excluded.display_whatsapp,
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
      clean.displayWhatsapp,
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

const CHUNK_SIZE = 600_000;
const MAX_UPLOAD_BYTES = 35_000_000; // 35 MB max for direct video/media uploads

function toBytes(data: unknown): Uint8Array | null {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (Array.isArray(data)) return new Uint8Array(data);
  return null;
}

export async function saveUploadedFile(
  db: D1Database,
  bytes: Uint8Array,
  mimeType: string
): Promise<{ id: string; url: string; sizeBytes: number }> {
  await ensureSchemaAndSeed(db);

  const isImage = mimeType.startsWith('image/');
  const isVideo = mimeType.startsWith('video/');
  if (!isImage && !isVideo) {
    throw new Error('Only image and video files are allowed');
  }
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error('File exceeds maximum allowed limit (35 MB)');
  }

  const id = crypto.randomUUID();

  if (bytes.byteLength <= CHUNK_SIZE) {
    await db
      .prepare('INSERT INTO uploaded_images (id, mime_type, data, size_bytes) VALUES (?, ?, ?, ?)')
      .bind(id, mimeType, bytes, bytes.byteLength)
      .run();
  } else {
    // Header record in uploaded_images
    await db
      .prepare('INSERT INTO uploaded_images (id, mime_type, data, size_bytes) VALUES (?, ?, ?, ?)')
      .bind(id, mimeType, new Uint8Array(0), bytes.byteLength)
      .run();

    // Chunk slices in batches of 5 to avoid D1 statement limit
    const totalChunks = Math.ceil(bytes.byteLength / CHUNK_SIZE);
    const chunkStmts: D1PreparedStatement[] = [];
    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, bytes.byteLength);
      const chunk = bytes.subarray(start, end);
      chunkStmts.push(
        db
          .prepare('INSERT INTO uploaded_file_chunks (file_id, chunk_index, data) VALUES (?, ?, ?)')
          .bind(id, i, chunk)
      );
    }

    for (let b = 0; b < chunkStmts.length; b += 5) {
      await db.batch(chunkStmts.slice(b, b + 5));
    }
  }

  return {
    id,
    url: `/api/images/${id}`,
    sizeBytes: bytes.byteLength,
  };
}

export const saveUploadedImage = saveUploadedFile;

export async function getUploadedFile(
  db: D1Database,
  id: string
): Promise<{ data: Uint8Array; mimeType: string } | null> {
  await ensureSchemaAndSeed(db);
  const row = await db
    .prepare('SELECT mime_type, data, size_bytes FROM uploaded_images WHERE id = ?')
    .bind(id)
    .first<{ mime_type: string; data: unknown; size_bytes: number }>();

  if (!row) return null;

  const directBytes = toBytes(row.data);
  if (directBytes && directBytes.byteLength > 0) {
    return { data: directBytes, mimeType: row.mime_type || 'image/webp' };
  }

  // Retrieve and reassemble chunks
  const chunkRows = await db
    .prepare('SELECT chunk_index, data FROM uploaded_file_chunks WHERE file_id = ? ORDER BY chunk_index ASC')
    .bind(id)
    .all<{ chunk_index: number; data: unknown }>();

  if (!chunkRows.results || chunkRows.results.length === 0) {
    return null;
  }

  const assembled = new Uint8Array(row.size_bytes || 0);
  let offset = 0;
  for (const chunkRow of chunkRows.results) {
    const chunkBytes = toBytes(chunkRow.data);
    if (chunkBytes) {
      assembled.set(chunkBytes, offset);
      offset += chunkBytes.byteLength;
    }
  }

  return { data: assembled, mimeType: row.mime_type || 'video/mp4' };
}

export const getUploadedImage = getUploadedFile;

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

export async function getBlogPosts(
  db?: D1Database,
  options: {
    lang?: 'ar' | 'en';
    category?: string;
    limit?: number;
    publishedOnly?: boolean;
  } = {}
): Promise<BlogPost[]> {
  const { lang, category, limit, publishedOnly = true } = options;

  if (!db) {
    let posts = getDefaultBlogPosts();
    if (lang) posts = posts.filter((p) => p.lang === lang);
    if (category && category !== 'all') posts = posts.filter((p) => p.category === category);
    if (publishedOnly) posts = posts.filter((p) => p.published);
    posts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (limit && limit > 0) posts = posts.slice(0, limit);
    return posts;
  }

  try {
    await ensureSchemaAndSeed(db);
    const conditions: string[] = [];
    const binds: unknown[] = [];

    if (publishedOnly) {
      conditions.push('published = 1');
    }
    if (lang) {
      conditions.push('lang = ?');
      binds.push(lang);
    }
    if (category && category !== 'all') {
      conditions.push('category = ?');
      binds.push(category);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limitClause = limit && limit > 0 ? `LIMIT ${limit}` : '';

    const query = `
      SELECT id, slug, lang, title, description, content, excerpt, cover_image, category, tags, read_time, published, featured, views, faq_json, created_at, updated_at
      FROM blog_posts
      ${whereClause}
      ORDER BY featured DESC, created_at DESC
      ${limitClause}
    `;

    const stmt = db.prepare(query);
    const result = binds.length > 0 ? await stmt.bind(...binds).all<BlogRow>() : await stmt.all<BlogRow>();

    return (result.results || []).map((row) => ({
      id: row.id,
      slug: row.slug,
      lang: (row.lang as 'ar' | 'en') || 'ar',
      title: row.title,
      description: row.description,
      content: row.content,
      excerpt: row.excerpt,
      coverImage: row.cover_image,
      category: row.category as BlogPost['category'],
      tags: row.tags ? row.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      readTime: row.read_time,
      published: row.published === 1,
      featured: row.featured === 1,
      views: Number(row.views || 0),
      faq: parseFaqJson(row.faq_json),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  } catch (err) {
    console.error('D1 getBlogPosts error:', err);
    let posts = getDefaultBlogPosts();
    if (lang) posts = posts.filter((p) => p.lang === lang);
    if (category && category !== 'all') posts = posts.filter((p) => p.category === category);
    if (publishedOnly) posts = posts.filter((p) => p.published);
    if (limit && limit > 0) posts = posts.slice(0, limit);
    return posts;
  }
}

export async function getBlogPostBySlug(
  db: D1Database | undefined,
  slug: string,
  lang: 'ar' | 'en' = 'ar'
): Promise<BlogPost | null> {
  if (!db) {
    const post = getDefaultBlogPosts().find((p) => p.slug === slug && p.lang === lang);
    return post || null;
  }

  try {
    await ensureSchemaAndSeed(db);
    const row = await db
      .prepare(`
        SELECT id, slug, lang, title, description, content, excerpt, cover_image, category, tags, read_time, published, featured, views, faq_json, created_at, updated_at
        FROM blog_posts
        WHERE slug = ? AND lang = ?
        LIMIT 1
      `)
      .bind(slug, lang)
      .first<BlogRow>();

    if (!row) {
      const fallback = getDefaultBlogPosts().find((p) => p.slug === slug && p.lang === lang);
      return fallback || null;
    }

    return {
      id: row.id,
      slug: row.slug,
      lang: (row.lang as 'ar' | 'en') || 'ar',
      title: row.title,
      description: row.description,
      content: row.content,
      excerpt: row.excerpt,
      coverImage: row.cover_image,
      category: row.category as BlogPost['category'],
      tags: row.tags ? row.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      readTime: row.read_time,
      published: row.published === 1,
      featured: row.featured === 1,
      views: Number(row.views || 0),
      faq: parseFaqJson(row.faq_json),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  } catch (err) {
    console.error('D1 getBlogPostBySlug error:', err);
    const fallback = getDefaultBlogPosts().find((p) => p.slug === slug && p.lang === lang);
    return fallback || null;
  }
}

export async function saveBlogPost(
  db: D1Database,
  post: Partial<BlogPost> & { title: string; slug: string; lang: 'ar' | 'en' }
): Promise<BlogPost> {
  await ensureSchemaAndSeed(db);

  const id = post.id || crypto.randomUUID();
  const slug = post.slug.trim().toLowerCase().replace(/[\s_]+/g, '-').replace(/[^a-z0-9\u0600-\u06FF-]/g, '');
  const lang = post.lang || 'ar';
  const title = post.title.trim();
  const description = post.description?.trim() || title;
  const content = post.content || '';
  const excerpt = post.excerpt?.trim() || description.slice(0, 160);
  const coverImage = post.coverImage || '/media/truck-loading-cairo.webp';
  const category = post.category || 'tips';
  const tagsStr = Array.isArray(post.tags) ? post.tags.join(', ') : (post.tags || '');
  const readTime = post.readTime || '5 دقائق';
  const published = post.published !== false ? 1 : 0;
  const featured = post.featured ? 1 : 0;
  const faqJson = JSON.stringify(post.faq || []);

  await db
    .prepare(`
      INSERT INTO blog_posts (
        id, slug, lang, title, description, content, excerpt, cover_image, category,
        tags, read_time, published, featured, views, faq_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        slug = excluded.slug,
        lang = excluded.lang,
        title = excluded.title,
        description = excluded.description,
        content = excluded.content,
        excerpt = excluded.excerpt,
        cover_image = excluded.cover_image,
        category = excluded.category,
        tags = excluded.tags,
        read_time = excluded.read_time,
        published = excluded.published,
        featured = excluded.featured,
        faq_json = excluded.faq_json,
        updated_at = CURRENT_TIMESTAMP
    `)
    .bind(
      id, slug, lang, title, description, content, excerpt, coverImage, category,
      tagsStr, readTime, published, featured, faqJson
    )
    .run();

  return {
    id,
    slug,
    lang,
    title,
    description,
    content,
    excerpt,
    coverImage,
    category: category as BlogPost['category'],
    tags: tagsStr.split(',').map((t) => t.trim()).filter(Boolean),
    readTime,
    published: published === 1,
    featured: featured === 1,
    views: post.views || 0,
    faq: post.faq || [],
    createdAt: post.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export async function deleteBlogPost(db: D1Database, id: string): Promise<boolean> {
  await ensureSchemaAndSeed(db);
  const result = await db.prepare('DELETE FROM blog_posts WHERE id = ?').bind(id).run();
  return (result.meta?.changes ?? 1) > 0;
}

export async function incrementPostViews(db?: D1Database, id?: string): Promise<void> {
  if (!db || !id) return;
  try {
    await db.prepare('UPDATE blog_posts SET views = views + 1 WHERE id = ?').bind(id).run();
  } catch (err) {
    // Non-blocking view increment
  }
}

function parseFaqJson(raw: unknown): BlogFaqItem[] {
  if (!raw || typeof raw !== 'string') return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
