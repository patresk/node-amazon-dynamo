const util = require('./util')
const config = require('./config')
const logger = require('./logger')

const store = {}

exports.get = function(key) {
  const hash = util.hash(key, config.maxOffset).toString()
  return store[hash] ? store[hash][key] : undefined
}

exports.set = function(key, value) {
  const hash = util.hash(key, config.maxOffset).toString()
  if (store[hash] && store[hash][key]) {
    return null
  }
  store[hash] = store[hash] || {}
  store[hash][key] = value
  return store[hash][key]
}

exports.update = function(key, value) {
  const hash = util.hash(key, config.maxOffset).toString()
  if (!store[hash] || !store[hash][key]) {
    return null
  }
  store[hash][key] = value
}

exports.delete = function(key) {
  const hash = util.hash(key, config.maxOffset).toString()
  if (!store[hash] || !store[hash][key]) {
    return 1
  }
  delete store[hash][key]
}

// Note: from - inclusive, to - inclusive
exports.getByRange = function(from, to) {
  const output = {}
  // If is "overlapping"
  if (to < from) {
    Object.keys(store)
      .filter(key => parseInt(key, 10) >= from || parseInt(key, 10) <= to)
      .forEach(key => output[key] = store[key])
  } else {
    Object.keys(store)
      .filter(key => parseInt(key, 10) >= from && parseInt(key, 10) <= to)
      .forEach(key => output[key] = store[key])
  }
  return output
}

exports.deleteByRange = function(from, to) {
  if (to < from) {
    Object.keys(store)
      .filter(key => parseInt(key, 10) >= from || parseInt(key, 10) <= to)
      .forEach(key => delete store[key])
  } else {
    Object.keys(store)
      .filter(key => parseInt(key, 10) >= from && parseInt(key, 10) <= to)
      .forEach(key => delete store[key])
  }
}

exports.setInBulk = function(input) {
  Object.keys(input).forEach(key => store[key] = input[key])
}

// For unit tests only
exports._data = store
exports._clear = function() {
  Object.keys(store).forEach(key => delete store[key])
}

// Periodic store status loggin
setInterval(function log() {
  logger.info(`[keys=${Object.keys(store).length}] Store status`)
  logger.info('Keys stored: ', Object.keys(store).map(key => Object.keys(store[key])))
}, 5000)