'use strict';

const request = require('request-promise')
const co = require('co')

const logger = require('./logger')
const consulUrl = 'http://consul:8500'

const getNodes = function() {
  return request({
    url: consulUrl + '/v1/catalog/service/app',
    method: 'GET',
    json: true
  })
}

const pingNode = function(address) {
  logger.info('Sending ping request to', address)
  return request({
    url: 'http://' + address + '/v1/ping',
    method: 'GET',
    json: true
  })
}

exports.init = function() {
  setInterval(function() {
    co(function* () {
      let nodes = yield getNodes()
      logger.info('Fetched nodes:', nodes.length)
      nodes.forEach(node => {
        pingNode(node.Address + ':' + node.ServicePort)
      })
    }).catch(function(err) {
      logger.error('Error occured during interval check', err)
    })
  }, 2000)
}