# setup-ffmpeg

This action sets up and caches a specific FFmpeg version, providing the `ffmpeg`
and `ffprobe` commands.

> **Suno fork.** Upstream downloads Linux builds live from
> `johnvansickle.com`, which is frequently down or throttles CI and made this
> action flaky. This fork instead serves Linux builds from **this repo's GitHub
> Releases** (reliable, on GitHub's CDN, authenticated by the workflow token).
> Windows and macOS paths are unchanged from upstream. See
> [`src/dists/sunorelease.js`](./src/dists/sunorelease.js) and
> [Publishing a Linux build](#publishing-a-linux-build-suno-fork) below.

Builds are downloaded from the following sources:

- **Linux builds: this repo's GitHub Releases** (re-hosted static
  `johnvansickle.com` builds)
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
      # exactly regardless.
      ffmpeg-version: release
      # Target architecture of the ffmpeg executable to install. Defaults to the
      # system architecture. Only x64 and arm64 are supported (arm64 only on Linux).
      architecture: ''
      # Linking type of the binaries. Use "shared" to download shared binaries and 
      # "static" for statically linked ones. Shared builds are currently only available
      # for windows releases. Defaults to "static"
      linking-type: static
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

## Publishing a Linux build (Suno fork)

Linux builds are served from this repo's GitHub Releases. Each release:

- is tagged `ffmpeg-<version>` (e.g. `ffmpeg-7.0.2`), and
- carries one asset per architecture named
  `ffmpeg-<version>-<arch>-static.tar.xz`, where `<arch>` is `amd64` or `arm64`.

The assets are the **unmodified** `johnvansickle.com` static tarballs, so the
action extracts them exactly like upstream.

**Version tracking.** `ffmpeg-version: release` (or `latest`) resolves to the
highest semver among published `ffmpeg-*` releases. Publishing a newer release
makes every "latest" pipeline pick it up automatically — no change to the
pinned action SHA is needed. Pinning `ffmpeg-version: '7.0.2'` selects that
specific release.

To publish a new Linux build (requires write access to this repo):

```bash
# 1. Find the current upstream release version
VERSION=$(curl -fsSL https://johnvansickle.com/ffmpeg/release-readme.txt \
  | sed -n 's/^ *version: *//p' | head -1)

# 2. Download the static build(s) you want to host
curl -fL -o "ffmpeg-${VERSION}-amd64-static.tar.xz" \
  https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz
# (optional) arm64:
# curl -fL -o "ffmpeg-${VERSION}-arm64-static.tar.xz" \
#   https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-arm64-static.tar.xz

# 3. Create the release and upload the asset(s)
gh release create "ffmpeg-${VERSION}" \
  --repo suno-ai/setup-ffmpeg \
  --title "ffmpeg ${VERSION}" \
  --notes "Static ffmpeg ${VERSION} (re-hosted johnvansickle.com build) for CI." \
  "ffmpeg-${VERSION}-amd64-static.tar.xz"
```

The script [`scripts/publish-linux-build.sh`](./scripts/publish-linux-build.sh)
does all of the above.
