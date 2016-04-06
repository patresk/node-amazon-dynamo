const store = {}

exports.get = function(id) {
  return store[id]
}

exports.set = function(id, value) {
  if (store[id]) {
    return null
  }
  store[id] = {
    values: [value],
    version: 1
  }
  return store[id]
}

exports.update = function(id, value) {
  if (!store[id]) {
    return 1
  }
  store[id].values = [value]
  store[id].version = store[id].version + 1
}

exports.delete = function(id) {
  if (!store[id]) {
    return 1
  }
  delete store[id]
}