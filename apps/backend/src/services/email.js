// Transactional email via Resend (https://resend.com — plain HTTPS API, no SDK needed).
// Without RESEND_API_KEY (local dev) nothing is sent: the message is printed to the
// backend console instead, so flows like "forgot password" stay testable offline.
const RESEND_URL = 'https://api.resend.com/emails'

async function sendEmail({ to, subject, html, text }) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM || 'SCHET.uz <no-reply@schet.uz>'

  if (!apiKey) {
    console.log(`\n[email] RESEND_API_KEY not set — not sending. To: ${to}\nSubject: ${subject}\n${text}\n`)
    return { sent: false }
  }

  const res = await fetch(RESEND_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, html, text }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Resend ${res.status}: ${body.slice(0, 300)}`)
  }
  return { sent: true }
}

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

const RESET_COPY = {
  uz: {
    subject: 'SCHET.uz — parolni tiklash',
    hello: (name) => (name ? `Salom, ${name}!` : 'Salom!'),
    body: "Kimdir (ehtimol siz) SCHET.uz akkauntingiz parolini tiklashni so'radi. Yangi parol o'rnatish uchun tugmani bosing:",
    button: "Yangi parol o'rnatish",
    note: "Havola 1 soat amal qiladi va faqat bir marta ishlaydi. Agar buni siz so'ramagan bo'lsangiz, bu xatga e'tibor bermang — parolingiz o'zgarmaydi.",
  },
  ru: {
    subject: 'SCHET.uz — восстановление пароля',
    hello: (name) => (name ? `Здравствуйте, ${name}!` : 'Здравствуйте!'),
    body: 'Кто-то (возможно, вы) запросил восстановление пароля от аккаунта SCHET.uz. Чтобы задать новый пароль, нажмите кнопку:',
    button: 'Задать новый пароль',
    note: 'Ссылка действует 1 час и срабатывает один раз. Если вы этого не запрашивали, просто проигнорируйте письмо — пароль не изменится.',
  },
  en: {
    subject: 'SCHET.uz — reset your password',
    hello: (name) => (name ? `Hi ${name},` : 'Hi,'),
    body: 'Someone (hopefully you) asked to reset the password for your SCHET.uz account. Click the button to set a new one:',
    button: 'Set a new password',
    note: "The link works once and expires in 1 hour. If you didn't ask for this, ignore this email — your password won't change.",
  },
}

function passwordResetEmail({ name, link, lang }) {
  const c = RESET_COPY[lang] || RESET_COPY.uz
  const text = `${c.hello(name)}\n\n${c.body}\n${link}\n\n${c.note}`
  const html = `<!doctype html><html><body style="margin:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
  <div style="max-width:480px;margin:0 auto;padding:32px 16px">
    <div style="background:#ffffff;border-radius:16px;padding:28px">
      <p style="font-size:20px;font-weight:bold;margin:0 0 16px">SCHET.uz</p>
      <p style="font-size:15px;margin:0 0 12px">${escapeHtml(c.hello(name))}</p>
      <p style="font-size:15px;line-height:1.5;margin:0 0 24px">${escapeHtml(c.body)}</p>
      <a href="${escapeHtml(link)}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-weight:bold;padding:14px 22px;border-radius:12px">${escapeHtml(c.button)}</a>
      <p style="font-size:13px;color:#6b7280;line-height:1.5;margin:24px 0 0">${escapeHtml(c.note)}</p>
      <p style="font-size:12px;color:#9ca3af;word-break:break-all;margin:16px 0 0">${escapeHtml(link)}</p>
    </div>
  </div></body></html>`
  return { subject: c.subject, html, text }
}

module.exports = { sendEmail, passwordResetEmail }
