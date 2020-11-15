import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as hc from '@actions/http-client';
import * as tc from '@actions/tool-cache';
import * as rh from '@actions/tool-cache/lib/retry-helper';

const userAgent = 'FedericoCarboni/setup-ffmpeg';
const firstChild = (dir: string) => fs.readdirSync(dir)[0];

const fetch = async (url: string): Promise<string> => {
  const retryHelper = new rh.RetryHelper(12, 10, 20);
  return retryHelper.execute(async () => {
    core.info(`fetching ${url}`);
    const http = new hc.HttpClient(userAgent, [], {
      allowRetries: false,
      socketTimeout: 1000,
    });
    const response = await http.get(url);
    if (response.message.statusCode !== 200)
      throw new tc.HTTPError(response.message.statusCode);
    return await response.readBody();
  }, (err: Error) => {
    core.info(err.message);
    const errorCode = (err as any).code;
    return err instanceof tc.HTTPError || errorCode === 'ETIMEDOUT' || errorCode === 'ECONNREFUSED';
  });
};

const testInstallation = async (installPath: string) => {
  core.info('testing installation');
  assert.ok(await exec.exec(path.join(installPath, `ffmpeg${EXE_EXT}`), ['-version']) === 0, 'Expected ffmpeg to exit with code 0');
  assert.ok(await exec.exec(path.join(installPath, `ffprobe${EXE_EXT}`), ['-version']) === 0, 'Expected ffprobe to exit with code 0');
  core.info('installation successful');
};

const linux = async () => {
  core.info('fetching latest version...');
  const info = await fetch('https://johnvansickle.com/ffmpeg/release-readme.txt');
  const [, version] = /version: (.*?)\n/.exec(info) ?? [];
  assert.ok(version);
  core.info(`downloading ffmpeg v${version}`);
  const downloadPath = await tc.downloadTool('https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz');
  core.info(`extracting ffmpeg from ${downloadPath}`);
  const extractPath = await tc.extractTar(downloadPath, void 0, ['-x']);
  const sourceDir = path.join(extractPath, firstChild(extractPath));
  core.info(`caching ffmpeg from ${sourceDir}`);
  const cachedPath = await tc.cacheDir(sourceDir, 'ffmpeg', version);
  core.info(`cached ffmpeg to ${cachedPath}`);
  return cachedPath;
};

const windows = async () => {
  core.info('fetching latest version...');
  const info = await fetch('https://www.gyan.dev/ffmpeg/builds/release-version');
  const [version] = info.trim().split('-');
  core.info(`downloading ffmpeg v${version}`);
  const downloadPath = await tc.downloadTool('https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-full.7z');
  core.info(`extracting ffmpeg from ${downloadPath}`);
  const extractPath = await tc.extract7z(downloadPath);
  const sourceDir = path.join(extractPath, firstChild(extractPath), 'bin');
  core.info(`caching ffmpeg from ${sourceDir}`);
  const cachedPath = await tc.cacheDir(sourceDir, 'ffmpeg', version);
  core.info(`cached ffmpeg to ${cachedPath}`);
  return cachedPath;
};

export const EXE_EXT = os.platform() === 'win32' ? '.exe' : '';

export const install = async (): Promise<string> => {
  // TODO: support 32-bit
  assert.strictEqual(os.arch(), 'x64');

  const path = tc.find('ffmpeg', '4.x');
  if (path) {
    core.info(`found cached installation ${path}`);
    return path;
  }

  let installPath: string;
  switch (os.platform()) {
  case 'linux':
    installPath = await linux();
    break;
  case 'win32':
    installPath = await windows();
    break;
  // TODO: support macos
  case 'darwin':
  default:
    throw new Error();  // TODO: add an error message
  }

  await testInstallation(installPath);
  return installPath;
};
