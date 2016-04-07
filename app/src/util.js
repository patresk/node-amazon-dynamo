'use strict';

const deepEqual = require('deep-equal')
const _ = require('lodash')

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

exports.getReplicasForNode = function getReplicasForNode(hashRingArg, nodeAddress, number) {
  let hashRing = Object.assign([], hashRingArg)

  if (hashRing.length === 1) {
    return []
  }

  hashRing.sort((a, b) => a.offset > b.offset)
  let nodeIndex = -1
  hashRing.forEach((node, index) => {
    if (node.address == nodeAddress) {
      nodeIndex = index
    }
  })

  // Double the hash ring co we can iterate
  hashRing = hashRing.concat(hashRing)
  const nodes = []
  for (let i = 1; i <= number; i++) {
    if (hashRing[nodeIndex + i] && hashRing[nodeIndex + i].address != nodeAddress) {
      nodes.push(hashRing[nodeIndex + i])
    }
  }

  return _.uniq(nodes)
}

exports.hash = function hash(string, max) {
  max = max ? max : 50
  var hash = 0
  if (string.length == 0) return hash
  for (let i = 0; i < string.length; i++) {
    let char = string.charCodeAt(i)
    hash = ((hash<<5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash % max)
}
