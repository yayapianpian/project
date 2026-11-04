// 端對端驗收：npm run build && node tests/e2e/smoke.mjs
// 走完：基本設定 → 能力診斷 30 題 → 結果與計畫 → 儀表板 → 勾選任務 → 重新整理仍保留
//       → 主題切換 → 匯出備份 → 清除資料 → 還原備份 → 手機版版面
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';

const OUT = process.env.SHOT_DIR || 'test-results';
mkdirSync(OUT, { recursive: true });
const PORT = 4179;
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' });
await new Promise((r) => setTimeout(r, 2500));
const BASE = `http://localhost:${PORT}/`;

const errors = [];
const browser = await chromium.launch();
const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 900 } });
await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE.slice(0, -1) });
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()));

function check(cond, msg) {
  if (!cond) throw new Error('驗收失敗：' + msg);
  console.log('✓', msg);
}

try {
  await page.goto(BASE);
  await page.getByLabel('怎麼稱呼你').fill('小安');
  await page.getByRole('button', { name: '儲存並繼續' }).click();
  await page.getByRole('link', { name: '開始能力診斷' }).click();
  await page.getByRole('button', { name: '開始' }).click();

  // 作答 30 題：選第一個選項或填 1；第 10 題後重新整理一次，確認可以接續
  for (let i = 0; i < 30; i++) {
    if (i === 10) {
      await page.reload();
      await page.getByText('整體進度').waitFor();
      check((await page.getByText('10 / 30').count()) > 0, '重新整理後診斷從第 11 題接續');
    }
    const input = page.getByLabel('答案');
    if (await input.count()) await input.fill('1');
    else await page.locator('fieldset label').first().click();
    await page.getByRole('button', { name: '送出，下一題' }).click();
    await page.waitForTimeout(80);
  }
  await page.getByText('能力診斷結果').waitFor({ timeout: 10000 });
  check(true, '完成 30 題並顯示診斷結果');
  check((await page.getByText('逐題解析').count()) === 1, '結果頁有逐題解析');
  await page.screenshot({ path: `${OUT}/diagnostic-result.png`, fullPage: true });

  // 複製給 AI
  await page.getByRole('button', { name: /請 AI/ }).first().click();
  await page.getByRole('button', { name: '複製文字' }).click();
  await page.getByText('已複製到剪貼簿').waitFor();
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  check(clip.includes('不要直接給答案') && clip.includes('正確答案'), '複製給 AI 的文字包含引導規則與題目');
  await page.getByRole('button', { name: '關閉' }).click();

  await page.getByRole('button', { name: '前往今日任務' }).click();
  await page.getByText(/今日任務 · 第 1 天/).waitFor();
  check(true, '儀表板顯示今日任務');
  check((await page.getByText('技能熟練度').count()) === 1, '儀表板顯示技能雷達');
  check((await page.locator('.recharts-surface').count()) >= 2, '雷達圖與成績圖已繪製');

  const firstBox = page.getByRole('checkbox', { name: /標記「/ }).first();
  await firstBox.check();
  await page.waitForTimeout(300);
  await page.reload();
  await page.getByText(/今日任務 · 第 1 天/).waitFor();
  check(await page.getByRole('checkbox', { name: /標記「/ }).first().isChecked(), '勾選的任務在重新整理後仍保留');
  await page.screenshot({ path: `${OUT}/dashboard-light.png`, fullPage: true });

  // 主題切換
  await page.getByRole('button', { name: /切換主題/ }).click(); // system → light
  await page.getByRole('button', { name: /切換主題/ }).click(); // light → dark
  check(await page.evaluate(() => document.documentElement.classList.contains('dark')), '切換到深色主題');
  await page.reload();
  check(await page.evaluate(() => document.documentElement.classList.contains('dark')), '深色主題在重新整理後保留');
  await page.screenshot({ path: `${OUT}/dashboard-dark.png`, fullPage: true });

  // 課程單元：閱讀 → 三段式引導練習 → 小測 → 任務自動打勾
  await page.goto(BASE + '#/lessons/m1-mindset-1');
  await page.getByRole('heading', { name: '數據分析師在企業裡做什麼' }).waitFor();
  await page.getByRole('button', { name: '我讀完了' }).click();
  await page.getByText('已標記為讀完').waitFor();
  const p1 = page.locator('#practice .rounded-xl').first();
  await p1.locator('label').nth(0).click();
  await p1.getByRole('button', { name: '送出' }).click();
  await p1.getByText('錯在哪：').waitFor();
  check((await p1.getByText('圖表數量多，不代表主管就能做決策').count()) === 1 && (await p1.getByText('正確答案：').count()) === 0, '練習：第 1 次答錯只指出錯在哪，不顯示答案');
  await p1.locator('label').nth(2).click();
  await p1.getByRole('button', { name: '再試一次' }).click();
  await p1.getByText('提示：').waitFor();
  check((await p1.getByText('正確答案：').count()) === 0, '練習：第 2 次答錯顯示解題提示，仍不顯示答案');
  await p1.locator('label').nth(3).click();
  await p1.getByRole('button', { name: '再試一次' }).click();
  await p1.getByText('正確答案：').waitFor();
  check(true, '練習：第 3 次答錯顯示完整解答');
  const p2 = page.locator('#practice .rounded-xl').nth(1);
  await p2.locator('label').nth(0).click();
  await p2.locator('label').nth(1).click();
  await p2.getByRole('button', { name: '送出' }).click();
  await p2.getByText('一次答對').waitFor();
  check(true, '練習：答對後顯示解析');
  const quiz = page.locator('#quiz');
  const qs = quiz.locator('.rounded-xl');
  await qs.nth(0).locator('label').nth(1).click();
  await qs.nth(1).locator('label').nth(2).click();
  await qs.nth(2).locator('label').nth(2).click();
  for (let k = 0; k < 4; k++) await qs.nth(3).locator('label').nth(k).click();
  await qs.nth(4).locator('label').nth(1).click();
  await quiz.getByRole('button', { name: '交卷' }).click();
  await quiz.getByText('100 分').waitFor();
  check(true, '小測：交卷後顯示分數與解析');
  await page.goto(BASE);
  await page.getByText(/今日任務 · 第 1 天/).waitFor();
  const boxes = page.getByRole('checkbox', { name: /標記「/ });
  check(await boxes.nth(0).isChecked() && await boxes.nth(1).isChecked(), '完成單元後，每日任務自動打勾');
  await page.goto(BASE + '#/quiz');
  await page.getByText('單元小測').first().waitFor();
  check(true, '小測成績出現在測驗紀錄');

  // 路線頁
  await page.goto(BASE + '#/roadmap');
  await page.getByText('第 1 個月：資料分析基礎').waitFor();
  check((await page.getByText('目前階段').count()) === 1, '學習路線標示目前階段');

  // 能力分析
  await page.goto(BASE + '#/abilities');
  await page.getByText('各能力分數與分級').waitFor();
  check(true, '能力分析頁可開啟');

  // 匯出備份 → 清除 → 還原
  await page.goto(BASE + '#/settings');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: '匯出備份' }).click()]);
  const backupPath = `${OUT}/backup.json`;
  await dl.saveAs(backupPath);
  const backup = JSON.parse(readFileSync(backupPath, 'utf8'));
  check(backup.app === 'da180' && backup.stores.attempts.length === 37 && backup.stores.planDays.length === 180, '備份包含 37 筆作答（診斷 30 + 練習 2 + 小測 5）與 180 天計畫');

  await page.getByRole('button', { name: '清除所有資料…' }).click();
  await page.getByLabel('請輸入「清除」兩個字確認').fill('清除');
  await page.getByRole('button', { name: '永久清除' }).click();
  await page.getByText('已清除所有資料').waitFor();
  await page.goto(BASE);
  await page.getByRole('button', { name: '儲存並繼續' }).waitFor();
  check(true, '清除後回到初始設定畫面');

  await page.goto(BASE + '#/settings');
  await page.locator('input[type=file]').setInputFiles(backupPath);
  await page.getByText('作答紀錄 37 筆').waitFor();
  const [, ] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: '覆寫並還原' }).click()]);
  await page.getByText('已還原備份').waitFor();
  await page.goto(BASE);
  await page.getByText(/今日任務 · 第 1 天/).waitFor();
  check(await page.getByRole('checkbox', { name: /標記「/ }).first().isChecked(), '還原後資料完整（任務狀態保留）');

  // 雲端同步：網站內建預設連線，設定頁直接顯示登入表單
  await page.goto(BASE + '#/settings');
  await page.getByRole('heading', { name: '跨裝置雲端同步' }).waitFor();
  await page.getByRole('button', { name: '註冊新帳號' }).waitFor();
  check(true, '雲端同步：已內建連線設定，直接顯示登入表單');
  check((await page.getByLabel('電子郵件').count()) === 1 && (await page.getByLabel(/密碼/).count()) === 1, '雲端同步：有電子郵件與密碼欄位');
  // 測試環境無法連到 Supabase，忽略相關網路錯誤
  const keep = errors.filter((e) => !/supabase\.co|Failed to fetch|ERR_|net::/.test(e));
  errors.splice(0, errors.length, ...keep);

  // 手機版
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const m = await mobile.newPage();
  m.on('pageerror', (e) => errors.push('mobile pageerror: ' + e.message));
  await m.goto(BASE);
  await m.getByLabel('怎麼稱呼你').fill('手機');
  await m.getByRole('button', { name: '儲存並繼續' }).click();
  await m.getByRole('button', { name: '先略過，使用標準計畫' }).click();
  await m.getByText(/今日任務 · 第 1 天/).waitFor();
  const overflow = await m.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(overflow <= 0, `手機版沒有水平捲動（溢出 ${overflow}px）`);
  await m.getByRole('button', { name: '開啟選單' }).click();
  await m.getByRole('link', { name: '180 天學習路線' }).click();
  await m.getByText('第 1 個月：資料分析基礎').waitFor();
  check(true, '手機版選單可導覽');
  await m.goto(BASE);
  await m.getByText(/今日任務 · 第 1 天/).waitFor();
  await m.screenshot({ path: `${OUT}/dashboard-mobile.png`, fullPage: true });

  // 手機版課程單元截圖
  await m.goto(BASE + '#/lessons/m1-lookup-3');
  await m.getByRole('heading', { name: /SUMIFS/ }).first().waitFor();
  const lessonOverflow = await m.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(lessonOverflow <= 0, `手機版課程單元沒有水平捲動（溢出 ${lessonOverflow}px）`);
  await m.screenshot({ path: `${OUT}/lesson-mobile.png`, fullPage: true });

  check(errors.length === 0, '沒有任何頁面錯誤' + (errors.length ? '\n' + errors.join('\n') : ''));
  console.log('\n全部驗收通過');
} catch (e) {
  console.error(e.stack || e.message);
  console.error(errors.join('\n'));
  await page.screenshot({ path: `${OUT}/failure.png`, fullPage: true }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
  server.kill();
  process.exit(process.exitCode ?? 0);
}
