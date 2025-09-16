// @ts-check
const core = require('@actions/core')
const exec = require('@actions/exec')
const io = require('@actions/io')
const hasha = require('hasha')
const cache = require('@actions/cache')
const fs = require('fs')
const os = require('os')
const path = require('path')
const quote = require('quote')

/**
 * Grabs a boolean GitHub Action parameter input and casts it.
 * @param {string} name - parameter name
 * @param {boolean} defaultValue - default value to use if the parameter was not specified
 * @returns {boolean} converted input argument or default value
 */
const getInputBool = (name, defaultValue = false) => {
  const param = core.getInput(name)
  if (param === 'true' || param === '1') {
    return true
  }
  if (param === 'false' || param === '0') {
    return false
  }

  return defaultValue
}

const restoreCachedNpm = npmCache => {
  console.log('trying to restore cached NPM modules')
  console.log('cache key %s', npmCache.primaryKey)
  console.log('restore keys %o', npmCache.restoreKeys)
  console.log('input paths %o', npmCache.inputPaths)
  return cache
    .restoreCache(
      npmCache.inputPaths,
      npmCache.primaryKey,
      npmCache.restoreKeys
    )
    .then(cache => {
      if (typeof cache === 'undefined') {
        console.log('npm cache miss')
      } else {
        console.log('npm cache hit key', cache)
      }
      return cache
    })
    .catch(e => {
      console.warn(
        `caught error ${e} retrieving cache, installing from scratch`
      )
    })
}

const saveCachedNpm = npmCache => {
  console.log('saving NPM modules under key %s', npmCache.primaryKey)
  console.log('input paths: %o', npmCache.inputPaths)

  const started = +new Date()
  return cache
    .saveCache(npmCache.inputPaths, npmCache.primaryKey)
    .then(() => {
      const finished = +new Date()
      console.log(
        'npm cache saved for key %s, took %dms',
        npmCache.primaryKey,
        finished - started
      )
    })
    .catch(err => {
      // don't throw an error if cache already exists, which may happen due to
      // race conditions
      if (err instanceof cache.ReserveCacheError) {
        console.warn(err.message)
        return -1
      }

      // do not rethrow here or github actions will break (https://github.com/bahmutov/npm-install/issues/142)
      console.warn(`saving npm cache failed with ${err}, continuing...`)
      console.warn('cache key %s', npmCache.primaryKey)
      console.warn('input paths %o', npmCache.inputPaths)
    })
}

const hasOption = (name, o) => name in o

const install = (opts = {}) => {
  // Note: need to quote found tool to avoid Windows choking on
  // npm paths with spaces like "C:\Program Files\nodejs\npm.cmd ci"

  if (!hasOption('useYarn', opts)) {
    console.error('passed options %o', opts)
    throw new Error('Missing useYarn option')
  }
  if (!hasOption('usePackageLock', opts)) {
    console.error('passed options %o', opts)
    throw new Error('Missing usePackageLock option')
  }
  if (!hasOption('workingDirectory', opts)) {
    console.error('passed options %o', opts)
    throw new Error('Missing workingDirectory option')
  }

  const shouldUseYarn = opts.useYarn
  const shouldUseYarnV1 = opts.useYarnV1 ?? true
  const shouldUsePackageLock = opts.usePackageLock
  const npmCacheFolder = opts.npmCacheFolder
  if (!npmCacheFolder) {
    console.error('passed opts %o', opts)
    throw new Error('Missing npm cache folder to use')
  }

  // set the NPM cache config in case there is custom npm install command
  core.exportVariable('npm_config_cache', npmCacheFolder)

  const options = {
    cwd: path.resolve(opts.workingDirectory)
  }

  if (opts.installCommand) {
    core.debug(`installing using custom command "${opts.installCommand}"`)
    return exec.exec(opts.installCommand, [], options)
  }

  if (shouldUseYarn) {
    console.log('installing NPM dependencies using Yarn')
    return io.which('yarn', true).then(yarnPath => {
      console.log('yarn at "%s"', yarnPath)

      const args = shouldUsePackageLock
        ? [shouldUseYarnV1 ? '--frozen-lockfile' : '--immutable']
        : []
      core.debug(
        `yarn command: "${yarnPath}" ${args} ${JSON.stringify(options)}`
      )
      return exec.exec(quote(yarnPath), args, options)
    })
  } else {
    console.log('installing NPM dependencies')

    return io.which('npm', true).then(npmPath => {
      console.log('npm at "%s"', npmPath)

      const args = shouldUsePackageLock ? ['ci'] : ['install']
      core.debug(`npm command: "${npmPath}" ${args} ${JSON.stringify(options)}`)
      return exec.exec(quote(npmPath), args, options)
    })
  }
}

const getPlatformAndArch = () => `${process.platform}-${process.arch}`
const getNow = () => new Date()

const getLockFilename = usePackageLock => workingDirectory => {
  const packageFilename = path.join(workingDirectory, 'package.json')
  const yarnFilename = path.join(workingDirectory, 'yarn.lock')
  const useYarn = fs.existsSync(yarnFilename)

  if (!usePackageLock) {
    return {
      useYarn,
      lockFilename: packageFilename
    }
  }

  core.debug(`yarn lock file "${yarnFilename}" exists? ${useYarn}`)

  const npmShrinkwrapFilename = path.join(
    workingDirectory,
    'npm-shrinkwrap.json'
  )
  const packageLockFilename = path.join(workingDirectory, 'package-lock.json')
  const npmFilename =
    !useYarn && fs.existsSync(npmShrinkwrapFilename)
      ? npmShrinkwrapFilename
      : packageLockFilename

  const result = {
    useYarn,
    lockFilename: useYarn ? yarnFilename : npmFilename
  }
  return result
}

const getCacheParams = ({
  useYarn,
  useYarnV1,
  useRollingCache,
  homeDirectory,
  npmCacheFolder,
  lockHash,
  cachePrefix
}) => {
  const platformAndArch = api.utils.getPlatformAndArch()
  core.debug(`platform and arch ${platformAndArch}`)
  const primaryKeySegments = [platformAndArch]

  if (cachePrefix) {
    primaryKeySegments.unshift(cachePrefix)
  }

  let inputPaths, restoreKeys

  if (useYarn) {
    inputPaths = useYarnV1
      ? [path.join(homeDirectory, '.cache', 'yarn')]
      : [path.join(homeDirectory, '.yarn', 'berry', 'cache')]
    primaryKeySegments.unshift('yarn')
  } else {
    inputPaths = [npmCacheFolder]
    primaryKeySegments.unshift('npm')
  }

  if (useRollingCache) {
    const now = api.utils.getNow()
    primaryKeySegments.push(
      String(now.getFullYear()),
      String(now.getMonth()),
      lockHash
    )
    restoreKeys = [
      primaryKeySegments.join('-'),
      primaryKeySegments.slice(0, -1).join('-')
    ]
  } else {
    primaryKeySegments.push(lockHash)
    restoreKeys = [primaryKeySegments.join('-')]
  }

  return { primaryKey: primaryKeySegments.join('-'), inputPaths, restoreKeys }
}

const installInOneFolder = async ({
  usePackageLock,
  workingDirectory,
  useRollingCache,
  installCommand,
  cachePrefix
}) => {
  core.debug(`usePackageLock? ${usePackageLock}`)
  core.debug(`working directory ${workingDirectory}`)

  const lockInfo = getLockFilename(usePackageLock)(workingDirectory)
  const lockHash = hasha.fromFileSync(lockInfo.lockFilename)
  if (!lockHash) {
    throw new Error(
      `could not compute hash from file "${lockInfo.lockFilename}"`
    )
  }
  core.debug(`lock filename ${lockInfo.lockFilename}`)
  core.debug(`file hash ${lockHash}`)

  // if the user provided a custom command like "npm ...", then we cannot
  // use Yarn cache paths
  let useYarn = lockInfo.useYarn
  if (useYarn && installCommand && installCommand.startsWith('npm')) {
    core.debug('using NPM command, not using Yarn cache paths')
    useYarn = false
  }
  let useYarnV1 = true
  if (useYarn) {
    const { stdout: yarnVersion } = await exec.getExecOutput('yarn', [
      '--version'
    ])
    useYarnV1 = /^1/.test(yarnVersion)
  }

  // enforce the same NPM cache folder across different operating systems
  const homeDirectory = os.homedir()
  const NPM_CACHE_FOLDER = path.join(homeDirectory, '.npm')

  const NPM_CACHE = getCacheParams({
    useYarn,
    useYarnV1,
    homeDirectory,
    useRollingCache,
    npmCacheFolder: NPM_CACHE_FOLDER,
    lockHash,
    cachePrefix
  })

  const opts = {
    useYarn,
    useYarnV1,
    usePackageLock,
    workingDirectory,
    npmCacheFolder: NPM_CACHE_FOLDER,
    installCommand
  }

  return api.utils.restoreCachedNpm(NPM_CACHE).then(npmCacheHit => {
    return api.utils.install(opts).then(() => {
      if (npmCacheHit) {
        return
      }

      return api.utils.saveCachedNpm(NPM_CACHE)
    })
  })
}

const npmInstallAction = async () => {
  const usePackageLock = getInputBool('useLockFile', true)
  const useRollingCache = getInputBool('useRollingCache', false)
  const cachePrefix = core.getInput('cache-key-prefix') || ''
  core.debug(`usePackageLock? ${usePackageLock}`)
  core.debug(`useRollingCache? ${useRollingCache}`)
  core.debug(`cache prefix "${cachePrefix}"`)

  // Note: working directory for "actions/exec" should be absolute

  const wds = core.getInput('working-directory') || process.cwd()

  const workingDirectories = wds
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean)

  core.debug(`iterating over working ${workingDirectories.length} folder(s)`)

  const installCommand = core.getInput('install-command')

  try {
    for (const workingDirectory of workingDirectories) {
      const started = +new Date()
      await api.utils.installInOneFolder({
        usePackageLock,
        useRollingCache,
        workingDirectory,
        installCommand,
        cachePrefix
      })

      const finished = +new Date()
      core.debug(
        `installing in ${workingDirectory} took ${finished - started}ms`
      )
    }

    // node will stay alive if any promises are not resolved,
    // which is a possibility if HTTP requests are dangling
    // due to retries or timeouts. We know that if we got here
    // that all promises that we care about have successfully
    // resolved, so simply exit with success.
    // From: https://github.com/actions/cache/blob/a2ed59d39b352305bdd2f628719a53b2cc4f9613/src/saveImpl.ts#L96
    if (process.env.NODE_ENV !== 'test') {
      process.exit(0)
    } else {
      core.debug('skip process.exit(0) in test mode')
    }
  } catch (err) {
    console.error(err)
    core.setFailed(err.message)
    process.exit(1)
  }
}

/**
 * Object of exports, useful to easy testing when mocking individual methods
 */
const api = {
  npmInstallAction,
  // export functions mostly for testing
  utils: {
    restoreCachedNpm,
    install,
    saveCachedNpm,
    getPlatformAndArch,
    getNow,
    installInOneFolder
  }
}

module.exports = api

// @ts-ignore
if (!module.parent) {
  console.log('running npm-install GitHub Action')
  const started = +new Date()
  npmInstallAction()
    .then(() => {
      console.log('all done, exiting')
      const finished = +new Date()
      core.debug(`npm-install took ${finished - started}ms`)
    })
    .catch(error => {
      console.log(error)
      core.setFailed(error.message)
    })
}
