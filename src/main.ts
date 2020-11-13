import * as path from 'path';

import * as core from '@actions/core';
import { EXE_EXT, install } from './install';

const main = async () => {
  try {
    const installPath = await install();
    core.addPath(installPath);
    core.setOutput('path', installPath);
    core.setOutput('ffmpeg-path', path.join(installPath, `ffmpeg${EXE_EXT}`));
    core.setOutput('ffprobe-path', path.join(installPath, `ffprobe${EXE_EXT}`));
  } catch (error) {
    core.setFailed(error);
  }
};

main();
