const util = require('./util')
const config = require('./config')
const logger = require('./logger')

const store = {}

exports.get = function(key) {
  const hash = util.hash(key, config.maxOffset).toString()
  logger.info(`[module=store][action=get][count=1][key=${key}]`)
  return store[hash] ? store[hash][key] : undefined
}

exports.set = function(key, value, clock) {
  const hash = util.hash(key, config.maxOffset).toString()
  if (store[hash] && store[hash][key]) {
    return null
  }
  store[hash] = store[hash] || {}
  store[hash][key] = { value: [value], clock: clock }
  logger.info(`[module=store][action=set][count=1][key=${key}]`)
  return store[hash][key]
}

exports.update = function(key, value, clock) {
  const hash = util.hash(key, config.maxOffset).toString()
  if (!store[hash] || !store[hash][key]) {
    return null
  }
  logger.info(`[module=store][action=update][count=1][key=${key}]`)
  store[hash][key] = { value: value, clock: clock }
}

exports.delete = function(key) {
  const hash = util.hash(key, config.maxOffset).toString()
  if (!store[hash] || !store[hash][key]) {
    return 1
  }
  logger.info(`[module=store][action=delete][count=1][key=${key}]`)
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
  logger.info(`[module=store][action=setBulk][count=${Object.keys(input).length}]`)
  Object.keys(input).forEach(key => store[key] = input[key])
}

// For unit tests only
exports._data = store
exports._clear = function() {
  Object.keys(store).forEach(key => delete store[key])
}

// Periodic store status loggin
setInterval(function log() {
  logger.info('Keys stored: ', Object.keys(store).length, Object.keys(store).map(key => Object.keys(store[key])))
}, 10000)
