'use strict';

// App states
// - STARTING- when node's api is not yet public, but the node is registered in service discovery
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
const util = require('./util')

const consulUrl = 'http://consul:8500'
let state = 'NEW'
let myself = undefined
let nodeList = []
let hashRing = []
const maxOffset = 1024

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

const addNodeToRing = function(address, node, predict) {
  logger.info('Sending request to add node to hash ring', address)
  return request({
    url: 'http://' + address + '/v1/ring/add',
    method: 'POST',
    json: true,
    body: {
      node: node,
      predict: predict ? true : false
    },
    timeout: 2000 // Ain't nobody got time for that
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
        internalNodeList.push({ address: address, hostname: response.hostname, status: 'STARTING' })
      })
  }))

  logger.info('Ping result:', internalNodeList.map(node => node.status).join(','))
  nodeList = internalNodeList
  myself = internalNodeList.filter(node => node.hostname === process.env.HOSTNAME)[0]
  if (myself) {
    logger.info('Node identified itself as', myself.address)
  } else {
    logger.error('Could not identify itself. Exiting...')
    process.exit(1)
  }
})

exports.init = function init() {
  co(function*() {
    // Note: wait till api's are up
    yield util.sleep(3000)
    yield refreshNodes()

    // NEW STATE
    do {
      // Note: race conditions are not fullfilled here.
      const allNodes = yield getNodes()
      const otherNodes = allNodes.filter(node => node.Address + ':' + node.ServicePort !== myself.address)

      if (otherNodes.length > 0) {
        let predictedRingResponses = []
        // Send request to all nodes to add myself to the ring (prediction)
        yield Promise.all(otherNodes.map(function (node){
          return addNodeToRing(node.Address + ':' + node.ServicePort, { address: myself.address }, true)
            .then(response => {
              predictedRingResponses.push(response.ring)
            }, () => {
              predictedRingResponses.push({ err: 'nope' })
            })
        }))

        // Make sure the hash rings are the same from all nodes
        if (!util.areItemsEqual(predictedRingResponses)) {
          // Othrwise restart the whole init process. Something is not ouky douky
          logger.error('Starting not successfull: different hash rings returned.')
          logger.info('Trying to start init process again...')
          return setTimeout(init, 1000 + Math.floor(Math.random() * 1000))
        }

        let addRingResponses = []
        // Send request to all nodes to add myself to the ring
        yield Promise.all(otherNodes.map(function (node){
          return addNodeToRing(node.Address + ':' + node.ServicePort, { address: myself.address }, false)
            .then(response => {
              addRingResponses.push(response.ring)
            }, () => {
              predictedRingResponses.push({ err: 'nope' })
            })
        }))

        // Make sure the hash rings are the same from all nodes
        if (!util.areItemsEqual(addRingResponses)) {
          // Othrwise restart the whole init process. Something is not ouky douky
          logger.error('Starting not successfull: different hash rings returned.')
          logger.info('Trying to start init process again...')
          return setTimeout(init, 1000 + Math.floor(Math.random() * 1000))
        }

        // Set hash ring
        hashRing = addRingResponses[0]
      } else {
        // Initialize a hash ring
        hashRing = [{
          address: myself.address,
          offset: 0
        }]
      }
      logger.info('Node initialized with hash ring:', hashRing)
      state = 'PENDING'
      logger.info('State changed to', state)
    } while(state !== 'PENDING')

    // PENDING STATE
    do {
      // Todo: implement
      state = 'READY'
      logger.info('State changed to READY')
    } while(state !== 'READY')

    // READY STATE
    //do {
    //  yield refreshNodes()
    //  yield util.sleep(5000)
    //} while(state !== 'CRASHED')

  }).catch(err => {
    logger.error('Error occured:', err)
    state = 'CRASHED'
  })
}

exports.getState = function() {
  return state
}

exports.getRing = function() {
  return hashRing
}

exports.addNodeToHashRing = function(node, predict) {
  // This is super important - of the prediction is true, the current
  // hash ring is NOT being updated
  const ring = predict ? Object.assign([], hashRing) : hashRing
  return util.addNodeToHashRing(ring, maxOffset, node)
}

exports.getNodeForKey = function(id) {
  const offset = util.hash(id, maxOffset)
  const node = util.getNodeForOffset(hashRing, offset)
  logger.info(`Key ${id} hashed to offset ${offset} with node found: ${node}`)
  if (node.address === myself.address) {
    return { type: 'return' }
  } else {
    return {
      type: 'forward',
      node: node
    }
  }
}
