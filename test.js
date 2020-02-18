const expect = require('chai').expect
const npmInstall = require('./index')

it('exports a function', () => {
  expect(npmInstall).to.have.property('npmInstallAction').and.be.a('function')
})
