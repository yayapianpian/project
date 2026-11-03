# 07 上線與跨裝置同步設定教學

完成以下三步，就能在電腦、手機、平板使用同一份學習紀錄。

| 步驟 | 做什麼 | 時間 | 費用 |
|---|---|---|---|
| 一 | 開啟 GitHub Pages，讓網站上線 | 2 分鐘 | 免費 |
| 二 | 建立 Supabase 專案（雲端資料庫） | 約 10 分鐘 | 免費方案 |
| 三 | 在每台裝置登入同一個帳號 | 每台 1 分鐘 | — |

---

## 步驟一：開啟 GitHub Pages

1. 打開 https://github.com/yayapianpian/project → 上方 **Settings**。
2. 左側選單 **Pages**。
3. **Build and deployment → Source** 選 **GitHub Actions**。
4. 到上方 **Actions** 分頁，找到「Deploy to GitHub Pages」，按 **Run workflow**（之後每次程式更新都會自動重新部署）。
5. 執行完成（約 2 分鐘）後，網站網址是：

   **https://yayapianpian.github.io/project/**

### 加到手機主畫面（像 App 一樣開啟）

- **iPhone / iPad（Safari）**：打開網址 → 下方「分享」按鈕 → **加入主畫面**。
- **Android（Chrome）**：打開網址 → 右上角 ⋮ → **加到主畫面**（或「安裝應用程式」）。

> 注意：iPhone 上「Safari 分頁」和「主畫面圖示」是兩個獨立的儲存空間，登入雲端同步後兩邊資料就會一致。

---

## 步驟二：建立 Supabase 專案

Supabase 是開源的雲端資料庫服務，免費方案足夠個人使用。

1. 到 https://supabase.com → **Start your project**，用 GitHub 帳號登入最快。
2. **New project**：
   - Name：`da180`（任意）
   - Database Password：按 Generate 產生並自行保存（本平台用不到，但管理資料庫時需要）
   - Region：選 **Northeast Asia (Tokyo)** 或 **Southeast Asia (Singapore)**，台灣連線較快
   - 方案選 **Free**
3. 等專案建立完成（約 1–2 分鐘）。

### 2-1 建立資料表

1. 左側選單 **SQL Editor** → **New query**。
2. 打開本專案的 [`supabase/schema.sql`](../supabase/schema.sql)，**全部複製**貼上。
3. 按 **Run**，看到 `Success. No rows returned` 即完成。

這個資料表開啟了「列層級安全性（RLS）」：每個帳號只能讀寫自己的資料。

### 2-2 設定登入後回到網站的網址

1. 左側 **Authentication** → **URL Configuration**。
2. **Site URL** 填：`https://yayapianpian.github.io/project/`
3. **Redirect URLs** 按 Add URL，加入同一個網址；如果會在電腦上用 `npm run dev` 測試，再加入 `http://localhost:5173/`。
4. 儲存。

這樣註冊後收到的確認信，點連結會回到你的網站。

### 2-2b 關閉「確認信」（建議，個人使用最簡單）

Supabase 免費方案內建的寄信服務有限制：只會寄給專案成員的信箱，而且每小時只能寄少量信件。如果你註冊用的信箱跟登入 Supabase 的信箱不同，可能收不到確認信。個人使用建議直接關閉：

1. 左側 **Authentication** → **Sign In / Providers**（舊版介面為 **Providers → Email**）。
2. 關閉 **Confirm email**，儲存。

關閉後，按「註冊新帳號」會直接登入，不需要收信。

**註冊完自己的帳號後**，建議在同一頁關閉 **Allow new users to sign up**，避免其他人用你的網站註冊帳號、占用你的免費額度（他們也無法看到你的資料）。

### 2-3 取得連線資訊

1. 左側 **Project Settings**（齒輪）→ **API Keys**（舊版介面為 **API**）。
2. 複製兩個值：
   - **Project URL**：`https://xxxx.supabase.co`（在 Project Settings → Data API，或專案首頁的 Connect 按鈕中）
   - **Publishable key**（`sb_publishable_…`）；舊專案則是 **anon public** key（`eyJ…`）
3. **不要**使用 `secret` 或 `service_role` 金鑰，那是管理員金鑰，不能放在網頁上。

### 2-4 把連線資訊放進網站（二選一）

**本站已內建預設連線**（`src/sync/supabase.ts` 的 `DEFAULT_URL`／`DEFAULT_KEY`），所有裝置打開網站即自動連線，直接登入即可。以下兩種做法用於改連到其他 Supabase 專案。

**做法 A：設定在 GitHub，所有裝置自動套用**

1. GitHub 儲存庫 → **Settings** → **Secrets and variables** → **Actions** → **Variables** 分頁 → **New repository variable**。
2. 新增兩個變數：
   - `SUPABASE_URL` = Project URL
   - `SUPABASE_ANON_KEY` = Publishable key（或 anon key）
3. 到 **Actions** 重新執行「Deploy to GitHub Pages」。

**做法 B：在每台裝置手動輸入**

網站 → 右上角 **設定** → 「跨裝置雲端同步」→ 貼上 Project URL 與金鑰 → 儲存並連線。

> Publishable／anon key 本來就是設計給網頁公開使用的，資料安全由 2-1 的權限規則保護，所以放在 GitHub Variables 是安全的。

---

## 步驟三：登入

1. 網站 → **設定** → 「跨裝置雲端同步」。
2. 第一次：輸入電子郵件與密碼 → **註冊新帳號**。若已依 2-2b 關閉確認信，會直接登入；否則到信箱點確認連結後，再回到網站 **登入**。
3. 其他裝置：直接用同一組電子郵件與密碼 **登入**。
4. 如果某台裝置在登入前已經有資料，系統會詢問：
   - **使用雲端紀錄（建議）**：以雲端資料為準
   - **合併兩邊**：作答紀錄全部保留，設定與計畫以較新修改的為準

登入後右上角會出現雲朵圖示：「已同步」表示完成；點一下可以立即同步。

---

## 同步怎麼運作

- **什麼時候同步**：修改資料後約 4 秒、切回網頁時、恢復網路時，以及按「立即同步」時。
- **離線也能用**：沒有網路時照常練習，資料先存在裝置上，恢復網路後自動上傳。
- **衝突處理**：
  - 作答紀錄：每一筆都有唯一編號，兩台裝置的作答會**全部保留**。
  - 每日任務：同一天在手機勾 A、在電腦勾 B，同步後 A、B **都會是完成**（逐項比較修改時間）。
  - 個人設定、計畫結構：以**最後修改**的版本為準。
- **不會同步的內容**：只存在單一裝置的設定（雲端連線設定、日後的 AI API Key）、主題偏好。熟練度會在每台裝置由作答紀錄重新計算。

## 免費方案的限制

| 項目 | 免費方案 | 本平台預估用量 |
|---|---|---|
| 資料庫容量 | 500 MB | 180 天約 5–20 MB |
| 每月活躍使用者 | 50,000 | 1 |
| 閒置暫停 | 連續 7 天沒有任何連線會暫停專案 | 每天使用就不會暫停 |

如果專案被暫停：登入 Supabase 後台，在專案頁面按 **Restore project** 即可恢復，資料不會遺失。期間網站仍可離線使用，恢復後會自動同步。

## 常見問題

| 狀況 | 解法 |
|---|---|
| 「雲端資料表尚未建立」 | 回到步驟 2-1 執行 `schema.sql` |
| 「信箱尚未確認」或收不到確認信 | 到信箱（含垃圾郵件匣）找確認信；收不到時依 2-2b 關閉 Confirm email，再重新註冊或登入 |
| 點確認連結後打開錯誤的網址 | 檢查步驟 2-2 的 Site URL |
| 「金鑰無效」 | 確認複製的是同一個專案的 Publishable／anon key |
| 想從頭開始 | 設定 → 跨裝置雲端同步 → 進階 → 刪除雲端資料，再到「清除所有資料」 |
