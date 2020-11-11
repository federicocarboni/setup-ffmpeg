'use strict';
const path = require('path');
const os = require('os');

const core = require('@actions/core');
const hc = require('@actions/http-client');
const tc = require('@actions/tool-cache');
const glob = require('@actions/glob');
const io = require('@actions/io');

const windows = async () => {
};
const ubuntu = async () => {
  const downloadPath = await tc.downloadTool('https://johnvansickle.com/ffmpeg/builds/ffmpeg-git-amd64-static.tar.xz');
  const binPath = await tc.extractTar(downloadPath, void 0, ['-x']);
  const globber = await glob.create(binPath + '/ffmpeg-git-*-static/{ffmpeg,ffprobe}');
  for (const exe of await globber.glob()) {
    await io.mv(exe, binPath);
  }
  await io.rmRF((await (await glob.create(binPath + '/ffmpeg-git-*-static/')).glob())[0]);
  core.info(await tc.cacheFile(binPath, 'ffmpeg-git-linux-am64'));
  core.setOutput('ffmpeg-path', path.join(binPath, 'ffmpeg'));
  core.setOutput('ffprobe-path', path.join(binPath, 'ffprobe'));
};
const macos = async () => {
};

const platform = os.platform();

if (platform === 'linux') {
  ubuntu();
} else if (platform === 'win32') {
  windows();
} else if (platform === 'darwin') {
  macos();
} else {
  core.setFailed(`Unsupported platform ${platform}`);
}
