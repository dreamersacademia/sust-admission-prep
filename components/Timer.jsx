'use client';

import { useEffect, useRef, useState } from 'react';

export default function Timer({ totalSeconds = 0, onExpire }) {
  const [remaining, setRemaining] = useState(totalSeconds);
  const expiredRef = useRef(false);
  
  // onExpire-এর রেফারেন্স ধরে রাখা যাতে useEffect বারবার রিস্টার্ট না হয়
  const onExpireRef = useRef(onExpire);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          if (!expiredRef.current) {
            expiredRef.current = true;
            if (onExpireRef.current) onExpireRef.current();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []); // ডিপেনডেন্সি খালি রাখায় টাইমার আর কখনই স্টাক হবে না

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