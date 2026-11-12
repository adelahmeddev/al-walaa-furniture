import type { APIRoute } from 'astro';
import { getRuntimeEnv, getUploadedImage } from '../../../utils/db';

export const GET: APIRoute = async ({ params, locals }) => {
  const { db } = getRuntimeEnv(locals);
  const id = String(params.id || '').trim();

  if (!db || !id) {
    return new Response('Not Found', { status: 404 });
  }

  const image = await getUploadedImage(db, id);
  if (!image) {
    return new Response('Not Found', { status: 404 });
  }

  return new Response(image.data as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': image.mimeType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};
