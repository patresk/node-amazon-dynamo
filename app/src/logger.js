const log4js = require('log4js')

const loggerName = process.env.HOSTNAME || 'unknown'

log4js.configure({
  // Send logs to console (development) and filebeat (production)
  appenders: [
    {
      type: 'console',
      category: loggerName
    },
    {
      host: '192.168.99.100',
      port: 5000,
      type: 'logstashUDP',
      category: loggerName
    }
  ]
});

const logger = log4js.getLogger(loggerName);

module.exports = logger