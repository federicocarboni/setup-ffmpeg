import * as os from 'os';

import * as core from '@actions/core';
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
  } catch (error) {
    core.setFailed(error);
  }
}

run();
