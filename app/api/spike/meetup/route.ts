import { NextRequest, NextResponse } from 'next/server';
import type { Browser, Page } from 'playwright-core';

export const maxDuration = 60;

const DEFAULT_EVENT = 'https://www.meetup.com/west-tokyo-badminton-club/events/316690671/';

type Step = { label: string; url: string; buttons: string[]; shot: string };

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

async function snap(page: Page, label: string): Promise<Step> {
  const buttons = (await page.getByRole('button').allInnerTexts()).map((t) => t.trim()).filter(Boolean);
  const shot = (await page.screenshot({ type: 'jpeg', quality: 60 })).toString('base64');
  return { label, url: page.url(), buttons: [...new Set(buttons)].slice(0, 40), shot };
}

// "a=1; b=2" (a Cookie request header copied from Chrome DevTools) -> Playwright cookies
function parseCookieHeader(header: string) {
  return header.split(';').map((pair) => pair.trim()).filter(Boolean).map((pair) => {
    const i = pair.indexOf('=');
    const name = pair.slice(0, i);
    // __Host- cookies must be host-only (no domain), so pin them to the exact origin
    const scope = name.startsWith('__Host-') ? { url: 'https://www.meetup.com' } : { domain: '.meetup.com', path: '/' };
    return { name, value: pair.slice(i + 1), ...scope, secure: true, sameSite: 'Lax' as const };
  }).filter((c) => c.name);
}

// Spike: drive a Meetup event page from Vercel. With MEETUP_COOKIE set, it's
// logged in as me. ?click=Attend&click=Submit clicks those buttons in order and
// returns a page with a screenshot and the visible buttons after every step.
// No app auth: previews sit behind Vercel's login and this branch is never merged.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const url = params.get('url') ?? DEFAULT_EVENT;
  // Only Meetup pages: this route drives a real browser, don't let it fetch arbitrary URLs
  if (!/^https:\/\/www\.meetup\.com\/[^\s]*$/.test(url)) {
    return NextResponse.json({ error: 'Only https://www.meetup.com/ URLs' }, { status: 400 });
  }
  const clicks = params.getAll('click');
  const cookieHeader = process.env.MEETUP_COOKIE;

  const started = Date.now();
  const steps: Step[] = [];
  const rejectedCookies: string[] = [];
  const problems: string[] = [];
  let error: string | null = null;
  let browser: Browser | undefined;
  try {
    // Imported here so a failing import is reported instead of crashing the function
    const { default: chromium } = await import('@sparticuz/chromium');
    const { chromium: playwright } = await import('playwright-core');
    browser = await playwright.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
    const majorVersion = browser.version().split('.')[0];
    const context = await browser.newContext({
      // The default headless user agent says "HeadlessChrome", an easy bot signal
      userAgent: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${majorVersion}.0.0.0 Safari/537.36`,
      locale: 'en-US',
      viewport: { width: 1280, height: 900 },
    });
    // One at a time: a single invalid cookie otherwise rejects the whole batch
    for (const cookie of cookieHeader ? parseCookieHeader(cookieHeader) : []) {
      await context.addCookies([cookie]).catch(() => rejectedCookies.push(cookie.name));
    }
    const page = await context.newPage();
    // Why hydration stalls: keep the first few failures to show on the page
    const note = (s: string) => { if (problems.length < 30) problems.push(s.slice(0, 200)); };
    page.on('console', (m) => { if (m.type() === 'error') note(`console: ${m.text()}`); });
    page.on('requestfailed', (r) => note(`failed: ${r.url()} (${r.failure()?.errorText})`));
    page.on('response', (r) => { if (r.status() >= 400) note(`${r.status()}: ${r.url()}`); });

    // The RSVP bar renders after hydration, which sometimes never happens: reload once
    const rsvp = page.getByRole('button', { name: /attend|waitlist|rsvp|going/i }).first();
    const rendered = () => rsvp.waitFor({ timeout: 15_000 }).then(() => true, () => false);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20_000 });
    if (!(await rendered())) {
      steps.push(await snap(page, 'no RSVP bar, reloading'));
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 15_000 });
      if (!(await rendered()) && clicks.length) throw new Error('RSVP bar never rendered, skipped the clicks');
    }
    steps.push(await snap(page, 'loaded'));

    for (const name of clicks) {
      // Never buy anything: the Meetup+ upsell's "Continue" starts a paid subscription
      if (await page.getByText('Join Meetup+').isVisible() && name !== 'Continue with free plan') {
        throw new Error(`Refused to click "${name}" while the Meetup+ upsell is open`);
      }
      // Match the rendered text (innerText), as the buttons list shows it: hasText and
      // role names use textContent, which glues words split across flex items
      const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
      const candidates = page.getByRole('button').or(page.getByRole('link'));
      const texts = await candidates.allInnerTexts();
      let clicked = false;
      for (let i = 0; i < texts.length && !clicked; i++) {
        if (norm(texts[i]) !== norm(name) || !(await candidates.nth(i).isVisible())) continue;
        await candidates.nth(i).click({ timeout: 10_000 });
        clicked = true;
      }
      if (!clicked) throw new Error(`No visible button or link reads "${name}"`);
      await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
      steps.push(await snap(page, `after clicking "${name}"`));
    }
  } catch (e) {
    console.error('Meetup spike error:', e);
    error = String(e);
  } finally {
    await browser?.close();
  }

  const html = `<!doctype html><meta charset="utf-8"><title>Meetup spike</title>
<body style="font-family:system-ui;background:#111;color:#eee;max-width:1000px;margin:auto;padding:16px">
<p>${esc(url)}<br>session: ${cookieHeader ? `MEETUP_COOKIE set (${parseCookieHeader(cookieHeader).length} cookies${rejectedCookies.length ? `, rejected: ${esc(rejectedCookies.join(', '))}` : ''})` : 'none (logged out)'} · ${Date.now() - started} ms · node ${process.version}</p>
${error ? `<pre style="color:#f88;white-space:pre-wrap">${esc(error)}</pre>` : ''}
${problems.length ? `<details><summary>${problems.length} request/console problems</summary><pre style="white-space:pre-wrap;font-size:12px">${esc(problems.join('\n'))}</pre></details>` : ''}
${steps.map((s) => `<h3>${esc(s.label)}</h3><p>${esc(s.url)}</p>
<p>buttons: ${s.buttons.map((b) => `<code>${esc(b)}</code>`).join(' · ')}</p>
<img src="data:image/jpeg;base64,${s.shot}" style="width:100%;border:1px solid #444">`).join('')}
</body>`;
  return new NextResponse(html, { status: error ? 500 : 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
