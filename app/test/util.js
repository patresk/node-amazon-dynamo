/* eslint-env mocha */
'use strict';

const expect = require('chai').expect
const util = require('../src/util')

describe('Util', function () {

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

    it('shoud handle "ring" edge cases', function () {
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

  describe('getReplicasForNode()', function() {
    it('should return nothing if there is only one node', function() {
      let hashRing = [ { offset: 200, address: 'a' }, { offset: 800, address: 'b' } ]
      expect(util.getReplicasForNode(hashRing, 'a', 1)).to.deep.equal([{ offset: 800, address: 'b' }])
    })

    it('should work properly if the number requested is higher then nodes provided', function() {
      let hashRing = [ { offset: 200, address: 'a' }, { offset: 800, address: 'b' } ]
      expect(util.getReplicasForNode(hashRing, 'a', 3)).to.deep.equal([{ offset: 800, address: 'b' }])
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
      expect(util.getReplicasForNode(hashRing, 'a', 3)).to.deep.equal([
        { offset: 300, address: 'b' },
        { offset: 500, address: 'c' },
        { offset: 600, address: 'd' }
      ])
      expect(util.getReplicasForNode(hashRing, 'e', 2)).to.deep.equal([
        { offset: 1200, address: 'f' },
        { offset: 100, address: 'a' }
      ])
      expect(util.getReplicasForNode(hashRing, 'f', 3)).to.deep.equal([
        { offset: 100, address: 'a' },
        { offset: 300, address: 'b' },
        { offset: 500, address: 'c' }
      ])
    })
  })

})
