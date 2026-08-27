'use client';

import { useEffect, useRef, useState } from 'react';

export default function Timer({
  totalSeconds,
  onExpire,
}: {
  totalSeconds: number;
  onExpire: () => void;
}) {
  const [remaining, setRemaining] = useState(totalSeconds);
  const expiredRef = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          if (!expiredRef.current) {
            expiredRef.current = true;
            onExpire();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [onExpire]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const isLow = remaining <= 60;

  return (
    <div
      className={`font-mono text-lg font-semibold tabular-nums rounded-md px-3 py-1 border ${
        isLow ? 'text-alert border-alert animate-pulse' : 'text-ink border-line'
      }`}
      role="timer"
      aria-live="polite"
    >
      {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
    </div>
  );
}
