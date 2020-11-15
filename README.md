# setup-ffmpeg
This action sets up FFmpeg by:
 - downloading and caching the latest FFmpeg release
 - adding `ffmpeg` and `ffprobe` to `PATH` and setting
 - setting `path`, `ffmpeg-path` and `ffprobe-path` in its step's output

# Usage



```yml
steps:
  - uses: actions/checkout@v2
  - uses: FedericoCarboni/setup-ffmpeg@v1-alpha
    id: setup-ffmpeg
  - run: ffmpeg -i input.avi output.mkv
```

# FFmpeg Version
This action uses the latest FFmpeg releases from the following sources:
 - on linux https://johnvansickle.com/ffmpeg/
 - on windows https://www.gyan.dev/ffmpeg/builds/
