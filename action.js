'use strict';
const path = require('path');
const os = require('os');

const core = require('@actions/core');
const hc = require('@actions/http-client');
const tc = require('@actions/tool-cache');

const windows = async () => {
};
const ubuntu = async () => {
  const downloadPath = await tc.downloadTool('https://johnvansickle.com/ffmpeg/builds/ffmpeg-git-amd64-static.tar.xz');
  const binPath = await tc.extractXar(downloadPath);
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
