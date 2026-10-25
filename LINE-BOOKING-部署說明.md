# LINE 預約與手機審核部署（2026-10-25）

此包保留先前櫃台結帳、合併收款、捲軸及速度修正。這次新增 LINE 登入辨識、院方新預約提醒、手機審核及客戶結果通知。程式已完成本機驗證，尚未替你部署到 Supabase、Render 或實際發送 LINE。

## 先了解實際操作

1. 客戶從官方 LINE 圖文選單進入 LIFF 預約頁，以 LINE 登入。
2. 第一次使用顯示「會員待確認」，姓名電話相同不會自動取得院內資料。
3. 院方收到官方 LINE 的新預約提醒，點通知內連結，用原本員工帳密登入手機審核頁。
4. 搜尋飼主／電話／寵物／病歷號，按 Enter 或搜尋，點選正確寵物。核對本人或代約授權後，才勾選確認會員綁定，並核准預約；也可不綁定而只核准。
5. 已綁定的客戶下次可主動核對會員並選自家寵物。核准／婉拒結果及審核頁的自訂回覆，均由官方 LINE 發送給該 LINE 帳號。這不是開啟私人 LINE 聊天室，也不提供任意 LINE ID 輸入。

手機審核頁：`https://genblue-ah.onrender.com/booking-review.html`。通知送出表示 LINE 接受發送，不代表已讀；客戶需加入官方帳號並維持可收訊狀態。尚未完成 LINE 登入的一般網頁申請仍可人工審核，但無法傳送客戶 LINE 通知。既有電腦審核的核准／婉拒也共用通知佇列。

## 部署順序

### 1. Supabase 執行新增 SQL

先確認原本線上預約可用；不要重建或清空現有資料。到 SQL Editor 開新查詢，貼上並執行：

`database/existing/03_line_booking_20261025.sql`

此檔新增會員綁定、申請 LINE 關聯與通知佇列，沿用原本 ob_public／ob_staff 的預約名額和審核規則；可重複執行。只供已具 appointment 權限的院方帳號審核，通知 RPC 僅允許後端服務呼叫。

### 2. 設定 Edge Function Secrets

保留原本 `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`、`BOOKING_ALLOWED_ORIGINS`、`TURNSTILE_SITE_KEY`、`TURNSTILE_SECRET_KEY`、`TURNSTILE_ALLOWED_HOSTNAMES`。新增下列值；Secrets 填在 Supabase，不要放 GitHub、前端或聊天室。

| 名稱 | 值 |
| --- | --- |
| LINE_LIFF_ID | 2012197599-DbZHKl1s |
| LINE_LOGIN_CHANNEL_ID | 2012197599 |
| LINE_BOOKING_CLINIC | genblue-ah |
| LINE_CHANNEL_ACCESS_TOKEN | 你已私下保存的 Messaging API 長效 access token |
| LINE_NOTIFY_USER_ID | LINE Developers 的 Your user ID（U 開頭），院方收提醒的帳號 |
| BOOKING_REVIEW_URL | https://genblue-ah.onrender.com/booking-review.html |
| LINE_DISPATCH_SECRET | 自行產生的長隨機密碼，至少 32 隨機位元組；後續 Render、Vault 使用同一值 |
| LINE_REQUIRE_LOGIN | false（先測試；完成後再改 true） |

院方收提醒的 LINE 帳號也必須加入醫院官方帳號。初版先通知一個院方帳號。
這條整合透過 LIFF ID token 由 LINE 伺服器驗證身分，不需要把 LINE Login Secret 或 Messaging API Channel Secret 填入本程式，也不需要新增 Webhook。

### 3. 更新現有 online-booking Function

將 `supabase/functions/online-booking/index.ts` 全文貼到原本 **online-booking** Function，取代舊程式後部署。不要另外建立同功能的另一個名稱。

維持 **verify_jwt=false**；公開送出依然驗證 Turnstile，LINE 身分另由後端驗證。檔案 `supabase/config.toml` 已寫此設定，使用 CLI 時只部署 online-booking。

### 4. 更新 GitHub 與 Render

解壓縮後把此包專案內容覆蓋到原本 GitHub 專案並提交，等 Render 顯示部署完成。不是只更新 index 頁；本次也有 Python 後端與新手機頁。

Render Environment 新增 `LINE_DISPATCH_SECRET`，值與 Edge Function 相同。原本 Supabase 連線設定保持既有值。此值只在伺服器端使用，審核後立即喚醒通知工作；沒有設定時仍可由下一步排程發送。

### 5. 設定不依賴網頁開啟的通知排程

在 Supabase 啟用 pg_cron、pg_net。於 Vault 建立兩個 Secret：

| 名稱 | 值 |
| --- | --- |
| gb_line_project_url | 你的 Supabase Project URL，https:// 開頭，不加尾端斜線 |
| gb_line_dispatch_secret | 與 Edge／Render LINE_DISPATCH_SECRET 完全相同 |

再於 SQL Editor 執行 `database/existing/04_line_notification_schedule.sql`。排程每分鐘處理一次，可在 Cron 工作紀錄查是否執行；即使沒有開著審核頁或 Render 休眠仍會運作。新送出／審核時另有即時嘗試，因此不必一律等一分鐘，但不保證手機即時到達。

通知採佇列、固定重送識別碼及領取租約，失敗不撤銷已完成預約。單則最多嘗試 8 次，重試間隔約 5 分鐘，首次嘗試後超過 23 小時不再自動送；審核頁可看通知狀態。失敗時先查 access token、院方 user ID、官方帳號好友與訊息額度、排程執行紀錄，再以電話等方式處理，勿假設已送達。

### 6. 實機測試後才換圖文選單

先保留舊圖文選單網址，手動在 LINE 開啟：

`https://liff.line.me/2012197599-DbZHKl1s`

LIFF endpoint 維持 `https://genblue-ah.onrender.com/booking.html?clinic=genblue-ah`，scope 為 openid、profile。LINE Login 若仍為 Developing，先使用有測試權限帳號；正式開放前完成 LINE 要求的隱私權等資料並發布 Channel。

依序測：

- 未綁定帳號不會看到別人的寵物；同名同電話不會自動綁定。
- 送一筆測試預約，院方手機收到提醒，點開需登入，搜尋並選正確寵物後核准，客戶收到官方 LINE 結果。
- 明確勾選綁定後，該 LINE 帳號下次可核對並選自己的寵物；不要用未授權家人帳號測試正式綁定。
- 測婉拒、手機自訂回覆，以及原本電腦審核的結果通知。
- 關掉審核頁後再送測試，確認仍收到提醒；Cron 無錯誤。
- 重複按鈕／重新整理不會重複建立預約；一般原有預約與申請編號查詢仍正常。

全部確認後，將 `LINE_REQUIRE_LOGIN` 改為 `true`，再把圖文選單的預約連結改成上述 LIFF URL。這時該院所送新預約必須 LINE 登入，原本申請編號查詢保留。

## 本次新增／修改檔案

新增：`database/existing/03_line_booking_20261025.sql`、`database/existing/04_line_notification_schedule.sql`、`supabase/functions/online-booking/index.ts`、`supabase/config.toml`、`clinic/line_booking.py`、`clinic/tests_line_booking.py`、`web/booking-review.html`、`assets/frontend/booking-review/main.js`、`assets/frontend/booking-review/style.css`、本說明，以及 `tests/line-booking/` 驗證程式。

修改：`config/urls.py`、`web/booking.html`、`assets/frontend/booking/block-01.js`、`assets/frontend/manifest.json`。先前版本的其他修正保留在此完整包中。

## 驗證範圍與復原

已執行 Django 測試、本機 PostgreSQL 相容引擎 SQL 安裝／重跑／權限／隔離與重送測試、Edge Function 型別與模擬 LINE／Turnstile 測試。實際 Supabase 擴充套件排程、LINE Channel 設定、手機顯示與真實通知收送，仍須依上述清單現場測試。

若需暫停導入，先把 LINE_REQUIRE_LOGIN 改回 false，恢復原本圖文選單連結；需要完全停用時還原舊 Function 及舊網站，暫停 Cron 工作。新增 SQL 資料保留，勿直接刪除既有預約／會員綁定或通知紀錄。首次啟用前的舊預約不會補發院方新預約提醒。
