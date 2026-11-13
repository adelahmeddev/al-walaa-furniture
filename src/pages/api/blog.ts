import type { APIRoute } from 'astro';
import {
  checkAdminAuth,
  deleteBlogPost,
  getBlogPostBySlug,
  getBlogPosts,
  getRuntimeEnv,
  saveBlogPost,
  type BlogPost,
} from '../../utils/db';

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

export const GET: APIRoute = async ({ request, locals }) => {
  const { db } = getRuntimeEnv(locals);
  const url = new URL(request.url);
  const slug = url.searchParams.get('slug');
  const lang = (url.searchParams.get('lang') as 'ar' | 'en') || 'ar';
  const category = url.searchParams.get('category') || undefined;
  const publishedOnly = url.searchParams.get('all') === '1' ? false : true;

  if (slug) {
    const post = await getBlogPostBySlug(db, slug, lang);
    if (!post) {
      return new Response(JSON.stringify({ ok: false, error: 'Post not found' }), {
        status: 404,
        headers: JSON_HEADERS,
      });
    }
    return new Response(JSON.stringify({ ok: true, post, dbConnected: Boolean(db) }), {
      status: 200,
      headers: JSON_HEADERS,
    });
  }

  const posts = await getBlogPosts(db, { lang, category, publishedOnly });
  return new Response(JSON.stringify({ ok: true, posts, count: posts.length, dbConnected: Boolean(db) }), {
    status: 200,
    headers: JSON_HEADERS,
  });
};

export const POST: APIRoute = async ({ request, locals }) => {
  const { db, adminKey } = getRuntimeEnv(locals);

  if (!checkAdminAuth(request, adminKey)) {
    return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
      status: 401,
      headers: JSON_HEADERS,
    });
  }

  if (!db) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Cloudflare D1 binding (DB) is not configured' }),
      { status: 503, headers: JSON_HEADERS }
    );
  }

  try {
    const body = (await request.json()) as Partial<BlogPost> & { title: string; slug: string; lang: 'ar' | 'en' };

    if (!body?.title || !body?.slug) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Title and slug are required fields' }),
        { status: 400, headers: JSON_HEADERS }
      );
    }

    const saved = await saveBlogPost(db, body);
    return new Response(JSON.stringify({ ok: true, post: saved }), {
      status: 200,
      headers: JSON_HEADERS,
    });
  } catch (err: unknown) {
    console.error('POST /api/blog error:', err);
    return new Response(
      JSON.stringify({ ok: false, error: err instanceof Error ? err.message : 'Failed to save blog post' }),
      { status: 400, headers: JSON_HEADERS }
    );
  }
};

export const DELETE: APIRoute = async ({ request, locals }) => {
  const { db, adminKey } = getRuntimeEnv(locals);

  if (!checkAdminAuth(request, adminKey)) {
    return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
      status: 401,
      headers: JSON_HEADERS,
    });
  }

  if (!db) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Cloudflare D1 binding (DB) is not configured' }),
      { status: 503, headers: JSON_HEADERS }
    );
  }

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return new Response(JSON.stringify({ ok: false, error: 'Post ID is required' }), {
        status: 400,
        headers: JSON_HEADERS,
      });
    }

    const success = await deleteBlogPost(db, id);
    return new Response(JSON.stringify({ ok: success }), {
      status: 200,
      headers: JSON_HEADERS,
    });
  } catch (err: unknown) {
    console.error('DELETE /api/blog error:', err);
    return new Response(
      JSON.stringify({ ok: false, error: err instanceof Error ? err.message : 'Failed to delete blog post' }),
      { status: 400, headers: JSON_HEADERS }
    );
  }
};
