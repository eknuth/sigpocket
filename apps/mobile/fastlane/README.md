fastlane documentation
----

# Installation

Make sure you have the latest version of the Xcode command line tools installed:

```sh
xcode-select --install
```

For _fastlane_ installation instructions, see [Installing _fastlane_](https://docs.fastlane.tools/#installing-fastlane)

# Available Actions

## iOS

### ios set_pricing

```sh
[bundle exec] fastlane ios set_pricing
```

Set pricing to free using the appPriceSchedules API

### ios submit_review

```sh
[bundle exec] fastlane ios submit_review
```

Manually submit the existing reviewSubmission to Apple

### ios inspect

```sh
[bundle exec] fastlane ios inspect
```

Inspect current state and any issues blocking submission

### ios set_privacy

```sh
[bundle exec] fastlane ios set_privacy
```

Publish App Privacy answers (no data collected)

### ios upload_metadata

```sh
[bundle exec] fastlane ios upload_metadata
```

Upload metadata and screenshots to App Store Connect

### ios submit

```sh
[bundle exec] fastlane ios submit
```

Find the latest TestFlight build and submit it for App Review

----

This README.md is auto-generated and will be re-generated every time [_fastlane_](https://fastlane.tools) is run.

More information about _fastlane_ can be found on [fastlane.tools](https://fastlane.tools).

The documentation of _fastlane_ can be found on [docs.fastlane.tools](https://docs.fastlane.tools).
