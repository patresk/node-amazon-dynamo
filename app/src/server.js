'use strict';

const express = require('express')
const bodyParser = require('body-parser')
const request = require('request')

const logger = require('./logger')
const discovery = require('./discovery')
const store = require('./store')

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

//
// Public API
//

// Correlation ID middleware
router.use(function(req, res, next) {
  // Set correlation ID from the request or assign a new one
  req.corId = req.get('x-correlation-id') || Date.now()
  next()
})

function validationMiddleware(req, res, next) {
  if (!req.params.id) {
    return res.status(400).send()
  }
  next()
}

router.get('/v1/:id', validationMiddleware, function(req, res) {
  const action = discovery.getNodeForKey(req.params.id)

  if (action.type === 'return') {
    logger.info(`[corId=${req.corId}] [key=${req.params.id}] This node should contain the value`)
    const value = store.get(req.params.id)
    logger.info(`[corId=${req.corId}] [key=${req.params.id}] Value: ${value}`)
    if (value) {
      return res.status(200).json({ value: value })
    }
    return res.status(404).send()
  }

  logger.info(`[corId=${req.corId}] [key=${req.params.id}] Forwarding GET request`)

  request({
    url: 'http://' + action.node.address + '/v1/' + req.params.id,
    method: 'GET',
    json: true,
    headers: { 'x-correlation-id': req.corId },
    timeout: 4000
  }, function(err, response, body) {
    if (err) {
      logger.error(`[corId=${req.corId}] [key=${req.params.id}] Forwarded GET request failed: ${err}`)
      return res.status(500).send()
    }
    logger.info(`[corId=${req.corId}] [key=${req.params.id}] Forwarded GET request successful`)
    res.status(response.statusCode).send(body)
  })
})

router.post('/v1/:id', validationMiddleware, function(req, res) {
  const action = discovery.getNodeForKey(req.params.id)

  if (action.type === 'return') {
    logger.info(`[corId=${req.corId}] [key=${req.params.id}] This node contains a value for the key`)
    if (!store.set(req.params.id, req.body.value)) {
      return res.status(409).send()
    }
    return res.status(200).send()
  }

  logger.info(`[corId=${req.corId}] [key=${req.params.id}] Forwarding POST request for key`)

  request({
    url: 'http://' + action.node.address  + '/v1/' + req.params.id,
    method: 'POST',
    json: true,
    headers: { 'x-correlation-id': req.corId },
    body: req.body,
    timeout: 4000
  }, function(err, response, body) {
    if (err) {
      logger.error(`[corId=${req.corId}] [key=${req.params.id}] Forwarted POST request failed ${err}`)
      return res.status(500).send()
    }
    logger.info(`[corId=${req.corId}] [key=${req.params.id}] Forwarded POST request successful`)
    res.status(response.statusCode).send(body)
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
  logger.error(`[corId=${req.corId}] Uncaught error happend ${err}`)
  res.status(500).send()
})

app.listen(process.env.PORT || 80, function() {
  logger.info(`Node listening on http://localhost:${ process.env.PORT || 80 }`)
})