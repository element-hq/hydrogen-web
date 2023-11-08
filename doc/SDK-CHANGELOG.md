# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [v0.1.8] - 2023-11-08

### Changed

- Pass `sendReadReceipt: false` to RoomViewModel options to disable sending read receipts, see https://github.com/vector-im/hydrogen-web/pull/1150

### Fixed

- Switch over to olm from npm registry, fixes https://github.com/vector-im/hydrogen-web/issues/1146

## [v0.1.7] - 2023-10-08

### Added

- Export many view classes, see https://github.com/vector-im/hydrogen-web/pull/1124.

### Fixed

- Fixed an issue where some UI components were missing in AccountSetupView.

## [v0.1.6] - 2023-08-22

### Changed

- Pass `isReadonly: true` in `Client.startWithAuthData` to disable uploading OTKs. 


## [v0.1.5] - 2023-08-10

### Added

- Export classes MemberList, MemberListView, MemberListViewModel and avatar functions.

### Fixed

- Fixed an issue where `FilteredMap` was not emitting when setting a new filter.


## [v0.1.4] - 2023-07-20

### Added

- Export more classes for the SDK

### Fixed

- Fixed `RoomViewModel.load` not awaiting promise 

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
