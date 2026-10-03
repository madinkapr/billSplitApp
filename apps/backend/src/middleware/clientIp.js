// req.ip already honours `trust proxy` (server.js); this only strips the IPv4-mapped
// IPv6 prefix so the admin activity table shows "1.2.3.4" instead of "::ffff:1.2.3.4".
function clientIp(req) {
  return (req.ip || '').replace(/^::ffff:/, '') || null
}

module.exports = clientIp
