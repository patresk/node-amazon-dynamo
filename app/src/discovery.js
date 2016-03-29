'use strict';

// App states
// - DOWN    - when node's api is not yet public, but the node is registered in service discovery
// - NEW     - the app is in the new state right after it is added to the network.
//           - the app starts to ping all other nodes and tries to receive position
//             in the hash ring
// - PENDING - the app obtained ack from all nodes and it is added to the
//             hash ring
// - READY   - the app is in ready state when all needed data are moved from old previous node
//             and it is ready to receive requests
// - CRASHED - when a error happen and the node needs to be restarted
//

const request = require('request-promise')
const co = require('co')

const logger = require('./logger')

const consulUrl = 'http://consul:8500'
let state = 'NEW'
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
    json: true,
    timeout: 2000 // Ain't nobody got time for that
  })
}

const sleep = function(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms)
  })
}

const refreshNodes = co.wrap(function* () {
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

  logger.info('Ping result:', internalNodeList.map(node => node.status).join(','))
  nodeList = internalNodeList
  myself = internalNodeList.filter(node => node.hostname === process.env.HOSTNAME)[0]
  if (myself) {
    logger.info('Node identified itself as', myself.address)
  }
})

exports.init = function() {
  co(function*() {
    // Note: wait till api's are up
    yield sleep(5000)
    yield refreshNodes()

    do {
      // Todo: implement
      state = 'PENDING'
      logger.info('State changed to PENDING')
    } while(state !== 'PENDING')

    do {
      // Todo: implement
      state = 'READY'
      logger.info('State changed to READY')
    } while(state !== 'READY')

    do {
      yield refreshNodes()
      yield sleep(5000)
    } while(state !== 'CRASHED')

  }).catch(err => {
    logger.error('Error occured:', err)
    state = 'CRASHED'
  })
}

exports.getState = function() {
  return state
}