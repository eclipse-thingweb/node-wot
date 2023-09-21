# Contributing to Eclipse Thingweb

Thanks for your interest in this project. General information
regarding source code management, builds, coding standards, and
more can be found here:

-   https://projects.eclipse.org/projects/iot.thingweb/developer

## Legal Requirements

Thingweb is an [Eclipse IoT](https://iot.eclipse.org) project and as such is governed by the Eclipse Development process.
This process helps us in creating great open source software within a safe legal framework.

Thus, before your contribution can be accepted by the project team, contributors must electronically sign the [Eclipse Contributor Agreement (ECA)](http://www.eclipse.org/legal/ECA.php) and follow these preliminary steps:

-   Obtain an [Eclipse Foundation account](https://accounts.eclipse.org/)
    -   Anyone who currently uses Eclipse Bugzilla or Gerrit systems already has one of those
    -   Newcomers can [create a new account](https://accounts.eclipse.org/user/register?destination=user)
-   Add your GiHub username to your Eclipse Foundation account
    -   ([Log into Eclipse](https://accounts.eclipse.org/))
    -   Go to the _Edit Profile_ tab
    -   Fill in the _GitHub ID_ under _Social Media Links_ and save
-   Sign the [Eclipse Contributor Agreement](http://www.eclipse.org/legal/ECA.php)
    -   ([Log into Eclipse](https://accounts.eclipse.org/))
    -   If the _Status_ entry _Eclipse Contributor Agreement_ has a green checkmark, the ECA is already signed
    -   If not, go to the _Eclipse Contributor Agreement_ tab or follow the corresponding link under _Status_
    -   Fill out the form and sign it electronically
-   Sign-off every commit using the same email address used for your Eclipse account
    -   Set the Git user email address with `git config user.email "<your Eclipse account email>"`
    -   Add the `-s` flag when you make the commit(s), e.g. `git commit -s -m "feat: add support for magic"`
-   Open a [Pull Request](https://github.com/eclipse-thingweb/node-wot/pulls)

For more information, please see the Eclipse Committer Handbook:
https://www.eclipse.org/projects/handbook/#resources-commit

## Adding a New Protocol Binding

In order to add support for a new protocol binding, you need to implement the protocol interfaces defined in the `core` package.
For the protocol to be usable via a `ConsumedThing` object, you need to implement the `ProtocolClientFactory` and the `ProtocolClient` interfaces.
For the protocol to be usable via an `ExposedThing` object, you need to implement the `ProtocolServer` interface.
The resulting `ProtocolClientFactory` and `ProtocolServer` implementations can then be used to enhance a given `Servient` with support for the protocol in question.

<!-- TODO: Add more instructions and guidelines -->

In the following, we will give a couple of guidelines and examples for how to add specific features (such as logging) to your protocol binding implementation, keeping it consistent with the already existing packages.

### Starting a New Binding Implementation

`node-wot` is structured as a mono repo with a separate package (or "workspace") for each binding.
If you want to add a new package for a protocol called `foo`, you can use the following command for initialization in the repository's top-level directory:

```sh
npm init -w ./packages/binding-foo
```

Since node-wot uses a single lock file (`package-lock.json`) for tracking all packages' dependencies, adding a new dependency to your binding also requires you to run the `npm install` command with the `-w` option.
For instance, if you need the `foobaz` package to implement your protocol binding, you can install it like so:

```sh
npm install foobaz -w ./packages/binding-foo
```

In order to support linting and typescript transpilation, you should add both an `.eslintrc.json` and a `tsconfig.json` file to your package.
Examples for these can be found in the already existing binding packages.

<!-- TODO: Mention npm scripts -->

### Adding Logging Functionality

Please use the `createLoggers` function from the `core` package for adding logging functionality to your package.
The function accepts an arbitrary number of arguments that will be mapped to `debug` namespaces.
In the example below, the `createLoggers` function will map its arguments `binding-foo` and `foo-server` to the namespace `node-wot:binding-foo:foo-server`.
The resulting functions `debug`, `info`, `warn`, and `error` will append their log-level to this namespace when creating the actual log message.
This enables filtering as described in the `README` section on logging.

```ts
import { createLoggers } from "@node-wot/core";
const { debug, info, warn, error } = createLoggers("binding-foo", "foo-server");

function startFoo() {
    info("This is an info message!");
    debug("This is a debug message!");
    warn("This is a warn message!");
    error("This is an error message!");
}
```
### Checking for `undefined` or `null`

In node-wot, we enabled [strict boolean expressions](https://typescript-eslint.io/rules/strict-boolean-expressions/). In summary, this means that in the 
the code base is not allowed to use non-boolean expressions where a boolean is expected (see the [examples](https://typescript-eslint.io/rules/strict-boolean-expressions/#examples)). 
How then should the contributor deal with nullable variables? For example:
```ts
function(arg1: string | null | undefined) {
    // ERROR: not allowed by strict-boolean-expressions 
    if(!arg) { throw new Error("arg should be defined!))}
}
```
Instead of checking for both null and `undefiend` values (`if(arg !== undefined && arg !== null)`) the preferred solution is to use `!=` or `==` operator. Interestingly in JavaScript 
with ==, null and undefined are only equal to each other. Example:
```ts
function(arg1: string | null | undefined) {
    // OK
    if(arg == null) { throw new Error("arg should be defined!))}
}
```

Further reading on the motivations can be found [here](https://basarat.gitbook.io/typescript/recap/null-undefined#checking-for-either). 

## Commits

Eclipse Thingweb uses Conventional Changelog, which structure Git commit messages in a way that allows automatic generation of changelogs.
Commit messages must be structured as follows:

```
<type>(<scope>): <subject>
<BLANK LINE>
<body>
<BLANK LINE>
<footer>
```

-   `<type>`: A noun specifying the type of change, followed by a colon and a space. The types allowed are:
    -   `feat`: A new feature
    -   `fix`: A bug fix
    -   `refactor`: Code change that neither fixes a bug or adds a feature (not relevant for end user)
    -   `perf`: Change improves performance
    -   `style`: Change does not affect the code (e.g., formatting, whitespaces)
    -   `test`: Adding missing tests
    -   `chore`: Change of build process or auxiliary tools
    -   `docs`: Documentation only changes
-   `<scope>`: Optional. A term of free choice specifying the place of the commit change, enclosed in parentheses. Examples:
    -   `feat(binding-coap): ...`
    -   `fix(cli): ...`
    -   `docs: ...` (no scope, as it is optional)
-   `<subject>`: A succinct description of the change, e.g., `add support for magic`
    -   Use the imperative, present tense: "add", not "added" nor "adds"
    -   Do not capitalize first letter: "add", not "Add"
    -   No dot (.) at the end
-   `<body>`: Optional. Can include the motivation for the change and contrast this with previous behavior.
    -   Just as in the subject, use the imperative, present tense: "change" not "changed" nor "changes"
-   `<footer>`: Optional. Can be used to automatically close GitHub Issues and to document breaking changes.
    -   The prefix `BREAKING CHANGE: ` idicates API breakage (corresponding to a major version change) and everything after is a description what changed and what needs to be done to migrate
    -   GitHub Issue controls such as `Fixes #123` or `Closes #4711` must come before a potential `BREAKING CHANGE: `.

Examples:

```
docs: improve how to contribute
```

```
feat(core): add support for magic

Closes #110
```

```
feat(core): add support for magic

Simplify the API by reducing the number of functions.

Closes #110
BREAKING CHANGE: Change all calls to the API to the new `do()` function.
```

## Coding Style

Eclipse Thingweb uses `eslint` and `prettier` to enforce a consistent coding style.
A Github Actions workflow checks for each Pull Request if the coding style is followed and creates annotations in the "files changed" tab for each warning that is emitted during this linting process.
To avoid such warnings, please use `npm run lint` for linting your code and `npm run format` to automatically apply fixes before committing any changes.

## Pull Requests and Feature Branches

-   Do not merge with master while developing a new feature or providing a fix in a new branch
-   Do a rebase if updates in the master such as a fix are required:

```
git checkout master && git pull && git checkout - && git rebase master
```

-   Pull Requests are merged using rebase

## Contact

Contact the project developers via the project's "dev" list.

-   https://dev.eclipse.org/mailman/listinfo/thingweb-dev
