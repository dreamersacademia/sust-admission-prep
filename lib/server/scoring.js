/**
 * lib/server/scoring.js
 * Shared scoring helper for calculating net score with negative marking.
 */

export function scoreAttempt(arg1, arg2, negativeMarking = 0.25) {
  // অটো-ডিটেক্ট: আর্গুমেন্ট ১ নাকি ২ অ্যাররে (Questions), তা শনাক্ত করা
  const questions = Array.isArray(arg1) ? arg1 : Array.isArray(arg2) ? arg2 : [];
  const answers =
    !Array.isArray(arg1) && typeof arg1 === "object" && arg1 !== null
      ? arg1
      : !Array.isArray(arg2) && typeof arg2 === "object" && arg2 !== null
      ? arg2
      : {};

  let correctCount = 0;
  let wrongCount = 0;
  let skippedCount = 0;

  const negMark = Number(negativeMarking) || 0;

  questions.forEach((q) => {
    const selected = answers[q.id];

    // উত্তর না দিলে স্কিপ হিসেবে গণ্য হবে (কোনো পেনাল্টি নেই)
    if (selected === undefined || selected === null || selected === "") {
      skippedCount++;
    } 
    // সঠিক উত্তর
    else if (Number(selected) === Number(q.correctIndex)) {
      correctCount++;
    } 
    // ভুল উত্তর (নেগেটিভ মার্ক কাটা যাবে)
    else {
      wrongCount++;
    }
  });

  // Net Score = সঠিক উত্তর - (ভুল উত্তর * নেগেটিভ মার্ক)
  const netScore = correctCount - wrongCount * negMark;

  return {
    total: questions.length, // 👈 মোট প্রশ্নের সংখ্যা যোগ করা হয়েছে
    correctCount,
    wrongCount,
    skippedCount,
    negativeMarking: negMark,
    netScore: Number(netScore.toFixed(2)), // দশমিকের পর ২ ঘর পর্যন্ত
  };
}