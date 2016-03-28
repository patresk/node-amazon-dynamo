'use strict';

const express = require('express')
const bodyParser = require('body-parser')

const app = express()

app.get('/:id', function(req, res) {
  // Todo: implement
  res.status(200).send()
})

app.post('/:id', function(req, res) {
  // Todo: implement
  res.status(200).send()
})

app.put('/:id', function(req, res) {
  // Todo: implement
  res.status(200).send()
})

app.delete('/:id', function(req, res) {
  // Todo: implement
  res.status(200).send()
})

app.use(function(err, req, res) {
  console.error('Uncaught error:', err, err.stack)
  res.status(500).send()
})

app.listen(process.env.PORT || 80, function() {
  console.log('Node listening on http://localhost:' + (process.env.PORT || 80))
})