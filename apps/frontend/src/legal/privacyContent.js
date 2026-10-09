// Privacy policy text (uz/ru/en). Kept here rather than in the i18n JSON because it's
// long-form prose. It must describe what the app really does — update it whenever data
// collection changes (new tables, new third-party services, new uploads).
export const PRIVACY_UPDATED = '2026-10-09'
export const PRIVACY_CONTACT_EMAIL = 'support@schet.uz'

export const PRIVACY = {
  uz: {
    title: 'Maxfiylik siyosati',
    updated: 'Oxirgi yangilanish',
    intro:
      "SCHET.uz (\"biz\") — restoran va kafe hisoblarini do'stlar o'rtasida bo'lishga yordam beradigan xizmat (schet.uz sayti va Telegram bot). Bu sahifa qaysi ma'lumotlarni yig'ishimiz, ulardan qanday foydalanishimiz va ular kimga uzatilishini tushuntiradi.",
    sections: [
      {
        h: "1. Qanday ma'lumotlarni yig'amiz",
        items: [
          "Akkaunt: ismingiz, email manzilingiz va parolingiz (faqat shifrlangan ko'rinishda, parolning o'zini saqlamaymiz). Google orqali kirsangiz — Google profilingizdagi ism, email, rasm va Google identifikatori.",
          "Chek rasmlari: skanerlash uchun yuborgan rasmlaringiz va ulardan o'qilgan ma'lumotlar (taomlar, narxlar, summa).",
          "Ovozli yozuvlar: ovoz bilan kiritishda yozib olingan audio va undan tushunilgan ma'lumotlar.",
          "Hisob ma'lumotlari: qo'lda kiritilgan hisoblar (ishtirokchilarning ismlari, taomlar, narxlar) va hisob-kitob uchun ulashilgan hisoblar, jumladan to'lovni qabul qiluvchining karta yoki telefon raqami (agar kiritilgan bo'lsa).",
          "Telegram: botdan foydalansangiz — Telegram chat identifikatori, ismingiz va @username.",
          "Texnik ma'lumotlar: IP manzil, saytga kirish va funksiyalardan foydalanish vaqti, brauzer identifikatori (statistika va suiiste'mollikka qarshi himoya uchun).",
        ],
      },
      {
        h: "2. Ma'lumotlardan qanday foydalanamiz",
        items: [
          "Xizmatni ko'rsatish: cheklarni o'qish, ovozni tushunish, hisobni bo'lish, to'lov xabarlarini yuborish.",
          "Akkauntga kirish va xavfsizlik: tizimga kirish, parolni tiklash, kunlik bepul limitlarni hisoblash, botlar va suiiste'mollikdan himoya.",
          "Xizmatni yaxshilash: chek rasmlari, ovozli yozuvlar va ulardan olingan natijalar chek o'qish va ovozni tushunish sifatini oshirish, jumladan o'z modellarimizni o'qitish uchun saqlanadi va ishlatiladi.",
          "Statistika: xizmatdan qanday foydalanilishini tushunish uchun umumlashtirilgan hisobotlar.",
          "Ma'lumotlaringizni sotmaymiz va reklama uchun ishlatmaymiz.",
        ],
      },
      {
        h: '3. Uchinchi tomon xizmatlari',
        items: [
          "Google Gemini (Google LLC) — chek rasmlari va ovozli yozuvlar tahlil qilish uchun Google'ga yuboriladi.",
          'Google Sign-In — Google orqali kirishni tanlasangiz.',
          'Resend — parolni tiklash kabi xizmat xatlarini yuborish uchun (email manzilingiz uzatiladi).',
          "Telegram — bot orqali xabarlar almashish uchun.",
          "Bu xizmatlar ma'lumotlarni o'z maxfiylik siyosatlariga muvofiq qayta ishlaydi va ularning serverlari O'zbekistondan tashqarida joylashgan bo'lishi mumkin.",
        ],
      },
      {
        h: '4. Cookie va brauzer xotirasi',
        items: [
          "Tizimga kirganingizni eslab qolish uchun bitta xavfsiz cookie (30 kun) ishlatamiz.",
          "Hisoblar tarixi, guruhlar, til va valyuta sozlamalari brauzeringizning o'zida (localStorage) saqlanadi va bizning serverga yuborilmaydi.",
        ],
      },
      {
        h: "5. Saqlash muddati",
        items: [
          "Akkaunt ma'lumotlari akkaunt mavjud ekan saqlanadi.",
          "Chek rasmlari, ovozli yozuvlar va texnik loglar xizmatni ko'rsatish va yaxshilash uchun zarur bo'lgan muddat davomida saqlanadi. Ularni o'chirishni so'rashingiz mumkin (6-bo'lim).",
        ],
      },
      {
        h: '6. Sizning huquqlaringiz',
        items: [
          "Biz saqlagan ma'lumotlaringizni olish, tuzatish yoki akkauntingizni va unga bog'liq ma'lumotlarni o'chirishni so'rashingiz mumkin. Buning uchun quyidagi manzilga yozing — 30 kun ichida javob beramiz.",
        ],
      },
      {
        h: '7. Xavfsizlik',
        items: [
          "Parollar shifrlangan holda saqlanadi, ulanish HTTPS orqali himoyalangan, ma'lumotlarga kirish cheklangan. Shunga qaramay, internet orqali uzatishning to'liq xavfsizligini kafolatlay olmaymiz.",
        ],
      },
      {
        h: "8. O'zgarishlar",
        items: [
          "Bu siyosat yangilanishi mumkin. Muhim o'zgarishlar bo'lsa, saytda xabar beramiz. Sahifa tepasidagi sana — oxirgi yangilanish sanasi.",
        ],
      },
    ],
    contact: "Savollar va so'rovlar uchun",
    back: 'Orqaga',
  },
  ru: {
    title: 'Политика конфиденциальности',
    updated: 'Последнее обновление',
    intro:
      'SCHET.uz («мы») — сервис, который помогает делить счёт в ресторане или кафе между друзьями (сайт schet.uz и Telegram-бот). Здесь описано, какие данные мы собираем, как их используем и кому передаём.',
    sections: [
      {
        h: '1. Какие данные мы собираем',
        items: [
          'Аккаунт: имя, email и пароль (только в зашифрованном виде — сам пароль мы не храним). При входе через Google — имя, email, фото и идентификатор из профиля Google.',
          'Фото чеков: изображения, которые вы отправляете на сканирование, и распознанные из них данные (блюда, цены, суммы).',
          'Голосовые записи: аудио при голосовом вводе и распознанные из него данные.',
          'Данные счетов: счета, введённые вручную (имена участников, блюда, цены), и счета, отправленные на расчёт, включая номер карты или телефона получателя оплаты (если он указан).',
          'Telegram: если вы пользуетесь ботом — идентификатор чата, имя и @username.',
          'Технические данные: IP-адрес, время посещений и использования функций, идентификатор браузера (для статистики и защиты от злоупотреблений).',
        ],
      },
      {
        h: '2. Как мы используем данные',
        items: [
          'Работа сервиса: распознавание чеков и голоса, раздел счёта, отправка сообщений об оплате.',
          'Вход и безопасность: авторизация, восстановление пароля, учёт бесплатных дневных лимитов, защита от ботов и злоупотреблений.',
          'Улучшение сервиса: фото чеков, голосовые записи и результаты их распознавания хранятся и используются для повышения качества распознавания, в том числе для обучения собственных моделей.',
          'Статистика: обобщённые отчёты о том, как используется сервис.',
          'Мы не продаём ваши данные и не используем их для рекламы.',
        ],
      },
      {
        h: '3. Сторонние сервисы',
        items: [
          'Google Gemini (Google LLC) — фото чеков и голосовые записи передаются в Google для распознавания.',
          'Google Sign-In — если вы выбираете вход через Google.',
          'Resend — для служебных писем, например восстановления пароля (передаётся ваш email).',
          'Telegram — для обмена сообщениями через бот.',
          'Эти сервисы обрабатывают данные по своим политикам конфиденциальности; их серверы могут находиться за пределами Узбекистана.',
        ],
      },
      {
        h: '4. Cookie и память браузера',
        items: [
          'Мы используем один защищённый cookie (30 дней), чтобы помнить, что вы вошли в аккаунт.',
          'История счетов, группы, язык и валюта хранятся в вашем браузере (localStorage) и не отправляются на наш сервер.',
        ],
      },
      {
        h: '5. Сроки хранения',
        items: [
          'Данные аккаунта хранятся, пока существует аккаунт.',
          'Фото чеков, голосовые записи и технические логи хранятся столько, сколько нужно для работы и улучшения сервиса. Вы можете попросить их удалить (раздел 6).',
        ],
      },
      {
        h: '6. Ваши права',
        items: [
          'Вы можете запросить копию своих данных, их исправление или удаление аккаунта и связанных с ним данных. Напишите на адрес ниже — ответим в течение 30 дней.',
        ],
      },
      {
        h: '7. Безопасность',
        items: [
          'Пароли хранятся в зашифрованном виде, соединение защищено HTTPS, доступ к данным ограничен. Тем не менее полную безопасность передачи данных через интернет гарантировать невозможно.',
        ],
      },
      {
        h: '8. Изменения',
        items: [
          'Политика может обновляться. О существенных изменениях мы сообщим на сайте. Дата вверху страницы — дата последнего обновления.',
        ],
      },
    ],
    contact: 'По вопросам и запросам',
    back: 'Назад',
  },
  en: {
    title: 'Privacy Policy',
    updated: 'Last updated',
    intro:
      'SCHET.uz ("we") is a service that helps friends split a restaurant or cafe bill (the schet.uz website and Telegram bot). This page explains what data we collect, how we use it, and who we share it with.',
    sections: [
      {
        h: '1. What we collect',
        items: [
          "Account: your name, email and password (stored only as a secure hash — we never keep the password itself). If you sign in with Google — the name, email, photo and ID from your Google profile.",
          'Receipt photos: images you send for scanning and the data read from them (dishes, prices, totals).',
          'Voice recordings: audio recorded for voice input and the data understood from it.',
          "Bill data: bills entered by hand (participants' names, dishes, prices) and bills shared for settling up, including the payee's card or phone number if provided.",
          'Telegram: if you use the bot — your Telegram chat ID, name and @username.',
          'Technical data: IP address, times of visits and feature use, a browser identifier (for statistics and abuse prevention).',
        ],
      },
      {
        h: '2. How we use it',
        items: [
          'Running the service: reading receipts, understanding voice, splitting the bill, sending payment messages.',
          'Sign-in and security: authentication, password reset, counting free daily limits, protection against bots and abuse.',
          'Improving the service: receipt photos, voice recordings and their results are stored and used to improve recognition quality, including training our own models.',
          'Statistics: aggregated reports on how the service is used.',
          "We don't sell your data or use it for advertising.",
        ],
      },
      {
        h: '3. Third-party services',
        items: [
          'Google Gemini (Google LLC) — receipt photos and voice recordings are sent to Google for analysis.',
          'Google Sign-In — if you choose to sign in with Google.',
          'Resend — to send service emails such as password resets (your email address is shared).',
          'Telegram — for messages through the bot.',
          'These services process data under their own privacy policies; their servers may be located outside Uzbekistan.',
        ],
      },
      {
        h: '4. Cookies and browser storage',
        items: [
          'We use one secure cookie (30 days) to keep you signed in.',
          'Bill history, groups, language and currency settings are stored in your browser (localStorage) and are not sent to our server.',
        ],
      },
      {
        h: '5. Retention',
        items: [
          'Account data is kept for as long as the account exists.',
          'Receipt photos, voice recordings and technical logs are kept as long as needed to run and improve the service. You can ask us to delete them (section 6).',
        ],
      },
      {
        h: '6. Your rights',
        items: [
          'You can ask for a copy of your data, its correction, or deletion of your account and related data. Write to the address below — we reply within 30 days.',
        ],
      },
      {
        h: '7. Security',
        items: [
          "Passwords are stored hashed, connections are protected by HTTPS, and access to data is restricted. Still, no transmission over the internet can be guaranteed fully secure.",
        ],
      },
      {
        h: '8. Changes',
        items: ['This policy may be updated. We will announce significant changes on the site. The date at the top is the last update.'],
      },
    ],
    contact: 'Questions and requests',
    back: 'Back',
  },
}
