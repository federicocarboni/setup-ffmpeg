import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

import * as exec from '@actions/exec';
import * as hc from '@actions/http-client';
import * as tc from '@actions/tool-cache';

const userAgent = 'FedericoCarboni/setup-ffmpeg';

const ext = os.platform() === 'win32' ? '.exe' : '';

const getExePath = (dir: string, filename: string) => path.join(dir, filename + ext);
const chmodX = (filename: string) => fs.promises.chmod(filename, '755');

const fetchVersion = async (): Promise<string> => {
  const http = new hc.HttpClient(userAgent);
  const response = await http.getJson<any>('https://api.github.com/repos/FedericoCarboni/setup-ffmpeg/releases/latest');
  assert.ok(response.statusCode === 200);
  const release = response.result;
  const version = release?.tag_name;
  assert.ok(version);
  return version;
};

const testInstallation = async (ffmpegPath: string, ffprobePath: string) => {
  assert.ok(await exec.exec(ffmpegPath, ['-version']) === 0, 'Expected ffmpeg to exit with code 0');
  assert.ok(await exec.exec(ffprobePath, ['-version']) === 0, 'Expected ffprobe to exit with code 0');
};

export const install = async (): Promise<{
  path: string;
  ffmpegPath: string;
  ffprobePath: string;
}> => {
  assert.strictEqual(os.arch(), 'x64');
  assert.ok(os.platform() === 'linux' || os.platform() === 'win32');

  const version = await fetchVersion();

  let path = tc.find('ffmpeg', version);
  if (!path) {
    const downloadPath = await tc.downloadTool(`https://github.com/FedericoCarboni/setup-ffmpeg/releases/download/4.3.1/ffmpeg-${os.platform()}-${os.arch()}.tar.gz`);
    const extractPath = await tc.extractTar(downloadPath);
    path = await tc.cacheDir(extractPath, 'ffmpeg', version, os.arch());
  }

  const ffmpegPath = getExePath(path, 'ffmpeg');
  const ffprobePath = getExePath(path, 'ffprobe');

  await chmodX(ffmpegPath);
  await chmodX(ffprobePath);

  await testInstallation(ffmpegPath, ffprobePath);
  return { path, ffmpegPath, ffprobePath };
};
