import { Phone, Facebook, Send } from "lucide-react";

export default function Footer() {
  return (
    <footer className="mt-8 flex flex-col items-center gap-2 pb-4 text-center">
      <div className="flex items-center gap-4 text-ink-400">
        <a href="tel:+8801XXXXXXXXX" className="flex items-center gap-1 text-[11px] hover:text-ink-600 dark:hover:text-ink-100">
          <Phone size={12} /> হটলাইন
        </a>
        <a href="https://facebook.com/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[11px] hover:text-ink-600 dark:hover:text-ink-100">
          <Facebook size={12} /> Facebook
        </a>
        <a href="https://t.me/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[11px] hover:text-ink-600 dark:hover:text-ink-100">
          <Send size={12} /> Telegram
        </a>
      </div>
      <p className="text-[10px] text-ink-300 dark:text-ink-600">Designed &amp; developed by Jarif</p>
    </footer>
  );
}
