import * as tc from '@actions/tool-cache';
import * as http from '@actions/http-client';

import assert from 'assert';
import * as os from 'os';
import { md5sum, sha256sum, verifyGpgSig } from './integrity';
import { pipeline } from 'stream/promises';
import { createWriteStream } from 'fs';
import path from 'path';
import { mkdir, readdir, rename } from 'fs/promises';

/**
 * @typedef {object} DownloadOptions
 * @property {string} version FFmpeg version, i.e. 6.1.0, git (for git master
 *  builds), release (for latest release builds)
 * @property {boolean} skipVerify Skip verifying signatures of downloaded files
 */

const UNSUPPORTED_PLATFORM = 'Unsupported platform/architecture combination';
const VERIFICATION_FAIL = 'Could not verify file signatures';

function getLinuxArch() {
  const arch = os.arch();
  return arch === 'x64' ? 'amd64' : arch === 'arm64' ? arch : null;
}

async function downloadText(url) {
  const client = new http.HttpClient();
  const res = await client.get(url);
  return await res.readBody();
}

async function downloadToFile(url, file) {
  const client = new http.HttpClient();
  const res = await client.get(url);
  await pipeline(res.message, createWriteStream(file));
}

/**
 * @param {DownloadOptions} options
 */
async function downloadLinux({ version, skipVerify }) {
  version = version || 'git';
  const arch = getLinuxArch();
  assert.ok(arch, UNSUPPORTED_PLATFORM);
  const tool = `https://johnvansickle.com/ffmpeg/builds/ffmpeg-${version}-${arch}-static.tar.xz`;
  const sig = tool + '.md5';
  const downloadPath = await tc.downloadTool(tool);
  if (!skipVerify) {
    const hash = await downloadText(sig);
    assert.strictEqual(await md5sum(downloadPath), hash, VERIFICATION_FAIL);
  }
  const extractPath = await tc.extractTar(downloadPath, void 0, 'x');
  const files = await readdir(extractPath);
  return await tc.cacheDir(path.join(extractPath, files[0]), 'ffmpeg', version);
}

/**
 * @param {DownloadOptions} options
 */
async function downloadWindows({ version, skipVerify }) {
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
  const extractPath = await tc.extract7z(downloadPath);
  return await tc.cacheDir(extractPath, 'ffmpeg', version);
}

/**
 * @param {DownloadOptions} options
 */
async function downloadMac({ version, skipVerify }) {
  assert.strictEqual(os.arch(), 'x64', UNSUPPORTED_PLATFORM);
  let ffmpeg;
  let ffprobe;
  if (version === 'git') {
    ffmpeg = 'https://evermeet.cx/ffmpeg/get/zip';
    ffprobe = 'https://evermeet.cx/ffmpeg/get/ffprobe/zip';
  } else if (version === 'release') {
    ffmpeg = 'https://evermeet.cx/ffmpeg/getrelease/zip';
    ffprobe = 'https://evermeet.cx/ffmpeg/getrelease/ffprobe/zip';
  } else {
    ffmpeg = `https://evermeet.cx/ffmpeg/ffmpeg-${version}.zip`;
    ffprobe = `https://evermeet.cx/ffmpeg/ffprobe-${version}.zip`;
  }
  const ext = version === 'git' || version === 'release' ? '/sig' : '.sig';
  const ffmpegSig = ffmpeg + ext;
  const ffprobeSig = ffprobe + ext;
  const ffmpegPath = await tc.downloadTool(ffmpeg);
  const ffprobePath = await tc.downloadTool(ffprobe);
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
  const combinedPath = path.join(temp(), `ffmpeg-ffprobe`);
  await mkdir(combinedPath);
  await rename(path.join(ffmpegExtractPath, 'ffmpeg'), path.join(combinedPath, 'ffmpeg'));
  await rename(path.join(ffprobeExtractPath, 'ffprobe'), path.join(combinedPath, 'ffprobe'));
  return await tc.cacheDir(combinedPath, 'ffmpeg', version);
}

const PLATFORMS = new Set(['linux', 'win32', 'darwin']);

/**
 * Download ffmpeg.
 * @param {DownloadOptions} options
 */
export async function download(options = {}) {
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
