// https://github.com/bahmutov/npm-install/pull/228
process.env.NODE_ENV = 'test'

// following guide
// https://glebbahmutov.com/blog/mocha-and-sinon/
const chai = require('chai')
const sinonChai = require('sinon-chai')
const sinon = require('sinon')

chai.use(sinonChai)
global.expect = chai.expect

before(() => {
  global.sandbox = sinon.createSandbox()
})
beforeEach(() => {
  global.sandbox.restore()
})
