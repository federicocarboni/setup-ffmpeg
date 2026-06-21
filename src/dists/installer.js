import * as assert from 'assert';
import * as os from 'os';

import * as tc from '@actions/tool-cache';
import * as core from '@actions/core';
// import * as semver from 'semver';

import {EvermeetCxInstaller} from './evermeet.cx.js';
import {BtbNInstaller} from './btbn.js';

/**
 * @typedef {object} InstallerOptions
 * @property {string} version
 * @property {string} arch
 * @property {boolean} [skipIntegrityCheck]
 * @property {string} toolCacheDir
 * @property {string} [githubToken]
 * @property {string} linkingType
 */

/**
 * @typedef {object} InstalledTool
 * @property {string} version
 * @property {string} path
 */

/**
 * @typedef {object} InstallOutput
 * @property {string} version
 * @property {string} path
 * @property {boolean} cacheHit
 */

/**
 * @typedef {object} ReleaseInfo
 * @property {string} version
 * @property {boolean} [isGitRelease]
 * @property {string[]} downloadUrl
 * @property {string[]} [checksumUrl]
 */

/**
 * @param options {InstallerOptions}
 * @returns {BtbNInstaller | EvermeetCxInstaller}
 */
function getInstaller(options) {
  const platform = os.platform();
  if (platform === 'linux' || platform === 'win32') {
    return new BtbNInstaller(options);
  } else if (platform === 'darwin') {
    return new EvermeetCxInstaller(options);
  }
  assert.ok(false, 'Unsupported platform');
}

/**
 * @param options {InstallerOptions}
 * @returns {Promise<InstallOutput>}
 */
export async function install(options) {
  const installer = getInstaller(options);
  let release;
  let version = options.version;
  if (version.toLowerCase() === 'git' || version.toLowerCase() === 'release') {
    release = await installer.getLatestRelease();
    version = release.version;
  }
  const toolInstallDir = tc.find(options.toolCacheDir, version, options.arch);
  if (toolInstallDir) {
    core.info(`Using ffmpeg version ${version} from tool cache`);
    return {version, path: toolInstallDir, cacheHit: true};
  }
  if (!release) release = await installer.getRelease();
  core.info(`Installing ffmpeg version ${release.version} from ${release.downloadUrl}`);
  return {
    ...(await installer.downloadTool(release)),
    cacheHit: false,
  };
}
