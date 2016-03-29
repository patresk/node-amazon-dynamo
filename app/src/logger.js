const log4js = require('log4js')

log4js.configure({
  // Send logs to console (development) and logstash (production)
  appenders: [
    {
      type: 'console',
      category: 'Dynamo node'
    },
    {
      host: '192.168.99.100',
      port: 5000,
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