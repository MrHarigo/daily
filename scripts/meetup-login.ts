import { chromium } from 'playwright-core';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as readline from 'readline/promises';

// One-time Meetup login: opens real Chrome, you log in by hand, and the Meetup
// cookies are saved as base64 for the MEETUP_STORAGE_STATE env var.
async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('https://www.meetup.com/login/');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  await rl.question('Log in to Meetup in the Chrome window, then press Enter here... ');
  rl.close();

  const { cookies } = await context.storageState();
  const meetupCookies = cookies.filter((c) => c.domain.endsWith('meetup.com'));
  if (meetupCookies.length === 0) throw new Error('No Meetup cookies found. Did the login finish?');

  const out = path.join(os.tmpdir(), 'meetup-state.b64');
  const state = JSON.stringify({ cookies: meetupCookies, origins: [] });
  fs.writeFileSync(out, Buffer.from(state).toString('base64'), { mode: 0o600 });
  console.log(`Saved ${meetupCookies.length} Meetup cookies to ${out}`);
  console.log(`Copy to clipboard: pbcopy < ${out}`);
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
