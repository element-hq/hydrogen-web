# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [v0.1.3] - 2023-05-11

### Added

- Added `Copy matrix.to permalink` option to message action

### Fixed

- Fix an issue where keys for encrypted messages sent from Hydrogen was not shared leading to UTDs.
- Fix documentation which failed to mention that `FeatureSet` needs to be passed into view models.
- Mention how to add `libolm` as dependency in the tutorial.
- Fix an issue where large log files were generated for long lived calls.
- Fix an issue which prevented the SDK from being used without encryption.


### Changed

- Long dates in sticky date headers are now rendered in a single line
