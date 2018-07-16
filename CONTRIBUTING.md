# Contributing to Eclipse Thingweb

Thanks for your interest in this project. General information
regarding source code management, builds, coding standards, and
more can be found here:

* https://projects.eclipse.org/projects/iot.thingweb/developer

## Legal Requirements

Thingweb is an [Eclipse IoT](https://iot.eclipse.org) project and as such is governed by the Eclipse Development process.
This process helps us in creating great open source software within a safe legal framework.

Thus, before your contribution can be accepted by the project team, contributors must electronically sign the [Eclipse Contributor Agreement (ECA)](http://www.eclipse.org/legal/ECA.php) and follow these preliminary steps:

* Obtain an [Eclipse Foundation account](https://accounts.eclipse.org/)
   * Anyone who currently uses Eclipse Bugzilla or Gerrit systems already has one of those
   * Newcomers can [create a new account](https://accounts.eclipse.org/user/register?destination=user)
* Add your GiHub username to your Eclipse Foundation account
  * ([Log into Eclipse](https://accounts.eclipse.org/))
  * Go to the *Edit Profile* tab
  * Fill in the *GitHub ID* under *Social Media Links* and save
* Sign the [Eclipse Contributor Agreement](http://www.eclipse.org/legal/ECA.php)
  * ([Log into Eclipse](https://accounts.eclipse.org/))
  * If the *Status* entry *Eclipse Contributor Agreement* has a green checkmark, the ECA is already signed
  * If not, go to the *Eclipse Contributor Agreement* tab or follow the corresponding link under *Status*
  * Fill out the form and sign it electronically
* Sign-off every commit using the same email address used for your Eclipse account
  * Set the Git user email address with `git config user.email "<your Eclipse account email>"`
  * Add the `-s` flag when you make the commit(s), e.g. `git commit -s -m "feat: add support for magic"`
* Open a [Pull Request](https://github.com/eclipse/thingweb.node-wot/pulls)

For more information, please see the Eclipse Committer Handbook:
https://www.eclipse.org/projects/handbook/#resources-commit

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

* `<type>`: A noun specifying the type of change, followed by a colon and a space. The types allowed are:
   * `feat`: A new feature
   * `fix`: A bug fix
   * `refactor`: Code change that neither fixes a bug or adds a feature (not relevant for end user)
   * `perf`: Change improves performance
   * `style`: Change does not affect the code (e.g., formatting, whitespaces)
   * `test`: Adding missing tests
   * `chore`: Change of build process or auxiliary tools
   * `docs`: Documentation only changes
* `<scope>`: Optional. A term of free choice specifying the place of the commit change, enclosed in parentheses. Examples:
   * `feat(binding-coap): ...`
   * `fix(cli): ...`
   * `docs: ...` (no scope, as it is optional)
* `<subject>`: A succinct description of the change, e.g., `add support for magic`
   * Use the imperative, present tense: "add", not "added" nor "adds"
   * Do not capitalize first letter: "add", not "Add"
   * No dot (.) at the end
* `<body>`: Optional. Can include the motivation for the change and contrast this with previous behavior.
   * Just as in the subject, use the imperative, present tense: "change" not "changed" nor "changes"
* `<footer>`: Optional. Can be used to automatically close GitHub Issues and to document breaking changes.
   * The prefix `BREAKING CHANGE: ` idicates API breakage (corresponding to a major version change) and everything after is a description what changed and what needs to be done to migrate
   * GitHub Issue controls such as `Fixes #123` or `Closes #4711` must come before a potential `BREAKING CHANGE: `.

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

## Pull Requests and Feature Branches

* Do not merge with master while developing a new feature or providing a fix in a new branch
* Do a rebase if updates in the master such as a fix are required:
```
git checkout master && git pull && git checkout - && git rebase master
```
* Pull Requests are merged using rebase

## Contact

Contact the project developers via the project's "dev" list.

* https://dev.eclipse.org/mailman/listinfo/thingweb-dev
