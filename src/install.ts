import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

import * as core from '@actions/core';
import * as hc from '@actions/http-client';
import * as tc from '@actions/tool-cache';

const client = new hc.HttpClient('FedericoCarboni/setup-ffmpeg', [], {
  socketTimeout: 5000,
  allowRetries: true,
});

const linux = async () => {
  const fetchVersion = async (retry = 10): Promise<string> => {
    try {
      const response = await client.get('https://johnvansickle.com/ffmpeg/release-readme.txt');
      const readme = await response.readBody();
      const [ , version ] = /version: (.*?)\n/.exec(readme) ?? [];
      assert.ok(version);
      return version;
    } finally {
      if (retry)
        return await fetchVersion(retry - 1);
    }
  };
  const version = await fetchVersion();
  core.info(`Downloading ffmpeg v${version}`);
  const downloadPath = await tc.downloadTool('https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz');
  core.info(`Extracting ffmpeg from ${downloadPath}`);
  const extractPath = await tc.extractTar(downloadPath, void 0, ['-x']);
  const sourceDir = path.join(extractPath, fs.readdirSync(extractPath)[0]);
  core.info(`Caching ffmpeg from ${sourceDir}`);
  const cachedPath = await tc.cacheDir(sourceDir, 'ffmpeg', version);
  core.info(`Cached ffmpeg to ${cachedPath}`);
  return cachedPath;
};

export const install = async (): Promise<string> => {
  // TODO: support 32-bit
  assert.strictEqual(os.arch(), 'x64');

  core.info(tc.findAllVersions('ffmpeg').join(', '));
  const path = tc.find('ffmpeg', '4.3.1');
  if (path) {
    core.info(`Found ffmpeg installation at ${path}`);
    return path;
  }

  switch (os.platform()) {
  case 'linux':
    return await linux();
  default:
    throw new Error();  // TODO: add an error message
  }
};
