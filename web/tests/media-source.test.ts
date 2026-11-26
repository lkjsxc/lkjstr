import { expect, it, vi } from 'vitest';
import { loadImage, loadPlayable, mediaSource } from '../src/shared/media-source.ts';

it.each([
  'https://pictures.onion/file.png',
  'http://pictures.i2p./file.png',
  'https://localhost./file.png',
  'https://images.localhost/file.png',
  'https://intranet/file.png',
  'https://photos.home.arpa/file.png',
  'https://127.1/file.png',
  'https://0x7f000001/file.png',
  'http://10.0.0.1/file.png',
  'https://172.31.255.255/file.png',
  'https://192.168.1.1/file.png',
  'https://169.254.1.1/file.png',
  'https://100.64.1.1/file.png',
  'https://[::1]/file.png',
  'https://[::ffff:192.168.1.1]/file.png',
  'https://[fc00::1]/file.png',
  'https://[fe80::1]/file.png',
  'https://[2001:db8::1]/file.png',
  '//private.i2p/file.png',
])('leaves %s as a link only', (url) => {
  expect(mediaSource(url)).toBeUndefined();
});

it.each([
  ['http://images.test:80/file.png?size=128#crop', 'https://images.test/file.png?size=128#crop'],
  ['http://images.test:8443/file.png', 'https://images.test:8443/file.png'],
  ['https://8.8.8.8/file.png', 'https://8.8.8.8/file.png'],
  ['https://[2606:4700::1111]/file.png', 'https://[2606:4700::1111]/file.png'],
  ['data:image/png;base64,AA==', 'data:image/png;base64,AA=='],
])('keeps a browser-loadable source for %s', (url, source) => {
  expect(mediaSource(url)).toBe(source);
});

it('settles concurrent image consumers on one error and skips later mounts', () => {
  const first = document.createElement('img');
  const second = document.createElement('img');
  const fallback = vi.fn();
  const source = 'https://images.test/failed-image.png';
  loadImage(first, source, fallback);
  loadImage(second, 'http://images.test/failed-image.png#tile', fallback);
  expect(first.getAttribute('src')).toBe(source);
  expect(second.hasAttribute('src')).toBe(false);
  first.dispatchEvent(new Event('error'));
  expect(fallback).toHaveBeenCalledTimes(2);
  const remount = document.createElement('img');
  loadImage(remount, source, fallback);
  expect(remount.hasAttribute('src')).toBe(false);
  expect(fallback).toHaveBeenCalledTimes(3);
});

it('skips a known failed audio or video URL on later mounts', () => {
  const source = 'https://images.test/failed-video.mp4';
  const first = document.createElement('video');
  const fallback = vi.fn();
  expect(loadPlayable(first, source, fallback)).toBe(true);
  first.dispatchEvent(new Event('error'));
  expect(fallback).toHaveBeenCalledOnce();
  const remount = document.createElement('video');
  expect(loadPlayable(remount, source, fallback)).toBe(false);
  expect(remount.hasAttribute('src')).toBe(false);
});
