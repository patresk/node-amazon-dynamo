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

})
