import { useEffect, useMemo } from "react";
import { motion } from "motion/react";
import { Sparkles, CheckCircle2, Plane } from "lucide-react";

// Full-screen one-shot celebration shown the moment a Razorpay payment is
// verified and the account is upgraded to Captain (Pro). Self-contained: the
// confetti is rendered with motion/react (already a dependency) — no extra
// packages. Calls onDone() after the sequence so the caller can reload/sync.

const CONFETTI_COLORS = ["#0F1E3C", "#DF9D38", "#10B981", "#3B8AD9", "#CF8E28"];

type Props = {
  interval: "monthly" | "yearly";
  // Fired once the animation has had time to play. Caller typically reloads.
  onDone?: () => void;
  doneDelayMs?: number;
};

export default function PaymentSuccessCelebration({ interval, onDone, doneDelayMs = 3600 }: Props) {
  // Pre-compute confetti pieces once so they don't re-randomise on re-render.
  const pieces = useMemo(
    () =>
      Array.from({ length: 90 }).map((_, i) => ({
        id: i,
        left: Math.random() * 100,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        delay: Math.random() * 0.6,
        duration: 2.4 + Math.random() * 1.8,
        rotate: (Math.random() - 0.5) * 720,
        size: 6 + Math.random() * 8,
        drift: (Math.random() - 0.5) * 160,
      })),
    []
  );

  useEffect(() => {
    if (!onDone) return;
    const t = setTimeout(onDone, doneDelayMs);
    return () => clearTimeout(t);
  }, [onDone, doneDelayMs]);

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-live="assertive"
      aria-label="Payment successful"
    >
      {/* Dim backdrop */}
      <div className="absolute inset-0 bg-ink/70 backdrop-blur-sm" />

      {/* Confetti layer */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {pieces.map((p) => (
          <motion.div
            key={p.id}
            className="absolute top-[-5%] rounded-[2px]"
            style={{ left: `${p.left}%`, width: p.size, height: p.size * 1.6, backgroundColor: p.color }}
            initial={{ y: "-10vh", x: 0, rotate: 0, opacity: 1 }}
            animate={{ y: "110vh", x: p.drift, rotate: p.rotate, opacity: [1, 1, 0.9, 0] }}
            transition={{ delay: p.delay, duration: p.duration, ease: "easeIn" }}
          />
        ))}
      </div>

      {/* Center card */}
      <motion.div
        className="relative z-10 w-full max-w-sm bg-paper border border-rule rounded-[28px] shadow-2xl px-8 py-10 text-center overflow-hidden"
        initial={{ scale: 0.8, y: 24, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 220, damping: 18, delay: 0.1 }}
      >
        <div className="absolute top-0 right-0 w-56 h-56 bg-navy/5 blur-3xl rounded-full translate-x-1/3 -translate-y-1/3" />

        {/* Animated badge */}
        <motion.div
          className="relative mx-auto mb-6 w-20 h-20 rounded-full bg-navy flex items-center justify-center shadow-lg"
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.25 }}
        >
          <motion.span
            className="absolute inset-0 rounded-full border-2 border-[#DF9D38]"
            initial={{ scale: 1, opacity: 0.8 }}
            animate={{ scale: 1.6, opacity: 0 }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "easeOut" }}
          />
          <CheckCircle2 className="text-bg" size={38} strokeWidth={2.2} />
        </motion.div>

        <motion.span
          className="inline-flex items-center gap-1.5 mb-3 font-mono text-[9px] tracking-[0.25em] uppercase text-[#DF9D38] font-bold"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
        >
          <Sparkles size={12} /> Clearance Granted
        </motion.span>

        <motion.h2
          className="font-serif text-[30px] leading-tight text-ink mb-2"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
        >
          Welcome aboard, Captain!
        </motion.h2>

        <motion.p
          className="font-sans text-[13px] text-muted leading-relaxed mb-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
        >
          Your Captain (Pro) {interval === "yearly" ? "annual" : "monthly"} plan is live. Every
          feature is unlocked — happy flying.
        </motion.p>

        <motion.div
          className="flex items-center justify-center gap-2 font-mono text-[10px] uppercase tracking-widest text-navy"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.85 }}
        >
          <Plane size={13} className="text-[#DF9D38]" /> Preparing your flight deck…
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
