export const dynamic = 'force-dynamic';

import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

async function dynamicAuth(req: any, res: any) {
  try {
    // Dynamically adjust NEXTAUTH_URL based on request headers to support local IP addresses (e.g. 192.168.1.109)
    let host = '';
    let protocol = 'http';
    
    if (req && req.headers) {
      if (typeof req.headers.get === 'function') {
        host = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
        protocol = req.headers.get('x-forwarded-proto') || 'http';
      } else {
        host = req.headers['x-forwarded-host'] || req.headers['host'] || '';
        protocol = req.headers['x-forwarded-proto'] || 'http';
      }
    }
    
    if (host) {
      if (protocol.includes(',')) {
        protocol = protocol.split(',')[0].trim();
      }
      process.env.NEXTAUTH_URL = `${protocol}://${host}`;
    }

    const googleId = await prisma.systemConfig.findUnique({ where: { key: 'google_client_id' } });
    const googleSecret = await prisma.systemConfig.findUnique({ where: { key: 'google_client_secret' } });
    if (googleId?.value) process.env.GOOGLE_CLIENT_ID = googleId.value;
    if (googleSecret?.value) process.env.GOOGLE_CLIENT_SECRET = googleSecret.value;
  } catch (err) {
    console.error('Error loading dynamic credentials or setting NEXTAUTH_URL:', err);
  }
  return NextAuth(authOptions)(req, res);
}

export { dynamicAuth as GET, dynamicAuth as POST };
