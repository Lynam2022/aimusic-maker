export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ userId: string; filename: string }> }
) {
  try {
    const { userId, filename } = await context.params;

    // Sanitize parameters to prevent path traversal
    const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, '');
    const safeFilename = filename.replace(/[^a-zA-Z0-9_.-]/g, '');

    if (!safeUserId || !safeFilename) {
      return new NextResponse('Bad Request', { status: 400 });
    }

    // Primary path: root-level uploads folder
    const filePath = path.join(process.cwd(), 'uploads', safeUserId, safeFilename);

    if (!fs.existsSync(filePath)) {
      // Fallback path: public/uploads folder
      const fallbackPath = path.join(process.cwd(), 'public', 'uploads', safeUserId, safeFilename);
      if (!fs.existsSync(fallbackPath)) {
        return new NextResponse('Not Found', { status: 404 });
      }
      return serveFile(fallbackPath, request);
    }

    return serveFile(filePath, request);
  } catch (error: any) {
    console.error('[Uploads Route] Error serving file:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

function serveFile(filePath: string, request: NextRequest): Response {
  const stat = fs.statSync(filePath);
  const ext = path.extname(filePath).toLowerCase();

  let contentType = 'application/octet-stream';
  if (ext === '.mp3') contentType = 'audio/mpeg';
  else if (ext === '.wav') contentType = 'audio/wav';
  else if (ext === '.mp4') contentType = 'video/mp4';
  else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
  else if (ext === '.png') contentType = 'image/png';
  else if (ext === '.webp') contentType = 'image/webp';
  else if (ext === '.gif') contentType = 'image/gif';

  // Handle Range requests for audio/video streaming
  const rangeHeader = request.headers.get('range');
  if (rangeHeader && (ext === '.mp3' || ext === '.wav' || ext === '.mp4')) {
    const parts = rangeHeader.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
    const chunksize = end - start + 1;

    // Use readSync to read partial content to avoid memory bloat
    const fileDescriptor = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(chunksize);
    fs.readSync(fileDescriptor, buffer, 0, chunksize, start);
    fs.closeSync(fileDescriptor);

    return new Response(buffer, {
      status: 206,
      headers: {
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize.toString(),
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  }

  const fileBuffer = fs.readFileSync(filePath);
  return new Response(fileBuffer, {
    headers: {
      'Content-Type': contentType,
      'Content-Length': stat.size.toString(),
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
