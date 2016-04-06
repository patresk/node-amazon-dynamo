'use strict';

const express = require('express')
const bodyParser = require('body-parser')

const logger = require('./logger')
const discovery = require('./discovery')

const app = express()
const router = express.Router()

discovery.init()

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))

app.use(function(req, res, next) {
  logger.info('Request recevied on url:', req.originalUrl)
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
  }).send()
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

router.get('/v1/:id', function(req, res) {
  if (!req.params.id) {
    return res.status(500).send()
  }
  // Set correlation ID from reqeust or create a new one
  const corId = req.get('x-correlation-id') || Date.now()
  // Todo: implement
  res.status(200).send()
})

router.put('/v1/:id', function(req, res) {
  // Todo: implement
  res.status(200).send()
})

router.post('/v1/:id', function(req, res) {
  // Todo: implement
  res.status(200).send()
})

router.delete('/v1/:id', function(req, res) {
  // Todo: implement
  res.status(200).send()
})

app.use(router)

app.use(function(err, req, res, next) {
  const corId = req.get('x-correlation-id')
  logger.error('[corId=' + corId + ']', 'Uncaught error happend', err)
  res.status(500).send()
})

app.listen(process.env.PORT || 80, function() {
  logger.info('Node listening on http://localhost:' + (process.env.PORT || 80))
})