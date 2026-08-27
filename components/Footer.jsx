import { Phone, Send } from "lucide-react";

export default function Footer() {
  return (
    <footer className="mt-8 flex flex-col items-center gap-2 pb-4 text-center">
      <div className="flex items-center gap-4 text-ink-400">
        <a href="tel:+8801XXXXXXXXX" className="flex items-center gap-1 text-[11px] hover:text-ink-600 dark:hover:text-ink-100">
          <Phone size={12} /> হটলাইন
        </a>
        <a href="https://facebook.com/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[11px] hover:text-ink-600 dark:hover:text-ink-100">
           <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" />
           </svg> Facebook
        </a>
        <a href="https://t.me/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[11px] hover:text-ink-600 dark:hover:text-ink-100">
          <Send size={12} /> Telegram
        </a>
      </div>
      <p className="text-[10px] text-ink-300 dark:text-ink-600">Designed &amp; developed by Jarif</p>
    </footer>
  );
}
