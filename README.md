# npm-install [![semantic-release][semantic-image] ][semantic-url] [![renovate-app badge][renovate-badge]][renovate-app]

> GitHub Action for install npm dependencies with caching without any configuration

## CI

<!-- prettier-ignore-start -->
Example | Status
--- | ---
[main](.github/workflows/main.yml) | ![this repo](https://github.com/bahmutov/npm-install/workflows/main/badge.svg?branch=master)
[basic](.github/workflows/example-basic.yml) | ![basic example](https://github.com/bahmutov/npm-install/workflows/example-basic/badge.svg?branch=master)
[shrinkwrap](.github/workflows/example-shrinkwrap.yml) | ![shrinkwrap example](https://github.com/bahmutov/npm-install/workflows/example-shrinkwrap/badge.svg?branch=master)
[Yarn](.github/workflows/example-yarn.yml) | ![yarn example](https://github.com/bahmutov/npm-install/workflows/example-yarn/badge.svg?branch=master)
[without lock file](.github/workflows/example-without-lock-file.yml) | ![without lockfile example](https://github.com/bahmutov/npm-install/workflows/example-without-lock-file/badge.svg?branch=master)
[subfolders](.github/workflows/example-subfolders.yml) | ![subfolders example](https://github.com/bahmutov/npm-install/workflows/example-subfolders/badge.svg?branch=master)
<!-- prettier-ignore-end -->

## Examples

### Basic

This example should cover 95% of use cases.

If you use `npm ci` or `yarn --frozen-lockfile` on CI to install NPM dependencies - this Action is for you. Simply use it, and your NPM modules will be installed and the folder `~/.npm` or `~/.cache/yarn` will be cached. Typical use:

```yml
name: main
on: [push]
jobs:
  build-and-test:
    runs-on: ubuntu-latest
    name: Build and test
    steps:
      - uses: actions/checkout@v2
      - uses: bahmutov/npm-install@v1
      - run: npm t
```

See [bahmutov/npm-install-action-example](https://github.com/bahmutov/npm-install-action-example) ![npm-install-action-example](https://github.com/bahmutov/npm-install-action-example/workflows/main/badge.svg?branch=master).

### Subfolders

If your repository contains packages in separate folders, install each one separately

```text
repo/
  app1/
    package-lock.json
  app2/
    yarn.json
```

```yml
name: main
on: [push]

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    name: Build and test
    steps:
      - uses: actions/checkout@v2

      - uses: bahmutov/npm-install@v1
        with:
          working-directory: app1
      - uses: bahmutov/npm-install@v1
        with:
          working-directory: app2

      - name: App1 tests
        run: npm t
        working-directory: app1
      - name: Run app2
        run: node .
        working-directory: app2
```

See [npm-install-monorepo-example](https://github.com/bahmutov/npm-install-monorepo-example) ![npm-install-monorepo-example](https://github.com/bahmutov/npm-install-monorepo-example/workflows/main/badge.svg?branch=master).

You can also specify multiple subfolders in a single action; one subfolder per line.

```yml
name: main
on: [push]

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    name: Build and test
    steps:
      - uses: actions/checkout@v2
      - uses: bahmutov/npm-install@v1
        with:
          working-directory: |
            app1
            app2
```

### Use lock file

By default, this action will use a lock file like `package-lock.json`, `npm-shrinkwrap.json` or `yarn.lock`. You can set `useLockFile: false` to use just `package.json` which might be better for [building libraries](https://twitter.com/mikeal/status/1202298796274700288).

```yml
- uses: bahmutov/npm-install@v1
  with:
    useLockFile: false
```

### Use time-based rolling cache

By default, yarn and npm dependencies will be cached according to the exact hash of the lockfile (if enabled) or the `package.json`. This will cause cache misses when the dependencies change, which can be slower than re-installing for big projects. To re-use the cache across runs with different lockfiles/dependencies, you can enable the `useRollingCache` option, which will restore the cache from more keys. It will expire the cache once a month to keep it from growing too large, see the Cache Snowballing & Rolling Cache expiry below.

```yml
- uses: bahmutov/npm-install@v1
  with:
    useRollingCache: true
```

`useRollingCache` is defaulted to false.

### Production dependencies

You can install just the production dependencies (without installing dev dependencies) by setting an environment variable `NODE_ENV` variable

```yml
- uses: bahmutov/npm-install@v1
  env:
    NODE_ENV: production
```

### Custom install command

You can use your own install command

```yml
- uses: bahmutov/npm-install@v1
  with:
    install-command: yarn --frozen-lockfile --silent
```

See [example-install-command.yml](./.github/workflows/example-install-command.yml)

## NPM

If you are writing your own GitHub Action and would like to use this action as a utility function, import it and run it.

```js
const { npmInstallAction } = require('npm-install')
await npmInstallAction()
```

## Debugging

You can see verbose messages from GitHub Actions by setting the following secrets (from [Debugging Actions Guide](https://github.com/actions/toolkit/blob/master/docs/action-debugging.md#step-debug-logs))

```
ACTIONS_RUNNER_DEBUG: true
ACTIONS_STEP_DEBUG: true
```

**Tip:** environment variable `ACTIONS_STEP_DEBUG` enables debug messages from this action itself, try it first.

## Testing

Using Mocha and Sinon.js following the guide [How to set up Mocha with Sinon.js](https://glebbahmutov.com/blog/mocha-and-sinon/). You can find the tests in [test](test) folder. In general:

- all environment inputs are done inside the action, so they can be stubbed and controlled during tests
- there are separate workflows in [.github/workflows](.github/workflows) that match examples. Each workflow uses this action to install dependencies

## Cache Snowballing & Rolling Cache expiry

By default, this action will cache dependencies using an exacty hashs of the lock file (like `package-lock.json`, `npm-shrinkwrap.json` or `yarn.lock`). If you change any dependencies, there will be a cache miss. This is the default cache key strategy to avoid unbounded growth of the cache, as if you don't expire the cache, it will continue being added to. See [this post](https://glebbahmutov.com/blog/do-not-let-npm-cache-snowball/) for more details on this issue.

To get better cache hit rates without the cache size snowballing, you can turn on this action's `useRollingCache` option, which will allow old caches to be re-used when your dependencies change, at the expense of some snowballing. Instead of letting the cache grow forever, this action resets it every month by including the current month in the cache key.

The rule of thumb is this: if re-installing your dependencies doesn't take very long, you can avoid superfluous cache restores by keeping `useRollingCache` off. This is the recommended setup for small projects. For big projects where installing the dependencies takes a long time, and cache restores are faster, `useRollingCache` will provide a performance improvement.

## Links

- [Do Not Let NPM Cache Snowball on CI](https://glebbahmutov.com/blog/do-not-let-npm-cache-snowball/) blog post
- [Trying GitHub Actions](https://glebbahmutov.com/blog/trying-github-actions/) blog post
- [GitHub Actions in Action](https://slides.com/bahmutov/github-actions-in-action) slides

### Small print

Author: Gleb Bahmutov &lt;gleb.bahmutov@gmail.com&gt; &copy; 2019

- [@bahmutov](https://twitter.com/bahmutov)
- [glebbahmutov.com](https://glebbahmutov.com)
- [blog](https://glebbahmutov.com/blog)

License: MIT - do anything with the code, but don't blame me if it does not work.

Support: if you find any problems with this module, email / tweet /
[open issue](https://github.com/bahmutov/npm-install/issues) on Github

## MIT License

Copyright (c) 2019 Gleb Bahmutov &lt;gleb.bahmutov@gmail.com&gt;

Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation
files (the "Software"), to deal in the Software without
restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.

[semantic-image]: https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg
[semantic-url]: https://github.com/semantic-release/semantic-release
[renovate-badge]: https://img.shields.io/badge/renovate-app-blue.svg
[renovate-app]: https://renovateapp.com/
