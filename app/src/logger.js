const log4js = require('log4js')

log4js.configure({
  // Send logs to console (development) and logstash (production)
  appenders: [
    {
      type: 'console',
      category: 'Dynamo node'
    },
    {
      host: '127.0.0.1',
      port: 10001,
      type: 'logstashUDP',
      fields: {
        hostName: 'default'
        // Todo: add node id here
      },
      category: 'Dynamo node'
    }
  ]
});

const logger = log4js.getLogger('Dynamo node');

module.exports = logger