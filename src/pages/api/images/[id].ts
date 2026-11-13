import type { APIRoute } from 'astro';
import { getRuntimeEnv, getUploadedFile } from '../../../utils/db';

export const GET: APIRoute = async ({ params, locals, request }) => {
  const { db } = getRuntimeEnv(locals);
  const id = String(params.id || '').trim();

  if (!db || !id) {
    return new Response('Not Found', { status: 404 });
  }

  const file = await getUploadedFile(db, id);
  if (!file) {
    return new Response('Not Found', { status: 404 });
  }

  const isVideo = file.mimeType.startsWith('video/');
  const totalLength = file.data.byteLength;
  const rangeHeader = request.headers.get('Range');

  if (isVideo && rangeHeader && rangeHeader.startsWith('bytes=')) {
    const parts = rangeHeader.replace('bytes=', '').split('-');
    const start = parseInt(parts[0], 10) || 0;
    const end = parts[1] ? parseInt(parts[1], 10) : totalLength - 1;
    const clampedEnd = Math.min(end, totalLength - 1);
    const chunkLength = clampedEnd - start + 1;
    const slice = file.data.subarray(start, clampedEnd + 1);

    return new Response(slice as unknown as BodyInit, {
      status: 206,
      headers: {
        'Content-Type': file.mimeType,
        'Content-Range': `bytes ${start}-${clampedEnd}/${totalLength}`,
        'Content-Length': String(chunkLength),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  }

  return new Response(file.data as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': file.mimeType,
      'Content-Length': String(totalLength),
      'Accept-Ranges': isVideo ? 'bytes' : 'none',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};
