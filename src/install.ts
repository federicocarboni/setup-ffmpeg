import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as hc from '@actions/http-client';
import * as tc from '@actions/tool-cache';

const userAgent = 'FedericoCarboni/setup-ffmpeg';

const fetchVersion = async (): Promise<string> => {
  const http = new hc.HttpClient(userAgent);
  const release = (await http.getJson<{ tag_name: string; }>(
    'https://api.github.com/repos/FedericoCarboni/setup-ffmpeg/releases/latest')).result;
  const version = release?.tag_name;
  assert.ok(version);
  return version;
};

const testInstallation = async (installPath: string) => {
  core.info('testing installation');
  assert.ok(fs.lstatSync(path.join(installPath, `ffmpeg${EXE_EXT}`)));
  assert.ok(await exec.exec(path.join(installPath, `ffmpeg${EXE_EXT}`), ['-version']) === 0, 'Expected ffmpeg to exit with code 0');
  assert.ok(await exec.exec(path.join(installPath, `ffprobe${EXE_EXT}`), ['-version']) === 0, 'Expected ffprobe to exit with code 0');
  core.info('installation successful');
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

  const version = await fetchVersion();
  const downloadPath = await tc.downloadTool(`https://github.com/FedericoCarboni/setup-ffmpeg/releases/download/4.3.1/ffmpeg-${os.platform()}-${os.arch()}.tar.gz`);
  const extractPath = await tc.extractTar(downloadPath);
  const installPath = await tc.cacheDir(extractPath, 'ffmpeg', version, os.arch());

  await testInstallation(installPath);
  return installPath;
};
