'use strict';

exports.addNodeToHashRing = function(hashRing, maxOffset, node) {
  if (hashRing.length === 0) {
    return [{ address: node.address, offset: 0 }]
  }
  if (hashRing.length === 1) {
    hashRing.push({ address: node.address, offset: Math.floor(maxOffset/2) })
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