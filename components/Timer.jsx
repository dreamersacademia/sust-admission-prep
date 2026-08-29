'use client';

import { useState, useEffect, useRef } from 'react';

export default function Timer({ 
  durationMinutes, 
  initialSeconds, 
  onTimeUp, 
  answeredCount, 
  totalQuestions,
  answersCount 
}) {
  // ১. মোট সময় (সেকেন্ডে) হিসাব
  const totalSecs = initialSeconds ?? (durationMinutes ? durationMinutes * 60 : 0);

  const [timeLeft, setTimeLeft] = useState(totalSecs);
  const onTimeUpRef = useRef(onTimeUp);

  // Callback আপডেট রাখা
  useEffect(() => {
    onTimeUpRef.current = onTimeUp;
  }, [onTimeUp]);

  // ২. কাউন্টডাউন ইন্টারভাল (Re-render এ আটকে যাবে না)
  useEffect(() => {
    if (totalSecs <= 0) return;

    // টার্গেট এন্ড টাইম নির্ধারণ (মোবাইল ব্যাকগ্রাউন্ড বা রিরেন্ডারেও সময় ড্রিপ্ট করবে না)
    const endTime = Date.now() + totalSecs * 1000;

    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.round((endTime - Date.now()) / 1000));
      
      setTimeLeft(remaining);

      if (remaining <= 0) {
        clearInterval(timer);
        if (onTimeUpRef.current) {
          onTimeUpRef.current();
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [totalSecs]);

  // ৩. সময় ফরম্যাট করার ফাংশন (HH:MM:SS অথবা MM:SS)
  const formatTime = (seconds) => {
    if (seconds <= 0) return '00:00:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const pad = (n) => String(n).padStart(2, '0');

    if (hrs > 0) {
      return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
    }
    return `${pad(mins)}:${pad(secs)}`;
  };

  const currentAnswered = answeredCount ?? answersCount;

  return (
    <div className="flex flex-col items-end">
      <div className="text-2xl font-bold tracking-wider font-mono text-slate-800 dark:text-slate-100">
        {formatTime(timeLeft)}
      </div>
      {currentAnswered !== undefined && totalQuestions !== undefined && (
        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          {currentAnswered}/{totalQuestions} উত্তর দেওয়া হয়েছে
        </div>
      )}
    </div>
  );
}