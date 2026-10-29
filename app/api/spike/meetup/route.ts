import { NextRequest, NextResponse } from 'next/server';
import chromium from '@sparticuz/chromium';
import { chromium as playwright, type Browser } from 'playwright-core';

export const maxDuration = 60;

const DEFAULT_EVENT = 'https://www.meetup.com/west-tokyo-badminton-club/events/316690671/';

// Spike (no Meetup login): can headless Chromium on Vercel open a Meetup event
// page without a bot check, and find the Attend button? ?shot=1 returns a screenshot.
// No app auth: previews sit behind Vercel's login and this branch is never merged.
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url') ?? DEFAULT_EVENT;
  // Only Meetup pages: this route drives a real browser, don't let it fetch arbitrary URLs
  if (!/^https:\/\/www\.meetup\.com\/[^\s]*$/.test(url)) {
    return NextResponse.json({ error: 'Only https://www.meetup.com/ URLs' }, { status: 400 });
  }

  const started = Date.now();
  let browser: Browser | undefined;
  try {
    browser = await playwright.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
    const majorVersion = browser.version().split('.')[0];
    const page = await browser.newPage({
      // The default headless user agent says "HeadlessChrome", an easy bot signal
      userAgent: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${majorVersion}.0.0.0 Safari/537.36`,
      locale: 'en-US',
      viewport: { width: 1280, height: 900 },
    });

    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    const attend = page.getByRole('button', { name: /attend|参加/i }).first();
    const attendVisible = await attend.waitFor({ timeout: 10_000 }).then(() => true, () => false);

    if (request.nextUrl.searchParams.get('shot')) {
      const image = await page.screenshot({ type: 'jpeg', quality: 70 });
      return new NextResponse(new Uint8Array(image), { headers: { 'Content-Type': 'image/jpeg' } });
    }

    const html = await page.content();
    return NextResponse.json({
      httpStatus: response?.status() ?? null,
      finalUrl: page.url(),
      title: await page.title(),
      attendButton: attendVisible ? await attend.innerText() : null,
      botCheckSuspected: /captcha|are you a robot|verify you are human|access denied|cf-chl|datadome/i.test(html),
      chromium: browser.version(),
      ms: Date.now() - started,
    });
  } catch (error) {
    console.error('Meetup spike error:', error);
    return NextResponse.json(
      { error: String(error), stack: (error as Error)?.stack, node: process.version, ms: Date.now() - started },
      { status: 500 }
    );
  } finally {
    await browser?.close();
  }
}
