import * as assert from 'assert';
import * as path from 'path';
import * as os from 'os';
import {chmod} from 'fs/promises';

import * as core from '@actions/core';
import * as exec from '@actions/exec';

import {install} from './dists/installer';

/**
 * @typedef {object} Dist
 * @property {() => Promise<void>} downloadTool
 */

const INPUT_FFMPEG_VERSION = 'ffmpeg-version';
const INPUT_GITHUB_TOKEN = 'github-token';

async function run() {
  try {
    const version = core.getInput(INPUT_FFMPEG_VERSION);
    const githubToken = core.getInput(INPUT_GITHUB_TOKEN);

    const installed = await install({
      version,
      githubToken,
      arch: os.arch(),
      toolCacheDir: 'ffmpeg',
    });

    const binaryExt = os.platform() === 'win32' ? '.exe' : '';
    const ffmpegPath = path.join(installed.toolInstallDir, 'ffmpeg' + binaryExt);
    const ffprobePath = path.join(installed.toolInstallDir, 'ffprobe' + binaryExt);

    await chmod(ffmpegPath, '755');
    await chmod(ffprobePath, '755');

    assert.strictEqual(await exec.exec(ffmpegPath, ['-version']), 0);
    assert.strictEqual(await exec.exec(ffprobePath, ['-version']), 0);

    core.addPath(installed.toolInstallDir);
    core.setOutput('path', installed.toolInstallDir);
    core.setOutput('ffmpeg-path', ffmpegPath);
    core.setOutput('ffprobe-path', ffprobePath);
  } catch (error) {
    core.setFailed(error);
  }
}

run();
