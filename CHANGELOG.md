# Changelog

All notable changes to this project should be documented in this file.

The format is inspired by Keep a Changelog and Semantic Versioning.

## [Unreleased]

### Added
- Ongoing Synology API coverage expansion.

### Changed
- Documentation and release workflow improvements.

---

## [0.32.0] - 2026-03-13

### Added
- New **Synology Storage Manager** node (read-only, `usableAsTool`) with operations:
  - List Storage APIs (`SYNO.Storage*`, `SYNO.Core.Storage*`)
  - List Volumes
  - List Storage Pools
  - List Disks
  - Get Disk Health
  - List RAIDs (best-effort depending on DSM API availability)
- DSM-variant fallback logic for Storage APIs using `callAny` / `callAuto` patterns.

## [0.31.25] - 2026-03-12

### Fixed
- README examples link now uses absolute GitHub URL (`ClawBow`) to avoid npm relative-link confusion.

## [0.31.24] - 2026-03-12

### Changed
- npm package description expanded to reflect broader node/API coverage.
- README synced to npm with updated project status and guidance.

## [0.31.23] - 2026-03-12

### Changed
- GitHub metadata links corrected to `ClawBow`.
- Major sync of latest suite work (FileStation/Chat/security/download station related updates).

## [0.31.22] - 2026-03-11

### Added
- File Station node and Chat v2 operations (see REPORT.md for details).

---

## Notes

- For deep technical release details, see `REPORT.md` and commit history.
- This project is under active development; behavior may vary by DSM version/build.
