const telegramBot = require('./telegramBot')
const handlers = require('./handlers')
const reminderScheduler = require('./reminderScheduler')

async function start() {
  const bot = await telegramBot.init()
  if (!bot) return
  handlers.register()
  reminderScheduler.start()
  console.log(`Settle-up bot running as @${telegramBot.getBotUsername()}`)
}

module.exports = { start }
