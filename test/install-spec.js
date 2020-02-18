const exec = require('@actions/exec')
const core = require('@actions/core')
const io = require('@actions/io')
const quote = require('quote')

const action = require('../index')

describe('install command', () => {
  beforeEach(function() {
    this.exec = sandbox.stub(exec, 'exec').resolves()
  })

  const workingDirectory = '/current/working/directory'
  const npmCacheFolder = '/path/to/user/cache'

  context('using Yarn', () => {
    const pathToYarn = '/path/to/yarn'

    it('and lock file', async function() {
      const opts = {
        useYarn: true,
        usePackageLock: true,
        workingDirectory,
        npmCacheFolder
      }
      sandbox
        .stub(io, 'which')
        .withArgs('yarn')
        .resolves(pathToYarn)
      await action.utils.install(opts)
      expect(this.exec).to.have.been.calledOnceWithExactly(
        quote(pathToYarn),
        ['--frozen-lockfile'],
        { cwd: workingDirectory }
      )
    })

    it('without lock file', async function() {
      const opts = {
        useYarn: true,
        usePackageLock: false,
        workingDirectory,
        npmCacheFolder
      }
      sandbox
        .stub(io, 'which')
        .withArgs('yarn')
        .resolves(pathToYarn)
      await action.utils.install(opts)
      expect(this.exec).to.have.been.calledOnceWithExactly(
        quote(pathToYarn),
        [],
        { cwd: workingDirectory }
      )
    })
  })

  context('using NPM', () => {
    const pathToNpm = '/path/to/npm'

    beforeEach(function() {
      this.exportVariable = sandbox.stub(core, 'exportVariable')
    })

    it('installs using lock file', async function() {
      const opts = {
        useYarn: false,
        usePackageLock: true,
        workingDirectory,
        npmCacheFolder
      }
      sandbox
        .stub(io, 'which')
        .withArgs('npm')
        .resolves(pathToNpm)
      await action.utils.install(opts)
      expect(
        this.exportVariable,
        'export npm_config_cache was called'
      ).to.be.calledOnceWithExactly('npm_config_cache', npmCacheFolder)
      expect(this.exportVariable).to.have.been.calledBefore(this.exec)
      expect(this.exec).to.have.been.calledOnceWithExactly(
        quote(pathToNpm),
        ['ci'],
        { cwd: workingDirectory }
      )
    })

    it('installs without a lock file', async function() {
      const opts = {
        useYarn: false,
        usePackageLock: false,
        workingDirectory,
        npmCacheFolder
      }
      sandbox
        .stub(io, 'which')
        .withArgs('npm')
        .resolves(pathToNpm)
      await action.utils.install(opts)
      expect(
        this.exportVariable,
        'export npm_config_cache was called'
      ).to.be.calledOnceWithExactly('npm_config_cache', npmCacheFolder)
      expect(this.exportVariable).to.have.been.calledBefore(this.exec)
      expect(this.exec).to.have.been.calledOnceWithExactly(
        quote(pathToNpm),
        ['install'],
        { cwd: workingDirectory }
      )
    })
  })
})
