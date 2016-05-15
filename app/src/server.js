'use strict';

const express = require('express')
const bodyParser = require('body-parser')
const request = require('request')

const logger = require('./logger')
const discovery = require('./discovery')
const store = require('./store')
const config = require('./config')
const util = require('./util')

const app = express()
const router = express.Router()

discovery.init()

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))

app.use(function(req, res, next) {
  logger.info(`Request recevied on url: ${req.originalUrl}`)
  next()
})

//
// Internal API for node communication
//

router.get('/v1/ping', function(req, res) {
  logger.info('Ping request received')
  res.json({
    hostname: process.env.HOSTNAME,
    status: discovery.getState(),
    ring: discovery.getRing()
  })
})

router.get('/v1/internal/data', function(req, res) {
  logger.info('Get data request received', req.query)
  res.status(200).json(store.getByRange(req.query.from, req.query.to))
})

router.delete('/v1/internal/data', function(req, res) {
  logger.info('Delete data request received', req.query)
  res.status(200).json(store.deleteByRange(req.query.from, req.query.to))
})

// Add a node to the hash ring
// If a parameter predict is set to true, the hash ring is not set
//  only is returned "how would the hash ring looks like"
router.post('/v1/ring/add', function(req, res) {
  logger.info('Request to add node to the ring received')
  // If the state of the node is NEW, nothing is returned
  if (discovery.getState() === 'NEW') {
    return res.json({ status: 'NEW', ring: null })
  }
  if (!req.body.node || !req.body.hasOwnProperty('predict')) {
    logger.error('Received request to add node to hash ring without parameters.')
    return res.sendStatus(500)
  }
  const ring = discovery.addNodeToHashRing(req.body.node, req.body.predict)
  logger.info('Returned ring', req.body.predict, ring)
  logger.info('Actual ring', discovery.getRing())
  res.json({ ring: ring })
})

// Generates a logger with correlation id and key
function generateRequestLogger(req) {
  const wrapper = {}
  for (let type of ['info', 'debug', 'error']) {
    wrapper[type] = function() {
      let args = Array.prototype.slice.call(arguments);
      args.unshift(`[corId=${req.corId}] [key=${req.params.key}] [method=${req.method}]`)
      logger[type].apply(logger, args)
    }
  }
  return wrapper
}

router.use(function(req, res, next) {
  // Get correlation id from header or assign a new one
  req.corId = req.get('x-correlation-id') || Date.now()
  req.logger = generateRequestLogger(req)
  next()
})

router.get('/v1/internal/:key', function(req, res) {
  const value = store.get(req.params.key)
  req.logger.info(`Value: ${value}`)
  if (value) {
    return res.status(200).json(value)
  }
  return res.status(404).send()
})

router.post('/v1/internal/:key', function(req, res) {
  req.logger.info(`This node contains a value for the key`)
  if (!store.set(req.params.key, req.body.value, req.body.clock)) {
    return res.status(409).send()
  }
  return res.status(200).send()
})

router.put('/v1/internal/:key', function(req, res) {
  req.logger.info(`This node contains a value for the key`)
  const item = store.get(req.params.key, req.body.value)
  if (!item) {
    return res.status(409).send()
  }
  const resolved = util.resolveVersions(item, { value: [req.body.value], clock: req.body.clock })
  req.logger.info('Resolved clock:', resolved)
  store.update(req.params.key, resolved.value, resolved.clock)
  return res.status(200).send()
})

// -----------------------------------
// Public API for request coordinator
// -----------------------------------

function validationMiddleware(req, res, next) {
  if (!req.params.key) {
    return res.status(400).send()
  }
  next()
}

router.get('/v1/:key', validationMiddleware, function(req, res) {
  const nodes = discovery.getNodesForKey(req.params.key)
  const quorum = Math.min(req.query.quorum ? parseInt(req.query.quorum, 10) : config.readQuorum, config.replicas, nodes.length)

  const responses = []
  let sent = false

  req.logger.info('Sending requests to nodes', nodes)

  nodes.forEach(node => {
    request({
      url: 'http://' + node.address + '/v1/internal/' + req.params.key,
      method: 'GET',
      json: true,
      headers: { 'x-correlation-id': req.corId },
      timeout: 2000
    }, function(err, response, body) {
      if (err) {
        req.logger.error(`Forwarded GET request failed: ${err}`)
        responses.push({ type: 'err', status: response.statusCode, body: body })
      } else {
        req.logger.info(`Forwarded GET request successful, retrieved`, body)
        responses.push({ type: 'success', status: response.statusCode, body: body })
      }
      let successfulResponses = responses.filter(response => response.type === 'success')
      if (successfulResponses.length >= quorum) {
        if (!sent) {
          sent = true
          if (successfulResponses[0].body && successfulResponses[0].body.value) {
            return res.status(successfulResponses[0].status).json(successfulResponses.map(response => {
              return {
                value: response.body.value,
                clock: util.encodeClock(response.body.clock)
              }
            }))
          }
          res.status(successfulResponses[0].status).send()
        }
      } else {
        req.logger.info('Quorum still not fullfilled')
      }
      if (responses.length === nodes.length) {
        req.logger.info('All responses received.')
        if (!sent) {
          sent = true
          res.status(500).json({ message: 'Quorum not fulfilled.'})
          req.logger.error('Quorum not fulfilled')
        }
      }
    })
  })
})

router.post('/v1/:key', validationMiddleware, function(req, res) {
  const nodes = discovery.getNodesForKey(req.params.key)
  const quorum = Math.min(req.query.quorum ? parseInt(req.query.quorum, 10) : config.readQuorum, config.replicas, nodes.length)

  const responses = []
  let sent = false

  req.logger.info(`Sending requests to ${nodes.length} nodes`)

  const body = req.body
  body.clock = {}
  body.clock[discovery.getMyself().address] = 1

  nodes.forEach(node => {
    request({
      url: 'http://' + node.address  + '/v1/internal/' + req.params.key,
      method: 'POST',
      json: true,
      headers: { 'x-correlation-id': req.corId },
      body: body,
      timeout: 4000
    }, function(err, response, body) {
      if (err) {
        req.logger.error(`Forwarded POST request failed ${err}`)
        responses.push({ type: 'err', body: body })
      } else {
        req.logger.info(`Forwarded POST request successful`)
        responses.push({ type: 'success', status: response.statusCode, body: body })
      }
      let successfulResponses = responses.filter(response => response.type === 'success')
      if (successfulResponses.length >= quorum) {
        if (!sent) {
          sent = true
          res.status(successfulResponses[0].status).json({ message: 'Requests successful with quorum ' + quorum })
        }
      }
      if (responses.length === nodes.length) {
        req.logger.info('All responses received.')
        if (!sent) {
          sent = true
          res.status(500).json({ message: 'Quorum not fulfilled.'})
          req.logger.error('Quorum not fulfilled')
        }
      }
    })
  })
})

router.put('/v1/:key', validationMiddleware, function(req, res) {
  if (!req.body.clock) {
    return res.status(400).json({ message: 'No version specified.'})
  }

  const clock = util.decodeClock(req.body.clock)

  if (!clock) {
    return res.status(400).json({ message: 'Invalid version specified.' })
  }

  // Increment vector clock for the coordinator node
  clock[discovery.getMyself().address] = clock[discovery.getMyself().address] || 0
  clock[discovery.getMyself().address]++

  req.logger.info('Clock after incrementing:', clock)

  const nodes = discovery.getNodesForKey(req.params.key)
  const quorum = Math.min(req.query.quorum ? parseInt(req.query.quorum, 10) : config.readQuorum, config.replicas, nodes.length)
  const responses = []
  let sent = false

  nodes.forEach(node => {
    request({
      url: 'http://' + node.address  + '/v1/internal/' + req.params.key,
      method: 'PUT',
      json: true,
      headers: { 'x-correlation-id': req.corId },
      body: {
        clock: clock,
        value: req.body.value
      },
      timeout: 4000
    }, function(err, response, body) {
      if (err) {
        req.logger.error(`Forwarded PUT request failed ${err}`)
        responses.push({ type: 'err', body: body })
      } else {
        req.logger.info(`Forwarded PUT request successful`)
        responses.push({ type: 'success', status: response.statusCode, body: body })
      }
      let successfulResponses = responses.filter(response => response.type === 'success')
      if (successfulResponses.length >= quorum) {
        if (!sent) {
          sent = true
          res.status(successfulResponses[0].status).json({ message: 'Requests successful with quorum ' + quorum })
        }
      }
      if (responses.length === nodes.length) {
        req.logger.info('All responses received.')
        if (!sent) {
          sent = true
          res.status(500).json({ message: 'Quorum not fulfilled.'})
          req.logger.error('Quorum not fulfilled')
        }
      }
    })
  })
})

router.delete('/v1/:id', validationMiddleware, function(req, res) {
  // Todo: implement
  res.status(200).send()
})

app.use(router)

app.use(function(err, req, res, next) {
  if (req.logger) {
    req.logger.error(`Uncaught error happend ${err}`)
  } else {
    logger.error(`Uncaught error happend ${err}`)
  }
  res.status(500).send()
})

app.listen(process.env.PORT || 80, function() {
  logger.info(`Node listening on http://localhost:${ process.env.PORT || 80 }`)
})