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
  const release = await installer.getRelease();
  // Since git doesn't have a proper version tag it cannot be retrieved from the
  // GitHub tool cache since it only supports proper semantic versions.
  // At the moment even if we provided a proper version there is no guarantee
  // that the tool cache would give you back the latest git build, it could just
  // as well give you an older version. So for now git builds are not cacheable.
  const toolInstallDir =
    options.version.toLowerCase() !== 'git' &&
    tc.find(options.toolCacheDir, release.version, options.arch);
  if (toolInstallDir) {
    core.info(`Using ffmpeg version ${release.version} from tool cache`);
    return {version: release.version, path: toolInstallDir, cacheHit: true};
  }
  core.info(`Installing ffmpeg version ${release.version} from ${release.downloadUrl}`);
  return {
    ...(await installer.downloadTool(release)),
    cacheHit: false,
  };
}
