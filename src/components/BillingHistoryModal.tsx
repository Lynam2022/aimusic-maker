'use client';

import React, { useState, useEffect } from 'react';
import { X, Loader2, Calendar, Coins, Landmark, ReceiptText } from 'lucide-react';

interface Transaction {
  id: string;
  type: string;
  amount: number;
  balance: number;
  vndAmount: number | null;
  note: string | null;
  createdAt: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

function BillingHistoryModalInner({ onClose }: { onClose: () => void }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const res = await fetch('/api/user/transactions');
        if (!res.ok) throw new Error('Không thể tải lịch sử giao dịch.');
        const data = await res.json();
        setTransactions(data.transactions || []);
      } catch (err: any) {
        setError(err.message || 'Lỗi kết nối hệ thống.');
      } finally {
        setLoading(false);
      }
    };
    fetchTransactions();
  }, []);

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  /**
   * Lọc technical error details khỏi note trước khi hiển thị với user.
   * Bảo vệ thương hiệu — không lộ thông tin kỹ thuật nội bộ.
   */
  const sanitizeNote = (note: string | null, type: string): string | null => {
    if (!note) return null;

    // Các pattern kỹ thuật cần loại bỏ
    const techPatterns = [
      /Suno API.*?($|\n)/gi,
      /Cookie Suno.*?($|\n)/gi,
      /token_validation_failed.*?($|\n)/gi,
      /Browser Token.*?($|\n)/gi,
      /Settings > Kết Nối Suno.*?($|\n)/gi,
      /Status: \d+.*?($|\n)/gi,
      /\{.*?status_code.*?\}/gi,
      /Clerk.*?($|\n)/gi,
      /studio-api.*?($|\n)/gi,
    ];

    const isTechnical = techPatterns.some(p => p.test(note));
    if (isTechnical) {
      // Thay bằng message thân thiện theo loại giao dịch
      if (type === 'refund') return 'Hoàn credits — Yêu cầu tạo nhạc không thành công.';
      return 'Giao dịch không thành công.';
    }

    // Sanitize "Hoàn credits do lỗi tạo nhạc:" prefix (legacy format)
    if (/^Hoàn credits do lỗi tạo nhạc:/i.test(note)) {
      return 'Hoàn credits — Yêu cầu tạo nhạc không thành công.';
    }

    return note;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-xl bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl animate-scale-up overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[var(--border)] bg-[var(--bg-card)]">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              <ReceiptText className="h-4.5 w-4.5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-sm font-black text-[var(--text-primary)]">Lịch Sử Thanh Toán</h2>
              <p className="text-[10px] text-[var(--text-secondary)]">Danh sách các giao dịch nạp credits của bạn</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition-all cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 max-h-[60vh] overflow-y-auto min-h-[250px] flex flex-col">
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center py-12 gap-2 text-xs text-[var(--text-muted)]">
              <Loader2 className="h-5 w-5 animate-spin text-[var(--accent)]" />
              <span>Đang tải lịch sử thanh toán...</span>
            </div>
          ) : error ? (
            <div className="flex-1 flex items-center justify-center text-center p-4 text-xs text-rose-400 font-semibold">
              {error}
            </div>
          ) : transactions.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-16 text-center space-y-3">
              <div className="rounded-full bg-[var(--bg-hover)] p-3 text-[var(--text-muted)]">
                <ReceiptText className="h-8 w-8" />
              </div>
              <div>
                <p className="text-xs font-bold text-[var(--text-primary)]">Chưa có giao dịch</p>
                <p className="text-[10px] text-[var(--text-muted)] mt-1">Lịch sử thanh toán của bạn sẽ xuất hiện tại đây.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((tx) => {
                const isDebit = tx.type === 'debit';
                const isRefund = tx.type === 'refund';
                const isDeposit = tx.type === 'deposit';

                let typeLabel = tx.type;
                let badgeClass = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
                let amountClass = 'text-emerald-400';
                let amountPrefix = '+';

                if (isDebit) {
                  typeLabel = 'Chi tiêu';
                  badgeClass = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
                  amountClass = 'text-rose-400';
                  amountPrefix = '-';
                } else if (isDeposit) {
                  typeLabel = 'Nạp tiền';
                  badgeClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                  amountClass = 'text-emerald-400';
                  amountPrefix = '+';
                } else if (isRefund) {
                  typeLabel = 'Hoàn trả';
                  badgeClass = 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
                  amountClass = 'text-indigo-400';
                  amountPrefix = '+';
                }

                return (
                  <div
                    key={tx.id}
                    className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] hover:border-[var(--accent)]/20 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm"
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${badgeClass}`}>
                          {typeLabel}
                        </span>
                        <span className="flex items-center gap-1 text-[10px] text-[var(--text-muted)] font-mono">
                          <Calendar className="h-3 w-3" />
                          {formatDate(tx.createdAt)}
                        </span>
                      </div>
                      {sanitizeNote(tx.note, tx.type) && (
                        <p className="text-xs text-[var(--text-secondary)] font-medium leading-relaxed break-words">
                          {sanitizeNote(tx.note, tx.type)}
                        </p>
                      )}
                    </div>
                    
                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 border-[var(--border)] pt-2.5 sm:pt-0 gap-1.5 shrink-0">
                      <div className={`flex items-center gap-1 font-extrabold text-sm ${amountClass}`}>
                        <Coins className="h-3.5 w-3.5" />
                        <span>{amountPrefix}{tx.amount}</span>
                      </div>
                      {tx.vndAmount ? (
                        <div className="flex items-center gap-1 text-[10px] text-[var(--text-muted)] font-bold">
                          <Landmark className="h-3 w-3" />
                          <span>{tx.vndAmount.toLocaleString('vi-VN')} VNĐ</span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BillingHistoryModal({ open, onClose }: Props) {
  const [openKey, setOpenKey] = useState(0);

  useEffect(() => {
    if (open) setOpenKey((k) => k + 1); // eslint-disable-line react-hooks/set-state-in-effect
  }, [open]);

  if (!open) return null;

  return <BillingHistoryModalInner key={openKey} onClose={onClose} />;
}
