'use client';

import { InlineMath, BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';

/**
 * Renders text that mixes plain Bengali/English content with LaTeX.
 * Author questions like:
 *   "একটি বস্তুর ত্বরণ $a = \\dfrac{F}{m}$ সূত্র দ্বারা নির্ণয় করা হয়।"
 *   "$$\\int_0^\\infty e^{-x^2}\\,dx = \\dfrac{\\sqrt{\\pi}}{2}$$"
 * $...$ -> inline math, $$...$$ -> block/display math. Everything else
 * renders as plain text so Bengali script needs no escaping.
 */
export default function KatexText({ content = '' }) {
  const parts = splitMixedContent(content);

  return (
    <span className="font-body leading-relaxed">
      {parts.map((part, i) => {
        if (part.type === 'block') {
          return (
            <span key={i} className="my-2 block overflow-x-auto">
              <BlockMath math={part.value} errorColor="#B4432E" />
            </span>
          );
        }
        if (part.type === 'inline') {
          return <InlineMath key={i} math={part.value} errorColor="#B4432E" />;
        }
        return <span key={i}>{part.value}</span>;
      })}
    </span>
  );
}

function splitMixedContent(input) {
  if (!input) return [];
  const segments = [];
  // Match $$...$$ first (block), then $...$ (inline), non-greedy
  const regex = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(input)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: input.slice(lastIndex, match.index) });
    }
    if (match[1] !== undefined) {
      segments.push({ type: 'block', value: match[1].trim() });
    } else if (match[2] !== undefined) {
      segments.push({ type: 'inline', value: match[2].trim() });
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < input.length) {
    segments.push({ type: 'text', value: input.slice(lastIndex) });
  }
  return segments;
}