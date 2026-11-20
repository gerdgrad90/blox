import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Send,
  MessageSquare,
  Star,
  Mail,
  CheckCircle2,
  ExternalLink,
  AlertCircle,
  BarChart3,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  computeClientFeedbackSummary,
  EMPTY_FEEDBACK_SUMMARY,
  FEEDBACK_GAME_LABELS,
  FeedbackSummary,
  PublicFeedbackReview,
  readFeedbackArchive,
  saveFeedbackArchive,
} from '../game/feedback';

interface FeedbackModalProps {
  onClose: () => void;
  authorName?: string;
  gameId?: string;
  mode?: string;
  roomId?: string;
  onSummaryUpdated?: (summary: FeedbackSummary) => void;
}

interface FeedbackSubmitResult {
  id: string;
  emailDelivered: boolean;
  provider: 'resend' | 'smtp' | 'none';
  needsEmailConfig: boolean;
  error?: string;
  recipient: string;
  mailtoUrl: string;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({
  onClose,
  authorName = 'Игрок',
  gameId = 'doors',
  mode = 'online',
  roomId = '',
  onSummaryUpdated,
}) => {
  const [rating, setRating] = useState<number>(0);
  const [message, setMessage] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [submitResult, setSubmitResult] = useState<FeedbackSubmitResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const [summary, setSummary] = useState<FeedbackSummary>(() => {
    const local = readFeedbackArchive();
    return local.length > 0 ? computeClientFeedbackSummary(local) : EMPTY_FEEDBACK_SUMMARY;
  });
  const [recentReviews, setRecentReviews] = useState<PublicFeedbackReview[]>(() =>
    readFeedbackArchive()
      .slice(0, 8)
      .map((r) => ({
        id: r.id,
        author: r.author,
        rating: r.rating,
        message: r.message,
        gameId: r.gameId,
        createdAt: r.createdAt,
      }))
  );
  const [showReviewsList, setShowReviewsList] = useState(false);

  const loadSummary = useCallback(async () => {
    try {
      const res = await fetch('/api/feedback/summary', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (data?.summary) {
        setSummary(data.summary);
        onSummaryUpdated?.(data.summary);
      }
      if (Array.isArray(data?.recentReviews)) {
        setRecentReviews(data.recentReviews);
      }
    } catch {
      // Keep local archive summary fallback
    }
  }, [onSummaryUpdated]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rating && !message.trim()) return;

    setIsSending(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating,
          message: message.trim(),
          author: authorName,
          contactEmail: contactEmail.trim(),
          gameId,
          mode,
          roomId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Не удалось отправить отзыв');
      }

      if (data.feedback) {
        saveFeedbackArchive([data.feedback]);
      }
      if (data.summary) {
        setSummary(data.summary);
        onSummaryUpdated?.(data.summary);
      } else {
        void loadSummary();
      }
      void loadSummary();

      setSubmitResult({
        id: data.id,
        emailDelivered: Boolean(data.emailDelivered),
        provider: data.provider || 'none',
        needsEmailConfig: Boolean(data.needsEmailConfig),
        error: data.error,
        recipient: data.recipient || 'gerdgrad9@gmail.com',
        mailtoUrl: data.mailtoUrl || 'mailto:gerdgrad9@gmail.com',
      });
    } catch (err: any) {
      setErrorMsg(err?.message || 'Ошибка соединения с сервером.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm pointer-events-auto"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        className="w-full max-w-lg max-h-[92dvh] overflow-y-auto bg-slate-900 border-2 border-slate-700 rounded-3xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-500/20 rounded-xl text-blue-400">
                <MessageSquare size={22} />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-black text-white leading-tight">
                  Обратная связь и Отзывы
                </h2>
                <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                  <Mail size={11} className="text-sky-400" />
                  <span>Почта автора: <strong className="text-slate-200">gerdgrad9@gmail.com</strong></span>
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Закрыть форму отзыва"
              className="min-w-[40px] min-h-[40px] flex items-center justify-center p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>

          {/* Overall Rating by Reviews Card */}
          <div
            data-testid="overall-reviews-rating-card"
            className="p-3.5 rounded-2xl bg-gradient-to-br from-amber-950/35 via-slate-950 to-slate-900 border border-amber-500/35 space-y-2.5"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-black text-amber-300 uppercase tracking-wide">
                <BarChart3 size={14} className="text-amber-400" />
                <span>Общая оценка по отзывам</span>
              </div>
              <span className="text-[11px] font-bold text-slate-400">
                {summary.ratedCount > 0
                  ? `${summary.ratedCount} оц. · ${summary.totalLetters} писем`
                  : `${summary.totalLetters} писем`}
              </span>
            </div>

            <div className="grid grid-cols-12 gap-3 items-center">
              <div className="col-span-5 flex flex-col items-center justify-center p-2.5 rounded-xl bg-slate-950/85 border border-slate-800 text-center">
                <div className="flex items-baseline gap-1">
                  <span
                    data-testid="overall-rating-score"
                    className="text-2xl sm:text-3xl font-black text-amber-300 font-mono"
                  >
                    {summary.ratedCount > 0 ? summary.averageRating.toFixed(1) : '—'}
                  </span>
                  {summary.ratedCount > 0 && (
                    <span className="text-[11px] font-bold text-slate-500">/ 5</span>
                  )}
                </div>
                <div className="flex items-center gap-0.5 my-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      size={13}
                      className={
                        summary.ratedCount > 0 && summary.averageRating >= n - 0.35
                          ? 'text-amber-400 fill-amber-400'
                          : 'text-slate-700 fill-none'
                      }
                    />
                  ))}
                </div>
                <span className="text-[10px] text-slate-400 leading-tight">
                  {summary.ratedCount > 0
                    ? `${summary.positivePercent}% положительных`
                    : 'Станьте первым!'}
                </span>
              </div>

              <div className="col-span-7 space-y-1">
                {([5, 4, 3, 2, 1] as const).map((star) => {
                  const count = summary.breakdown[String(star) as '1' | '2' | '3' | '4' | '5'] || 0;
                  const pct = summary.ratedCount > 0 ? Math.round((count / summary.ratedCount) * 100) : 0;
                  return (
                    <div key={star} className="flex items-center gap-1.5 text-[10px]">
                      <span className="w-5 font-black text-amber-300 text-right shrink-0">{star}★</span>
                      <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-300 transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-7 text-right font-mono text-slate-400 shrink-0">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {recentReviews.length > 0 && (
              <div className="pt-1 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setShowReviewsList((prev) => !prev)}
                  className="w-full flex items-center justify-between text-[11px] font-bold text-sky-300 hover:text-sky-200 cursor-pointer py-0.5"
                >
                  <span>Последние отзывы игроков ({recentReviews.length})</span>
                  {showReviewsList ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                {showReviewsList && (
                  <div className="mt-2 space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {recentReviews.map((rev) => (
                      <div
                        key={rev.id}
                        className="p-2 rounded-xl bg-slate-900/90 border border-slate-800 text-[11px] space-y-0.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-black text-white truncate">{rev.author}</span>
                            {rev.gameId && (
                              <span className="text-[10px] text-slate-400">
                                {FEEDBACK_GAME_LABELS[rev.gameId] || rev.gameId}
                              </span>
                            )}
                          </div>
                          {rev.rating > 0 && (
                            <span className="text-amber-400 font-black shrink-0">
                              {'★'.repeat(rev.rating)}
                            </span>
                          )}
                        </div>
                        {rev.message && (
                          <p className="text-slate-300 line-clamp-2">{rev.message}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <AnimatePresence mode="wait">
            {submitResult ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-4 flex flex-col items-center text-center gap-4"
              >
                <div
                  className={`w-16 h-16 rounded-full flex items-center justify-center ${
                    submitResult.emailDelivered
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-sky-500/20 text-sky-400'
                  }`}
                >
                  <CheckCircle2 size={34} />
                </div>

                {submitResult.emailDelivered ? (
                  <div className="space-y-1.5">
                    <h3 className="text-xl font-black text-white">Письмо доставлено!</h3>
                    <p className="text-sm text-emerald-300">
                      Ваш отзыв успешно отправлен на почту <strong>{submitResult.recipient}</strong> и навсегда сохранён во вкладке «Почта».
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5 w-full">
                    <h3 className="text-xl font-black text-white">Отзыв сохранён навсегда!</h3>
                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                      Письмо навсегда сохранено в ящике разработчика (раздел <strong>«Почта»</strong> в Админ-панели) и учтено в общей оценке игры.
                    </p>
                    <a
                      href={submitResult.mailtoUrl}
                      className="w-full py-3 px-4 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white font-black text-sm flex items-center justify-center gap-2 transition-colors shadow-md"
                    >
                      <ExternalLink size={16} />
                      <span>Дублировать через почту на {submitResult.recipient}</span>
                    </a>
                  </div>
                )}

                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm cursor-pointer transition-colors"
                >
                  Закрыть
                </button>
              </motion.div>
            ) : (
              <motion.form
                key="form"
                onSubmit={handleSubmit}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2">Как вам игра?</label>
                  <div className="flex justify-between gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        className={`flex-1 py-3 rounded-2xl border-2 transition-all flex items-center justify-center cursor-pointer ${
                          rating >= star
                            ? 'bg-amber-500/20 border-amber-400 text-amber-400'
                            : 'bg-slate-800 border-slate-700 text-slate-500 hover:border-slate-600'
                        }`}
                      >
                        <Star
                          size={22}
                          className={rating >= star ? 'fill-amber-400' : 'fill-none'}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-1.5">
                    Ваш email или Telegram для ответа <span className="text-slate-500 font-normal">(необязательно)</span>
                  </label>
                  <input
                    type="text"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="example@gmail.com или @username"
                    maxLength={120}
                    className="w-full bg-slate-800 border-2 border-slate-700 rounded-2xl px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-1.5">Что можно улучшить?</label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Напишите ваши идеи, пожелания или найденные баги..."
                    maxLength={2000}
                    className="w-full h-24 bg-slate-800 border-2 border-slate-700 rounded-2xl p-3.5 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500 transition-colors resize-none"
                  />
                </div>

                {errorMsg && (
                  <div className="px-3 py-2 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center gap-2">
                    <AlertCircle size={15} className="shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSending || (!rating && !message.trim())}
                  className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 text-white font-black text-base flex items-center justify-center gap-2.5 shadow-[0_4px_0_#1e40af] active:translate-y-1 active:shadow-none transition-all cursor-pointer"
                >
                  {isSending ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Send size={18} />
                      <span>Отправить отзыв</span>
                    </>
                  )}
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
};
