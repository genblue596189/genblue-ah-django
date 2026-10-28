# genblue AH Django 整合版｜2026-10-28

最新驗證：使用者核准本機安裝 Django 5.2.18 後，系統檢查與217項後端測試全數通過；詳見 DJANGO_VALIDATION-20261028.md。

本版已改以與 Render 畫面 Live 提交一致的 `genblue-ah-django-main.zip`（34ae501b3ae7cca421905313f196761ba0fb28af）為基準。部署前找到的病歷／前端／manifest 衝突已合併，正式返回修改功能完整保留；詳見 DEPLOYMENT_COMPARISON-20261028.md。
本次是病歷唯讀查核等待整理、待付款／配藥交接的 Django 邊界整合與圖庫載入整理；不是全部前端業務規則都已移入 Python。

- 最新健康檢查版本：`/api/health/` → `django-workflow-20261028-r3`。
- 本次不需要 Supabase SQL、Secrets、Storage、Edge Function 或環境變數變更。
- 沒有部署正式站，也沒有連接或修改正式資料庫。
- 實際範圍、保留項目、檢查結果與部署前版本核對請先看 `INTEGRATION-20261028.md`。
- 本包與昨日原始包不同；部署前依 `CHANGESET-20261028.json` 比對合併，不能直接覆蓋後來已修改的檔案。
- 本機無外部連線檢查：`python tools/verify_integration.py`。
- `BUILD_INFO.json` 記錄本次整合；`BASELINE_BUILD_INFO.json` 只保留舊版建置紀錄，舊測試數字不是本次執行結果。

以下為先前版本歷史說明，其中版本標記與「直接覆蓋」指示不適用於本次整合；以以上說明及最新整合文件為準。

---

# 2026-10-24 處方儲存轉結帳修正

針對「儲存並前往結帳」減少一次重複的接診確認請求。
儲存前的接診確認、體重／體溫儲存，以及 Django 寫入病歷前的即時接診權／掛號狀態檢查均保留。
等待期間若帳號、院所、病患或接診資料改變，停止流程並保留輸入。
其他使用同一檢查函式的功能仍維持原本的確認行為。
驗證：165 項後端測試、10 組前端流程模擬、78 個 JS 語法與資源清單核對通過。
查詢／候診沿用上一輪修正；本輪不宣稱已量測或改善這兩項的正式站速度。

更新方式：解壓後上傳內容到原 GitHub 專案的相同位置並提交，再於原 Render 服務部署最新提交。
不用更新 SQL 或環境變數。/api/health/ 的 edition 應顯示 checkout-speed-20261024。
實際延遲仍須部署後確認；本輪的效果是移除一段不必要的往返，未保證具體秒數。

---

# 2026-10-24 速度修正版

本包已包含以下修正，可直接覆蓋目前 Render 專案的同名檔案後，重新部署最新提交。
不需要改 Supabase SQL、資料庫或 Edge Functions，也不需要更改原有環境變數。
部署後重新整理網頁。首次仍須下載資源；後續可直接使用相同版本的瀏覽器快取。
/api/health/ 的 edition 顯示 performance-20261024，代表這版後端已上線。

- 登入確認成功後，院所權限及試用期限同時查核，縮短原本依序等待的時間。
- 搜尋與處方換算使用既有的 5 秒唯讀查核快取，仍受登入期限與試用到期時間限制；寫入仍即時查核。
- 100 個前端資源加入內容版本、ETag 與條件式請求，減少重複下載；只有版本雜湊相符的資源可長期快取。
- 開啟 HTTP gzip 壓縮；病歷、帳款與 API 回應不加入公開快取。

驗證：165 項 Python 測試、九組既有畫面流程模擬、78 個 JavaScript 語法與資源清單核對通過。
新增檢查涵蓋查核並行、驗證失敗阻擋及資源快取／更新。
處方計算規則沒有修改，既有 144 組算式對照仍通過。
未連線量測正式 Render／Supabase，不能據此承諾實際秒數；這版仍會經 Django 轉送資料請求，免費服務的閒置休眠也仍存在。

以下保留原版說明，歷史日期與驗證數以本段為準。

---

# genblue AH — 唯一整合版

**只使用 genblue-AH.zip。之前的階段包與小更新包不必依序安裝。**

## 一次更新、集中實操

1. 原 Django PowerShell 按 Ctrl+C，先保留尚未儲存的操作。
2. 將本包解壓內容複製到目前 Django 專案，覆蓋同名檔案。manage.py 與 start-local.ps1 應在同一層；保留原本 .venv。
3. 執行原指令：powershell -ExecutionPolicy Bypass -File .\start-local.ps1
4. 開啟 http://127.0.0.1:8000/，按 Ctrl+F5。畫面版本標示為「Django 整合版 2026-10-22」。

這次不需在 Supabase 執行 SQL，不需重建資料庫，也不需更新 Edge Functions。本包沒有 .venv，會沿用原有 Python 環境。既有 GitHub 正式站不因本機覆蓋而變動。

localhost 仍沿用目前正式 Supabase，是真實資料操作。同一筆病患或帳款避免由兩邊同時修改；收款結果不明時，沿用原有核對上次收款，不另建第二筆。

## 整合後的分工

| 部分 | 維護位置與行為 |
| --- | --- |
| 畫面 | web/*.html，保留原介面、Enter 搜尋、檢驗跳格、收合、異常紅字與列印 |
| 前端程式／樣式 | assets/frontend/，78 個 classic scripts，保留原載入順序；FRONTEND_GUIDE.md 提供導覽 |
| Django 業務入口 | clinic/，包含搜尋、掛號、醫師、病歷、候診／歸檔、結帳、處方換算及建檔 |
| 其餘資料服務 | clinic/gateway.py 承接原 SDK 的 Auth／查詢／寫入／RPC／Storage／Edge 請求；固定專案與允許清單，沿用使用者 token |
| SQL 唯一維護來源 | database/modules/；修改後由 database/tools/build_install.py 產生完整安裝檔 |
| 正式資料庫更新 | 有功能變更才另外產生具名差異 SQL，不把完整 installer 貼進現有正式庫 |
| Edge Functions | 沿用現有部署，這次不修改、不重新部署 |

資料服務接入範圍涵蓋建檔、門診病歷、檢驗、疫苗、藥品／商品、庫存、住院寄養、人員／試用、預約、影像分享、備份還原、配藥室、夜間作業、期間費用、日曆及 POS 管理。介面清單包含 47 個資料表／view、43 個 RPC、4 個 Edge Functions 與影像桶。

Django 不使用 service-role key。原 SQL／RLS／Edge Functions 仍負責資料隔離、權限、交易、扣庫存與請求重播；沒有建立另一套帳。部分功能透過相容路由承接，不代表每段業務規則均改寫成 Python。畫面互動、參考文字及配藥指示仍有 JavaScript，瀏覽器可查看這些前端程式。

## 這次補齊的重點

- 處方數量換算移至 Python：從本院資料庫讀取藥品規格，保留口服總顆數、注射單次 ml、IU/kg、mg/kg、ml/kg、PRN 與精度規則。
- 舊計算回應與另一病患的回應不覆蓋目前欄位；等待換算完成才加入處方。
- 病歷儲存驗證處方數量與單位、組別頻次天數及已填交付總量；保留原始 JSON，不把交付總量再乘上頻次、天數。不重新推算舊版 per metadata。
- 新增飼主／寵物與同主新增由 Django 承接；原 SQL 產生系統編號。相同 UUID 核對已存結果，不以新 UUID 重複建檔；內容不同不覆寫。飼主與寵物仍是可部分成功的兩步，沒有宣稱新增跨表原子交易。
- 既有飼主／寵物修改刪除經 SDK 相容路由，原 RLS 繼續生效。
- 三頁程式與可獨立樣式／圖片分開維護，前端資源由明確清單提供。HTML 與資源更新不靠保留舊快取。
- Request 物件轉送改成保留明確 body bytes，支援本機 Django；原 SQL 錯誤碼、篩選、筆數與二進位資料保留，不自動重試業務寫入。
- 主頁 Supabase SDK 固定為這次 HTTP 驗證使用的 2.118.0。

## 驗證與界線

153 項 Python 測試、九組前端模擬、78 個外部 JS 語法及 100 個前端資源 HTTP 檢查通過。144 組原 JavaScript 算式結果已保存為可重跑的比對案例。

實際 Supabase SDK → 本機 Django HTTP → 模擬上游的登入、查詢／筆數／分頁、RPC 錯誤、二進位上傳下載、簽名網址、Edge 請求、Request body 與未允許路徑阻擋檢查通過。使用模擬資料，不存取正式帳號或寫入病患／帳款。

SQL 整合 installer 的空白試裝成功由使用者先前回報 INSTALL SUCCESS；本包收錄相同 SQL。SQL 維護工具補明確 UTF-8，以利 Windows 使用，沒有改動 SQL 定義。

尚未在真實瀏覽器與院內資料重新跑完整操作；集中實操時只針對實際問題修正，不要求重新做已完成的備份還原及逐段驗收。此次未執行雲端部署。localhost 產生的連結仍須等部署後才適合外部使用。

## 開發檢查

python tools/check_project.py 可一次執行檔案／介面核對、Django 與 Node 流程檢查，需具備 Django 和 Node.js。只執行 Python 可加 --python-only。

HTTP SDK 檢查使用 python tools/http_smoke.py --sdk-file SDK檔案路徑，使用本機模擬上游。一般院內使用者不必執行這些開發檢查。

修改或新增前端資源後執行 python tools/update_frontend_manifest.py，重啟 Django。SQL 來源以 database/modules/ 為準；database/source/ 是追溯快照，不在那裡維護第二份定義。
