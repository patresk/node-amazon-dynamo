const util = require('./util')
const config = require('./config')

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
  Object.keys(store)
    .map(key => parseInt(key, 10))
    .filter(key => key >= from && key <= to)
    .forEach(key => output[key] = store[key])
  return output
}

exports.setInBulk = function(input) {
  Object.keys(input).forEach(key => store[key] = input[key])
}

// For unit tests only
exports._data = store
exports._clear = function() {
  Object.keys(store).forEach(key => delete store[key])
}