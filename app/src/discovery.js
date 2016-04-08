'use strict';

//
// App states
//
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
const deepEqual = require('deep-equal')

const logger = require('./logger')
const util = require('./util')
const config = require('./config')
const store = require('./store')

let state = 'NEW'
let myself = undefined
let hashRing = []

const getNodes = function() {
  return request({
    url: config.consulUrl + '/v1/catalog/service/app',
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
    timeout: 2000
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
    timeout: 2000
  })
}

const fetchData = function(address, range) {
  logger.info('Fetching data from', address, 'range', range)
  return request({
    url: 'http://' + address + '/v1/internal/data',
    method: 'GET',
    json: true,
    qs: range,
    timeout: 2000
  })
}

const identifyMyself = co.wrap(function* () {
  const nodes = yield getNodes()
  logger.info('Number of fetched nodes from consul:', nodes.length)

  const nodeList = []
  yield Promise.all(nodes.map(node => {
    let address = node.Address + ':' + node.ServicePort
    return pingNode(address)
      .then(response => {
        nodeList.push({ address: address, hostname: response.hostname, status: response.status })
      }, response => {
        nodeList.push({ address: address, hostname: response.hostname, status: 'STARTING' })
      })
  }))

  logger.info('Ping result:', nodeList.map(node => node.status).join(','))
  myself = nodeList.filter(node => node.hostname === process.env.HOSTNAME)[0]

  if (myself) {
    logger.info('Node identified itself as', myself.address)
  } else {
    logger.error('Could not identify itself. Exiting...')
    process.exit(1)
  }
})

exports.init = function init() {
  co(function*() {
    // Note: wait until api is up
    yield util.sleep(3000)
    yield identifyMyself()

    // ------------------
    // NEW state
    // ------------------
    
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

        // Set hash ring
        hashRing = addRingResponses[0]
      } else {
        // Initialize a hash ring
        hashRing = [{
          address: myself.address,
          offset: 0
        }]
      }
      myself.offset = hashRing.filter(node => node.address === myself.address)[0].offset
      logger.info(`Node initialized with hash ring: ${hashRing}`)
      state = 'PENDING'
      logger.info(`State changed to ${state}`)
    } while(state !== 'PENDING')

    // ------------------
    // PENDING state
    // ------------------

    do {
      const requests = []

      const replicas = util.getNodesIamReplicaFor(hashRing, myself, config.replicas - 1)
      if (replicas.length === 0) {
        logger.info('This node is not replica for any node.')
      } else {
        logger.info(`This node is replica for ${replicas.length} nodes. Fetching data...`)
        replicas.forEach(repl => requests.push({ node: repl, range: util.getNodeAddressSpace(hashRing, repl) }))
      }

      const previousNode = util.getCounterClockwiseNode(hashRing, myself)
      if (previousNode) {
        requests.push({ node: previousNode, range: util.getNodeAddressSpace(hashRing, myself) })
      }

      const responses = yield Promise.all(requests.map(request => fetchData(request.node.address, request.range)))
      responses.forEach(data => store.setInBulk(data))
      logger.info('Replication finished.')

      state = 'READY'
      logger.info(`State changed to ${state}`)
    } while(state !== 'READY')

    // ------------------
    // READY state
    // ------------------

    setInterval(refreshNodes, 5000)

  }).catch(err => {
    logger.error(`Error occured: ${err}`)
    state = 'CRASHED'
    logger.error(`State changed to ${state}`)
    // Todo: deregister from service discovery somehow
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
  return util.addNodeToHashRing(ring, config.maxOffset, node)
}

exports.getNodeForKey = function(id) {
  const offset = util.hash(id, config.maxOffset)
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

exports.getNodesForKey = function(id) {
  const offset = util.hash(id, config.maxOffset)
  const node = util.getNodeForOffset(hashRing, offset)
  logger.info(`Key ${id} hashed to offset ${offset} with node found: ${node}`)
  const replicas = util.getNodesIamReplicaFor(hashRing, node, config.replicas - 1)
  logger.info(`Key ${id} hashed to offset ${offset} with replicas found: ${replicas}`)
  return [node].concat(replicas)
}

const refreshNodes = co.wrap(function *() {
  const nodes = yield getNodes()
  const nodesDown = hashRing.filter(node => {
    nodes.map(node => node.Address + ':' + node.ServicePort).indexOf(node.address) < 0
  })

  if (nodesDown.length === 0) {
    return logger.info('No node is down, moving on..')
  }

  if (nodesDown[0].address === myself.address) {
    logger.error('The note tht down is myself, shuting down...')
    process.exit(1)
  }

  logger.info('A node is down.', nodesDown)

  // Get nodes that this node is resposible to hold replicas for
  const prevReplicatedNodes = util.getNodesIamReplicaFor(hashRing, myself, config.replicas - 1)

  // Actually removes the down node from hash ring
  hashRing = util.removeNodeFromHashRing(hashRing, nodesDown[0])

  // Get nodes this node is responsible for again
  const replicatedNodes = util.getNodesIamReplicaFor(hashRing, myself, config.replicas - 1)

  if (!deepEqual(prevReplicatedNodes, replicatedNodes)) {
    logger.info('Replicated nodes has changed, fetching data...')
    const responses = yield Promise.all(replicatedNodes.map(node => fetchData(node.address, util.getNodeAddressSpace(hashRing, node))))
    responses.forEach(data => store.setInBulk(data))
    logger.info('Replication finished.')
  } else {
    logger.info('Replicated nodes has not changed, moving on...')
  }
})
