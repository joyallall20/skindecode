import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertSafeUrl,
  isBlockedIpAddress,
  UrlSafetyError,
} from '../src/utils/urlSafety.js';

test('blocks localhost hostnames', async () => {
  await assert.rejects(
    () => assertSafeUrl('http://localhost/product'),
    (error) => error instanceof UrlSafetyError
  );
});

test('blocks 127.0.0.1 literal IP', async () => {
  await assert.rejects(() => assertSafeUrl('http://127.0.0.1/admin'));
});

test('blocks private RFC1918 literal IP', () => {
  assert.equal(isBlockedIpAddress('10.0.0.1'), true);
  assert.equal(isBlockedIpAddress('192.168.1.10'), true);
  assert.equal(isBlockedIpAddress('172.16.0.5'), true);
  assert.equal(isBlockedIpAddress('8.8.8.8'), false);
});

test('blocks link-local and loopback IPv6', () => {
  assert.equal(isBlockedIpAddress('::1'), true);
  assert.equal(isBlockedIpAddress('fe80::1'), true);
});

test('allows public literal IPs', () => {
  assert.equal(isBlockedIpAddress('8.8.8.8'), false);
  assert.equal(isBlockedIpAddress('1.1.1.1'), false);
});
