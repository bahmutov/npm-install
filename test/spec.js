const action = require('../index')
const utils = action.utils

describe('misc', () => {
  it('exports a function', () => {
    expect(action)
      .to.have.property('npmInstallAction')
      .and.be.a('function')
    expect(action).to.have.property('utils')
  })

  it('cache was not hit', async () => {
    // previous cache not found
    const cacheHit = false
    const restoreCache = sandbox.stub(utils, 'restoreCachedNpm')
    const install = sandbox.stub(utils, 'install')
    const saveCache = sandbox.stub(utils, 'saveCachedNpm')

    restoreCache.resolves(cacheHit)
    install.resolves()
    saveCache.resolves()

    await action.npmInstallAction()
    expect(saveCache, 'new cache was saved').to.have.been.calledOnce
    expect(
      restoreCache,
      'restore cache was checked first'
    ).to.have.been.calledBefore(install)
    expect(
      install,
      'install was called before saving cache'
    ).to.have.been.calledBefore(saveCache)
  })

  it('cache was hit', async () => {
    // we don't need to save cache in this case
    const cacheHit = true
    const restoreCache = sandbox.stub(utils, 'restoreCachedNpm')
    const install = sandbox.stub(utils, 'install')
    const saveCache = sandbox.stub(utils, 'saveCachedNpm')

    restoreCache.resolves(cacheHit)
    install.resolves()
    saveCache.resolves()

    await action.npmInstallAction()
    expect(install, 'install was called').to.have.been.calledOnce
    expect(saveCache, 'cache remains the same').to.have.not.been.called
    expect(
      restoreCache,
      'restore cache was checked first'
    ).to.have.been.calledBefore(install)
  })
})
