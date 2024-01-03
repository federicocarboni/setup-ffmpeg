import * as assert from 'assert';
import * as path from 'path';
import {mkdir, rename} from 'fs/promises';

import * as tc from '@actions/tool-cache';
import {fetch} from 'undici';
import {v4 as uuidV4} from 'uuid';

import {USER_AGENT, cleanVersion, getTempDir} from '../util';

export class EvermeetCxInstaller {
  /**
   * @param options {import('./installer').InstallerOptions}
   */
  constructor({version, arch, toolCacheDir}) {
    assert.strictEqual(arch, 'x64', 'Unsupported architecture (only x64 is supported)');
    this.version = version;
    this.toolCacheDir = toolCacheDir;
  }
  /**
   * @param url {string}
   * @private
   */
  async getVersionAndUrls(url) {
    const res = await fetch(url, {
      headers: {
        'user-agent': USER_AGENT,
      },
    });
    if (!res.ok) return null;
    const data = /** @type {*} */ (await res.json());
    return {
      version: data.version,
      downloadUrl: data.download.zip.url,
      checksumUrl: data.download.zip.sig,
    };
  }
  /**
   * @param version {string}
   * @param isGitRelease {boolean}
   * @returns {Promise<import('./installer').ReleaseInfo>}
   * @private
   */
  async getRelease(version, isGitRelease) {
    const ffmpeg = await this.getVersionAndUrls(
      'https://evermeet.cx/ffmpeg/info/ffmpeg/' + version,
    );
    assert.ok(ffmpeg, 'Requested version not found');
    const ffprobe = await this.getVersionAndUrls(
      'https://evermeet.cx/ffmpeg/info/ffprobe/' + version,
    );
    assert.ok(ffprobe, 'Requested version not found');
    assert.strictEqual(ffmpeg.version, ffprobe.version);
    return {
      version: ffmpeg.version,
      isGitRelease,
      downloadUrl: [ffmpeg.downloadUrl, ffprobe.downloadUrl],
      checksumUrl: [ffmpeg.checksumUrl, ffprobe.checksumUrl],
    };
  }
  /**
   * @returns {Promise<import('./installer').ReleaseInfo>}
   */
  async getLatestRelease() {
    const isGitRelease = this.version.toLowerCase() === 'git';
    const releaseType = isGitRelease ? 'snapshot' : 'release';
    const release = await this.getRelease(releaseType, isGitRelease);
    return {...release, isGitRelease};
  }
  /**
   * @returns {Promise<import('./installer').ReleaseInfo[]>}
   */
  async getAvailableReleases() {
    const releases = [await this.getLatestRelease()];
    if (this.version.toLowerCase() !== 'git' && this.version.toLowerCase() !== 'release') {
      const release = await this.getRelease(cleanVersion(this.version), false);
      if (release && releases[0].version !== release.version) {
        releases.push(release);
      }
    }
    return releases;
  }
  /**
   * @param {import('./installer').ReleaseInfo} release
   * @returns {Promise<import('./installer').InstalledTool>}
   */
  async downloadTool(release) {
    // Evermeet.cx divides ffmpeg from ffprobe in different archives
    const [ffmpegUrl, ffprobeUrl] = /** @type {string[]} */ (release.downloadUrl);
    const ffmpegArchive = await tc.downloadTool(ffmpegUrl);
    const ffprobeArchive = await tc.downloadTool(ffprobeUrl);
    const ffmpegExtracted = await tc.extractZip(ffmpegArchive);
    const ffprobeExtracted = await tc.extractZip(ffprobeArchive);

    // Move ffmpeg and ffprobe to the same directory
    const dirToCache = path.join(getTempDir(), uuidV4());
    await mkdir(dirToCache, {recursive: true});
    await rename(path.join(ffmpegExtracted, 'ffmpeg'), path.join(dirToCache, 'ffmpeg'));
    await rename(path.join(ffprobeExtracted, 'ffprobe'), path.join(dirToCache, 'ffprobe'));

    const toolInstallDir = await tc.cacheDir(dirToCache, this.toolCacheDir, release.version);
    return {
      version: release.version,
      path: toolInstallDir,
    };
  }
}
