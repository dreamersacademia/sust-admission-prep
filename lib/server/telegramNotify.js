/**
 * Sends a Telegram message to the admin's own chat/channel. Purely a
 * notification side-channel — nothing here ever gets written to
 * Firestore, so it doesn't touch the "Student IDs are hashed and
 * unrecoverable" security model at all. It's the same category of thing
 * as a password-reset email: shown once, transiently, then it's on the
 * recipient to keep their own copy if they want one.
 *
 * Best-effort by design: if TELEGRAM_BOT_TOKEN/TELEGRAM_ADMIN_CHAT_ID
 * aren't set, or the request fails, this silently does nothing rather
 * than throwing — a missed notification should never block a student's
 * registration from completing.
 */
export async function notifyAdminTelegram(message) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!token || !chatId) return;

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: "HTML" }),
    });
  } catch {
    // best-effort — never let a notification failure break registration
  }
}