'use strict';

const deepEqual = require('deep-equal')
const _ = require('lodash')
//const farmhash = require('farmhash')

exports.addNodeToHashRing = function(hashRing, maxOffset, node) {
  if (hashRing.length === 0) {
    return [{ address: node.address, offset: 0 }]
  }
  if (hashRing.length === 1) {
    hashRing.push({ address: node.address, offset: Math.floor(maxOffset / 2) })
    hashRing.sort((a, b) => a.offset > b.offset)
    return hashRing
  }

  // Find the biggest "hole" in the hash ring
  let hole = { distance: 0, index: undefined }
  for (let i = 0; i < hashRing.length; i++) {
    let distance
    if (i === (hashRing.length - 1)) {
      distance = hashRing[0].offset + (maxOffset - hashRing[hashRing.length - 1].offset)
    } else {
      distance = hashRing[i + 1].offset - hashRing[i].offset
    }
    if (distance > hole.distance) {
      hole.distance = distance
      hole.offset = Math.floor((distance / 2)) + hashRing[i].offset
      hole.index = i
    }
  }

  // Add to hash ring and sort by offset
  hashRing.push({ address: node.address, offset: hole.offset })
  hashRing.sort((a, b) => a.offset > b.offset)
  return hashRing
}

exports.removeNodeFromHashRing = function(hashRingArg, node) {
  const hashRing = Object.assign([], hashRingArg)
  const index = getIndex(hashRing, node)
  hashRing.splice(index, 1)
  return hashRing
}

exports.sleep = function sleep(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms)
  })
}

exports.areItemsEqual = function areItemsEqual(arr) {
  for (let i = 0; i < arr.length; i++) {
    if (!deepEqual(arr[0], arr[i])) {
      return false
    }
  }
  return true
}

exports.getNodeForOffset = function getNodeForOffset(hashRing, offset) {
  if (hashRing.length === 1) {
    return hashRing[0]
  }
  let found
  for (let i = 0; i < hashRing.length; i++) {
    if (offset >= hashRing[i].offset) {
      found = hashRing[i]
    }
  }
  if (!found) {
    found = hashRing[hashRing.length - 1]
  }
  return found
}

// Note: "to" offset can be smaller than "from"!
exports.getNodeAddressSpace = function getNodeAddressSpace(hashRing, node) {
  let clockwiseNode = getClockwiseNode(hashRing, node)
  return { from: node.offset, to: clockwiseNode.offset }
}

const getClockwiseNode = exports.getClockwiseNode = function(hashRing, node) {
  let index = getIndex(hashRing, node)
  if (index !== -1) {
    return hashRing[index + 1 < hashRing.length ? index + 1 : 0]
  }
}

const getCounterClockwiseNode = exports.getCounterClockwiseNode = function(hashRing, node) {
  if (hashRing.length <= 1) {
    return null
  }
  let index = getIndex(hashRing, node)
  if (index !== -1) {
    return hashRing[index - 1 >= 0 ? index - 1 : hashRing.length - 1]
  }
}

const getIndex = exports.getIndex = function(hashRing, node) {
  let index = -1
  hashRing.forEach((n, i) => {
    if (n.address === node.address) {
      index = i
    }
  })
  return index
}

exports.getNodesIamReplicaFor = function getReplicasForNode(hashRingArg, node, number) {
  let hashRing = Object.assign([], hashRingArg)

  if (hashRing.length === 1) {
    return []
  }

  hashRing.sort((a, b) => a.offset > b.offset)
  let nodeIndex = -1
  hashRing.forEach((ringNode, index) => {
    if (ringNode.address == node.address) {
      nodeIndex = index
    }
  })

  // Double the hash ring co we can iterate
  hashRing = hashRing.concat(hashRing)
  const nodes = []
  for (let i = 1; i <= number; i++) {
    if (hashRing[nodeIndex + i] && hashRing[nodeIndex + i].address != node.address) {
      nodes.push(hashRing[nodeIndex + i])
    }
  }

  return _.uniq(nodes)
}

exports.hash = function hash(string, max) {
  var hash = 0;
  if (string.length == 0) return hash;
  for (var i = 0; i < string.length; i++) {
    var char = string.charCodeAt(i);
    hash = ((hash<<5)-hash)+char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash % max);
  //return farmhash.hash32(string) % max
}

exports.encodeClock = function encodeClock(clock) {
  try {
    return new Buffer(JSON.stringify(clock)).toString('base64')
  } catch (e) {
    return null
  }
}

exports.decodeClock = function decodeClock(string) {
  try {
    return JSON.parse(new Buffer(string, 'base64').toString('ascii'))
  } catch (e) {
    return null
  }
}

exports.resolveVersions = function resolveVersions(val1, val2) {
  const nodes = _.uniq(Object.keys(val1.clock).concat(Object.keys(val2.clock)))
  if (nodes.filter(node => (val1.clock[node] || 0) >= (val2.clock[node] || 0)).length === nodes.length) {
    return val1
  }
  if (nodes.filter(node => (val2.clock[node] || 0) >= (val1.clock[node] || 0)).length === nodes.length) {
    return val2
  }
  const mergedClock = {}
  nodes.forEach(node => mergedClock[node] = Math.max(val1.clock[node], val2.clock[node]))
  return {
    value: val1.value.concat(val2.value),
    clock: mergedClock
  }
}
