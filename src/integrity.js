import { pipeline } from 'stream/promises';
import { mkdir, unlink } from 'fs/promises';
import { createHash } from 'crypto';
import assert from 'assert';
import { createReadStream } from 'fs';
import path from 'path';

import { exec } from '@actions/exec';

export function temp() {
  const tempDirectory = process.env['RUNNER_TEMP'] || '';
  assert.ok(tempDirectory, 'Expected RUNNER_TEMP to be defined');
  return tempDirectory;
}

/**
 * Generate MD5 hash of file contents.
 *
 * @param {import("fs").PathLike} file
 * @returns {Promise<string>} MD5 hash of file in hex
 */
export async function md5sum(file) {
  const hash = createHash('md5').setEncoding('hex');
  await pipeline(createReadStream(file), hash);
  return hash.read();
}

/**
 * Generate SHA256 hash of file contents.
 *
 * @param {import("fs").PathLike} file
 * @returns {Promise<string>} SHA256 hash of file in hex
 */
export async function sha256sum(file) {
  const hash = createHash('sha256').setEncoding('hex');
  await pipeline(createReadStream(file), hash);
  return hash.read();
}

/**
 * Verify a GPG signature.
 *
 * @param {string} keyId Key id used to sign the file
 * @param {string} sig Path to the signature file
 * @param {string} file Path to the file to check
 * @returns {Promise<boolean>} true if the signature is valid
 */
export async function verifyGpgSig(keyId, sig, file) {
  // Create a temporary keyring to avoid polluting the default keyring
  const keyring = path.join(temp(), keyId + '.gpg');
  await mkdir(path.join(process.env['HOME'], '.gnupg'));
  assert.ok(
    await exec('gpg --no-default-keyring --keyring', [keyring, '--recv-keys', keyId]) === 0,
    'Could not create temporary keyring to verify GPG signature'
  );
  const code = await exec('gpg --no-default-keyring --keyring', [keyring, '--verify', sig, file]);
  await unlink(keyring);
  return code === 0;
}
