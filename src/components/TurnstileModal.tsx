'use client';

import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: Record<string, unknown>) => string;
      remove: (widgetId: string) => void;
      reset: (widgetId: string) => void;
    };
  }
}

interface TurnstileModalProps {
  onVerified: (token: string) => void;
  onClose: () => void;
}

// Suno's Cloudflare Turnstile site key
const SUNO_SITE_KEY = '0x4AAAAAADI7xDNyj-3LcIbi';

export default function TurnstileModal({ onVerified, onClose }: TurnstileModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const calledRef = useRef(false); // prevent calling onVerified more than once
  const [status, setStatus] = useState<'loading' | 'ready' | 'verified' | 'error'>('loading');

  useEffect(() => {
    const renderWidget = () => {
      if (!containerRef.current || !window.turnstile) return;
      setStatus('ready');
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: SUNO_SITE_KEY,
        theme: 'dark',
        language: 'vi',
        callback: (token: string) => {
          if (calledRef.current) return; // only fire once
          calledRef.current = true;
          setStatus('verified');
          setTimeout(() => onVerified(token), 400);
        },
        'error-callback': () => {
          calledRef.current = false;
          setStatus('error');
          if (widgetIdRef.current && window.turnstile) {
            setTimeout(() => {
              window.turnstile!.reset(widgetIdRef.current!);
              setStatus('ready');
            }, 2000);
          }
        },
        'expired-callback': () => {
          calledRef.current = false;
          if (widgetIdRef.current && window.turnstile) {
            window.turnstile.reset(widgetIdRef.current);
            setStatus('ready');
          }
        },
      });
    };

    if (window.turnstile) {
      renderWidget();
    } else {
      const existing = document.getElementById('cf-turnstile-script');
      if (!existing) {
        const script = document.createElement('script');
        script.id = 'cf-turnstile-script';
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.onload = renderWidget;
        document.head.appendChild(script);
      } else {
        const iv = setInterval(() => {
          if (window.turnstile) { clearInterval(iv); renderWidget(); }
        }, 100);
        return () => clearInterval(iv);
      }
    }

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        try { window.turnstile.remove(widgetIdRef.current); } catch {}
      }
    };
  }, [onVerified]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative rounded-2xl border shadow-2xl"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', minWidth: 300 }}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1 rounded-lg opacity-50 hover:opacity-100 transition-opacity"
          style={{ color: 'var(--text-muted)' }}
        >
          <X className="h-4 w-4" />
        </button>

        <div className="p-6 flex flex-col items-center gap-3">
          <p className="text-xs font-medium pr-4" style={{ color: 'var(--text-secondary)' }}>
            Xác minh để tiếp tục tạo nhạc
          </p>

          <div ref={containerRef} />

          {status === 'loading' && (
            <div className="flex items-center gap-2 py-2">
              <div
                className="h-4 w-4 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}
              />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Đang tải xác thực...</span>
            </div>
          )}

          {status === 'verified' && (
            <p className="text-xs font-semibold text-green-500">✓ Xác minh thành công!</p>
          )}

          {status === 'error' && (
            <p className="text-xs text-red-400">Xác minh thất bại. Đang tải lại...</p>
          )}
        </div>
      </div>
    </div>
  );
}
