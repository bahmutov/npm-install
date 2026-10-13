const exec = require('@actions/exec')
const core = require('@actions/core')
const io = require('@actions/io')
const quote = require('quote')
const path = require('path')

const action = require('../index')

describe('install command', () => {
  beforeEach(function() {
    this.exec = sandbox.stub(exec, 'exec').resolves()
  })

  // by resolving we normalize the folder on Linux and Windows CI
  const workingDirectory = path.resolve('/current/working/directory')
  const npmCacheFolder = '/path/to/user/cache'

  context('using Yarn', () => {
    const pathToYarn = '/path/to/yarn'

    it('uses absolute working directory', async function() {
      const opts = {
        useYarn: true,
        useYarnV1: true,
        usePackageLock: true,
        // only use relative path
        workingDirectory: 'directory',
        npmCacheFolder
      }
      sandbox
        .stub(io, 'which')
        .withArgs('yarn')
        .resolves(pathToYarn)
      sandbox
        .stub(path, 'resolve')
        .withArgs('directory')
        .returns(workingDirectory)
      sandbox.stub(core, 'exportVariable')

      await action.utils.install(opts)
      expect(
        this.exec,
        'to use absolute working directory'
      ).to.have.been.calledOnceWithExactly(
        quote(pathToYarn),
        ['--frozen-lockfile'],
        { cwd: workingDirectory }
      )
      expect(
        core.exportVariable,
        'npm_config_cache was set'
      ).to.have.been.calledOnceWithExactly('npm_config_cache', npmCacheFolder)
    })

    it('and lock file', async function() {
      const opts = {
        useYarn: true,
        useYarnV1: true,
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
        useYarnV1: true,
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

    it('uses Yarn berry', async function() {
      const opts = {
        useYarn: true,
        useYarnV1: false,
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
        ['--immutable'],
        { cwd: workingDirectory }
      )
    })
  })

  context('using NPM', () => {
    const pathToNpm = '/path/to/npm'

    beforeEach(function() {
      this.exportVariable = sandbox.stub(core, 'exportVariable')
    })

    it('uses absolute working directory', async function() {
      const opts = {
        useYarn: false,
        useYarnV1: false,
        usePackageLock: true,
        // only use relative path
        workingDirectory: 'directory',
        npmCacheFolder
      }
      sandbox
        .stub(io, 'which')
        .withArgs('npm')
        .resolves(pathToNpm)
      sandbox
        .stub(path, 'resolve')
        .withArgs('directory')
        .returns(workingDirectory)

      await action.utils.install(opts)

      expect(
        this.exec,
        'to use absolute working directory'
      ).to.have.been.calledOnceWithExactly(quote(pathToNpm), ['ci'], {
        cwd: workingDirectory
      })
    })

    it('installs using lock file', async function() {
      const opts = {
        useYarn: false,
        useYarnV1: false,
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
        useYarnV1: false,
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

  context('using custom command', () => {
    it('calls exec directly', async function() {
      const opts = {
        useYarn: true,
        useYarnV1: false,
        usePackageLock: true,
        // only use relative path
        workingDirectory: 'directory',
        npmCacheFolder,
        installCommand: 'my install command'
      }

      sandbox.stub(core, 'exportVariable')

      sandbox
        .stub(path, 'resolve')
        .withArgs('directory')
        .returns(workingDirectory)

      await action.utils.install(opts)
      expect(
        this.exec,
        'to use the install command'
      ).to.have.been.calledOnceWithExactly('my install command', [], {
        cwd: workingDirectory
      })

      expect(
        core.exportVariable,
        'npm_config_cache was set'
      ).to.have.been.calledOnceWithExactly('npm_config_cache', npmCacheFolder)
    })
  })

  context('retries', () => {
    const pathToNpm = '/path/to/npm'
    const npmOpts = {
      useYarn: false,
      useYarnV1: false,
      usePackageLock: true,
      workingDirectory,
      npmCacheFolder
    }

    beforeEach(function() {
      sandbox.stub(core, 'exportVariable')
      sandbox
        .stub(io, 'which')
        .withArgs('npm')
        .resolves(pathToNpm)
      this.sleep = sandbox.stub(action.utils, 'sleep').resolves()
      this.log = sandbox.spy(console, 'log')
    })

    it('runs once when retries is omitted', async function() {
      const error = new Error('network down')
      this.exec.rejects(error)

      try {
        await action.utils.install(npmOpts)
        expect.fail('should have thrown')
      } catch (err) {
        expect(err).to.equal(error)
      }

      expect(this.exec).to.have.been.calledOnce
      expect(this.sleep).to.not.have.been.called
      expect(this.log).to.not.have.been.calledWith(
        'install attempt %d of %d',
        1,
        1
      )
    })

    it('retries the npm install command until it succeeds', async function() {
      this.exec.onCall(0).rejects(new Error('registry timeout'))
      this.exec.onCall(1).resolves(0)

      await action.utils.install({ ...npmOpts, retries: 2 })

      expect(this.exec).to.have.been.calledTwice
      expect(this.exec).to.have.been.calledWithExactly(
        quote(pathToNpm),
        ['ci'],
        { cwd: workingDirectory }
      )
      expect(this.sleep).to.have.been.calledOnceWithExactly(5000)
      expect(this.log).to.have.been.calledWith('install attempt %d of %d', 1, 3)
      expect(this.log).to.have.been.calledWith(
        'install attempt %d of %d failed: %s; retrying in %ds',
        1,
        3,
        'registry timeout',
        5
      )
      expect(this.log).to.have.been.calledWith('install attempt %d of %d', 2, 3)
      expect(core.exportVariable).to.have.been.calledOnce
    })

    it('fails after the configured retries are exhausted', async function() {
      const error = new Error('network down')
      this.exec.rejects(error)

      try {
        await action.utils.install({ ...npmOpts, retries: 2 })
        expect.fail('should have thrown')
      } catch (err) {
        expect(err).to.equal(error)
      }

      expect(this.exec).to.have.been.calledThrice
      expect(this.sleep).to.have.been.calledTwice
      expect(this.sleep).to.have.been.calledWithExactly(5000)
      expect(this.log).to.have.been.calledWith(
        'install attempt %d of %d failed: %s',
        3,
        3,
        'network down'
      )
    })

    it('retries Yarn installs', async function() {
      const pathToYarn = '/path/to/yarn'
      io.which.withArgs('yarn').resolves(pathToYarn)
      this.exec.onCall(0).rejects(new Error('yarn registry blip'))
      this.exec.onCall(1).resolves(0)

      await action.utils.install({
        useYarn: true,
        useYarnV1: true,
        usePackageLock: true,
        workingDirectory,
        npmCacheFolder,
        retries: 1
      })

      expect(this.exec).to.have.been.calledTwice
      expect(this.exec).to.have.been.calledWithExactly(
        quote(pathToYarn),
        ['--frozen-lockfile'],
        { cwd: workingDirectory }
      )
      expect(this.sleep).to.have.been.calledOnceWithExactly(5000)
    })

    it('retries a custom install command', async function() {
      const installCommand = 'pnpm install --frozen-lockfile'
      this.exec.onCall(0).rejects(new Error('pnpm registry blip'))
      this.exec.onCall(1).resolves(0)

      await action.utils.install({
        ...npmOpts,
        installCommand,
        retries: 1
      })

      expect(this.exec).to.have.been.calledTwice
      expect(this.exec).to.have.been.calledWithExactly(installCommand, [], {
        cwd: workingDirectory
      })
      expect(this.sleep).to.have.been.calledOnceWithExactly(5000)
      expect(io.which).to.not.have.been.called
    })

    it('rejects a negative retries option', async function() {
      try {
        await action.utils.install({ ...npmOpts, retries: -1 })
        expect.fail('should have thrown')
      } catch (err) {
        expect(err.message).to.equal(
          'retries must be a non-negative integer, received -1'
        )
      }

      expect(this.exec).to.not.have.been.called
    })
  })
})
