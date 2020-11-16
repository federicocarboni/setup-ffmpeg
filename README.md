# setup-ffmpeg
Setup FFmpeg in GitHub Actions to use `ffmpeg` and `ffprobe`.

# Usage

```yml
steps:
  - uses: actions/checkout@v2
  - uses: FedericoCarboni/setup-ffmpeg@v1-alpha
    id: setup-ffmpeg
  - run: ffmpeg -i input.avi output.mkv
```

# FFmpeg Version
This action uses FFmpeg builds provided by the following sources:
 - linux builds https://johnvansickle.com/ffmpeg/
 - windows builds https://www.gyan.dev/ffmpeg/builds/
