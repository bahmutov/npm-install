const npmInstall = require('../index')
const utils = npmInstall.utils

it('exports a function', () => {
  expect(npmInstall)
    .to.have.property('npmInstallAction')
    .and.be.a('function')
  expect(npmInstall).to.have.property('utils')
})

it('cache was not hit', async () => {
  // previous cache not found
  const cacheHit = false
  const restoreCache = sandbox.stub(
    utils,
    'restoreCachedNpm'
  )
  const install = sandbox.stub(utils, 'install')
  const saveCache = sandbox.stub(utils, 'saveCachedNpm')

  restoreCache.resolves(cacheHit)
  install.resolves()
  saveCache.resolves()

  await npmInstall.npmInstallAction()
  expect(saveCache, 'new cache was saved').to.have.been
    .calledOnce
  expect(
    restoreCache,
    'restore cache was checked first'
  ).to.have.been.calledBefore(install)
  expect(
    install,
    'install was called before saving cache'
  ).to.have.been.calledBefore(saveCache)
})
