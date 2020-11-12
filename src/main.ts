import * as core from '@actions/core';
import { install } from './install';

const main = async () => {
  try {
    await install();
  } catch (error) {
    core.setFailed(error);
  }
};

main();
