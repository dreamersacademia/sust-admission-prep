import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const exam = await prisma.exam.create({
    data: {
      title: 'SUST ভর্তি মডেল টেস্ট — পদার্থবিজ্ঞান ও গণিত',
      subject: 'Physics & Math',
      durationMinutes: 20,
      shuffleQuestions: true,
      questions: {
        create: [
          {
            order: 1,
            text: 'একটি বস্তুর ত্বরণ নিচের কোন সূত্র দ্বারা নির্ণয় করা হয়? $a = ?$',
            optionA: '$a = \\dfrac{F}{m}$',
            optionB: '$a = F \\cdot m$',
            optionC: '$a = \\dfrac{m}{F}$',
            optionD: '$a = F + m$',
            correctOption: 'A',
            explanation:
              'নিউটনের দ্বিতীয় সূত্র অনুযায়ী $F = ma$, সুতরাং $a = \\dfrac{F}{m}$।',
            videoUrl: 'https://www.youtube.com/watch?v=example1',
            marks: 1,
            negativeMarks: 0.25,
          },
          {
            order: 2,
            text: 'মান নির্ণয় কর: $$\\int_0^1 x^2\\,dx = ?$$',
            optionA: '$1/2$',
            optionB: '$1/3$',
            optionC: '$1$',
            optionD: '$2/3$',
            correctOption: 'B',
            explanation: '$\\int_0^1 x^2\\,dx = \\left[\\dfrac{x^3}{3}\\right]_0^1 = \\dfrac{1}{3}$।',
            videoUrl: 'https://www.youtube.com/watch?v=example2',
            marks: 1,
            negativeMarks: 0.25,
          },
          {
            order: 3,
            text: 'বাংলাদেশের প্রথম বিশ্ববিদ্যালয় কোনটি?',
            optionA: 'ঢাকা বিশ্ববিদ্যালয়',
            optionB: 'রাজশাহী বিশ্ববিদ্যালয়',
            optionC: 'চট্টগ্রাম বিশ্ববিদ্যালয়',
            optionD: 'শাহজালাল বিজ্ঞান ও প্রযুক্তি বিশ্ববিদ্যালয়',
            correctOption: 'A',
            explanation: 'ঢাকা বিশ্ববিদ্যালয় প্রতিষ্ঠিত হয় ১৯২১ সালে, এটি বাংলাদেশের প্রাচীনতম বিশ্ববিদ্যালয়।',
            videoUrl: null,
            marks: 1,
            negativeMarks: 0.25,
          },
        ],
      },
    },
  });

  console.log('Seeded exam:', exam.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
