import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

import * as core from '@actions/core';
import * as hc from '@actions/http-client';
import * as tc from '@actions/tool-cache';
import * as exec from '@actions/exec';

const GITHUB_REPO = 'FedericoCarboni/setup-ffmpeg';
const GITHUB_URL = `https://github.com/${GITHUB_REPO}`;
const PLATFORMS = new Set(['linux', 'win32']);

interface Release {
  tag_name: string;
}

// sets the file as executable acts like chmod +x $path
const chmodx = (path: string) => fs.promises.chmod(path, '755');

async function main() {
  try {
    const platform = os.platform();
    const arch = os.arch();

    // check if the current platform and architecture are supported
    assert.ok(PLATFORMS.has(platform), `setup-ffmpeg cannot be run on ${platform}`);
    assert.ok(arch === 'x64', 'setup-ffmpeg can only be run on 64-bit systems');

    // fetch the latest build of ffmpeg
    const http = new hc.HttpClient('FedericoCarboni/setup-ffmpeg');
    const res = await http.getJson<Release[]>(`https://api.github.com/repos/${GITHUB_REPO}/releases`);

    assert.ok(res.statusCode === 200);
    assert.ok(res.result);

    const version = res.result.find(({ tag_name }) => tag_name.startsWith('ffmpeg-'))?.tag_name?.slice(7);

    assert.ok(version);

    // search in the cache if version is already installed
    let installPath = tc.find('ffmpeg', version, arch);

    // if ffmpeg was not found in cache download it from releases
    if (!installPath) {
      const downloadURL = `${GITHUB_URL}/releases/download/ffmpeg-${version}/ffmpeg-${platform}-${arch}.tar.gz`;
      const downloadPath = await tc.downloadTool(downloadURL);
      const extractPath = await tc.extractTar(downloadPath);
      installPath = await tc.cacheDir(extractPath, 'ffmpeg', version, arch);
    }

    assert.ok(installPath);

    const ext = platform === 'win32' ? '.exe' : '';
    const ffmpegPath = path.join(installPath, `ffmpeg${ext}`);
    const ffprobePath = path.join(installPath, `ffprobe${ext}`);

    // ensure the correct permission to execute ffmpeg and ffprobe
    await chmodx(ffmpegPath);
    await chmodx(ffprobePath);

    // execute ffmpeg -version and ffprobe -version to verify the installation
    assert.ok(await exec.exec(ffmpegPath, ['-version']) === 0);
    assert.ok(await exec.exec(ffprobePath, ['-version']) === 0);

    core.addPath(installPath);
    core.setOutput('path', installPath);
    core.setOutput('ffmpeg-path', ffmpegPath);
    core.setOutput('ffprobe-path', ffprobePath);
  } catch (error) {
    core.setFailed(`${error.message}`);
  }
}

main();
