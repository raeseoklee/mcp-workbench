'use strict';
// Playwright UI demo recorder
// Requires: global playwright, API server on :3001, Web UI on :5173

const { chromium } = require('/opt/homebrew/lib/node_modules/playwright');
const { execSync }  = require('child_process');
const path          = require('path');
const fs            = require('fs');

const ROOT      = path.join(__dirname, '..');
const VIDEO_DIR = '/tmp/pw-ui-demo';
const OUT_GIF   = path.join(ROOT, 'docs/assets/tool-execution.gif');
const PALETTE   = '/tmp/pw-palette.png';

async function pause(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  if (fs.existsSync(VIDEO_DIR)) fs.rmSync(VIDEO_DIR, { recursive: true });
  fs.mkdirSync(VIDEO_DIR);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport:    { width: 1280, height: 720 },
    recordVideo: { dir: VIDEO_DIR, size: { width: 1280, height: 720 } },
  });
  const page = await context.newPage();

  // ── 1. Overview ────────────────────────────────────────────────────────────
  console.log('Step 1: Overview page');
  await page.goto('http://localhost:5173');
  await page.waitForLoadState('networkidle');
  await pause(1800);

  // ── 2. Inspect — connect to demo server ────────────────────────────────────
  console.log('Step 2: Inspect → connect');
  await page.click('a[href="/inspect"]');
  await pause(700);

  // "node" is already in the Command field by default; just set args
  await page.fill('#args', 'examples/demo-server/dist/index.js');
  await pause(600);

  await page.click('button[type="submit"]');          // "Connect"
  await page.waitForSelector('text=demo-mcp-server', { timeout: 12000 });
  await pause(1500);

  // ── 3. Tools — run get_weather ─────────────────────────────────────────────
  console.log('Step 3: Tools page → get_weather');
  await page.click('a[href="/tools"]');
  await pause(1200);

  await page.click('button:has-text("Get Weather")');
  await pause(700);

  // Replace args textarea with Seoul
  const textarea = page.locator('textarea').first();
  await textarea.fill('{"city": "Seoul"}');
  await pause(500);

  await page.click('button:has-text("Run Tool")');
  await page.waitForSelector('text=Seoul', { timeout: 10000 });
  await pause(2000);

  // ── 4. Protocol Inspector ──────────────────────────────────────────────────
  console.log('Step 4: Protocol Inspector');
  await page.click('a[href="/timeline"]');
  await pause(2500);   // let polling fetch events

  // Click on the tools/call row (sub-label [get_weather])
  const callRow = page.locator('button').filter({ hasText: 'tools/call' }).first();
  if (await callRow.isVisible()) {
    await callRow.click();
    await pause(800);

    // Switch to Response tab
    const respTab = page.locator('button').filter({ hasText: 'Response' }).nth(0);
    if (await respTab.isVisible() && await respTab.isEnabled()) {
      await respTab.click();
      await pause(1200);
    }
  }

  // ── 5. Test Results ────────────────────────────────────────────────────────
  console.log('Step 5: Test Results');
  await page.click('a[href="/tests"]');
  await pause(1000);

  // YAML editor already pre-filled with demo spec — just run
  await page.click('button:has-text("Run Tests")');
  await page.waitForSelector('text=passed', { timeout: 30000 });
  await pause(2500);

  // ── 6. Done ────────────────────────────────────────────────────────────────
  await pause(1500);
  await context.close();
  await browser.close();

  // Find the .webm video
  const files    = fs.readdirSync(VIDEO_DIR);
  const videoFile = files.find(f => f.endsWith('.webm'));
  if (!videoFile) throw new Error('No .webm video found in ' + VIDEO_DIR);
  const videoPath = path.join(VIDEO_DIR, videoFile);
  console.log('Video recorded:', videoPath);

  // Convert webm → GIF (palette-optimised, 10fps, 960px wide)
  console.log('Converting to GIF…');
  execSync(
    `ffmpeg -y -i "${videoPath}" ` +
    `-vf "fps=10,scale=960:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer" ` +
    `"${OUT_GIF}"`,
    { stdio: 'inherit' }
  );
  console.log('UI demo saved →', OUT_GIF);
}

main().catch(err => { console.error(err); process.exit(1); });
