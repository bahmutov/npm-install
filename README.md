# npm-install [![semantic-release][semantic-image] ][semantic-url]

> GitHub Action for install npm dependencies with caching without any configuration

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
      - uses: actions/checkout@v1
      - uses: bahmutov/npm-install@v1
      - run: npm t
```

See [bahmutov/npm-install-action-example](https://github.com/bahmutov/npm-install-action-example).

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
      - uses: actions/checkout@v1

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

See [npm-install-monorepo-example](https://github.com/bahmutov/npm-install-monorepo-example).

### Use lock file

By default, this action will use a lock file like `package-lock.json` or `yarn.lock`. You can set `useLockFile: false` to use just `package.json` which might be better for [building libraries](https://twitter.com/mikeal/status/1202298796274700288).

```yml
- uses: bahmutov/npm-install@v1
  with:
    useLockFile: false
```

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

## Links

- [Trying GitHub Actions](https://glebbahmutov.com/blog/trying-github-actions/) blog post

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
