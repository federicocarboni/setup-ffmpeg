import * as assert from 'assert';
import * as path from 'path';
import {readdir} from 'fs/promises';

import * as tc from '@actions/tool-cache';
import {Octokit} from '@octokit/core';
import {fetch} from 'undici';

import {USER_AGENT, _7ZR_PATH, normalizeVersion} from '../util.js';

export class GyanInstaller {
  /**
   * @param options {import('./installer').InstallerOptions}
   */
  constructor({version, arch, toolCacheDir, githubToken, linkingType}) {
    assert.strictEqual(arch, 'x64', 'Unsupported architecture (only x64 is supported)');
    this.version = version;
    this.toolCacheDir = toolCacheDir;
    this.githubToken = githubToken;
    this.linkingType = linkingType;
    this.octokit = new Octokit({
      auth: this.githubToken,
    });
  }
  /**
   * @returns {Promise<import('./installer').ReleaseInfo>}
   */
  async getLatestRelease() {
    const isGitBuild = this.version.toLowerCase() === 'git';
    const isSharedBuild = this.linkingType === 'shared';
    const url = isGitBuild
      ? 'https://www.gyan.dev/ffmpeg/builds/git-version'
      : 'https://www.gyan.dev/ffmpeg/builds/release-version';
    const res = await fetch(url, {
      headers: {
        'user-agent': USER_AGENT,
      },
    });
    const versionText = res.ok && (await res.text());
    assert.ok(versionText, 'Cannot get latest release');
    const version = normalizeVersion(versionText.trim(), isGitBuild);
    const downloadUrl = isGitBuild
      ? 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-git-full.7z'
      : isSharedBuild
        ? 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-full-shared.7z'
        : 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-full.7z';
    return {
      version,
      downloadUrl: [downloadUrl],
      checksumUrl: [downloadUrl + '.sha256'],
    };
  }
  /**
   * @returns {Promise<import('./installer').ReleaseInfo[]>}
   */
  async getAvailableReleases() {
    // Gyan hosts binaries also on GitHub
    const data = await this.octokit.request('GET /repos/{owner}/{repo}/releases', {
      owner: 'GyanD',
      repo: 'codexffmpeg',
    });
    const linkingType = this.linkingType === 'shared' ? '-shared' : '';
    return data.data
      .filter(
        (release) => release.name.startsWith('ffmpeg') && release.tag_name.match(/^[0-9]+\.[0-9]+/),
      )
      .map((release) => ({
        version: normalizeVersion(release.tag_name, false),
        isGitBuild: false,
        isGitHubRelease: true,
        downloadUrl: [
          release.assets.filter(
            (asset) => asset.name === `ffmpeg-${release.tag_name}-full_build${linkingType}.7z`,
          )[0].browser_download_url,
        ],
      }));
  }
  /**
   * @param release {import('./installer').ReleaseInfo}
   * @returns {Promise<import('./installer').InstalledTool>}
   */
  async downloadTool(release) {
    const downloadPath = await tc.downloadTool(release.downloadUrl[0]);
    const extractPath = await tc.extract7z(downloadPath, null, _7ZR_PATH);
    const dir = path.join(extractPath, (await readdir(extractPath))[0], 'bin');
    const toolInstallDir = await tc.cacheDir(dir, this.toolCacheDir, release.version, 'x64');
    return {
      version: release.version,
      path: toolInstallDir,
    };
  }
}
