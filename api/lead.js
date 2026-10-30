// Принимает заявку с формы на сайте и пересылает её в Telegram.
// Токен бота и ID чата берутся из настроек Vercel (Environment Variables),
// в коде их нет: TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID.

const LIMITS = { name: 80, contact: 120, message: 1500 };

function clean(value, max) {
  return String(value ?? '').trim().slice(0, max);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method' });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.error('Не заданы TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID');
    return res.status(500).json({ ok: false, error: 'config' });
  }

  let body = req.body || {};
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }

  // Скрытое поле-ловушка: люди его не видят, а спам-боты заполняют.
  if (body.website) return res.status(200).json({ ok: true });

  const name = clean(body.name, LIMITS.name);
  const contact = clean(body.contact, LIMITS.contact);
  const message = clean(body.message, LIMITS.message);

  if (!name || !contact) {
    return res.status(400).json({ ok: false, error: 'fields' });
  }
  if (body.consent !== 'yes') {
    return res.status(400).json({ ok: false, error: 'consent' });
  }

  const time = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });

  const text = [
    '🎬 Новая заявка с сайта',
    '',
    `Имя: ${name}`,
    `Контакт: ${contact}`,
    message ? `\nКомментарий:\n${message}` : '',
    `\n✅ Согласие на обработку ПД: дано (${time} МСК)`,
  ].join('\n').trim();

  try {
    const tg = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    });
    const data = await tg.json().catch(() => ({}));
    if (!tg.ok || !data.ok) {
      console.error('Telegram ответил ошибкой:', tg.status, data.description);
      return res.status(502).json({ ok: false, error: 'telegram' });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Не удалось связаться с Telegram:', err);
    return res.status(502).json({ ok: false, error: 'network' });
  }
};
