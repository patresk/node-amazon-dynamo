/* eslint-env mocha */
'use strict';

const expect = require('chai').expect
const store = require('../src/store')
const util = require('../src/util')
const config = require('../src/config')

describe('Store', function() {
  beforeEach(function() {
    store._clear()
  })

  describe('set()', function() {
    it('should set a value', function() {
      store.set('test', 'value')
      expect(store._data[util.hash('test', config.maxOffset)]['test']).to.deep.equal('value')
    })
  })

  describe('get()', function() {
    it('should get a value', function() {
      store.set('test', 'value')
      expect(store.get('test')).to.deep.equal('value')
    })
  })

  describe('getByRange()', function() {
    it('should get a object of values', function() {
      store.setInBulk({
        '1': { 'abc': 'val3' },
        '2': { 'def': 'val3' },
        '50': { 'plo': 'val3' },
        '1022': { 'cfg': 'val2' },
        '1000': { 'efg': 'val3' }
      })
      expect(store.getByRange(1010, 5)).to.deep.equal({
        '1022': { 'cfg': 'val2' },
        '1': { 'abc': 'val3' },
        '2': { 'def': 'val3' }
      })
      expect(store.getByRange(1000, 1030)).to.deep.equal({
        '1022': { 'cfg': 'val2' },
        '1000': { 'efg': 'val3' }
      })
    })
  })

  describe('setInBulk()', function() {
    it('should set a multiple key-values', function() {
      store.set('test', 'value')
      store.setInBulk({
        '5': { another_test: 'val3' },
        '393': { next_test: 'val2' },
        '669': { test: 'val1' }
      })
      expect(store._data).to.deep.equal({
        '5': { another_test: 'val3' },
        '393': { next_test: 'val2' },
        '669': { test: 'val1' },
        '550': { test: 'value' }
      })
      //expect(store.get('next_test')).to.deep.equal('val2')
      //expect(store.get('another_test')).to.deep.equal('val3')
    })
  })
})
