import * as assert from 'assert';
import * as os from 'os';

import * as tc from '@actions/tool-cache';
import * as core from '@actions/core';
import * as semver from 'semver';

import {GyanInstaller} from './gyan';
import {JohnVanSickleInstaller} from './johnvansickle';
import {EvermeetCxInstaller} from './evermeet.cx';

/**
 * @typedef {object} InstallerOptions
 * @property {string} version
 * @property {string} arch
 * @property {boolean} [skipIntegrityCheck]
 * @property {string} toolCacheDir
 * @property {string} [githubToken]
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
 * @returns {GyanInstaller | JohnVanSickleInstaller | EvermeetCxInstaller}
 */
function getInstaller(options) {
  const platform = os.platform();
  if (platform === 'linux') {
    return new JohnVanSickleInstaller(options);
  } else if (platform === 'win32') {
    return new GyanInstaller(options);
  } else if (platform === 'darwin') {
    return new EvermeetCxInstaller(options);
  }
  assert.ok(false, 'Unsupported platform');
}

/**
 * @param installer {ReturnType<getInstaller>}
 * @param options {InstallerOptions}
 */
async function getRelease(installer, options) {
  const releases = await installer.getAvailableReleases();
  const installVer = semver.maxSatisfying(
    releases.map(({version}) => version),
    options.version.replace('-shared', ''),
  );
  const release = releases.find(({version}) => version === installVer);
  assert.ok(release, 'Requested version is not available');
  return release;
}

/**
 * @param options {InstallerOptions}
 * @returns {Promise<InstallOutput>}
 */
export async function install(options) {
  const installer = getInstaller(options);
  let release;
  let version = options.version;
  const lowercaseVersion = version.toLowerCase();
  if (lowercaseVersion === 'git' || 
      lowercaseVersion === 'release' || 
      lowercaseVersion === 'release-shared') {
    release = await installer.getLatestRelease();
    version = release.version;
  }
  const toolInstallDir = tc.find(options.toolCacheDir, version, options.arch);
  if (toolInstallDir) {
    core.info(`Using ffmpeg version ${version} from tool cache`);
    return {version, path: toolInstallDir, cacheHit: true};
  }
  if (!release) release = await getRelease(installer, options);
  core.info(`Installing ffmpeg version ${release.version} from ${release.downloadUrl}`);
  return {
    ...(await installer.downloadTool(release)),
    cacheHit: false,
  };
}
