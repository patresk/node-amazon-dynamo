'use strict';

const request = require('request-promise')
const co = require('co')

const logger = require('./logger')
const consulUrl = 'http://consul:8500'

let myself = undefined
let nodeList = []

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
      const nodes = yield getNodes()
      logger.info('Number of fetched nodes from consul:', nodes.length)

      const internalNodeList = []

      yield Promise.all(nodes.map(node => {
        let address = node.Address + ':' + node.ServicePort
        return pingNode(address)
          .then(response => {
            internalNodeList.push({ address: address, hostname: response.hostname, status: response.status })
          }, response => {
            internalNodeList.push({ address: address, hostname: response.hostname, status: 'DOWN' })
          })
      }))

      logger.info('Ping result:',
        internalNodeList.filter(node => node.status === 'READY').length + ' up',
        internalNodeList.filter(node => node.status !== 'READY').length + ' other state')

      nodeList = internalNodeList
      myself = internalNodeList.filter(node => node.hostname === process.env.HOSTNAME)[0]
      logger.info('Node indentified itself as', myself.address)
    }).catch(function(err) {
      logger.error('Error occured during interval check', err)
    })
  }, 5000)
}