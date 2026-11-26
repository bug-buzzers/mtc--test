import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';
import {
  buildPortalMetadata,
  buildTestShareLinks,
  buildWhatsAppShareHref,
  buildWhatsAppTestMessage,
  resolveMetadataBaseUrl,
} from '../src/lib/share-test';

test('WhatsApp share builder includes all test information, topics, school branding, and portal URLs', () => {
  const msg = buildWhatsAppTestMessage({
    baseUrl: 'https://mtc.mapleskhatauli.com/',
    totalQuestions: 25,
    timeLimitMinutes: 30,
  });

  assert.match(msg, /Maples Academy, Khatauli/);
  assert.match(msg, /Maples Tech Club \(MTC\)/);
  assert.match(msg, /25 Multiple Choice Questions/);
  assert.match(msg, /30 Minutes/);
  assert.match(msg, /Negative Marking:\* None \(0\.00\)/);
  assert.match(msg, /Classes 6 to 10 \(Section A & B\)/);
  assert.match(msg, /Classes 11 to 12 \(Maths, Bio, Commerce & Humanities\)/);
  assert.match(msg, /Keyboard Shortcuts/);
  assert.match(msg, /Social Ethics & Cyber Safety/);
  assert.match(msg, /https:\/\/mtc\.mapleskhatauli\.com\//);
  assert.match(msg, /https:\/\/mtc\.mapleskhatauli\.com\/student\/register/);
  assert.match(msg, /https:\/\/mtc\.mapleskhatauli\.com\/student\/login/);

  const href = buildWhatsAppShareHref(msg);
  assert.ok(href.startsWith('https://api.whatsapp.com/send?text='));
  assert.equal(decodeURIComponent(href.replace('https://api.whatsapp.com/send?text=', '')), msg);
});

test('WhatsApp share builder customizes class-specific eligibility, qualifying score, and URLs', () => {
  const links11 = buildTestShareLinks('https://school.example.org', 11);
  assert.equal(links11.portalUrl, 'https://school.example.org/?class=11');
  assert.equal(links11.registerUrl, 'https://school.example.org/student/register?class=11');
  assert.equal(links11.loginUrl, 'https://school.example.org/student/login?class=11');

  const msg11 = buildWhatsAppTestMessage({
    baseUrl: 'https://school.example.org',
    targetClass: 11,
    totalQuestions: 30,
    timeLimitMinutes: 40,
    passingScore: 21,
  });

  assert.match(msg11, /Class 11 Online Entrance Test/);
  assert.match(msg11, /Class 11 \(Maths, Bio, Commerce, Humanities Streams\)/);
  assert.match(msg11, /30 Multiple Choice Questions/);
  assert.match(msg11, /40 Minutes/);
  assert.match(msg11, /Qualifying Score:\* 21\/30 \(70%\)/);
  assert.match(msg11, /https:\/\/school\.example\.org\/student\/register\?class=11/);
});

test('OpenGraph metadata and WhatsApp preview images with school logo are configured', async () => {
  const bannerPath = path.join(process.cwd(), 'public', 'whatsapp-share.png');
  const squarePath = path.join(process.cwd(), 'public', 'whatsapp-share-square.png');
  const lightLogoPath = path.join(process.cwd(), 'public', 'school-logo-light.png');

  assert.ok(fs.existsSync(bannerPath), '1200x630 WhatsApp OG share image exists');
  assert.ok(fs.existsSync(squarePath), '600x600 WhatsApp square share image exists');
  assert.ok(fs.existsSync(lightLogoPath), 'Light-surface school logo asset exists');

  const bannerBytes = fs.readFileSync(bannerPath);
  assert.equal(bannerBytes.readUInt32BE(16), 1200, 'Banner width is 1200px');
  assert.equal(bannerBytes.readUInt32BE(20), 630, 'Banner height is 630px');
  assert.ok(bannerBytes.length < 300 * 1024, 'WhatsApp OG image is under 300 KB for fast mobile previews');

  const squareBytes = fs.readFileSync(squarePath);
  assert.equal(squareBytes.readUInt32BE(16), 600, 'Square image width is 600px');
  assert.equal(squareBytes.readUInt32BE(20), 600, 'Square image height is 600px');

  const baseFromHeaders = resolveMetadataBaseUrl({
    get(name: string) {
      if (name === 'x-forwarded-host') return 'mtc.mapleskhatauli.com';
      if (name === 'x-forwarded-proto') return 'https';
      return null;
    },
  });
  assert.equal(baseFromHeaders.origin, 'https://mtc.mapleskhatauli.com');

  const meta = buildPortalMetadata({
    get(name: string) {
      if (name === 'x-forwarded-host') return 'mtc.mapleskhatauli.com';
      if (name === 'x-forwarded-proto') return 'https';
      return null;
    },
  });
  assert.ok(meta.metadataBase instanceof URL);
  assert.equal(meta.metadataBase?.origin, 'https://mtc.mapleskhatauli.com');
  assert.match(String(meta.description), /25 MCQs/);
  assert.match(String(meta.description), /Maples Academy, Khatauli/);
  assert.equal(meta.openGraph?.siteName, 'Maples Academy, Khatauli · Maples Tech Club (MTC)');
  const ogImages = Array.isArray(meta.openGraph?.images)
    ? meta.openGraph.images
    : meta.openGraph?.images
      ? [meta.openGraph.images]
      : [];
  assert.ok(ogImages.length >= 2, 'Includes primary 1200x630 and secondary square OG images');

  const { GET: getOgImage } = await import('../src/app/api/og/route');
  const { NextRequest } = await import('next/server');
  const response = await getOgImage(new NextRequest('https://mtc.mapleskhatauli.com/api/og?class=11'));
  const dynamicBytes = Buffer.from(await response.arrayBuffer());
  assert.equal(dynamicBytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(dynamicBytes.readUInt32BE(16), 1200);
  assert.equal(dynamicBytes.readUInt32BE(20), 630);

  const metaClass11 = buildPortalMetadata(
    {
      get(name: string) {
        if (name === 'x-forwarded-host') return 'mtc.mapleskhatauli.com';
        if (name === 'x-forwarded-proto') return 'https';
        return null;
      },
    },
    11
  );
  assert.match(String(metaClass11.openGraph?.title), /Class 11 Online Entrance Test/);
});

test('ShareTestCard renders WhatsApp share link, class selector, preview card, and copy buttons', async () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'https://portal.mapleskhatauli.com/',
    pretendToBeVisual: true,
  });
  const setGlobal = (key: string, value: unknown) =>
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  setGlobal('window', dom.window);
  setGlobal('self', dom.window);
  setGlobal('document', dom.window.document);
  setGlobal('navigator', dom.window.navigator);
  setGlobal('HTMLElement', dom.window.HTMLElement);
  setGlobal('Event', dom.window.Event);
  setGlobal('IS_REACT_ACT_ENVIRONMENT', true);

  let copiedText = '';
  Object.defineProperty(dom.window.navigator, 'clipboard', {
    value: {
      writeText: async (txt: string) => {
        copiedText = txt;
      },
    },
    configurable: true,
  });

  const { render, screen, fireEvent, waitFor, cleanup } = await import('@testing-library/react');
  const { default: ShareTestCard } = await import('../src/components/ShareTestCard');

  try {
    render(<ShareTestCard />);

    const waLink = screen.getByRole('link', { name: /Share Test on WhatsApp/i }) as HTMLAnchorElement;
    await waitFor(() => {
      assert.match(waLink.href, /^https:\/\/api\.whatsapp\.com\/send\?text=/);
      assert.match(decodeURIComponent(waLink.href), /portal\.mapleskhatauli\.com/);
    });

    // Switch to Class 10
    fireEvent.click(screen.getByRole('button', { name: 'Cls 10' }));
    const waLinkCls10 = screen.getByRole('link', { name: /Share Class 10 Test on WhatsApp/i }) as HTMLAnchorElement;
    assert.match(decodeURIComponent(waLinkCls10.href), /Class 10 Online Entrance Test/);
    assert.match(decodeURIComponent(waLinkCls10.href), /\?class=10/);

    // Copy full message
    fireEvent.click(screen.getByRole('button', { name: /Copy full info & links/i }));
    await waitFor(() => {
      assert.match(copiedText, /Class 10 Online Entrance Test/);
      assert.match(copiedText, /https:\/\/portal\.mapleskhatauli\.com\/student\/login\?class=10/);
    });
  } finally {
    cleanup();
    dom.window.close();
  }
});
