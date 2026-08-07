export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { SunoClient } from '@/lib/suno';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const downloadUrl = searchParams.get('url');
    let filename = searchParams.get('name') || 'nhacai-file';

    if (!downloadUrl) {
      return new NextResponse('Missing url parameter', { status: 400 });
    }

    // ── SSRF Protection ────────────────────────────────────────────────────────
    // Only allow fetching from known Suno CDN domains. Reject any attempt to
    // reach internal infrastructure (localhost, private IPs, etc.).
    const ALLOWED_CDN_HOSTS = new Set([
      'cdn1.suno.ai',
      'cdn2.suno.ai',
      'audiopipe.suno.ai',
      'cdn.suno.ai',
      'suno-uploads.s3.amazonaws.com',
      // Add more trusted Suno/AWS CDN hostnames here if needed
    ]);

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(downloadUrl);
    } catch {
      return new NextResponse('Invalid url parameter', { status: 400 });
    }

    if (parsedUrl.protocol !== 'https:') {
      return new NextResponse('Only HTTPS URLs are allowed', { status: 400 });
    }

    if (!ALLOWED_CDN_HOSTS.has(parsedUrl.hostname)) {
      console.warn(`[Download SSRF] Blocked request to disallowed host: ${parsedUrl.hostname}`);
      return new NextResponse('URL host is not allowed', { status: 400 });
    }
    // ──────────────────────────────────────────────────────────────────────────

    let targetUrl = downloadUrl;
    
    // Format and type checks
    const format = (searchParams.get('format') || '').toLowerCase();
    const isVideo = format === 'mp4' || downloadUrl.toLowerCase().includes('.mp4');
    const isWav = format === 'wav' || downloadUrl.toLowerCase().includes('.wav');

    const match = downloadUrl.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
    const clipId = match ? match[1] : null;

    if (isVideo && clipId) {
      try {
        const session = await getServerSession(authOptions).catch(() => null);
        const userId = session?.user?.id;
        console.log(`[Download Proxy] Checking/triggering video generation for clip: ${clipId}`);
        const resolvedVideoUrl = await SunoClient.getOrGenerateVideoUrl(clipId, userId);
        if (resolvedVideoUrl) {
          targetUrl = resolvedVideoUrl;
        }
      } catch (videoErr) {
        console.error('[Download Proxy] Error resolving video URL:', videoErr);
      }
    } else if (isWav && clipId) {
      try {
        const session = await getServerSession(authOptions).catch(() => null);
        const userId = session?.user?.id;
        console.log(`[Download Proxy] Checking/triggering WAV conversion for clip: ${clipId}`);
        const wavUrl = await SunoClient.getOrGenerateWavUrl(clipId, userId);
        if (wavUrl) {
          targetUrl = wavUrl;
        } else {
          console.warn(`[Download Proxy] WAV URL resolution failed for clip: ${clipId}. Falling back to default URL.`);
        }
      } catch (wavErr) {
        console.error('[Download Proxy] Error resolving WAV URL:', wavErr);
      }
    }

    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
      }
    });

    if (!response.ok) {
      console.warn(`[Download] Server-side fetch failed with status ${response.status}. Redirecting directly to CDN URL: ${targetUrl}`);
      return NextResponse.redirect(targetUrl);
    }

    const contentType = response.headers.get('content-type') || '';
    const isVideoResponse = isVideo || contentType.includes('video') || contentType.includes('mp4') || targetUrl.toLowerCase().includes('.mp4');
    const isWavResponse = isWav || contentType.includes('wav') || targetUrl.toLowerCase().includes('.wav');

    filename = filename.replace(/[/\\?%*:|"<>]/g, '-').trim() || 'nhacai-file';
    const extension = isVideoResponse ? '.mp4' : (isWavResponse ? '.wav' : '.mp3');
    if (!filename.toLowerCase().endsWith(extension)) {
      filename = filename.replace(/\.(mp3|mp4|wav)$/i, '') + extension;
    }

    const arrayBuffer = await response.arrayBuffer();
    const headers = new Headers();
    
    let finalContentType = 'audio/mpeg';
    if (isVideoResponse) {
      finalContentType = 'video/mp4';
    } else if (isWavResponse) {
      finalContentType = 'audio/wav';
    }

    const safeAsciiFilename = filename.replace(/[^\x20-\x7E]/g, '_');
    headers.set('Content-Type', finalContentType);
    headers.set('Content-Length', arrayBuffer.byteLength.toString());
    headers.set('Content-Disposition', `attachment; filename="${safeAsciiFilename}"; filename*=UTF-8''${encodeURIComponent(filename)}`);

    return new NextResponse(Buffer.from(arrayBuffer), {
      status: 200,
      headers,
    });
  } catch (error: any) {
    console.error('Download proxy error:', error);
    // Do NOT redirect to the original URL here — it would bypass the SSRF
    // allowlist check performed above. Return a 502 error instead.
    return new NextResponse(`Download failed: ${error.message}`, { status: 502 });
  }
}
