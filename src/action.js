import * as path from 'path';
import * as os from 'os';
import {chmod} from 'fs/promises';
import * as assert from 'assert';

import * as core from '@actions/core';

import {install} from './dists/installer';

/**
 * @typedef {object} Dist
 * @property {() => Promise<void>} downloadTool
 */

const INPUT_FFMPEG_VERSION = 'ffmpeg-version';
const INPUT_ARCHITECTURE = 'architecture';
const INPUT_GITHUB_TOKEN = 'github-token';
const INPUT_LINKING_TYPE = 'linking-type';

const OUTPUT_FFMPEG_VERSION = 'ffmpeg-version';
const OUTPUT_FFMPEG_PATH = 'ffmpeg-path';
const OUTPUT_CACHE_HIT = 'cache-hit';

async function run() {
  try {
    const version = core.getInput(INPUT_FFMPEG_VERSION);
    const arch = core.getInput(INPUT_ARCHITECTURE) || os.arch();
    const githubToken = core.getInput(INPUT_GITHUB_TOKEN);
    const linkingType = core.getInput(INPUT_LINKING_TYPE) || "static";

    assert.ok(["static", "shared"].includes(linkingType), 'Unsupported linking type (use static or shared)');

    const output = await install({
      version,
      githubToken,
      arch,
      toolCacheDir: 'ffmpeg',
      linkingType
    });

    const binaryExt = os.platform() === 'win32' ? '.exe' : '';
    const ffmpegPath = path.join(output.path, 'ffmpeg' + binaryExt);
    const ffprobePath = path.join(output.path, 'ffprobe' + binaryExt);

    // Ensure ffmpeg binaries are executable
    await chmod(ffmpegPath, '755');
    await chmod(ffprobePath, '755');

    // assert.strictEqual(await exec.exec(ffmpegPath, ['-version']), 0);
    // assert.strictEqual(await exec.exec(ffprobePath, ['-version']), 0);

    core.addPath(output.path);
    core.setOutput(OUTPUT_FFMPEG_VERSION, output.version);
    core.setOutput(OUTPUT_FFMPEG_PATH, output.path);
    core.setOutput(OUTPUT_CACHE_HIT, output.cacheHit);
  } catch (error) {
    core.setFailed(error);
  }
}

run();
