# setup-ffmpeg

This action sets up and caches a specific FFmpeg version, providing the `ffmpeg`
and `ffprobe` commands.

Builds are downloaded from the following sources:

- <https://johnvansickle.com/ffmpeg/> Linux builds
- <https://www.gyan.dev/ffmpeg/builds/> Windows builds
- <https://evermeet.cx/ffmpeg/> MacOS builds

## v3 vs v2

Version 3 of this action downloads binaries directly from the sources listed above
instead of periodically updating GitHub releases. In turn this means it receives
updates more frequently and supports git master builds and selecting a specific
version.

By default the latest release version available for the platform is used. As
upstream sources are not guaranteed to update at the same time, the action may
at times install different versions of ffmpeg for different operating systems,
unless a specific version is requested.

## Usage

See [`action.yml`](./action.yml).

```yml
steps:
  - uses: actions/checkout@v3
  - uses: FedericoCarboni/setup-ffmpeg@v3
    id: setup-ffmpeg
    with:
      # A specific version to download, may also be "release" or a specific version
      # like "6.1.0". At the moment semver specifiers (i.e. >=6.1.0) are supported
      # only on Windows, on other platforms they are allowed but version is matched
      # exactly regardless. On windows, you can append -shared to the version to
      # download shared binaries instead of statically linked ones
      ffmpeg-version: release
      # Target architecture of the ffmpeg executable to install. Defaults to the
      # system architecture. Only x64 and arm64 are supported (arm64 only on Linux).
      architecture: ''
      # As of version 3 of this action, builds are no longer downloaded from GitHub
      # except on Windows: https://github.com/GyanD/codexffmpeg/releases.
      github-token: ${{ github.server_url == 'https://github.com' && github.token || '' }}
  - run: ffmpeg -i input.avi output.mkv
```

### Outputs

- `ffmpeg-version`: Installed version of FFmpeg.
- `ffmpeg-path`: Path to the install directory containing `ffmpeg` and `ffprobe`
binaries.
- `cache-hit`: A boolean value indicating whether the tool cache was hit.
