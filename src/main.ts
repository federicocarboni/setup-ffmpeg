import * as core from '@actions/core';
import { install } from './install';

const main = async () => {
  try {
    const { path, ffmpegPath, ffprobePath } = await install();
    core.addPath(path);
    core.setOutput('path', path);
    core.setOutput('ffmpeg-path', ffmpegPath);
    core.setOutput('ffprobe-path', ffprobePath);
  } catch (error) {
    core.setFailed(error);
  }
};

main();
