import { Octokit } from '@octokit/rest';

const owner = 'FedericoCarboni';
const repo = 'setup-ffmpeg';

/**
 * @typedef {object} FindOptions
 * @property {string} [token]
 */

/**
 * @param {NodeJS.Platform} os
 * @param {string} arch
 * @param {FindOptions} [options={}]
 */
export async function find(os, arch, options = {}) {
  const octokit = new Octokit({ auth: options.token });
  const response = await octokit.repos.listReleases({ owner, repo });
  const release = response.data.find(({ tag_name }) => tag_name.startsWith('ffmpeg-'));
  return {
    release,
    version: release.tag_name.slice(7, -9),
    url: `https://github.com/${owner}/${repo}/releases/download/${release.tag_name}/ffmpeg-${os}-${arch}.tar.gz`,
  };
}
