import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

import * as core from '@actions/core';
import * as tc from '@actions/tool-cache';
import * as exec from '@actions/exec';
import { download } from './download.js';

const PLATFORMS = new Set(['linux', 'win32', 'darwin']);

// Sets the file as executable acts like chmod +x $path
const chmodx = (path) => fs.promises.chmod(path, '755');

async function main() {
  try {
    const platform = os.platform();
    const arch = os.arch();

    // Check if the current platform and architecture are supported
    assert.ok(PLATFORMS.has(platform), `setup-ffmpeg cannot be run on ${platform}`);
    assert.strictEqual(arch, 'x64', 'setup-ffmpeg can only be run on 64-bit systems');

    // const token = [process.env.INPUT_TOKEN, process.env.INPUT_GITHUB_TOKEN, process.env.GITHUB_TOKEN]
    //   .filter((token) => token)[0];

    const version = core.getInput('version');

    // Search in the cache if version is already installed
    let installPath = tc.find('ffmpeg', version, arch);

    // If ffmpeg was not found in cache download it from releases
    if (!installPath) {
      installPath = await download({
        version,
        skipVerify: true,
      });
    }

    assert.ok(installPath);

    const ext = platform === 'win32' ? '.exe' : '';
    const ffmpegPath = path.join(installPath, `ffmpeg${ext}`);
    const ffprobePath = path.join(installPath, `ffprobe${ext}`);

    // Ensure the correct permission to execute ffmpeg and ffprobe
    await chmodx(ffmpegPath);
    await chmodx(ffprobePath);

    // Execute ffmpeg -version and ffprobe -version to verify the installation
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
