import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatCountdown(ms) {
  if (ms <= 0) return "00:00:00";
  const totalSeconds = Math.floor(ms / 1000);
  const h = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const s = String(totalSeconds % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

// Tiny haptic-feedback helper — makes taps (answer select, lock, submit)
// feel more physical on phones that support the Vibration API. No-op
// everywhere else (desktop browsers, iOS Safari), wrapped so it can never
// throw and break the calling code.
export function haptic(pattern = 10) {
  if (typeof window === "undefined") return;
  try {
    window.navigator?.vibrate?.(pattern);
  } catch {
    // ignore — vibration is a nice-to-have, never a requirement
  }
}
