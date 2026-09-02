"use client";

import katex from "katex";
import "katex/dist/katex.min.css";

// gIobal window-এ katex যুক্ত করে mhchem লোড করা
if (typeof window !== "undefined") {
  window.katex = katex;
  require("katex/dist/contrib/mhchem");
}

import { InlineMath, BlockMath } from "react-katex";
/**
 * Renders text that mixes plain Bengali/English words with LaTeX.
 * Supports:
 *   $...$      -> inline math
 *   $$...$$    -> block math (own line, centered)
 *
 * Usage: <MathRenderer text="ভরবেগ $p = mv$ সূত্র অনুযায়ী..." />
 */
export default function MathRenderer({ text, className = "" }) {
  if (!text) return null;

  // Split on $$...$$ first (block), then handle $...$ (inline) within each chunk.
  const blockParts = text.split(/(\$\$[^$]+\$\$)/g);

  return (
    <span className={`font-body leading-loose ${className}`} lang="bn">
      {blockParts.map((part, i) => {
        if (part.startsWith("$$") && part.endsWith("$$")) {
          const formula = part.slice(2, -2);
          return (
            <span key={i} className="my-2 block overflow-x-auto">
              <BlockMath errorColor="#e0524a">{formula}</BlockMath>
            </span>
          );
        }
        return <InlineChunks key={i} text={part} />;
      })}
    </span>
  );
}

function InlineChunks({ text }) {
  const parts = text.split(/(\$[^$]+\$)/g);
  return parts.map((chunk, i) => {
    if (chunk.startsWith("$") && chunk.endsWith("$") && chunk.length > 1) {
      const formula = chunk.slice(1, -1);
      return (
        <span key={i} className="mx-0.5 inline-block align-middle">
          <InlineMath errorColor="#e0524a">{formula}</InlineMath>
        </span>
      );
    }
    return <span key={i}>{chunk}</span>;
  });
}
