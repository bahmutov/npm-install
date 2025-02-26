const exec = require('@actions/exec')
const core = require('@actions/core')
const io = require('@actions/io')
const quote = require('quote')
const os = require('os')
const path = require('path')
const hasha = require('hasha')
const fs = require('fs')
const cache = require('@actions/cache')

const action = require('../index')
const utils = action.utils

const isWindows = os.platform().includes('win')

describe('action', () => {
  // by resolving we normalize the folder on Linux and Windows CI
  const cwd = path.resolve('/path/to/mock/cwd')
  const homedir = '/home/path/for/test/user'

  beforeEach(function() {
    this.exec = sandbox.stub(exec, 'exec').resolves()
    sandbox.stub(os, 'homedir').returns(homedir)
    sandbox.stub(process, 'cwd').returns(cwd)
    sandbox.stub(utils, 'getPlatformAndArch').returns('platform-arch')
    sandbox.stub(utils, 'getNow').returns(new Date(2020, 0o1, 0o1))
    // always stub "core.exportVariable" to avoid polluting actual workflow
    sandbox.stub(core, 'exportVariable').returns()
  })

  context('finds Yarn', function() {
    const pathToYarn = '/path/to/yarn'
    const yarnFilename = path.join(cwd, 'yarn.lock')
    const yarnCachePaths = [path.join(homedir, '.cache', 'yarn')]
    const cacheKey = 'yarn-platform-arch-hash-from-yarn-lock-file'

    beforeEach(function() {
      sandbox
        .stub(core, 'getInput')
        .withArgs('useLockFile')
        .returns()

      sandbox
        .stub(fs, 'existsSync')
        .withArgs(yarnFilename)
        .returns(true)

      sandbox
        .stub(io, 'which')
        .withArgs('yarn')
        .resolves(pathToYarn)

      sandbox
        .stub(hasha, 'fromFileSync')
        .withArgs(yarnFilename)
        .returns('hash-from-yarn-lock-file')

      sandbox
        .stub(exec, 'getExecOutput')
        .withArgs('yarn', ['--version'])
        .resolves({ stdout: '1.22.19' })

      const cacheHit = false
      this.restoreCache = sandbox.stub(cache, 'restoreCache').resolves(cacheHit)
      this.saveCache = sandbox.stub(cache, 'saveCache').resolves()
    })

    it('and uses lock file', async function() {
      await action.npmInstallAction()

      expect(this.restoreCache).to.be.calledOnceWithExactly(
        yarnCachePaths,
        cacheKey,
        [cacheKey]
      )
      expect(this.exec).to.be.calledOnceWithExactly(
        quote(pathToYarn),
        ['--frozen-lockfile'],
        { cwd }
      )
      expect(this.saveCache).to.be.calledOnceWithExactly(
        yarnCachePaths,
        cacheKey
      )
    })
  })

  context('finds Yarn berry', function() {
    const pathToYarn = '/path/to/yarn'
    const yarnFilename = path.join(cwd, 'yarn.lock')
    const yarnCachePaths = [path.join(homedir, '.yarn', 'berry', 'cache')]
    const cacheKey = 'yarn-platform-arch-hash-from-yarn-lock-file'

    beforeEach(function() {
      sandbox
        .stub(core, 'getInput')
        .withArgs('useLockFile')
        .returns()

      sandbox
        .stub(fs, 'existsSync')
        .withArgs(yarnFilename)
        .returns(true)

      sandbox
        .stub(io, 'which')
        .withArgs('yarn')
        .resolves(pathToYarn)

      sandbox
        .stub(hasha, 'fromFileSync')
        .withArgs(yarnFilename)
        .returns('hash-from-yarn-lock-file')

      sandbox
        .stub(exec, 'getExecOutput')
        .withArgs('yarn', ['--version'])
        .resolves({ stdout: '4.2.1' })

      const cacheHit = false
      this.restoreCache = sandbox.stub(cache, 'restoreCache').resolves(cacheHit)
      this.saveCache = sandbox.stub(cache, 'saveCache').resolves()
    })

    it('and uses lock file', async function() {
      await action.npmInstallAction()

      expect(this.restoreCache).to.be.calledOnceWithExactly(
        yarnCachePaths,
        cacheKey,
        [cacheKey]
      )
      expect(this.exec).to.be.calledOnceWithExactly(
        quote(pathToYarn),
        ['--immutable'],
        { cwd }
      )
      expect(this.saveCache).to.be.calledOnceWithExactly(
        yarnCachePaths,
        cacheKey
      )
    })
  })

  context('does not find Yarn and uses NPM', function() {
    const yarnFilename = path.join(cwd, 'yarn.lock')
    const npmShrinkwrapFilename = path.join(cwd, 'npm-shrinkwrap.json')
    const packageLockFilename = path.join(cwd, 'package-lock.json')
    const npmCachePaths = [path.join(homedir, '.npm')]
    const pathToNpm = '/path/to/npm'

    beforeEach(function() {
      sandbox
        .stub(core, 'getInput')
        .withArgs('useLockFile')
        .returns()

      sandbox
        .stub(fs, 'existsSync')
        .withArgs(yarnFilename)
        .returns(false)

      sandbox
        .stub(io, 'which')
        .withArgs('npm')
        .resolves(pathToNpm)

      const cacheHit = false
      this.restoreCache = sandbox.stub(cache, 'restoreCache').resolves(cacheHit)
      this.saveCache = sandbox.stub(cache, 'saveCache').resolves()
    })

    context('finds npm-shrinkwrap.json', async function() {
      const cacheKey = 'npm-platform-arch-hash-from-npm-shrinkwrap-file'

      beforeEach(function() {
        fs.existsSync.withArgs(npmShrinkwrapFilename).returns(true)

        sandbox
          .stub(hasha, 'fromFileSync')
          .withArgs(npmShrinkwrapFilename)
          .returns('hash-from-npm-shrinkwrap-file')
      })

      it('uses npm-shrinkwrap.json and NPM', async function() {
        await action.npmInstallAction()

        expect(this.restoreCache).to.be.calledOnceWithExactly(
          npmCachePaths,
          cacheKey,
          [cacheKey]
        )
        expect(this.exec).to.be.calledOnceWithExactly(
          quote(pathToNpm),
          ['ci'],
          {
            cwd
          }
        )
        expect(this.saveCache).to.be.calledOnceWithExactly(
          npmCachePaths,
          cacheKey
        )
      })
    })

    context('finds package-lock.json', async function() {
      const cacheKey = 'npm-platform-arch-hash-from-package-lock-file'

      beforeEach(function() {
        fs.existsSync.withArgs(npmShrinkwrapFilename).returns(false)

        sandbox
          .stub(hasha, 'fromFileSync')
          .withArgs(packageLockFilename)
          .returns('hash-from-package-lock-file')
      })

      it('uses package-lock.json and NPM', async function() {
        await action.npmInstallAction()

        expect(this.restoreCache).to.be.calledOnceWithExactly(
          npmCachePaths,
          cacheKey,
          [cacheKey]
        )
        expect(this.exec).to.be.calledOnceWithExactly(
          quote(pathToNpm),
          ['ci'],
          {
            cwd
          }
        )
        expect(this.saveCache).to.be.calledOnceWithExactly(
          npmCachePaths,
          cacheKey
        )
      })
    })
  })

  context('useLockFile:0', function() {
    const pathToNpm = '/path/to/npm'
    beforeEach(() => {
      sandbox
        .stub(core, 'getInput')
        .withArgs('useLockFile')
        .returns('0')

      sandbox
        .stub(io, 'which')
        .withArgs('npm')
        .resolves(pathToNpm)

      const filename = path.join(cwd, 'package.json')
      sandbox
        .stub(hasha, 'fromFileSync')
        .withArgs(filename)
        .returns('hash-from-package-json')
    })

    it('hits the cache', async function() {
      const cacheHit = true
      const restoreCache = sandbox
        .stub(utils, 'restoreCachedNpm')
        .resolves(cacheHit)
      const saveCache = sandbox.stub(utils, 'saveCachedNpm')
      await action.npmInstallAction()
      // caching based on the file package.json in the current working directory
      expect(restoreCache).to.have.been.calledOnceWithExactly({
        inputPaths: [path.join(homedir, '.npm')],
        primaryKey: 'npm-platform-arch-hash-from-package-json',
        restoreKeys: ['npm-platform-arch-hash-from-package-json']
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

    it('saves new cache', async function() {
      const cacheHit = false
      const restoreCache = sandbox
        .stub(utils, 'restoreCachedNpm')
        .resolves(cacheHit)
      const saveCache = sandbox.stub(utils, 'saveCachedNpm')
      await action.npmInstallAction()
      // caching based on the file package.json in the current working directory
      const cacheParams = {
        inputPaths: [path.join(homedir, '.npm')],
        primaryKey: 'npm-platform-arch-hash-from-package-json',
        restoreKeys: ['npm-platform-arch-hash-from-package-json']
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

  context('multiple working directories', function() {
    it('iterates over each working directory', async function() {
      // should automatically skip empty subfolders
      sandbox.stub(core, 'getInput').withArgs('working-directory').returns(`
          subfolder/foo
          subfolder/bar

          subfolder/baz
        `)

      const installInOneFolder = sandbox
        .stub(utils, 'installInOneFolder')
        .resolves()
      await action.npmInstallAction()
      expect(installInOneFolder).to.be.calledThrice
      expect(installInOneFolder).to.be.calledWithExactly({
        cachePrefix: '',
        installCommand: undefined,
        usePackageLock: true,
        useRollingCache: false,
        workingDirectory: 'subfolder/foo'
      })
      expect(installInOneFolder).to.be.calledWithExactly({
        cachePrefix: '',
        installCommand: undefined,
        usePackageLock: true,
        useRollingCache: false,
        workingDirectory: 'subfolder/bar'
      })
      expect(installInOneFolder).to.be.calledWithExactly({
        cachePrefix: '',
        installCommand: undefined,
        usePackageLock: true,
        useRollingCache: false,
        workingDirectory: 'subfolder/baz'
      })
    })
  })

  context('with useRollingCache option enabled', function() {
    const pathToYarn = '/path/to/yarn'
    const yarnFilename = path.join(cwd, 'yarn.lock')
    const yarnCachePaths = [path.join(homedir, '.cache', 'yarn')]
    const cacheKey = 'yarn-platform-arch-2020-1-hash-from-yarn-lock-file'

    beforeEach(function() {
      const stub = sandbox.stub(core, 'getInput')
      stub.withArgs('useRollingCache').returns('1')
      stub.withArgs('useLockFile').returns()
      sandbox
        .stub(fs, 'existsSync')
        .withArgs(yarnFilename)
        .returns(true)

      sandbox
        .stub(io, 'which')
        .withArgs('yarn')
        .resolves(pathToYarn)

      sandbox
        .stub(hasha, 'fromFileSync')
        .withArgs(yarnFilename)
        .returns('hash-from-yarn-lock-file')

      sandbox
        .stub(exec, 'getExecOutput')
        .withArgs('yarn', ['--version'])
        .resolves({ stdout: '1.22.19' })

      const cacheHit = false
      this.restoreCache = sandbox.stub(cache, 'restoreCache').resolves(cacheHit)
      this.saveCache = sandbox.stub(cache, 'saveCache').resolves()
    })

    it('finds yarn and uses lock file', async function() {
      await action.npmInstallAction()

      expect(this.restoreCache).to.be.calledOnceWithExactly(
        yarnCachePaths,
        cacheKey,
        [
          'yarn-platform-arch-2020-1-hash-from-yarn-lock-file',
          'yarn-platform-arch-2020-1'
        ]
      )
      expect(this.exec).to.be.calledOnceWithExactly(
        quote(pathToYarn),
        ['--frozen-lockfile'],
        { cwd }
      )
      expect(this.saveCache).to.be.calledOnceWithExactly(
        yarnCachePaths,
        cacheKey
      )
    })
  })

  context('cache failure', function() {
    const pathToNpm = '/path/to/npm'
    beforeEach(() => {
      sandbox
        .stub(core, 'getInput')
        .withArgs('useLockFile')
        .returns('0')

      sandbox
        .stub(io, 'which')
        .withArgs('npm')
        .resolves(pathToNpm)

      const filename = path.join(cwd, 'package.json')
      sandbox
        .stub(hasha, 'fromFileSync')
        .withArgs(filename)
        .returns('hash-from-package-json')
    })

    it('handles restoreCache failure', async function() {
      this.restoreCache = sandbox
        .stub(cache, 'restoreCache')
        .rejects(
          new cache.ReserveCacheError(
            'getCacheEntry failed: Cache service responded with 503'
          )
        )
      const saveCache = sandbox.stub(utils, 'saveCachedNpm')
      await action.npmInstallAction()

      expect(this.exec).to.have.been.calledOnceWithExactly(
        quote(pathToNpm),
        ['install'],
        {
          cwd
        }
      )

      const nonWindowsFailure = {
        inputPaths: ['\\home\\path\\for\\test\\user\\.npm'],
        primaryKey: 'npm-platform-arch-hash-from-package-json',
        restoreKeys: ['npm-platform-arch-hash-from-package-json']
      }
      const windowsFailure = {
        inputPaths: ['/home/path/for/test/user/.npm'],
        primaryKey: 'npm-platform-arch-hash-from-package-json',
        restoreKeys: ['npm-platform-arch-hash-from-package-json']
      }
      const arg = isWindows ? windowsFailure : nonWindowsFailure
      // expect(saveCache, 'cache was hit').to.have.been.calledOnceWithExactly(arg)
      // TODO figure out the CI and paths on different OS
      expect(saveCache, 'cache was hit').to.have.been.calledOnceWith(
        sandbox.match.object
      )
    })

    it('handles saveCache failure', async function() {
      this.restoreCache = sandbox.stub(cache, 'restoreCache').resolves(false)
      this.saveCache = sandbox
        .stub(cache, 'saveCache')
        .rejects(
          new cache.ReserveCacheError(
            'getCacheEntry failed: Cache service responded with 503'
          )
        )
      await action.npmInstallAction()

      expect(this.exec).to.have.been.calledOnceWithExactly(
        quote(pathToNpm),
        ['install'],
        {
          cwd
        }
      )
    })
  })

  context('with cachePrefix', function() {
    const pathToYarn = '/path/to/yarn'
    const yarnFilename = path.join(cwd, 'yarn.lock')
    const yarnCachePaths = [path.join(homedir, '.cache', 'yarn')]
    const cacheKey =
      'yarn-my-cache-prefix-platform-arch-2020-1-hash-from-yarn-lock-file'

    beforeEach(function() {
      const stub = sandbox.stub(core, 'getInput')
      stub.withArgs('cache-key-prefix').returns('my-cache-prefix')
      stub.withArgs('useRollingCache').returns('1')
      stub.withArgs('useLockFile').returns()
      sandbox
        .stub(fs, 'existsSync')
        .withArgs(yarnFilename)
        .returns(true)

      sandbox
        .stub(io, 'which')
        .withArgs('yarn')
        .resolves(pathToYarn)

      sandbox
        .stub(hasha, 'fromFileSync')
        .withArgs(yarnFilename)
        .returns('hash-from-yarn-lock-file')

      sandbox
        .stub(exec, 'getExecOutput')
        .withArgs('yarn', ['--version'])
        .resolves({ stdout: '1.22.19' })

      const cacheHit = false
      this.restoreCache = sandbox.stub(cache, 'restoreCache').resolves(cacheHit)
      this.saveCache = sandbox.stub(cache, 'saveCache').resolves()
    })

    it('finds yarn and uses lock file', async function() {
      await action.npmInstallAction()

      expect(this.restoreCache).to.be.calledOnceWithExactly(
        yarnCachePaths,
        cacheKey,
        [
          'yarn-my-cache-prefix-platform-arch-2020-1-hash-from-yarn-lock-file',
          'yarn-my-cache-prefix-platform-arch-2020-1'
        ]
      )
      expect(this.exec).to.be.calledOnceWithExactly(
        quote(pathToYarn),
        ['--frozen-lockfile'],
        { cwd }
      )
      expect(this.saveCache).to.be.calledOnceWithExactly(
        yarnCachePaths,
        cacheKey
      )
    })
  })
})
