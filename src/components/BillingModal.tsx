'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useMusicStore } from '@/store/musicStore';
import { 
  X, 
  CreditCard, 
  Coins, 
  CheckCircle2, 
  Globe, 
  Copy, 
  Check, 
  Loader2, 
  ChevronRight 
} from 'lucide-react';

export default function BillingModal() {
  const { data: session, update } = useSession();
  const { showBillingModal, setShowBillingModal, addCredits } = useMusicStore();
  
  // Payment states
  const [paymentMethod, setPaymentMethod] = useState<'vn' | 'intl'>('vn');
  const [isDetectedVN, setIsDetectedVN] = useState<boolean | null>(true);
  const [publicConfig, setPublicConfig] = useState<any>(null);
  
  // VN Payment state
  const [vndAmount, setVndAmount] = useState<string>('50000');
  const [showQrCode, setShowQrCode] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  
  // International Payment state
  const [usdAmount, setUsdAmount] = useState<string>('5');
  
  // General states
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Fetch configs & auto detect country on mount
  useEffect(() => {
    if (showBillingModal) {
      // Fetch public configurations
      fetch('/api/config/public')
        .then((res) => res.json())
        .then((data) => setPublicConfig(data))
        .catch((err) => console.error('Error fetching public config:', err));

      // Reliable detection: Timezone, Language & Locale
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      const lang = (navigator.language || '').toLowerCase();
      const languages = (navigator.languages || []).map(l => l.toLowerCase());
      
      const isVNTimezone = tz.includes('Asia/Ho_Chi_Minh') || tz.includes('Bangkok') || tz.includes('Saigon');
      const isVNLang = lang.includes('vi') || languages.some(l => l.includes('vi'));

      // Default to VN if timezone or language is Vietnamese
      if (isVNTimezone || isVNLang) {
        setPaymentMethod('vn');
        setIsDetectedVN(true);
      } else {
        setPaymentMethod('intl');
        setIsDetectedVN(false);
        // Try Geo IP if not obviously VN
        fetch('https://ipapi.co/json/')
          .then((res) => res.json())
          .then((data) => {
            if (data && data.country_code) {
              const isVN = data.country_code === 'VN';
              setPaymentMethod(isVN ? 'vn' : 'intl');
              setIsDetectedVN(isVN);
            }
          })
          .catch(() => {
            // Keep current detection
          });
      }
    }
  }, [showBillingModal]);

  // Calculate credits based on exchange rate from config
  const creditsPer1000Vnd = Number(publicConfig?.credits_per_1000_vnd || '9');
  const creditsPerUsd = Number(publicConfig?.credits_per_1_usd || '110');

  const calculatedCredits = paymentMethod === 'vn'
    ? Math.round((Number(vndAmount || 0) / 1000) * creditsPer1000Vnd)
    : Math.round(Number(usdAmount || 0) * creditsPerUsd);

  // Generate Bank details for QR code
  const bank = publicConfig?.deposit_bank || '';
  const account = publicConfig?.deposit_account_number || '';
  const accountName = publicConfig?.deposit_account_name || '';
  const userCode = session?.user?.id 
    ? session.user.id.substring(session.user.id.length - 6).toUpperCase() 
    : 'GUEST';
  const memo = `LYD${userCode}`;
  // Validate bank code: phải là chữ cái (e.g. "MB", "VCB"), không phải số
  const isBankCodeValid = bank && /^[A-Za-z]/.test(bank) && bank.length <= 20;
  const qrUrl = isBankCodeValid && account
    ? `https://qr.sepay.vn/img?acc=${account}&bank=${bank}&amount=${vndAmount}&des=${memo}&template=compact`
    : '';

  // Auto-polling user profile to verify credits addition (for SePay)
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (showQrCode && session?.user?.id) {
      const initialCredits = session.user.credits || 0;
      interval = setInterval(() => {
        fetch('/api/user/profile')
          .then((res) => res.json())
          .then(async (data) => {
            if (data && data.credits > initialCredits) {
              clearInterval(interval);
              // Update session data
              await update({ credits: data.credits });
              addCredits(data.credits - initialCredits);
              setIsSuccess(true);
              setShowQrCode(false);
              setTimeout(() => {
                setIsSuccess(false);
                setShowBillingModal(false);
                setShowQrCode(false);
              }, 1800);
            }
          })
          .catch((err) => console.error(err));
      }, 4000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [showQrCode, session, update, addCredits, setShowBillingModal]);

  // PayPal Buttons rendering
  useEffect(() => {
    if (paymentMethod === 'intl' && publicConfig?.paypal_client_id && showBillingModal) {
      const scriptId = 'paypal-sdk-script';
      let script = document.getElementById(scriptId) as HTMLScriptElement;
      
      const initPaypal = () => {
        const container = document.getElementById('paypal-button-container');
        if (container) {
          container.innerHTML = ''; // Clear container to avoid duplicate buttons
        }
        
        if ((window as any).paypal) {
          (window as any).paypal.Buttons({
            createOrder: (data: any, actions: any) => {
              return actions.order.create({
                purchase_units: [{
                  amount: {
                    currency_code: 'USD',
                    value: usdAmount
                  }
                }]
              });
            },
            onApprove: async (data: any, actions: any) => {
              setIsProcessing(true);
              try {
                const response = await fetch('/api/payment/paypal-capture', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    orderId: data.orderID,
                    usdAmount: usdAmount
                  })
                });
                if (!response.ok) throw new Error('Capture failed');
                const resData = await response.json();
                
                await update({ credits: resData.newBalance });
                addCredits(resData.creditsAdded);
                
                setIsProcessing(false);
                setIsSuccess(true);
                setTimeout(() => {
                  setIsSuccess(false);
                  setShowBillingModal(false);
                }, 1800);
              } catch (err) {
                console.error(err);
                alert('Thanh toán PayPal thất bại hoặc đang chờ xử lý.');
                setIsProcessing(false);
              }
            },
            onError: (err: any) => {
              console.error('PayPal error:', err);
            }
          }).render('#paypal-button-container');
        }
      };

      const expectedSrc = `https://www.paypal.com/sdk/js?client-id=${publicConfig.paypal_client_id}&currency=USD`;
      if (script && script.getAttribute('src') !== expectedSrc) {
        script.remove();
        script = null as any;
        // Clear cached paypal object so SDK can re-initialize
        if ((window as any).paypal) {
          try {
            delete (window as any).paypal;
          } catch (e) {}
        }
      }

      if (!script) {
        script = document.createElement('script');
        script.id = scriptId;
        script.src = expectedSrc;
        script.async = true;
        script.onload = initPaypal;
        document.body.appendChild(script);
      } else {
        // If script is already loaded, wait a brief tick and render
        setTimeout(initPaypal, 50);
      }
    }
  }, [paymentMethod, publicConfig, usdAmount, showBillingModal, update, addCredits, setShowBillingModal]);

  // Handle manual verify button (for SePay)
  const handleVerifyVnPayment = async () => {
    setIsProcessing(true);
    try {
      const res = await fetch('/api/user/profile');
      if (!res.ok) throw new Error('Failed to verify profile');
      const data = await res.json();
      
      const initialCredits = session?.user?.credits || 0;
      if (data && data.credits > initialCredits) {
        await update({ credits: data.credits });
        addCredits(data.credits - initialCredits);
        setIsProcessing(false);
        setIsSuccess(true);
        setShowQrCode(false);
        setTimeout(() => {
          setIsSuccess(false);
          setShowBillingModal(false);
        }, 1800);
      } else {
        alert('Hệ thống chưa ghi nhận được chuyển khoản. Vui lòng chờ 1-2 phút hoặc liên hệ hỗ trợ nếu quá lâu.');
        setIsProcessing(false);
      }
    } catch (err) {
      alert('Lỗi kiểm tra giao dịch.');
      setIsProcessing(false);
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  if (!showBillingModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-2xl transition-all duration-300">
        
        {/* Decorative Gradient Background */}
        <div className="absolute -top-24 -left-24 h-48 w-48 rounded-full bg-[var(--accent)]/10 blur-3xl"></div>
        <div className="absolute -bottom-24 -right-24 h-48 w-48 rounded-full bg-blue-500/10 blur-3xl"></div>

        {/* Header with Flag Selector */}
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
          <div className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-[var(--accent)]" />
            <h3 className="text-base font-bold text-[var(--text-primary)]">
              {showQrCode 
                ? 'Quét Mã QR Chuyển Khoản' 
                : (paymentMethod === 'vn' ? 'Nạp Credits (VNĐ)' : 'Buy Music Credits (USD)')}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            {/* Country Flag Selector */}
            {!showQrCode && !isSuccess && (
              <div className="flex items-center bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('vn')}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                    paymentMethod === 'vn'
                      ? 'bg-[var(--accent)] text-white dark:text-black shadow'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                  title="Việt Nam (VNĐ)"
                >
                  <span className="text-sm">🇻🇳</span>
                  <span>VNĐ</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('intl')}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                    paymentMethod === 'intl'
                      ? 'bg-[var(--accent)] text-white dark:text-black shadow'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                  title="Quốc tế (USD)"
                >
                  <span className="text-sm">🌐</span>
                  <span>USD</span>
                </button>
              </div>
            )}

            <button 
              onClick={() => {
                setShowBillingModal(false);
                setShowQrCode(false);
              }}
              className="rounded-lg p-1 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Dynamic content switcher */}
        {!isSuccess ? (
          isDetectedVN === null ? (
            /* LOADING SCREEN WHILE DETECTING LOCATION */
            <div className="mt-5 py-12 flex flex-col items-center justify-center space-y-3">
              <Loader2 className="h-8 w-8 animate-spin text-[var(--accent)]" />
              <p className="text-xs text-[var(--text-secondary)] font-bold">Đang tự động nhận diện vị trí...</p>
            </div>
          ) : showQrCode ? (
            /* QR SCREEN FOR SEPAY */
            <div className="mt-5 space-y-4 text-center">
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Quét mã QR bằng ứng dụng ngân hàng của bạn để hoàn tất giao dịch tự động.
              </p>

              {/* QR Image Wrapper */}
              <div className="relative mx-auto w-[260px] h-[260px] bg-white rounded-xl p-2 border border-slate-200 shadow-md flex items-center justify-center overflow-hidden">
                {!qrUrl ? (
                  <div className="text-center p-3">
                    <p className="text-rose-500 text-xs font-bold">⚠️ Cấu hình QR chưa đúng</p>
                    <p className="text-[10px] text-slate-500 mt-1">Admin cần cấu hình lại mã ngân hàng trong trang quản trị.</p>
                  </div>
                ) : (
                  <img 
                    src={qrUrl} 
                    alt="SePay Transfer QR" 
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      const img = e.currentTarget;
                      img.style.display = 'none';
                      const parent = img.parentElement;
                      if (parent && !parent.querySelector('.qr-error-msg')) {
                        const err = document.createElement('div');
                        err.className = 'qr-error-msg text-center p-2';
                        err.innerHTML = '<p style="color:#ef4444;font-size:11px;font-weight:bold">⚠️ Không tải được QR</p><p style="color:#64748b;font-size:10px;margin-top:4px">Kiểm tra lại cấu hình ngân hàng trong Admin.</p>';
                        parent.appendChild(err);
                      }
                    }}
                  />
                )}
              </div>
              {/* Bank Details Table */}
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-secondary)]/80 p-3.5 text-left space-y-2.5 text-xs shadow-inner">
                <div className="flex justify-between items-center py-1 border-b border-[var(--border)]/40">
                  <span className="text-[var(--text-secondary)] font-medium">Số tiền chuyển</span>
                  <span className="font-extrabold text-[var(--text-primary)] text-sm font-mono">
                    {Number(vndAmount).toLocaleString('vi-VN')} VNĐ
                  </span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-[var(--text-primary)] font-semibold flex items-center gap-1">
                    Nội dung <span className="text-rose-400/90 text-[11px] font-normal">*bắt buộc</span>
                  </span>

                  <button
                    type="button"
                    onClick={() => copyToClipboard(memo, 'memo')}
                    className="flex items-center gap-1.5 font-mono font-bold text-sm text-[var(--accent)] bg-[var(--accent-dim)] hover:bg-[var(--accent)]/20 px-3 py-1.5 rounded-xl border border-[var(--accent)]/30 transition-all cursor-pointer group shadow-sm active:scale-95"
                    title="Sao chép nội dung"
                  >
                    <span>{memo}</span>
                    {copiedField === 'memo' ? (
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5 text-[var(--accent)] opacity-70 group-hover:opacity-100 transition-opacity" />
                    )}
                  </button>
                </div>
              </div>
              {/* Status Polling Helper info */}
              <div className="flex items-center justify-center gap-2 text-[10px] text-[var(--text-muted)]">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--accent)]" />
                <span>Hệ thống tự động cộng credits khi nhận được tiền (Đang quét...)</span>
              </div>

              {/* Confirm / Back Buttons */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={() => setShowQrCode(false)}
                  className="py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] text-xs font-bold transition-all cursor-pointer"
                >
                  Quay lại
                </button>
                <button
                  onClick={handleVerifyVnPayment}
                  disabled={isProcessing}
                  className="py-2.5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white dark:text-black text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-[var(--accent)]/10"
                >
                  {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Đã chuyển tiền'}
                </button>
              </div>
            </div>
          ) : (
            /* AMOUNT INPUT & METHOD SELECTION SCREEN */
            <div className="mt-5 space-y-5">

              {/* Exchange rate helper text */}
              <div>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  {paymentMethod === 'vn' ? (
                    <>
                      Tỷ lệ quy đổi: <span className="font-bold text-[var(--accent)]">1.000 VNĐ = {creditsPer1000Vnd} Credits</span>. Mỗi lần tạo nhạc (2 bài) tiêu tốn 10 Credits.
                    </>
                  ) : (
                    <>
                      Exchange rate: <span className="font-bold text-[var(--accent)]">1 USD = {creditsPerUsd} Credits</span>. Every music generation (2 songs) costs 10 Credits.
                    </>
                  )}
                </p>
              </div>

              {/* VN PAYMENT SELECTOR */}
              {paymentMethod === 'vn' && (
                <div className="space-y-4">
                  {/* Quick Select Buttons */}
                  <div className="grid grid-cols-4 gap-2">
                    {[20000, 50000, 100000, 150000].map((amount) => (
                      <button
                        key={amount}
                        type="button"
                        onClick={() => setVndAmount(amount.toString())}
                        className={`rounded-xl border py-2.5 px-2 text-xs font-extrabold transition-all cursor-pointer text-center ${
                          vndAmount === amount.toString()
                            ? 'border-[var(--accent)] bg-[var(--accent-dim)] text-[var(--accent)] shadow-md shadow-[var(--accent)]/15 scale-[1.02]'
                            : 'border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:border-[var(--border-focus)]/40 hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        {amount.toLocaleString('vi-VN')} đ
                      </button>
                    ))}
                  </div>

                  {/* Input Field */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-[var(--text-secondary)]">Nhập số tiền khác (VNĐ)</label>
                    <div className="relative flex items-center">
                      <input
                        type="number"
                        min="10000"
                        step="10000"
                        value={vndAmount}
                        onChange={(e) => setVndAmount(e.target.value)}
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-input)] py-3 pl-4 pr-16 text-sm text-[var(--text-primary)] outline-none transition-all focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/20"
                        placeholder="Nhập số tiền..."
                      />
                      <span className="absolute right-4 text-xs font-bold text-[var(--text-muted)] font-mono">VNĐ</span>
                    </div>
                  </div>
                </div>
              )}

              {/* INT PAYMENT SELECTOR */}
              {paymentMethod === 'intl' && (
                <div className="space-y-4">
                  {/* Quick Select Buttons */}
                  <div className="grid grid-cols-4 gap-2">
                    {[2, 5, 10, 20].map((amount) => (
                      <button
                        key={amount}
                        type="button"
                        onClick={() => setUsdAmount(amount.toString())}
                        className={`rounded-lg border py-2 text-[10px] font-bold transition-all cursor-pointer ${
                          usdAmount === amount.toString()
                            ? 'border-[var(--accent)] bg-[var(--accent-dim)] text-[var(--accent)] shadow-lg shadow-[var(--accent)]/10'
                            : 'border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:border-[var(--border-focus)]/40 hover:bg-[var(--bg-hover)]'
                        }`}
                      >
                        ${amount} USD
                      </button>
                    ))}
                  </div>

                  {/* Input Field */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-[var(--text-secondary)]">Enter custom amount (USD)</label>
                    <div className="relative flex items-center">
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={usdAmount}
                        onChange={(e) => setUsdAmount(e.target.value)}
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-input)] py-3 pl-4 pr-16 text-sm text-[var(--text-primary)] outline-none transition-all focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/20"
                        placeholder="USD amount..."
                      />
                      <span className="absolute right-4 text-xs font-bold text-[var(--text-muted)] font-mono">USD</span>
                    </div>
                  </div>
                </div>
              )}
              {/* Exchange Box */}
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[var(--text-secondary)]">Số Credits nhận được:</span>
                  <span className="text-lg font-black text-[var(--accent)] flex items-center gap-1.5">
                    <Coins className="h-5 w-5" />
                    {calculatedCredits.toLocaleString()} Credits
                  </span>
                </div>
              </div>
              {/* Payment Processing/Checkout buttons */}
              {paymentMethod === 'vn' ? (
                /* SePay trigger button */
                <button
                  onClick={() => {
                    if (Number(vndAmount) < 10000) {
                      alert('Số tiền nạp tối thiểu là 10.000 VNĐ.');
                      return;
                    }
                    setShowQrCode(true);
                  }}
                  disabled={Number(vndAmount) < 10000}
                  className={`w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all duration-300 cursor-pointer ${
                    Number(vndAmount) < 10000
                      ? 'bg-[var(--bg-hover)] text-[var(--text-muted)] cursor-not-allowed border border-[var(--border)]'
                      : 'bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white dark:text-black shadow-lg shadow-[var(--accent)]/20 active:scale-[0.98]'
                  }`}
                >
                  <CreditCard className="h-4 w-4" />
                  Xác nhận Nạp Tiền
                </button>
              ) : (
                /* PayPal button container (remounted on amount change to load PayPal buttons correctly) */
                <div className="space-y-2">
                  <div 
                    key={`${paymentMethod}_${usdAmount}`} 
                    id="paypal-button-container"
                    className="min-h-[50px] relative z-10"
                  >
                    {isProcessing && (
                      <div className="flex items-center justify-center py-4 gap-2 text-xs text-[var(--text-muted)]">
                        <Loader2 className="h-4 w-4 animate-spin text-[var(--accent)]" />
                        <span>Đang xử lý giao dịch PayPal...</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        ) : (
          /* Success Screen */
          <div className="my-8 flex flex-col items-center justify-center space-y-4 text-center animate-scale-up">
            <div className="rounded-full bg-emerald-500/10 p-3 text-emerald-400">
              <CheckCircle2 className="h-12 w-12 animate-bounce" />
            </div>
            <div>
              <h4 className="text-lg font-bold text-[var(--text-primary)]">Nạp Tiền Thành Công!</h4>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                +{calculatedCredits} Credits đã được cộng vào tài khoản của bạn.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
