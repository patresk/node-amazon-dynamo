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
      type: 'file',
      filename: '/dynamo/logs/file.log',
      category: loggerName
    }
  ]
});

const logger = log4js.getLogger(loggerName);

module.exports = logger