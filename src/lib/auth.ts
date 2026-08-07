// Polyfill for Node.js util.inspect on Edge runtime to prevent NextAuth v4 inspect.custom crash
if (typeof (globalThis as any).util === 'undefined') {
  (globalThis as any).util = { inspect: { custom: Symbol.for('nodejs.util.inspect.custom') } };
}

import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import bcrypt from 'bcryptjs';
import { prisma } from './db';
import { deleteCache } from './redis';

// Extend next-auth types to include our custom fields
declare module 'next-auth' {
  interface User {
    id: string;
    credits: number;
    role: string;
  }
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      credits: number;
      role: string;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    credits: number;
    role: string;
  }
}

import { checkLoginAttempts, recordLoginFailure, resetLoginAttempts } from './security';
import { Session } from 'next-auth';

// ─── Admin identity ────────────────────────────────────────────────────────────
/** Primary/fixed system-admin email. Change here only if you migrate accounts. */
export const ADMIN_EMAIL = 'karaokestudio2026@gmail.com';

/**
 * Returns true when the NextAuth session belongs to an admin user.
 * Checks both `role` (DB-driven) and the fixed primary-admin email as a
 * fallback so the admin panel stays accessible even if the DB role gets reset.
 */
export function isAdminSession(session: Session | null | undefined): session is Session {
  if (!session?.user) return false;
  return (
    session.user.role === 'admin' ||
    session.user.email?.toLowerCase().trim() === ADMIN_EMAIL
  );
}
// ──────────────────────────────────────────────────────────────────────────────

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || 'dummy-google-client-id',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'dummy-google-client-secret',
    }),
    CredentialsProvider({
      id: 'credentials',
      name: 'Email & Password',
      credentials: {
        email: { label: 'Email', type: 'email', placeholder: 'you@example.com' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email và mật khẩu là bắt buộc.');
        }

        const ip = (req as any)?.headers?.['x-forwarded-for'] || (req as any)?.headers?.['x-real-ip'] || '127.0.0.1';
        const email = credentials.email.toLowerCase().trim();

        // 1. Check brute force locks
        await checkLoginAttempts(email, ip);

        const user = await prisma.user.findUnique({
          where: { email }
        });

        if (!user) {
          // Record failure and throw
          await recordLoginFailure(email, ip);
          throw new Error('Email không tồn tại trong hệ thống.');
        }

        if (!user.isActive) {
          throw new Error('Tài khoản đã bị vô hiệu hóa.');
        }

        const isValid = await bcrypt.compare(credentials.password, user.password);
        if (!isValid) {
          // Record failure and throw
          await recordLoginFailure(email, ip);
          throw new Error('Mật khẩu không đúng.');
        }

        // 2. Success: Reset brute force tracking
        await resetLoginAttempts(email, ip);

        // Fixed primary admin role check
        let role = user.role;
        if (email === 'karaokestudio2026@gmail.com' && role !== 'admin') {
          await prisma.user.update({
            where: { id: user.id },
            data: { role: 'admin' }
          });
          role = 'admin';
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.avatarUrl,
          credits: user.credits,
          role
        };
      }
    })
  ],

  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === 'google') {
        if (!user.email) return false;

        const emailLower = user.email.toLowerCase().trim();
        const isAdminEmail = emailLower === 'karaokestudio2026@gmail.com';

        let existingUser = await prisma.user.findUnique({
          where: { email: emailLower }
        });

        if (!existingUser) {
          // Generate a random password for Google-registered users
          const hashedPassword = await bcrypt.hash(Math.random().toString(36), 10);
          
          existingUser = await prisma.user.create({
            data: {
              email: emailLower,
              password: hashedPassword,
              name: isAdminEmail ? 'Admin' : (user.name || null),
              avatarUrl: user.image || null,
              credits: isAdminEmail ? 9999 : 20,
              role: isAdminEmail ? 'admin' : 'user'
            }
          });
        } else if (isAdminEmail && existingUser.role !== 'admin') {
          existingUser = await prisma.user.update({
            where: { id: existingUser.id },
            data: { role: 'admin' }
          });
        }

        if (!existingUser.isActive) {
          return false;
        }

        user.id = existingUser.id;
        user.credits = existingUser.credits;
        user.role = existingUser.role;
      }
      return true;
    },

    async jwt({ token, user, trigger, session }) {
      // On login
      if (user) {
        token.id = user.id;
        token.credits = user.credits;
        token.role = (user.email && user.email.toLowerCase().trim() === 'karaokestudio2026@gmail.com') ? 'admin' : user.role;
      }

      if (token.email && token.email.toLowerCase().trim() === 'karaokestudio2026@gmail.com') {
        token.role = 'admin';
      }

      // On manual session update (e.g., after credit change)
      if (trigger === 'update' && session?.credits !== undefined) {
        token.credits = session.credits;
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id;
        session.user.role = token.role;

        // Always sync live credits and role directly from PostgreSQL Database
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id },
            select: { credits: true, role: true }
          });
          if (dbUser) {
            session.user.credits = dbUser.credits;
            session.user.role = dbUser.role;
          } else {
            session.user.credits = token.credits;
          }
        } catch {
          session.user.credits = token.credits;
        }

        // Force fixed primary system admin role AFTER DB sync so it never gets overwritten
        if (session.user.email && session.user.email.toLowerCase().trim() === 'karaokestudio2026@gmail.com') {
          session.user.role = 'admin';
        }
      }
      return session;
    }
  },

  events: {
    async signOut({ token }) {
      // Clear Redis cache on signout
      if (token?.id) {
        await deleteCache(`user:credits:${token.id}`);
      }
    }
  },

  pages: {
    signIn: '/login',
    error: '/login'
  },

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60 // 30 days
  },

  secret: process.env.NEXTAUTH_SECRET
};
