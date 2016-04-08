'use strict';

const express = require('express')
const bodyParser = require('body-parser')
const request = require('request')

const logger = require('./logger')
const discovery = require('./discovery')
const store = require('./store')
const config = require('./config')

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
    return res.status(200).json({ value: value })
  }
  return res.status(404).send()
})

router.post('/v1/internal/:key', function(req, res) {
  req.logger.info(`This node contains a value for the key`)
  if (!store.set(req.params.key, req.body.value)) {
    return res.status(409).send()
  }
  return res.status(200).send()
})

//
// Public API for request coordinator
//

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
          res.status(successfulResponses[0].status).json(successfulResponses)
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

router.post('/v1/:key', validationMiddleware, function(req, res) {
  const nodes = discovery.getNodesForKey(req.params.key)
  const quorum = Math.min(req.query.quorum ? parseInt(req.query.quorum, 10) : config.readQuorum, config.replicas, nodes.length)

  const responses = []
  let sent = false

  req.logger.info(`Sending requests to ${nodes.length} nodes`)

  nodes.forEach(node => {
    request({
      url: 'http://' + node.address  + '/v1/internal/' + req.params.key,
      method: 'POST',
      json: true,
      headers: { 'x-correlation-id': req.corId },
      body: req.body,
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
          res.status(successfulResponses[0].status).json(successfulResponses.map(res => res.body))
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

router.put('/v1/:id', validationMiddleware, function(req, res) {
  // Todo: implement
  res.status(200).send()
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