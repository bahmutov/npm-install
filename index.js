// @ts-check
const core = require('@actions/core')
const exec = require('@actions/exec')
const io = require('@actions/io')
const hasha = require('hasha')
const { restoreCache, saveCache } = require('cache/lib/index')
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

const usePackageLock = getInputBool('useLockFile', true)
core.debug(`usePackageLock? ${usePackageLock}`)

const workingDirectory = core.getInput('working-directory') || process.cwd()
core.debug(`working directory ${workingDirectory}`)

const packageFilename = path.join(workingDirectory, 'package.json')

const packageLockFilename = path.join(workingDirectory, 'package-lock.json')

const restoreCachedNpm = npmCache => {
  console.log('trying to restore cached NPM modules')
  return restoreCache(
    npmCache.inputPath,
    npmCache.primaryKey,
    npmCache.restoreKeys
  )
}

const saveCachedNpm = npmCache => {
  console.log('saving NPM modules')
  return saveCache(npmCache.inputPath, npmCache.primaryKey)
}

const hasOption = (name, o) => name in o

const getOption = (name, o, defaultValue) =>
  hasOption(name, o) ? o[name] : defaultValue

const install = (opts = {}) => {
  // Note: need to quote found tool to avoid Windows choking on
  // npm paths with spaces like "C:\Program Files\nodejs\npm.cmd ci"

  if (!hasOption('useYarn', opts)) {
    console.error('passed options %o', opts)
    throw new Error('Missing useYarn option')
  }

  const shouldUseYarn = opts.useYarn
  const shouldUsePackageLock = getOption('usePackageLock', opts, usePackageLock)
  const npmCacheFolder = opts.npmCacheFolder
  if (!npmCacheFolder) {
    console.error('passed opts %o', opts)
    throw new Error('Missing npm cache folder to use')
  }

  const options = {
    cwd: getOption('workingDirectory', opts, workingDirectory)
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
    core.exportVariable('npm_config_cache', npmCacheFolder)

    return io.which('npm', true).then(npmPath => {
      console.log('npm at "%s"', npmPath)

      const args = shouldUsePackageLock ? ['ci'] : ['install']
      core.debug(`npm command: "${npmPath}" ${args}`)
      return exec.exec(quote(npmPath), args, options)
    })
  }
}

const npmInstallAction = () => {
  const yarnFilename = path.join(workingDirectory, 'yarn.lock')
  const useYarn = fs.existsSync(yarnFilename)

  const getLockFilename = () => {
    if (!usePackageLock) {
      return packageFilename
    }

    return useYarn ? yarnFilename : packageLockFilename
  }

  const lockFilename = getLockFilename()
  const lockHash = hasha.fromFileSync(lockFilename)
  const platformAndArch = `${process.platform}-${process.arch}`
  core.debug(`lock filename ${lockFilename}`)
  core.debug(`file hash ${lockHash}`)
  core.debug(`platform and arch ${platformAndArch}`)

  // enforce the same NPM cache folder across different operating systems
  const homeDirectory = os.homedir()
  const NPM_CACHE_FOLDER = path.join(homeDirectory, '.npm')

  const NPM_CACHE = (() => {
    const o = {}
    if (useYarn) {
      o.inputPath = path.join(homeDirectory, '.cache', 'yarn')
      o.primaryKey = o.restoreKeys = `yarn-${platformAndArch}-${lockHash}`
    } else {
      o.inputPath = NPM_CACHE_FOLDER
      o.primaryKey = o.restoreKeys = `npm-${platformAndArch}-${lockHash}`
    }
    return o
  })()

  const opts = {
    useYarn,
    npmCacheFolder: NPM_CACHE_FOLDER
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

/**
 * Object of exports, useful to easy testing when mocking individual methods
 */
const api = {
  npmInstallAction,
  // export functions mostly for testing
  utils: {
    restoreCachedNpm,
    install,
    saveCachedNpm
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
