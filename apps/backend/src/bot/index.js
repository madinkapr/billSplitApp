const telegramBot = require('./telegramBot')
const handlers = require('./handlers')
const newBillHandlers = require('./newBillHandlers')
const statusHandlers = require('./statusHandlers')
const reminderScheduler = require('./reminderScheduler')

async function start() {
  const bot = await telegramBot.init()
  if (!bot) return
  handlers.register()
  newBillHandlers.register()
  statusHandlers.register()
  reminderScheduler.start()
  console.log(`Settle-up bot running as @${telegramBot.getBotUsername()}`)
}

function stop() {
  telegramBot.stop()
}

module.exports = { start, stop }
