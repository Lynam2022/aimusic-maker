import { Track } from '@/store/musicStore';
import { prisma } from './db';
import fs from 'fs';
import path from 'path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// Helper to download a file from URL to buffer
async function downloadFile(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download file from ${url}, status: ${res.status}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function uploadTrackFiles(tracks: Track[], userId: string): Promise<Track[]> {
  try {
    const configs = await prisma.systemConfig.findMany();
    const configMap = configs.reduce((acc, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {} as Record<string, string>);

    const storageType = configMap['storage_type'] || process.env.STORAGE_TYPE || 'local';

    if (storageType === 'local') {
      const storagePath = configMap['storage_path'] || './public/uploads';

      // Ensure local directory exists
      const targetDir = path.join(process.cwd(), storagePath, userId);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      const updatedTracks = await Promise.all(tracks.map(async (track) => {
        let localAudioUrl = track.url;
        let localCoverUrl = track.coverUrl;
        let localVideoUrl = track.videoUrl;

        // Download and save audio
        if (track.url && track.url.startsWith('http')) {
          try {
            const audioBuffer = await downloadFile(track.url);
            const audioExt = '.mp3';
            const audioName = `${track.id}${audioExt}`;
            const audioPath = path.join(targetDir, audioName);
            fs.writeFileSync(audioPath, audioBuffer);

            // Generate public URL relative to webroot
            // e.g., if storagePath is ./public/uploads, public url is /uploads/userId/trackId.mp3
            const webRootPath = storagePath.replace(/^\.?\/public/, '');
            localAudioUrl = `${webRootPath}/${userId}/${audioName}`.replace(/\/+/g, '/');
          } catch (err) {
            console.error(`[Storage] Failed to download local audio for track ${track.id}:`, err);
          }
        }

        // Download and save cover image
        if (track.coverUrl && track.coverUrl.startsWith('http') && !track.coverUrl.includes('unsplash.com')) {
          try {
            const coverBuffer = await downloadFile(track.coverUrl);
            const coverExt = '.jpg';
            const coverName = `${track.id}_cover${coverExt}`;
            const coverPath = path.join(targetDir, coverName);
            fs.writeFileSync(coverPath, coverBuffer);

            const webRootPath = storagePath.replace(/^\.?\/public/, '');
            localCoverUrl = `${webRootPath}/${userId}/${coverName}`.replace(/\/+/g, '/');
          } catch (err) {
            console.error(`[Storage] Failed to download local cover for track ${track.id}:`, err);
          }
        }

        // Download and save video
        if (track.videoUrl && track.videoUrl.startsWith('http')) {
          try {
            const videoBuffer = await downloadFile(track.videoUrl);
            const videoExt = '.mp4';
            const videoName = `${track.id}${videoExt}`;
            const videoPath = path.join(targetDir, videoName);
            fs.writeFileSync(videoPath, videoBuffer);

            const webRootPath = storagePath.replace(/^\.?\/public/, '');
            localVideoUrl = `${webRootPath}/${userId}/${videoName}`.replace(/\/+/g, '/');
          } catch (err) {
            console.error(`[Storage] Failed to download local video for track ${track.id}:`, err);
          }
        }

        return {
          ...track,
          url: localAudioUrl,
          coverUrl: localCoverUrl,
          videoUrl: localVideoUrl
        };
      }));

      return updatedTracks;
    }

    if (storageType === 'r2') {
      const accountId = configMap['r2_account_id'] || process.env.CLOUDFLARE_ACCOUNT_ID;
      const accessKeyId = configMap['r2_access_key_id'] || process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
      const secretAccessKey = configMap['r2_secret_access_key'] || process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
      const bucketName = configMap['r2_bucket_name'] || process.env.CLOUDFLARE_R2_BUCKET_NAME;
      let publicDomain = configMap['r2_public_domain'] || process.env.CLOUDFLARE_R2_PUBLIC_DOMAIN || '';

      if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
        console.warn('[Storage R2] Configuration is missing keys. Falling back to default URL.');
        return tracks;
      }

      // Standardize public domain
      if (publicDomain && !publicDomain.startsWith('http')) {
        publicDomain = `https://${publicDomain}`;
      }
      publicDomain = publicDomain.replace(/\/$/, ''); // strip trailing slash

      const cleanAccountId = accountId.trim();
      const cleanAccessKeyId = accessKeyId.trim();
      const cleanSecretAccessKey = secretAccessKey.trim();
      const cleanBucketName = bucketName.trim();

      // Initialize S3 client for Cloudflare R2 with flexible checksums disabled
      const s3 = new S3Client({
        region: 'auto',
        endpoint: `https://${cleanAccountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: cleanAccessKeyId,
          secretAccessKey: cleanSecretAccessKey,
        },
        requestChecksumCalculation: 'WHEN_REQUIRED',
        responseChecksumValidation: 'WHEN_REQUIRED',
      });

      // Override payload hash for Cloudflare R2 signature compatibility
      s3.middlewareStack.add(
        (next: any) => async (args: any) => {
          if (args.request && args.request.headers) {
            args.request.headers['x-amz-content-sha256'] = 'UNSIGNED-PAYLOAD';
          }
          return next(args);
        },
        {
          step: 'serialize',
          name: 'r2UnsignedPayloadMiddleware',
        }
      );

      const updatedTracks = await Promise.all(tracks.map(async (track) => {
        let r2AudioUrl = track.url;
        let r2CoverUrl = track.coverUrl;
        let r2VideoUrl = track.videoUrl;

        // Download & Upload audio
        if (track.url && track.url.startsWith('http')) {
          try {
            const audioBuffer = await downloadFile(track.url);
            const audioKey = `${userId}/${track.id}.mp3`;

            await s3.send(new PutObjectCommand({
              Bucket: bucketName,
              Key: audioKey,
              Body: audioBuffer,
              ContentType: 'audio/mpeg',
            }));

            if (publicDomain) {
              r2AudioUrl = `${publicDomain}/${audioKey}`;
            } else {
              // Fallback to R2 standard endpoint if public domain is not set
              r2AudioUrl = `https://${bucketName}.${accountId}.r2.cloudflarestorage.com/${audioKey}`;
            }
          } catch (err) {
            console.error(`[Storage R2] Failed to upload audio for track ${track.id}:`, err);
          }
        }

        // Download & Upload cover image
        if (track.coverUrl && track.coverUrl.startsWith('http') && !track.coverUrl.includes('unsplash.com')) {
          try {
            const coverBuffer = await downloadFile(track.coverUrl);
            const coverKey = `${userId}/${track.id}_cover.jpg`;

            await s3.send(new PutObjectCommand({
              Bucket: bucketName,
              Key: coverKey,
              Body: coverBuffer,
              ContentType: 'image/jpeg',
            }));

            if (publicDomain) {
              r2CoverUrl = `${publicDomain}/${coverKey}`;
            } else {
              r2CoverUrl = `https://${bucketName}.${accountId}.r2.cloudflarestorage.com/${coverKey}`;
            }
          } catch (err) {
            console.error(`[Storage R2] Failed to upload cover for track ${track.id}:`, err);
          }
        }

        // Download & Upload video
        if (track.videoUrl && track.videoUrl.startsWith('http')) {
          try {
            const videoBuffer = await downloadFile(track.videoUrl);
            const videoKey = `${userId}/${track.id}.mp4`;

            await s3.send(new PutObjectCommand({
              Bucket: bucketName,
              Key: videoKey,
              Body: videoBuffer,
              ContentType: 'video/mp4',
            }));

            if (publicDomain) {
              r2VideoUrl = `${publicDomain}/${videoKey}`;
            } else {
              r2VideoUrl = `https://${bucketName}.${accountId}.r2.cloudflarestorage.com/${videoKey}`;
            }
          } catch (err) {
            console.error(`[Storage R2] Failed to upload video for track ${track.id}:`, err);
          }
        }

        return {
          ...track,
          url: r2AudioUrl,
          coverUrl: r2CoverUrl,
          videoUrl: r2VideoUrl
        };
      }));

      return updatedTracks;
    }

    // Default fallback
    return tracks;
  } catch (error) {
    console.error('[Storage] Error saving track files:', error);
    return tracks;
  }
}
