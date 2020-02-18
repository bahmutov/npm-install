const npmInstall = require('../index')

it('exports a function', () => {
  expect(npmInstall)
    .to.have.property('npmInstallAction')
    .and.be.a('function')
  expect(npmInstall).to.have.property('utils')
})

it('cache was not hit', async () => {
  // previous cache not found
  const cacheHit = false
  sandbox
    .stub(npmInstall.utils, 'restoreCachedNpm')
    .resolves(cacheHit)
})
