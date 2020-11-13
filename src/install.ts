import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

import * as core from '@actions/core';
import * as hc from '@actions/http-client';
import * as tc from '@actions/tool-cache';

const firstChild = (dir: string) => fs.readdirSync(dir)[0];

const linux = async () => {
  const fetchVersion = async (retry = 10): Promise<string> => {
    try {
      const client = new hc.HttpClient('FedericoCarboni/setup-ffmpeg', [], {
        socketTimeout: 100,
      });
      const response = await client.get('https://johnvansickle.com/ffmpeg/release-readme.txt');
      const readme = await response.readBody();
      const [, version] = /version: (.*?)\n/.exec(readme) ?? [];
      assert.ok(version);
      return version;
    } finally {
      core.info('Failed to fetch latest version...');
      if (retry) {
        core.info('Retrying in 10 seconds...');
        await new Promise((resolve) => setTimeout(resolve, 10000));
        return await fetchVersion(retry - 1);
      }
    }
  };
  core.info('Fetching version...');
  const version = await fetchVersion();
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
  const fetchVersion = async (retry = 10): Promise<string> => {
    try {
      const client = new hc.HttpClient('FedericoCarboni/setup-ffmpeg', [], {
        socketTimeout: 1000,
      });
      const response = await client.get('https://www.gyan.dev/ffmpeg/builds/release-version');
      const body = await response.readBody();
      const [version] = body.trim().split('-');
      assert.ok(version);
      return version;
    } finally {
      core.info('Failed to fetch latest version...');
      if (retry) {
        core.info('Retrying...')
        return await fetchVersion(retry - 1);
      }
    }
  };
  core.info('Fetching version...');
  const version = await fetchVersion();
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
