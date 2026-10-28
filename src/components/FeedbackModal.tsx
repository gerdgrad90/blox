import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send, MessageSquare, Star, ThumbsUp, ThumbsDown } from 'lucide-react';

interface FeedbackModalProps {
  onClose: () => void;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({ onClose }) => {
  const [rating, setRating] = useState<number>(0);
  const [message, setMessage] = useState('');
  const [isSent, setIsSent] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rating && !message.trim()) return;

    setIsSending(true);
    // Simulate API call
    setTimeout(() => {
      setIsSending(false);
      setIsSent(true);
      setTimeout(() => {
        onClose();
      }, 2000);
    }, 1200);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm pointer-events-auto"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="w-full max-w-md bg-slate-900 border-2 border-slate-700 rounded-3xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-xl text-blue-400">
                <MessageSquare size={24} />
              </div>
              <h2 className="text-xl font-black text-white">Обратная связь</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <AnimatePresence mode="wait">
            {isSent ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-12 flex flex-col items-center text-center"
              >
                <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400 mb-4">
                  <ThumbsUp size={32} />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Спасибо!</h3>
                <p className="text-slate-400">Ваш отзыв очень важен для нас.</p>
              </motion.div>
            ) : (
              <motion.form
                key="form"
                onSubmit={handleSubmit}
                className="space-y-6"
              >
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-3">Как вам игра?</label>
                  <div className="flex justify-between gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        className={`flex-1 py-3 rounded-2xl border-2 transition-all flex items-center justify-center ${
                          rating >= star
                            ? 'bg-amber-500/20 border-amber-400 text-amber-400'
                            : 'bg-slate-800 border-slate-700 text-slate-500 hover:border-slate-600'
                        }`}
                      >
                        <Star
                          size={24}
                          className={rating >= star ? 'fill-amber-400' : 'fill-none'}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-3">Что можно улучшить?</label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Напишите ваши идеи или баги..."
                    className="w-full h-32 bg-slate-800 border-2 border-slate-700 rounded-2xl p-4 text-white placeholder-slate-500 outline-none focus:border-blue-500 transition-colors resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSending || (!rating && !message.trim())}
                  className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 text-white font-black text-lg flex items-center justify-center gap-3 shadow-[0_4px_0_#1e40af] active:translate-y-1 active:shadow-none transition-all"
                >
                  {isSending ? (
                    <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Send size={20} />
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
