import * as assert from 'assert';
import * as os from 'os';
import * as semver from 'semver';
import * as tc from '@actions/tool-cache';
// import * as core from '@actions/core';
import {Octokit} from '@octokit/core';

import {normalizeVersion} from '../util.js';
import * as path from 'path';
import {readdir} from 'fs/promises';

const RELEASE_NAME_RE =
  /^ffmpeg-(.+?)-(?:.+?)-(linux(?:arm)?64|win(?:arm)?64)-(l?gpl(?:-shared)?).*(\.zip|\.tar\.xz)$/;

export class BtbNInstaller {
  /**
   * @param {import('./installer').InstallerOptions} options
   */
  constructor({version, arch, skipIntegrityCheck, githubToken, linkingType, toolCacheDir}) {
    assert.ok(arch === 'x64' || arch === 'arm64', 'Only x64 and arm64 are supported');
    assert.ok(
      os.platform() === 'win32' || os.platform() === 'linux',
      'Only windows and linux are supported',
    );
    assert.ok(['static', 'shared'].includes(linkingType), 'Invalid linking type');
    this.version = version;
    this.arch = arch;
    this.platform = `${os.platform() === 'win32' ? 'win' : 'linux'}${arch === 'arm64' ? 'arm' : ''}64`;
    this.skipIntegrityCheck = skipIntegrityCheck;
    this.githubToken = githubToken;
    this.toolCacheDir = toolCacheDir;
    this.buildType = linkingType === 'shared' ? 'gpl-shared' : 'gpl';
    this.linkingType = linkingType;
    this.octokit = new Octokit({
      auth: this.githubToken,
    });
  }
  /** @returns {Promise<import('./installer').ReleaseInfo>} */
  async getLatestRelease() {
    const isGitBuild = this.version.toLowerCase() === 'git';
    // Use releases/tags/latest instead of releases/latest because while the
    // BtbN workflow is running the latest tag might not be uploaded yet, so
    // it could actually refer to a normal release.
    const response = await this.octokit.request('GET /repos/{owner}/{repo}/releases/tags/{tag}', {
      owner: 'BtbN',
      repo: 'FFmpeg-Builds',
      tag: 'latest',
    });
    assert.ok(response.status === 200, 'Failed to fetch latest release');
    /** @type {string} */
    let maxVersion;
    /** @type {typeof response.data.assets[0]} */
    let assetOut;
    for (const asset of response.data.assets) {
      const match = asset.name.match(RELEASE_NAME_RE);
      if (match === null) {
        continue;
      }
      const [, rawVersion, platform, buildType] = match;
      if (platform !== this.platform || buildType !== this.buildType) {
        continue;
      }
      const version =
        rawVersion !== 'master' ? normalizeVersion(rawVersion.slice(1), false) : undefined;
      if (isGitBuild && rawVersion === 'master') {
        return {
          version,
          downloadUrl: [asset.browser_download_url],
        };
      } else if (maxVersion === undefined || semver.compare(version, maxVersion) > 0) {
        maxVersion = version;
        assetOut = asset;
      }
    }
    assert.ok(assetOut !== undefined, "Couldn't find a release to download");
    return {
      version: maxVersion,
      downloadUrl: [assetOut.browser_download_url],
    };
  }
  /** @returns {Promise<import('./installer').ReleaseInfo>} */
  async getRelease() {
    if (this.version === 'git' || this.version === 'latest') {
      return await this.getLatestRelease();
    }
    let page = 1;
    while (page < 30) {
      const response = await this.octokit.request('GET /repos/{owner}/{repo}/releases', {
        owner: 'BtbN',
        repo: 'FFmpeg-Builds',
        page,
        // Leave GitHub default per page. We'd make a new request if this is not enough.
        // per_page: 30,
      });
      assert.ok(response.status === 200, 'Failed to fetch release list');
      for (const release of response.data) {
        if (release.tag_name === 'latest') {
          // The latest release is formatted differently.
          continue;
        }
        // Releases should be in chronological order so the
        // first release a matching version is the greatest
        // version available satisfying `this.version`
        /** @type {string} */
        let maxVersion;
        /** @type {typeof release.assets[0]} */
        let assetOut;
        for (const asset of release.assets) {
          const match = asset.name.match(RELEASE_NAME_RE);
          if (match === null) {
            continue;
          }
          const [, rawVersion, platform, buildType] = match;
          if (rawVersion === 'N' || platform !== this.platform || buildType !== this.buildType) {
            continue;
          }
          const version = normalizeVersion(rawVersion.slice(1), false);
          if (
            semver.satisfies(version, this.version) &&
            (maxVersion === undefined || semver.compare(version, maxVersion) > 0)
          ) {
            maxVersion = version;
            assetOut = asset;
          }
        }
        if (assetOut !== undefined) {
          return {
            version: maxVersion,
            downloadUrl: [assetOut.browser_download_url],
          };
        }
      }
    }
    assert.fail('Cannot find suitable release');
  }

  /**
   *
   * @param {import('./installer').ReleaseInfo} release
   * @returns
   */
  async downloadTool(release) {
    const archivePath = await tc.downloadTool(release.downloadUrl[0]);
    // Flag x to override the default xz flag
    const extractPath = await tc.extractTar(archivePath, null, 'x');
    const dir = path.join(extractPath, (await readdir(extractPath))[0], "bin");
    const toolInstallDir = await tc.cacheDir(dir, this.toolCacheDir, release.version, this.arch);
    return {
      version: release.version,
      path: toolInstallDir,
    };
  }
}
