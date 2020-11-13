import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

import * as core from '@actions/core';
import * as hc from '@actions/http-client';
import * as tc from '@actions/tool-cache';
import * as rh from '@actions/tool-cache/lib/retry-helper';

const userAgent = 'FedericoCarboni/setup-ffmpeg';
const firstChild = (dir: string) => fs.readdirSync(dir)[0];

const fetch = async (url: string): Promise<string> => {
  const retryHelper = new rh.RetryHelper(3, 10, 20);
  return retryHelper.execute(async () => {
    core.info(`fetching information from ${url}`);
    const http = new hc.HttpClient(userAgent, [], {
      allowRetries: false,
      socketTimeout: 1000,
    });
    const response = await http.get(url);
    if (response.message.statusCode !== 200)
      throw new tc.HTTPError(response.message.statusCode);
    return await response.readBody();
  }, (err) => {
    core.info(err.message);
    if (err instanceof tc.HTTPError)
      return true;
    return false;
  });
};

const linux = async () => {
  core.info('Fetching version...');
  const info = await fetch('https://johnvansickle.com/ffmpeg/release-readme.txt');
  const [, version] = /version: (.*?)\n/.exec(info) ?? [];
  assert.ok(version);
  core.info(`Downloading ffmpeg v${version}`);
  const downloadPath = await tc.downloadTool('https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz');
  core.info(`Extracting ffmpeg from ${downloadPath}`);
  const extractPath = await tc.extractTar(downloadPath, void 0, ['-x']);
  const sourceDir = path.join(extractPath, firstChild(extractPath));
  core.info(`Caching ffmpeg from ${sourceDir}`);
  const cachedPath = await tc.cacheDir(sourceDir, 'ffmpeg', version);
  core.info(`Cached ffmpeg to ${cachedPath}`);
  return cachedPath;
};

const windows = async () => {
  core.info('Fetching version...');
  const info = await fetch('https://www.gyan.dev/ffmpeg/builds/release-version');
  const [version] = info.trim().split('-');
  core.info(`Downloading ffmpeg v${version}`);
  const downloadPath = await tc.downloadTool('https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-full.7z');
  core.info(`Extracting ffmpeg from ${downloadPath}`);
  const extractPath = await tc.extract7z(downloadPath);
  const sourceDir = path.join(extractPath, firstChild(extractPath), 'bin');
  core.info(`Caching ffmpeg from ${sourceDir}`);
  const cachedPath = await tc.cacheDir(sourceDir, 'ffmpeg', version);
  core.info(`Cached ffmpeg to ${cachedPath}`);
  return cachedPath;
};

export const install = async (): Promise<string> => {
  // TODO: support 32-bit
  assert.strictEqual(os.arch(), 'x64');

  core.info(tc.findAllVersions('ffmpeg').join(', '));
  const path = tc.find('ffmpeg', '4.x');
  if (path) {
    core.info(`Found ffmpeg installation at ${path}`);
    return path;
  }

  switch (os.platform()) {
  case 'linux':
    return await linux();
  case 'win32':
    return await windows();
  // TODO: support macos
  case 'darwin':
  default:
    throw new Error();  // TODO: add an error message
  }
};
