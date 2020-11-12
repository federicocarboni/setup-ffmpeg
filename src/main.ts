import { setFailed } from '@actions/core';
import { install } from './install';

const main = async () => {
  try {
    await install();
  } catch (error) {
    setFailed(error);
  }
};

main();
