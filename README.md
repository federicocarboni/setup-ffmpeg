# setup-ffmpeg

Setup FFmpeg in GitHub Actions to use `ffmpeg` and `ffprobe`. The action will download,
cache and add to `PATH` a recent FFmpeg build for the current os.

Only 64-bit Linux, Windows and Mac OS are supported.

## Usage

To use `ffmpeg` and `ffprobe`, run the action before them.

```yml
steps:
  - uses: actions/checkout@v3
  - uses: FedericoCarboni/setup-ffmpeg@v3
    id: setup-ffmpeg
    with:
      # A specific version to download, may also be "release" or a specific version
      # like "6.1.0". At the moment semver specifiers (i.e. >=6.1.0)  are supported
      # only on Windows, on other platforms the version is matched exactly.
      # As of version 3, this action -- by default -- uses the latest release version
      # available for the platform. As upstream sources are not guaranteed to update
      # at the same time, the action may install different versions of ffmpeg for
      # different operating systems, unless a specific version is requested.
      # Default: "release"
      ffmpeg-version: release
      # As of version 3 of this action, builds are no longer downloaded from GitHub
      # except on Windows: https://github.com/GyanD/codexffmpeg/releases.
      # Default: ${{ github.token }}
      github-token: ${{ github.token }}
  - run: ffmpeg -i input.avi output.mkv
```

This action also sets a few outputs:

- `path`: Path to the install directory
- `ffmpeg-path`: Path to the ffmpeg executable
- `ffprobe-path`: Path to the ffprobe executable

## FFmpeg Version

The action downloads builds from the following sources depending on the platform:

- Linux Builds - <https://johnvansickle.com/ffmpeg/>
- Windows Builds - <https://www.gyan.dev/ffmpeg/builds/>
- MacOS Builds - <https://evermeet.cx/ffmpeg/>
