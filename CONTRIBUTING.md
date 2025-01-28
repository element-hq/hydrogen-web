# Contributing code to hydrogen-web

Everyone is welcome to contribute code to hydrogen-web, provided that they are willing to
license their contributions to Element under a Contributor License Agreement (CLA).
This ensures that their contribution will be made available under an approved licence as described in our [Readme](/README.md#copyright--license)

## How to contribute

The preferred and easiest way to contribute changes to the project is to fork
it on github, and then create a pull request to ask us to pull your changes
into our repo (https://help.github.com/articles/using-pull-requests/)

We use GitHub's pull request workflow to review the contribution, and either
ask you to make any refinements needed or merge it and make them ourselves.

Things that should go into your PR description:
 * References to any bugs fixed by the change (in GitHub's `Fixes` notation)
 * Describe the why and what is changing in the PR description so it's easy for
   onlookers and reviewers to onboard and context switch.
 * If your PR makes visual changes, include both **before** and **after** screenshots
   to easily compare and discuss what's changing.
 * Include a step-by-step testing strategy so that a reviewer can check out the
   code locally and easily get to the point of testing your change.
 * Add comments to the diff for the reviewer that might help them to understand
   why the change is necessary or how they might better understand and review it.

We use continuous integration, and all pull requests get automatically tested:
if your change breaks the build, then the PR will show that there are failed
checks, so please check back after a few minutes.

Tests
-----
If your PR is a feature then we require that the PR also includes tests.
These need to test that your feature works as expected and ideally test edge cases too.

Tests are written as unit tests by exporting a `tests` function from the file to be tested.
The function returns an object where the key is the test label, and the value is a 
function that accepts an [assert](https://nodejs.org/api/assert.html) object, and return a Promise or nothing.

Note that there is currently a limitation that files that are not indirectly included from `src/platform/web/main.js` won't be found by the runner.

You can run the tests by running `yarn test`.
This uses the [impunity](https://github.com/bwindels/impunity) runner.

We don't require tests for bug fixes.

In the future we may formalise this more.

Code style
----------
The js-sdk aims to target TypeScript/ES6. All new files should be written in
TypeScript and existing files should use ES6 principles where possible.

Please disable any automatic formatting tools you may have active.
If present, you'll be asked to undo any unrelated whitespace changes during code review.

Members should not be exported as a default export in general.
In general, avoid using `export default`.

The remaining code-style for hydrogen is [in the process of being documented](codestyle.md), but
contributors are encouraged to read the
[code style document for matrix-react-sdk](https://github.com/matrix-org/matrix-react-sdk/blob/master/code_style.md)
and follow the principles set out there.

Please ensure your changes match the cosmetic style of the existing project,
and ***never*** mix cosmetic and functional changes in the same commit, as it
makes it horribly hard to review otherwise.

Attribution
-----------
If you change or create a file, feel free to add yourself to the copyright holders
in the license header of that file.

Sign off
--------
In order to have a concrete record that your contribution is intentional
and you agree to license it under the same terms as the project's license, we've
adopted the same lightweight approach that the Linux Kernel
(https://www.kernel.org/doc/Documentation/SubmittingPatches), Docker
(https://github.com/docker/docker/blob/master/CONTRIBUTING.md), and many other
projects use: the DCO (Developer Certificate of Origin:
http://developercertificate.org/). This is a simple declaration that you wrote
the contribution or otherwise have the right to contribute it to Matrix:

```
Developer Certificate of Origin
Version 1.1

Copyright (C) 2004, 2006 The Linux Foundation and its contributors.
660 York Street, Suite 102,
San Francisco, CA 94110 USA

Everyone is permitted to copy and distribute verbatim copies of this
license document, but changing it is not allowed.

Developer's Certificate of Origin 1.1

By making a contribution to this project, I certify that:

(a) The contribution was created in whole or in part by me and I
    have the right to submit it under the open source license
    indicated in the file; or

(b) The contribution is based upon previous work that, to the best
    of my knowledge, is covered under an appropriate open source
    license and I have the right under that license to submit that
    work with modifications, whether created in whole or in part
    by me, under the same open source license (unless I am
    permitted to submit under a different license), as indicated
    in the file; or

(c) The contribution was provided directly to me by some other
    person who certified (a), (b) or (c) and I have not modified
    it.

(d) I understand and agree that this project and the contribution
    are public and that a record of the contribution (including all
    personal information I submit with it, including my sign-off) is
    maintained indefinitely and may be redistributed consistent with
    this project or the open source license(s) involved.
```

If you agree to this for your contribution, then all that's needed is to
include the line in your commit or pull request comment:

```
Signed-off-by: Your Name <your@email.example.org>
```

We accept contributions under a legally identifiable name, such as your name on
government documentation or common-law names (names claimed by legitimate usage
or repute). Unfortunately, we cannot accept anonymous contributions at this
time.

Git allows you to add this signoff automatically when using the `-s` flag to
`git commit`, which uses the name and email set in your `user.name` and
`user.email` git configs.

If you forgot to sign off your commits before making your pull request and are
on Git 2.17+ you can mass signoff using rebase:

```
git rebase --signoff origin/develop
```
