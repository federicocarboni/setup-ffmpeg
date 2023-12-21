import * as assert from 'assert';

import * as tc from '@actions/tool-cache';
import * as core from '@actions/core';
import {fetch} from 'undici';

import {USER_AGENT, cleanVersion, normalizeVersion} from '../util';
import {readdir} from 'fs/promises';
import * as path from 'path';

export class JohnVanSickleInstaller {
  /**
   * @param {import('./installer').InstallerOptions} options
   */
  constructor({version, arch, skipIntegrityCheck, toolCacheDir}) {
    this.version = version;
    this.arch = arch;
    this.skipIntegrityCheck = skipIntegrityCheck;
    this.toolCacheDir = toolCacheDir;
    assert.ok(this.arch === 'x64' || this.arch === 'arm64', 'Only x64 and arm64 are supported');
  }
  /**
   * @returns {Promise<import('./installer').ReleaseInfo>}
   */
  async getLatestRelease() {
    const isGitBuild = this.version.toLowerCase() === 'git';
    const url = isGitBuild
      ? 'https://johnvansickle.com/ffmpeg/git-readme.txt'
      : 'https://johnvansickle.com/ffmpeg/release-readme.txt';
    const res = await fetch(url, {
      headers: {
        'user-agent': USER_AGENT,
      },
    });
    const readme = res.ok && (await res.text());
    assert.ok(readme, 'Failed to get latest johnvansickle ffmpeg release');
    const versionMatch = readme.match(/version\: (.+)\n/);
    assert.ok(versionMatch, 'Failed to read version from readme');
    core.debug(`Found latest johnvansickle release: ${versionMatch}`);
    const version = normalizeVersion(versionMatch[1].trim(), isGitBuild);
    const downloadUrl = isGitBuild
      ? `https://johnvansickle.com/ffmpeg/builds/ffmpeg-git-${this.getArch()}-static.tar.xz`
      : `https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-${this.getArch()}-static.tar.xz`;
    return {
      version,
      downloadUrl: [downloadUrl],
      checksumUrl: [downloadUrl + '.md5'],
    };
  }
  /**
   * @returns {Promise<import('./installer').ReleaseInfo?>}
   */
  async getRelease() {
    const version = cleanVersion(this.version);
    /** @type {import('undici').RequestInit} */
    const init = {
      method: 'HEAD',
      headers: {
        'user-agent': USER_AGENT,
      },
      redirect: 'manual',
    };
    let res = await fetch(
      `https://johnvansickle.com/ffmpeg/releases/ffmpeg-${version}-${this.getArch()}-static.tar.xz`,
      init,
    );
    // Check in old releases if not available
    if (!res.ok) {
      res = await fetch(
        `https://johnvansickle.com/ffmpeg/old-releases/ffmpeg-${version}-${this.getArch()}-static.tar.xz`,
        init,
      );
    }
    if (!res.ok) return null;
    core.debug(`Found johnvansickle release: ${version}`);
    return {
      version: normalizeVersion(version, false),
      downloadUrl: [res.url],
    };
  }
  /**
   * johnvansickle.com does not provide any way to get a list of available
   * versions except very old ones and the latest ones.
   * The given version is matched exactly so at most two results are returned.
   * Latest version and fixed version.
   *
   * @returns {Promise<import('./installer').ReleaseInfo[]>}
   */
  async getAvailableReleases() {
    const releases = [await this.getLatestRelease()];
    if (this.version.toLowerCase() !== 'git' && this.version.toLowerCase() !== 'release') {
      const release = await this.getRelease();
      if (release && releases[0].version !== release.version) releases.push(release);
    }
    return releases;
  }
  // /**
  //  * @param {ReleaseInfo} release
  //  * @param {string} archivePath
  //  */
  // async verifyChecksum(release, archivePath) {
  //   if (this.skipIntegrityCheck || !release.checksumUrl) return true;
  //   const res = await fetch(release.checksumUrl, {
  //     headers: {
  //       'user-agent': USER_AGENT,
  //     },
  //   });
  //   const checksumText = res.ok && (await res.text());
  //   assert.ok(checksumText, 'Cannot download checksum');
  //   const checksum = checksumText.split(' ')[0].trim().toLowerCase();
  //   const hash = createHash('md5');
  //   hash.setEncoding('hex');
  //   await pipeline(createReadStream(archivePath), hash);
  //   const readhash = hash.read();
  //   console.log(readhash, checksum);
  //   return readhash === checksum;
  // }
  /** @private */
  getArch() {
    return this.arch === 'x64' ? 'amd64' : this.arch;
  }
  /**
   * @param {import('./installer').ReleaseInfo} release
   * @returns {Promise<import('./installer').InstalledTool>}
   */
  async downloadTool(release) {
    const archivePath = await tc.downloadTool(release.downloadUrl[0]);
    // assert.ok(await this.verifyChecksum(release, archivePath), 'Checksum mismatch');
    // Flag x to override the default xz flag
    const extractPath = await tc.extractTar(archivePath, null, 'x');
    const dir = path.join(extractPath, (await readdir(extractPath))[0]);

    const toolInstallDir = await tc.cacheDir(dir, this.toolCacheDir, release.version, this.arch);
    return {
      version: release.version,
      path: toolInstallDir,
    };
  }
}
