import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, AlertTriangle, CheckCircle, Flag, MessageSquare } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

interface ReportQuestionModalProps {
  questionId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function ReportQuestionModal({ questionId, isOpen, onClose }: ReportQuestionModalProps) {
  const { user } = useAuth();
  const [category, setCategory] = useState<string>("typo");
  const [comment, setComment] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const categories = [
    { value: "typo", label: "Typographical / Copy Error" },
    { value: "incorrect_answer", label: "Incorrect Answer Key" },
    { value: "outdated", label: "Outdated / Obsolete Regulation" },
    { value: "formatting", label: "Incorrect Diagram / Formatting" },
    { value: "other", label: "Other Rationale Issues" }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) {
      setError("Please provide a brief description of the issue.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: dbError } = await supabase.from("question_reports").insert({
        question_id: questionId,
        user_id: user?.id || null,
        category,
        comment: comment.trim(),
        status: "open"
      });

      if (dbError) throw dbError;

      setSuccess(true);
      setComment("");
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 2500);
    } catch (err: any) {
      console.error("Error submitting question report:", err);
      setError(err?.message || "Failed to submit report. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div role="button" tabIndex={0} onKeyDown={(e) => { if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-ink/30 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ scale: 0.95, y: 15, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, y: 15, opacity: 0 }}
            transition={{ type: "spring", duration: 0.4, bounce: 0.1 }}
            className="bg-panel border border-rule rounded-2xl w-full max-w-md shadow-2xl relative overflow-hidden z-10 p-6 sm:p-8"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-signal/10 border border-signal/20 flex items-center justify-center text-signal">
                  <Flag size={16} />
                </div>
                <div>
                  <h3 className="font-serif text-xl text-ink font-semibold">Report Issue</h3>
                  <p className="font-mono text-[9px] tracking-widest text-muted-2 uppercase mt-0.5">Syllabus Quality Audit</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1 px-1.5 hover:bg-rule/50 rounded-md transition-colors text-muted hover:text-ink outline-none"
              >
                <X size={18} />
              </button>
            </div>

            {success ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-10 text-center flex flex-col items-center justify-center"
              >
                <div className="w-12 h-12 rounded-full bg-mint/10 border border-mint/20 text-mint flex items-center justify-center mb-4">
                  <CheckCircle size={24} />
                </div>
                <h4 className="font-serif text-lg text-ink font-semibold mb-2">Report Transmitted</h4>
                <p className="font-sans text-xs text-ink-2 max-w-xs leading-relaxed">
                  Thank you. Our flight operations editorial team has locked in this feedback for peer review.
                </p>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div className="p-3 bg-signal-soft border border-signal/20 text-signal text-xs rounded-lg flex items-start gap-2">
                    <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Question Info */}
                <div className="p-3 bg-bg border border-rule/60 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2 font-mono text-[10px] text-muted-2 uppercase">
                    <span>Target Question ID</span>
                    <span className="text-ink font-semibold tracking-wider">{questionId.slice(0, 13)}...</span>
                  </div>
                  <div className="footnote text-[9px] text-[#A66C23] font-mono bg-[#A66C23]/5 border border-[#A66C23]/20 px-1.5 py-0.5 rounded uppercase">
                    CAR / CARS Ref
                  </div>
                </div>

                {/* Category Choices */}
                <div className="space-y-1.5">
                  <label className="font-mono text-[9px] uppercase tracking-widest text-muted-2 block">
                    Discrepancy Category
                  </label>
                  <div className="relative">
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full bg-paper border border-rule rounded-xl px-4 py-2.5 text-sm font-medium text-ink focus:border-ink outline-none transition-colors appearance-none cursor-pointer pr-10"
                    >
                      {categories.map((cat) => (
                        <option key={cat.value} value={cat.value}>
                          {cat.label}
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted-2">
                      <MessageSquare size={14} />
                    </div>
                  </div>
                </div>

                {/* Comment Box */}
                <div className="space-y-1.5">
                  <label className="font-mono text-[9px] uppercase tracking-widest text-muted-2 block">
                    Description / Peer Arguments
                  </label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Provide specific manual references, page numbers, or logical explanations justifying your review request..."
                    rows={4}
                    className="w-full bg-paper border border-rule rounded-xl p-4 text-xs lg:text-sm font-sans text-ink focus:border-ink placeholder:text-muted outline-none transition-colors resize-none leading-relaxed"
                    maxLength={1000}
                  />
                </div>

                {/* Submit Buttons */}
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="h-10 px-4 text-xs font-sans font-medium text-ink border border-rule hover:bg-rule/40 rounded-full transition-colors outline-none"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="h-10 px-6 text-xs font-sans font-semibold text-bg bg-ink rounded-full hover:bg-ink-2 disabled:bg-ink/50 transition-colors inline-flex items-center gap-2 outline-none"
                  >
                    {loading ? "Transmitting..." : "Send Feedback"}
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
