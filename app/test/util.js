/* eslint-env mocha */
'use strict';

const expect = require('chai').expect
const util = require('../src/util')

describe('Util', function () {

  let hashRing = [
    { offset: 100, address: 'a' },
    { offset: 300, address: 'b' },
    { offset: 500, address: 'c' },
    { offset: 600, address: 'd' },
    { offset: 900, address: 'e' },
    { offset: 1200, address: 'f' },
  ]

  describe('addNodeToHashRing()', function () {
    it('should work on small hash ring', function () {
      let maxOffset = 1023
      let hashRing = [ { offset: 0, address: 'a'} ]
      let node = { address: 'b' }
      let obj = util.addNodeToHashRing(hashRing, maxOffset, node)
      expect(obj).to.deep.equal([
        { offset: 0, address: 'a'},
        { offset: 511, address: 'b' }
      ])
    })

    it('shoud insert a node properly in the bigest "hole"', function () {
      let maxOffset = 1023
      let hashRing = [ { offset: 0, address: 'a' }, { offset: 200, address: 'b' } ]
      let node = { address: 'c' }
      let obj = util.addNodeToHashRing(hashRing, maxOffset, node)
      expect(obj).to.deep.equal([
        { offset: 0, address: 'a'},
        { offset: 200, address: 'b' },
        { offset: 611, address: 'c' }
      ])

      hashRing = [ { offset: 200, address: 'a' }, { offset: 800, address: 'b' } ]
      node = { address: 'c' }
      obj = util.addNodeToHashRing(hashRing, maxOffset, node)
      expect(obj).to.deep.equal([
        { offset: 200, address: 'a'},
        { offset: 500, address: 'c' },
        { offset: 800, address: 'b' }
      ])
    })

    it('shoud handle edge cases', function () {
      let maxOffset = 1023
      let hashRing = [ { offset: 200, address: 'a' }, { offset: 700, address: 'b' } ]
      let node = { address: 'c' }
      let obj = util.addNodeToHashRing(hashRing, maxOffset, node)
      expect(obj).to.deep.equal([
        { offset: 200, address: 'a'},
        { offset: 700, address: 'b' },
        { offset: 961, address: 'c' }
      ])
    })
  })

  describe('removeNodeFromHashRing()', function() {
    it('should remove a node', function() {
      expect(util.removeNodeFromHashRing(hashRing, { offset: 300, address: 'b' })).to.deep.equal([
        { offset: 100, address: 'a' },
        { offset: 500, address: 'c' },
        { offset: 600, address: 'd' },
        { offset: 900, address: 'e' },
        { offset: 1200, address: 'f' },
      ])
    })
  })

  describe('hash()', function () {
    it ('should return the same hash for the same key', function() {
      let h = util.hash('test')
      let k = util.hash('test')
      expect(h).to.deep.equal(k)
    })
  })

  describe('getNodeForOffset()', function() {
    it ('should return closest anti-clockwise node in the ring', function() {
      let hashRing = [ { offset: 200, address: 'a' }, { offset: 800, address: 'b' } ]
      expect(util.getNodeForOffset(hashRing, 500)).to.deep.equal({ offset: 200, address: 'a' })
      hashRing = [ { offset: 200, address: 'a' }, { offset: 800, address: 'b' } ]
      expect(util.getNodeForOffset(hashRing, 100)).to.deep.equal({ offset: 800, address: 'b' })
    })
  })

  describe('getNodeAddressSpace()', function() {
    it('should return address space the node is resposible for', function() {
      let hashRing = [
        { offset: 100, address: 'a' },
        { offset: 300, address: 'b' },
        { offset: 500, address: 'c' },
        { offset: 600, address: 'd' },
        { offset: 900, address: 'e' },
        { offset: 1200, address: 'f' },
      ]
      expect(util.getNodeAddressSpace(hashRing, hashRing[2])).to.deep.equal({ from: 500, to: 600 })
      expect(util.getNodeAddressSpace(hashRing, hashRing[5])).to.deep.equal({ from: 1200, to: 100 })
    })
  })

  describe('getCounterClockwiseNode()', function() {
    it('should return counter clockwise node from the ring', function() {
      expect(util.getCounterClockwiseNode(hashRing, hashRing[2])).to.deep.equal(hashRing[1])
      expect(util.getCounterClockwiseNode(hashRing, hashRing[5])).to.deep.equal(hashRing[4])
      expect(util.getCounterClockwiseNode(hashRing, hashRing[0])).to.deep.equal(hashRing[5])
    })
  })

  describe('getNodesIamReplicaFor()', function() {
    it('should return nothing if there is only one node', function() {
      let hashRing = [ { offset: 200, address: 'a' }]
      expect(util.getNodesIamReplicaFor(hashRing, { address: 'a' }, 3)).to.deep.equal([])
      hashRing = [ { offset: 200, address: 'a' }, { offset: 800, address: 'b' } ]
      expect(util.getNodesIamReplicaFor(hashRing, { address: 'a' }, 1)).to.deep.equal([{ offset: 800, address: 'b' }])
    })

    it('should work properly if the number of nodes requested is higher then nodes provided', function() {
      let hashRing = [ { offset: 200, address: 'a' }, { offset: 800, address: 'b' } ]
      expect(util.getNodesIamReplicaFor(hashRing, { address: 'a' }, 3)).to.deep.equal([{ offset: 800, address: 'b' }])
    })

    it('should work properly if the hash ring is large', function() {
      let hashRing = [
        { offset: 100, address: 'a' },
        { offset: 300, address: 'b' },
        { offset: 500, address: 'c' },
        { offset: 600, address: 'd' },
        { offset: 900, address: 'e' },
        { offset: 1200, address: 'f' },
      ]
      expect(util.getNodesIamReplicaFor(hashRing, { address: 'a' }, 3)).to.deep.equal([
        { offset: 300, address: 'b' },
        { offset: 500, address: 'c' },
        { offset: 600, address: 'd' }
      ])
      expect(util.getNodesIamReplicaFor(hashRing, { address: 'e' }, 2)).to.deep.equal([
        { offset: 1200, address: 'f' },
        { offset: 100, address: 'a' }
      ])
      expect(util.getNodesIamReplicaFor(hashRing, { address: 'f' }, 3)).to.deep.equal([
        { offset: 100, address: 'a' },
        { offset: 300, address: 'b' },
        { offset: 500, address: 'c' }
      ])
    })
  })

  describe('Real example', function() {
    it('should work', function() {
      let hashRing = [
        { offset: 100, address: 'a' },
        { offset: 300, address: 'b' },
        { offset: 500, address: 'c' },
        { offset: 600, address: 'd' },
        { offset: 900, address: 'e' },
        { offset: 1200, address: 'f' },
      ]
      let myself = { offset: 600, address: 'd' }
      expect(util.getNodesIamReplicaFor(hashRing, myself, 2)).to.deep.equal([
        { offset: 900, address: 'e' },
        { offset: 1200, address: 'f' }
      ])
      expect(util.getNodeForOffset(hashRing, myself.offset - 1)).to.deep.equal({ offset: 500, address: 'c' })
    })
  })

  describe('Version resolving', function() {
    it ('should resolve newer version', function() {
      let store1 = {
        value: ['jou'],
        clock: {
          node1: 1,
          node2: 1
        }
      }
      let store2 = {
        value: ['yeah'],
        clock: {
          node1: 1,
          node2: 0
        }
      }
      expect(util.resolveVersions(store1, store2)).to.deep.equal({
        value: ['jou'],
        clock: {
          node1: 1,
          node2: 1
        }
      })
    })

    it ('should work even when some nodes does not have value in clock', function() {
      let store1 = {
        value: ['jou'],
        clock: {
          node1: 2
        }
      }
      let store2 = {
        value: ['yeah'],
        clock: {
          node1: 1,
          node2: 0
        }
      }
      expect(util.resolveVersions(store1, store2)).to.deep.equal({
        value: ['jou'],
        clock: {
          node1: 2
        }
      })
    })

    it ('should union the values on conflict', function() {
      let store1 = {
        value: ['jou'],
        clock: {
          node1: 2,
          node2: 1
        }
      }
      let store2 = {
        value: ['yeah'],
        clock: {
          node1: 1,
          node2: 3
        }
      }
      expect(util.resolveVersions(store1, store2)).to.deep.equal({
        value: ['jou', 'yeah'],
        clock: {
          node1: 2,
          node2: 3
        }
      })
    })
  })

})
