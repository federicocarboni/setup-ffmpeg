import * as tc from '@actions/tool-cache';
import * as http from 'undici';

import assert from 'assert';
import * as os from 'os';
import { pipeline } from 'stream/promises';
import { createWriteStream } from 'fs';
import path from 'path';
import { mkdir, readFile, readdir, rename } from 'fs/promises';

import { md5sum, sha256sum, verifyGpgSig, temp } from './integrity';

/**
 * @typedef {object} DownloadOptions
 * @property {string} version FFmpeg version, i.e. 6.1.0, git (for git master
 *  builds), release (for latest release builds)
 * @property {string} toolVersion version to use for tool caching
 * @property {boolean} skipVerify Skip verifying signatures/hashes of downloaded files
 */

const UNSUPPORTED_PLATFORM = 'Unsupported platform/architecture combination';
const VERIFICATION_FAIL = 'Could not verify file signatures';

function getLinuxArch() {
  const arch = os.arch();
  return arch === 'x64' ? 'amd64' : arch === 'arm64' ? arch : null;
}

async function downloadText(url) {
  const res = await http.request(url, {
    maxRedirections: 5,
  });
  return await res.body.text();
}

async function downloadToFile(url, file) {
  // Apparently @actions/http-client is bugged with redirect responses
  const res = await http.request(url, {
    maxRedirections: 5,
  });
  await pipeline(res.body, createWriteStream(file));
}

/**
 *
 * @param {'git' | 'release'} version
 * @returns {Promise<string>}
 */
export async function getToolVersion(version) {
  const platform = os.platform();
  if (platform === 'linux') {
    const readme = await downloadText(`https://johnvansickle.com/ffmpeg/${version === 'git' ? 'git-' : ''}readme.txt`);
    return readme.match(/version\: (.+)\n/)[1].trim()
  } else if (platform === 'win32') {
    const ver = await downloadText(`https://www.gyan.dev/ffmpeg/builds/${version}-version`);
    return ver.trim();
  } else if (platform === 'darwin') {
    const res = await http.request(`https://evermeet.cx/ffmpeg/info/ffmpeg/${version === 'git' ? 'snapshot' : 'release'}`, {
      maxRedirections: 5,
    });
    const body = await res.body.json();
    return body.version + '';
  }
}

/**
 * @param {DownloadOptions} options
 */
async function downloadLinux({ version, toolVersion, skipVerify }) {
  version = version || 'git';
  const arch = getLinuxArch();
  assert.ok(arch, UNSUPPORTED_PLATFORM);
  const tool = `https://johnvansickle.com/ffmpeg/builds/ffmpeg-${version}-${arch}-static.tar.xz`;
  const sig = tool + '.md5';
  const downloadPath = await tc.downloadTool(tool);
  if (!skipVerify) {
    const hash = (await downloadText(sig)).trimStart().split(' ')[0].trim();
    assert.strictEqual(await md5sum(downloadPath), hash, VERIFICATION_FAIL);
  }
  const extractPath = await tc.extractTar(downloadPath, void 0, 'x');
  // Extract path contains a single directory
  const dirs = await readdir(extractPath);
  const dir = path.join(extractPath, dirs.filter((name) => name.startsWith('ffmpeg-'))[0]);

  return await tc.cacheDir(dir, 'ffmpeg', toolVersion);
}

/**
 * @param {DownloadOptions} options
 */
async function downloadWindows({ version, toolVersion, skipVerify }) {
  assert.strictEqual(os.arch(), 'x64', UNSUPPORTED_PLATFORM);
  let tool;
  if (version === 'git' || version === 'release') {
    tool = `https://www.gyan.dev/ffmpeg/builds/ffmpeg-${version}-full.7z`;
  } else {
    tool = `https://www.gyan.dev/ffmpeg/builds/packages/ffmpeg-${version}-full_build.7z`;
  }
  const sig = tool + '.sha256';
  const downloadPath = await tc.downloadTool(tool);
  if (!skipVerify) {
    const hash = await downloadText(sig);
    assert.strictEqual(await sha256sum(downloadPath), hash, VERIFICATION_FAIL);
  }
  const extractPath = await tc.extract7z(downloadPath, void 0, path.join(__dirname, '..', 'scripts', '7zr.exe'));
  // Extract path contains a single directory
  const dirs = await readdir(extractPath);
  const dir = path.join(extractPath, dirs.filter((name) => name.startsWith('ffmpeg-'))[0]);

  // Report the correct version (or git commit) so that caching can be effective
  if (version === 'git' || version === 'release') {
    const readme = await readFile(path.join(dir, 'README.txt'), 'utf8');
    version = readme.match(/Version\: (.+)\n/)[1].trim().replace(/-full_build-www\.gyan\.dev$/) || version;
  }

  return await tc.cacheDir(path.join(dir, 'bin'), 'ffmpeg', toolVersion);
}

/**
 * @param {DownloadOptions} options
 */
async function downloadMac({ version, toolVersion, skipVerify }) {
  assert.strictEqual(os.arch(), 'x64', UNSUPPORTED_PLATFORM);
  let ffmpeg;
  let ffprobe;
  if (version === 'git' || version === 'release') {
    ffmpeg = `https://evermeet.cx/ffmpeg/get${version === 'release' ? version : ''}/zip`;
    ffprobe = `https://evermeet.cx/ffmpeg/get${version === 'release' ? version : ''}/ffprobe/zip`;
  } else {
    ffmpeg = `https://evermeet.cx/ffmpeg/ffmpeg-${version}.zip`;
    ffprobe = `https://evermeet.cx/ffmpeg/ffprobe-${version}.zip`;
  }
  const ext = version === 'git' || version === 'release' ? '/sig' : '.sig';
  const ffmpegSig = ffmpeg + ext;
  const ffprobeSig = ffprobe + ext;
  console.log(ffmpeg);
  console.log(ffprobe);
  const ffmpegPath = path.join(temp(), `ffmpeg-${version}.zip`);
  const ffprobePath = path.join(temp(), `ffprobe-${version}.zip`);
  await downloadToFile(ffmpeg, ffmpegPath);
  await downloadToFile(ffprobe, ffprobePath);
  if (!skipVerify) {
    const ffmpegSigFile = path.join(temp(), `ffmpeg-${version}.zip.sig`);
    const ffprobeSigFile = path.join(temp(), `ffprobe-${version}.zip.sig`);
    await downloadToFile(ffmpegSig, ffmpegSigFile);
    await downloadToFile(ffprobeSig, ffprobeSigFile);
    assert.ok(await verifyGpgSig('0x476C4B611A660874', ffmpegSigFile, ffmpegPath), VERIFICATION_FAIL);
    assert.ok(await verifyGpgSig('0x476C4B611A660874', ffprobeSigFile, ffprobePath), VERIFICATION_FAIL);
  }
  const ffmpegExtractPath = await tc.extractZip(ffmpegPath);
  const ffprobeExtractPath = await tc.extractZip(ffprobePath);
  const combinedPath = path.join(temp(), `ffmpeg-ffprobe-${version}`);
  await mkdir(combinedPath);
  await rename(path.join(ffmpegExtractPath, 'ffmpeg'), path.join(combinedPath, 'ffmpeg'));
  await rename(path.join(ffprobeExtractPath, 'ffprobe'), path.join(combinedPath, 'ffprobe'));
  return await tc.cacheDir(combinedPath, 'ffmpeg', toolVersion);
}

const PLATFORMS = new Set(['linux', 'win32', 'darwin']);

/**
 * Download ffmpeg.
 * @param {DownloadOptions} options
 */
export async function download(options) {
  const platform = os.platform();
  assert.ok(PLATFORMS.has(platform), UNSUPPORTED_PLATFORM);
  if (platform === 'linux') {
    return await downloadLinux(options);
  } else if (platform === 'win32') {
    return await downloadWindows(options);
  } else if (platform === 'darwin') {
    return await downloadMac(options);
  }
}
