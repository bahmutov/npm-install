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
  return cache.restoreCache(
    npmCache.inputPaths,
    npmCache.primaryKey,
    npmCache.restoreKeys
  )
}

const saveCachedNpm = npmCache => {
  console.log('saving NPM modules')

  return cache
    .saveCache(npmCache.inputPaths, npmCache.primaryKey)
    .catch(err => {
      // don't throw an error if cache already exists, which may happen due to
      // race conditions
      if (err instanceof cache.ReserveCacheError) {
        console.warn(err.message)
        return -1
      }
      // otherwise re-throw
      throw err
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

      const args = shouldUsePackageLock ? ['--frozen-lockfile'] : []
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

  if (!usePackageLock) {
    return {
      useYarn: false,
      lockFilename: packageFilename
    }
  }

  const yarnFilename = path.join(workingDirectory, 'yarn.lock')
  const useYarn = fs.existsSync(yarnFilename)
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
  useRollingCache,
  homeDirectory,
  npmCacheFolder,
  lockHash
}) => {
  const platformAndArch = api.utils.getPlatformAndArch()
  core.debug(`platform and arch ${platformAndArch}`)
  const primaryKeySegments = [platformAndArch]
  let inputPaths, restoreKeys

  if (useYarn) {
    inputPaths = [path.join(homeDirectory, '.cache', 'yarn')]
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

const installInOneFolder = ({
  usePackageLock,
  workingDirectory,
  useRollingCache,
  installCommand
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

  // enforce the same NPM cache folder across different operating systems
  const homeDirectory = os.homedir()
  const NPM_CACHE_FOLDER = path.join(homeDirectory, '.npm')

  const NPM_CACHE = getCacheParams({
    useYarn: lockInfo.useYarn,
    homeDirectory,
    useRollingCache,
    npmCacheFolder: NPM_CACHE_FOLDER,
    lockHash
  })

  const opts = {
    useYarn: lockInfo.useYarn,
    usePackageLock,
    workingDirectory,
    npmCacheFolder: NPM_CACHE_FOLDER,
    installCommand
  }

  return api.utils.restoreCachedNpm(NPM_CACHE).then(npmCacheHit => {
    console.log('npm cache hit', npmCacheHit)

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
  core.debug(`usePackageLock? ${usePackageLock}`)
  core.debug(`useRollingCache? ${useRollingCache}`)

  // Note: working directory for "actions/exec" should be absolute

  const wds = core.getInput('working-directory') || process.cwd()

  const workingDirectories = wds
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean)

  core.debug(`iterating over working ${workingDirectories.length} folder(s)`)

  const installCommand = core.getInput('install-command')

  for (const workingDirectory of workingDirectories) {
    await api.utils.installInOneFolder({
      usePackageLock,
      useRollingCache,
      workingDirectory,
      installCommand
    })
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
  npmInstallAction()
    .then(() => {
      console.log('all done, exiting')
    })
    .catch(error => {
      console.log(error)
      core.setFailed(error.message)
    })
}
