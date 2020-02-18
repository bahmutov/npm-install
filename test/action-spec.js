const exec = require('@actions/exec')
const core = require('@actions/core')
const io = require('@actions/io')
const quote = require('quote')
const os = require('os')
const path = require('path')
const hasha = require('hasha')

const action = require('../index')
const utils = action.utils

describe('action', () => {
  const cwd = '/path/to/mock/cwd'
  const homedir = '/home/path/for/test/user'

  beforeEach(function() {
    this.exec = sandbox.stub(exec, 'exec').resolves()
    sandbox.stub(os, 'homedir').returns(homedir)
    sandbox.stub(process, 'cwd').returns(cwd)
    const filename = path.join(cwd, 'package.json')
    sandbox
      .stub(hasha, 'fromFileSync')
      .withArgs(filename)
      .returns('hash-from-package-json')
    sandbox.stub(utils, 'getPlatformAndArch').returns('platform-arch')
  })

  it('installs with useLockFile: 0', async function() {
    // useLockFile: '0'
    sandbox
      .stub(core, 'getInput')
      .withArgs('useLockFile')
      .returns('0')

    const pathToNpm = '/path/to/npm'
    sandbox
      .stub(io, 'which')
      .withArgs('npm')
      .resolves(pathToNpm)

    const cacheHit = true
    const restoreCache = sandbox
      .stub(utils, 'restoreCachedNpm')
      .resolves(cacheHit)
    const saveCache = sandbox.stub(utils, 'saveCachedNpm')
    await action.npmInstallAction()
    // caching based on the file package.json in the current working directory
    expect(restoreCache).to.have.been.calledOnceWithExactly({
      inputPath: path.join(homedir, '.npm'),
      primaryKey: 'npm-platform-arch-hash-from-package-json',
      restoreKeys: 'npm-platform-arch-hash-from-package-json'
    })

    expect(this.exec).to.have.been.calledOnceWithExactly(
      quote(pathToNpm),
      ['install'],
      {
        cwd
      }
    )

    expect(saveCache, 'cache was hit').to.not.have.been.called
  })

  it('installs with useLockFile: 0 and saves cache', async function() {
    // useLockFile: '0'
    sandbox
      .stub(core, 'getInput')
      .withArgs('useLockFile')
      .returns('0')

    const pathToNpm = '/path/to/npm'
    sandbox
      .stub(io, 'which')
      .withArgs('npm')
      .resolves(pathToNpm)

    const cacheHit = false
    const restoreCache = sandbox
      .stub(utils, 'restoreCachedNpm')
      .resolves(cacheHit)
    const saveCache = sandbox.stub(utils, 'saveCachedNpm')
    await action.npmInstallAction()
    // caching based on the file package.json in the current working directory
    const cacheParams = {
      inputPath: path.join(homedir, '.npm'),
      primaryKey: 'npm-platform-arch-hash-from-package-json',
      restoreKeys: 'npm-platform-arch-hash-from-package-json'
    }
    expect(restoreCache).to.have.been.calledOnceWithExactly(cacheParams)

    expect(this.exec).to.have.been.calledOnceWithExactly(
      quote(pathToNpm),
      ['install'],
      {
        cwd
      }
    )

    expect(
      saveCache,
      'new cache needs to be saved'
    ).to.have.been.calledOnceWithExactly(cacheParams)
  })
})
