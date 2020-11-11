'use strict';
const os = require('os');

const core = require('@actions/core');
const hc = require('@actions/http-client');
const tc = require('@actions/tool-cache');

const windows = async () => {
};
const ubuntu = async () => {};
const macos = async () => {};

const platform = os.platform();

if (platform === 'linux') {
  ubuntu();
} else if (platform === 'win32') {
  windows();
} else if (platform === 'darwin') {
  macos();
} else {
  core.setFailed(new TypeError());
}
