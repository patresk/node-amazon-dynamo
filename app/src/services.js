const request = require('request-promise')
const logger = require('./logger')

const consulUrl = 'http://192.168.99.100:8500'

function getNodes() {
  return new Promise((resolve, reject) => {
    request({
      url: consulUrl + '/v1/catalog/service/app',
      method: 'GET',
      json: true
    }).then(function(response) {
      logger.info('Fetched node list:', response)
      resolve(response)
    }).catch(function(err) {
      logger.error('Error occured when fetching node list', err)
      reject(err)
    })
  })
}

exports.init = function() {
  return getNodes()
}