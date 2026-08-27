"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

/**
 * "Pori" — the app's owl mascot. A proper illustrated character (feather
 * tufts, wings, beak, blush) built from SVG primitives with a mood-driven
 * gradient, not an emoji. Wings flap, eyes blink on a random timer, body
 * bobs — reads as "alive" at rest, not just during a specific animation.
 *
 * mood: "idle" | "submitting" | "blocking" | "suspense" | "celebrate-high" | "celebrate" | "encourage" | "struggling" | "locked"
 * ctaLabel/onCta: optional — always give the mascot a way forward when
 * it's the main content of a screen (e.g. a result reveal), so the user
 * never gets stuck looking at it with nowhere to go.
 */
const MOOD_COPY = {
  idle: "প্রস্তুত? চলো শুরু করি! ⚡",
  submitting: "আরেহ! সব আনসার করা শেষ?? 😳",
  blocking: "কোথায় পালাচ্ছ 🧐! এক্সাম শেষ করো।",
  suspense: "রেডি তো? দেখি কত পেলে! 👀",
  "celebrate-high": "অবিশ্বাস্য!! তুমি তো একদম টপার! 🏆✨",
  celebrate: "অসাধারণ! এভাবেই এগিয়ে যাও 🎉",
  encourage: "মোটামুটি হয়েছে — একটু বেশি প্র্যাকটিস করলেই দারুণ হবে! 💪",
  struggling: "মন খারাপ করো না — সবার শুরুটা এমনই হয়। আবার চেষ্টা করো! 🌱",
  locked: "উত্তর লক হয়ে গেছে — এখন আর বদলানো যাবে না।",
};

// Two-stop gradients per mood — feels glossier/more "designed" than a flat fill.
const MOOD_GRADIENT = {
  idle: ["#f6b93b", "#c9820a"],
  submitting: ["#8891c9", "#2f3878"],
  blocking: ["#f08a83", "#c23930"],
  suspense: ["#5b67a8", "#1a2050"],
  "celebrate-high": ["#ffd76a", "#c9820a"],
  celebrate: ["#6fd6a3", "#1f8a56"],
  encourage: ["#f6b93b", "#c9820a"],
  struggling: ["#8891c9", "#4a5590"],
  locked: ["#8891c9", "#2f3878"],
};

let gradIdCounter = 0;

export default function Mascot({ mood = "idle", message, size = "md", ctaLabel, onCta }) {
  const bubbleText = message || MOOD_COPY[mood] || MOOD_COPY.idle;
  const [c1, c2] = MOOD_GRADIENT[mood] || MOOD_GRADIENT.idle;
  const px = size === "sm" ? 64 : size === "lg" ? 132 : 92;
  const [gradId] = useState(() => `mascotGrad${gradIdCounter++}`);

  const [blink, setBlink] = useState(false);
  useEffect(() => {
    const loop = setInterval(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 130);
    }, 2400 + Math.random() * 1600);
    return () => clearInterval(loop);
  }, []);

  const isBlocking = mood === "blocking";
  const isCelebrate = mood === "celebrate" || mood === "celebrate-high";
  const isTopper = mood === "celebrate-high";
  const isStruggling = mood === "struggling";

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-end gap-3">
        <motion.div
          animate={{
            y: isBlocking ? [0, -3, 0] : isStruggling ? [0, -3, 0] : isTopper ? [0, -14, 0] : [0, -7, 0],
            rotate: isBlocking ? [0, -4, 4, 0] : isStruggling ? [-1, 1, -1] : [-2, 2, -2],
          }}
          transition={{ duration: isBlocking ? 0.45 : isTopper ? 0.9 : 2.8, repeat: Infinity, ease: "easeInOut" }}
          style={{ width: px, height: px, opacity: isStruggling ? 0.92 : 1 }}
          className="relative shrink-0 drop-shadow-xl"
        >
          {isCelebrate && <Sparkles big={isTopper} />}
          <svg viewBox="0 0 120 130" width={px} height={px} style={{ transform: isStruggling ? "rotate(-2deg)" : undefined }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={c1} />
                <stop offset="100%" stopColor={c2} />
              </linearGradient>
            </defs>

            {/* back wings — flap (droop instead, for a low-score comfort pose) */}
            <motion.ellipse
              cx="22" cy="80" rx="14" ry="22"
              fill={c2}
              animate={{ rotate: isTopper ? [0, -45, 0] : isCelebrate ? [0, -30, 0] : isStruggling ? [-14, -10, -14] : [-8, 4, -8] }}
              transition={{ duration: isTopper ? 0.35 : isCelebrate ? 0.5 : 2.8, repeat: Infinity, ease: "easeInOut" }}
              style={{ transformOrigin: "30px 68px" }}
            />
            <motion.ellipse
              cx="98" cy="80" rx="14" ry="22"
              fill={c2}
              animate={{ rotate: isTopper ? [0, 45, 0] : isCelebrate ? [0, 30, 0] : isStruggling ? [14, 10, 14] : [8, -4, 8] }}
              transition={{ duration: isTopper ? 0.35 : isCelebrate ? 0.5 : 2.8, repeat: Infinity, ease: "easeInOut" }}
              style={{ transformOrigin: "90px 68px" }}
            />

            {/* ear tufts */}
            <path d="M 36 24 Q 30 6 44 16 Z" fill={c2} />
            <path d="M 84 24 Q 90 6 76 16 Z" fill={c2} />

            {/* body */}
            <ellipse cx="60" cy="76" rx="40" ry="44" fill={`url(#${gradId})`} />
            {/* belly patch */}
            <ellipse cx="60" cy="86" rx="24" ry="28" fill="#fff" opacity="0.18" />

            {/* blush cheeks */}
            <ellipse cx="30" cy="80" rx="7" ry="5" fill="#ff8a80" opacity="0.55" />
            <ellipse cx="90" cy="80" rx="7" ry="5" fill="#ff8a80" opacity="0.55" />

            {/* face disc */}
            <ellipse cx="60" cy="66" rx="30" ry="26" fill="#fff9f0" opacity="0.95" />

            {/* eyes — star-shaped sparkle for the topper mood, droopy half-lidded for struggling */}
            {blink && !isTopper ? (
              <>
                <path d="M 38 64 Q 47 68 56 64" stroke="#101636" strokeWidth="3.5" strokeLinecap="round" fill="none" />
                <path d="M 64 64 Q 73 68 82 64" stroke="#101636" strokeWidth="3.5" strokeLinecap="round" fill="none" />
              </>
            ) : isTopper ? (
              <>
                <StarEye cx={47} cy={64} />
                <StarEye cx={73} cy={64} />
              </>
            ) : (
              <>
                <circle cx="47" cy={isStruggling ? 66 : 64} r="10" fill="#fff" stroke="#101636" strokeWidth="2" />
                <circle cx="73" cy={isStruggling ? 66 : 64} r="10" fill="#fff" stroke="#101636" strokeWidth="2" />
                {isStruggling && (
                  <>
                    {/* half-closed eyelid for a gentle, comforting look rather than sad/mocking */}
                    <path d="M 37 63 Q 47 58 57 63 L 57 66 Q 47 62 37 66 Z" fill="#fff9f0" />
                    <path d="M 63 63 Q 73 58 83 63 L 83 66 Q 73 62 63 66 Z" fill="#fff9f0" />
                  </>
                )}
                <circle cx={isBlocking ? 44 : 49} cy={isStruggling ? 67 : 64} r="5" fill="#101636" />
                <circle cx={isBlocking ? 70 : 75} cy={isStruggling ? 67 : 64} r="5" fill="#101636" />
                <circle cx="51" cy={isStruggling ? 64 : 61} r="1.6" fill="#fff" />
                <circle cx="77" cy={isStruggling ? 64 : 61} r="1.6" fill="#fff" />
              </>
            )}

            {/* eyebrows — stern when blocking, gently raised/concerned when struggling */}
            {isBlocking && (
              <>
                <line x1="38" y1="50" x2="52" y2="54" stroke="#101636" strokeWidth="3" strokeLinecap="round" />
                <line x1="82" y1="50" x2="68" y2="54" stroke="#101636" strokeWidth="3" strokeLinecap="round" />
              </>
            )}
            {isStruggling && (
              <>
                <line x1="39" y1="52" x2="53" y2="49" stroke="#101636" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="81" y1="52" x2="67" y2="49" stroke="#101636" strokeWidth="2.5" strokeLinecap="round" />
              </>
            )}
            {isTopper && (
              <>
                <circle cx="31" cy="74" r="5" fill="#ff8a80" opacity="0.4" />
                <circle cx="89" cy="74" r="5" fill="#ff8a80" opacity="0.4" />
              </>
            )}

            {/* beak */}
            <path d="M 55 74 L 65 74 L 60 84 Z" fill="#eda315" stroke="#c9820a" strokeWidth="1" />

            {/* feet */}
            <ellipse cx="46" cy="118" rx="8" ry="4" fill={c2} />
            <ellipse cx="74" cy="118" rx="8" ry="4" fill={c2} />
          </svg>
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.div
            key={bubbleText}
            initial={{ opacity: 0, y: 6, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.95 }}
            transition={{ duration: 0.25 }}
            className="relative max-w-[220px] rounded-2xl rounded-bl-sm bg-white dark:bg-ink-800 px-3.5 py-2 text-sm font-medium shadow-card border border-ink-100 dark:border-ink-700"
            lang="bn"
            role="status"
          >
            {bubbleText}
          </motion.div>
        </AnimatePresence>
      </div>

      {ctaLabel && onCta && (
        <button
          onClick={onCta}
          className="mt-1 rounded-lg bg-ink-900 dark:bg-marigold-500 px-5 py-2 text-sm font-semibold text-white dark:text-ink-950 transition active:scale-95"
        >
          {ctaLabel}
        </button>
      )}
    </div>
  );
}

// Tiny particle burst behind the mascot on a celebration — no external
// confetti library needed (network's off for npm installs anyway).
// `big` (the celebrate-high/topper mood) gets more particles, wider
// spread, and a second color pass so it reads as a genuinely bigger deal.
function Sparkles({ big = false }) {
  const count = big ? 16 : 10;
  const particles = Array.from({ length: count });
  return (
    <div className="pointer-events-none absolute inset-0">
      {particles.map((_, i) => {
        const angle = (i / particles.length) * Math.PI * 2;
        const dist = big ? 62 : 46;
        const colors = big ? ["#ffd76a", "#f6b93b", "#2fae6f"] : ["#f6b93b", "#2fae6f"];
        return (
          <motion.span
            key={i}
            className="absolute left-1/2 top-1/2 rounded-full"
            style={{
              width: big ? 7 : 6,
              height: big ? 7 : 6,
              backgroundColor: colors[i % colors.length],
            }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{
              x: Math.cos(angle) * dist,
              y: Math.sin(angle) * dist,
              opacity: 0,
              scale: 0.4,
            }}
            transition={{ duration: 0.9, repeat: Infinity, repeatDelay: 0.6, ease: "easeOut", delay: i * 0.03 }}
          />
        );
      })}
    </div>
  );
}

// Star-shaped "sparkle eyes" for the top-score mood — a simple 5-point
// star scaled small, rendered in place of the normal circular pupil.
function StarEye({ cx, cy }) {
  const points = [];
  const outerR = 7;
  const innerR = 3;
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    points.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
  }
  return <polygon points={points.join(" ")} fill="#eda315" stroke="#101636" strokeWidth="1" />;
}
