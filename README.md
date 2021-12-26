# setup-ffmpeg
Setup FFmpeg in GitHub Actions to use `ffmpeg` and `ffprobe`. The action will download, cache and
add to `PATH` a recent FFmpeg build for the current os.

# Usage
To use `ffmpeg` and `ffprobe`, run the action before them.

```yml
steps:
  - uses: actions/checkout@v2
  - uses: FedericoCarboni/setup-ffmpeg@v1
    id: setup-ffmpeg
  - run: ffmpeg -i input.avi output.mkv
```

This action also sets a few outputs:
 - `path`: Path to the install directory
 - `ffmpeg-path`: Path to the ffmpeg executable
 - `ffprobe-path`: Path to the ffprobe executable

# FFmpeg Version
The action uses a recent FFmpeg build provided by the following sources:
 - Linux Builds - https://johnvansickle.com/ffmpeg/
 - Windows Builds - https://www.gyan.dev/ffmpeg/builds/
 - MacOS Builds - https://evermeet.cx/ffmpeg/

**Note:** This action only supports x64 operating systems.
