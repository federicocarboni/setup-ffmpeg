import * as assert from 'assert';
import * as path from 'path';
import {readdir} from 'fs/promises';

import * as tc from '@actions/tool-cache';
import * as core from '@actions/core';
import * as semver from 'semver';
import {Octokit} from '@octokit/core';

import {normalizeVersion} from '../util.js';

// Suno fork: instead of fetching Linux builds live from johnvansickle.com (which
// is frequently down or throttles CI), we re-host the static builds as GitHub
// Release assets on this repo. GitHub's CDN is reliable and authenticated by the
// workflow token. Each release is tagged `ffmpeg-<version>` (e.g. `ffmpeg-7.0.2`)
// and carries one asset per architecture named
// `ffmpeg-<version>-<arch>-static.tar.xz` (arch is `amd64` or `arm64`). The
// tarballs are the unmodified johnvansickle static builds, so extraction is
// identical to upstream.
//
// Version tracking: `ffmpeg-version: release` (or `latest`) resolves to the
// highest semver among published releases, so publishing a newer release makes
// every "latest" pipeline pick it up with no action/code change. A pinned
// version (e.g. `7.0.2`) selects the matching release.
const RELEASE_OWNER = 'suno-ai';
const RELEASE_REPO = 'setup-ffmpeg';
const TAG_PREFIX = 'ffmpeg-';

export class SunoReleaseInstaller {
  /**
   * @param {import('./installer').InstallerOptions} options
   */
  constructor({version, arch, toolCacheDir, githubToken, linkingType}) {
    assert.ok(arch === 'x64' || arch === 'arm64', 'Only x64 and arm64 are supported');
    assert.strictEqual(linkingType, 'static', 'Only static linking is supported');
    this.version = version;
    this.arch = arch;
    this.toolCacheDir = toolCacheDir;
    this.githubToken = githubToken;
    this.octokit = new Octokit({auth: githubToken});
  }

  /** @private */
  getArch() {
    return this.arch === 'x64' ? 'amd64' : this.arch;
  }

  /**
   * Lists every ffmpeg release published on the fork that has an asset for the
   * requested architecture.
   *
   * @returns {Promise<import('./installer').ReleaseInfo[]>}
   */
  async getAvailableReleases() {
    const assetSuffix = `-${this.getArch()}-static.tar.xz`;
    /** @type {import('./installer').ReleaseInfo[]} */
    const releases = [];
    let page = 1;
    for (;;) {
      const {data} = await this.octokit.request('GET /repos/{owner}/{repo}/releases', {
        owner: RELEASE_OWNER,
        repo: RELEASE_REPO,
        per_page: 100,
        page,
      });
      for (const release of data) {
        if (release.draft) continue;
        if (!release.tag_name.startsWith(TAG_PREFIX)) continue;
        const version = normalizeVersion(release.tag_name.slice(TAG_PREFIX.length), false);
        if (!version) continue;
        const asset = release.assets.find((a) => a.name.endsWith(assetSuffix));
        if (!asset) continue;
        releases.push({version, downloadUrl: [asset.browser_download_url]});
      }
      if (data.length < 100) break;
      page += 1;
    }
    assert.ok(
      releases.length > 0,
      `No ffmpeg releases with a ${this.getArch()} static asset found on ` +
        `${RELEASE_OWNER}/${RELEASE_REPO}. Publish one tagged ${TAG_PREFIX}<version>.`,
    );
    return releases;
  }

  /**
   * @returns {Promise<import('./installer').ReleaseInfo>}
   */
  async getLatestRelease() {
    const releases = await this.getAvailableReleases();
    // Highest semver wins so publishing a newer release auto-upgrades `release`.
    let latest = releases[0];
    for (const release of releases) {
      if (semver.gt(release.version, latest.version)) latest = release;
    }
    core.debug(`Latest ffmpeg release on ${RELEASE_OWNER}/${RELEASE_REPO}: ${latest.version}`);
    return latest;
  }

  /**
   * @param {import('./installer').ReleaseInfo} release
   * @returns {Promise<import('./installer').InstalledTool>}
   */
  async downloadTool(release) {
    const archivePath = await tc.downloadTool(release.downloadUrl[0]);
    // Flag x to override the default xz flag.
    const extractPath = await tc.extractTar(archivePath, null, 'x');
    const dir = path.join(extractPath, (await readdir(extractPath))[0]);
    const toolInstallDir = await tc.cacheDir(dir, this.toolCacheDir, release.version, this.arch);
    return {
      version: release.version,
      path: toolInstallDir,
    };
  }
}
