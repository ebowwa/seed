# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

#### Bootstrap PATH Configuration for SSH Sessions
- **Issue**: `bun` and other tools installed by the bootstrap script were not available in SSH sessions immediately after setup. Users had to manually source the PATH or reconnect after the bootstrap process completed.
- **Root Cause**: The bootstrap script only exported PATH for the current shell session, which didn't persist for new SSH logins. Interactive shells like SSH sessions don't inherit environment variables from the parent process.
- **Fix**: Modified the bootstrap process to write PATH configuration to `/etc/environment` during the cloud-init bootstrap phase. This ensures that all tools (bun, node-agent, etc.) are immediately available in SSH sessions after the first setup.
- **Implementation Details**:
  - Added `/etc/environment` PATH configuration in both `setup.sh` (lines 89-94) and `v2/src/index.ts` (lines 263-273)
  - The fix checks if `/etc/environment` is writable and if the PATH isn't already configured before adding it
  - Gracefully handles cases where `/etc/environment` doesn't exist or can't be written
- **Impact**: All tools installed during bootstrap are now immediately available upon first SSH login, eliminating the need for manual PATH configuration or reconnection.

### Changed

#### Bun Installation URL
- Updated Bun installation URL from `https://bun.sh/install/install.sh` (which returned 404) to `https://bun.sh/install` (the correct official install script)

## [2.0.0] - 2025-01-XX

### Added
- Initial v2 setup with TypeScript-based configuration
- Node agent for background task management
- Environment-aware tool installation (VPS, Codespaces, local dev)
