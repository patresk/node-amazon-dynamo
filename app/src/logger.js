const log4js = require('log4js')

log4js.configure({
  // Send logs to console (development) and filebeat (production)
  appenders: [
    {
      type: 'console',
      category: 'Dynamo node'
    },
    {
      type: 'file',
      filename: '/dynamo/logs/file.log',
      category: 'Dynamo node'
    }
  ]
});

const logger = log4js.getLogger('Dynamo node');

module.exports = logger