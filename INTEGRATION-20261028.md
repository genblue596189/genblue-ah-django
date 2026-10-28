# genblue AH Django 整合交付｜2026-10-28

## 基準與本次成果

本版改以使用者提供的正式 GitHub ZIP genblue-ah-django-main.zip 為部署基準，ZIP 提交34ae501b3ae7cca421905313f196761ba0fb28af與Render畫面一致。先前ZIP的正式差異與3個衝突已處理；原始附件均保持不動。所有修正累積在同一工作副本，不需分批套用。

這次完成的是可在本機進行的 Django 邊界整合、圖庫載入整理與版本交付。不是把每個 JavaScript 功能或 SQL 交易全面改寫成 Python。既有穩定 SQL 負責交易及資料一致性，Django 負責身分、請求契約、協調及回覆核對。

本次追加：病歷接診權核對與原儲存編號讀取重疊，總請求數不變、減少一段串行等待；未宣稱正式秒數改善。四項目的逐項狀態見 FOUR_GOALS_STATUS.md，維護索引見 WORKFLOW_MAP.md。

## 實際變更

| 項目 | 本次實作 | 保留內容 |
| --- | --- | --- |
| 待付款修改與取消 | /api/checkout/edit/、cancel/；保留原 UUID、version、draft，取消限管理者 | 原櫃台畫面、pos_v77、版本衝突與處方用量限制 |
| 待付款及財務讀取 | /api/pos/list/、work_list_v854/、finance_status/、reissue_links_v854/、daily_summary/、bank_pending/ | 原始查詢條件、分頁、SQL 權限與回傳資料 |
| 調劑進度 | /api/pos/dispensing/；固定狀態、版本與回覆檢查 | 退回較早進度的管理者／原因要求仍由既有 SQL 判定 |
| 配藥室交接 | /api/pharmacy/ 下的 list、counts、staff、export、permission、send、claim、complete、return、cancel、handed | 原送單 UUID／版本、完整處方、服務費與急診費資料、醫師接診權、配藥回退及交藥條件 |
| 寫入失敗判定 | SQL 明確拒絕保留代碼；無法確認結果不自動重試、不產生新送單編號 | 上次送單核對、原 sessionStorage 暫存與原畫面保留 |
| 圖庫載入 | 350 個 JPEG 與主程式中的 1 張 PNG 抽為內容雜湊命名靜態圖片，個別按需載入並使用既有資產快取機制 | 399 筆品種項目、圖片對應、原圖位元內容、選圖後仍先預覽再儲存 |
| 版本標記 | 健康檢查與閘道 edition 統一為 django-workflow-20261028-r3 | 原環境變數、Render 啟動方式、Supabase 連線方式 |

圖庫 JavaScript：13,155,682 bytes → 132,997 bytes，減少約 99%。主程式 block-01.js：2,991,992 bytes → 426,293 bytes；只把 JOURNAL_BRITISH_CAT 圖片常數改成獨立網址，其他文字完整保留。這是該 JS 檔案的靜態體積改善；不是正式站操作秒數量測，也不是整個網站下載量減少 99%。350 張圖的總資料仍保留，使用時個別讀取。

新增驗證：返回修改成功還原、未確認直接收款／送待付款／合併待收、接診權失效、已送待付款／配藥、查詢失敗、取消確認與院所變更等10種情境通過。

## 昨天完成的功能如何保留

- 不把「未收款前返回看診修改」當成新需求重新開發。
- web/index.html、clinic/visit_status.py 完全未改。clinic/medical.py 本次只調整唯讀查核重疊與沿用該次查詢結果，寫入仍等兩項查核成功；既有輸入、處方驗證、內容比對與封存邏輯保留。block-01.js 除一個圖片常數外，其他程式文字保持一致；檢查工具會把原圖還原為 data URL 後核對原始 SHA256。
- 既有返回看診相關檔案、處方計算／驗證、分組、合併帳單與急診計價程式完全未改。
- pharmacyRoomV9133.js 只換傳輸函式 pharmacyRpcV9133；其後畫面、送單、撤回回門診、暫存恢復、計時更新及登出處理保持原文字內容。
- 46 個受保護檔案與昨天來源逐位元一致；另有 block-01.js 的圖片常數單點替換保護。PRESERVATION.json 保存兩種檢查方式與 SHA256。
- 不用包內舊 SQL 快照覆蓋已完成的正式功能，不因缺少舊補丁檔名就重建現有流程。

以上是來源保留與本機檢查證據，不是已登入正式站重跑所有臨床流程的宣稱。

## 保留、搬移、暫不動

| 範圍 | 決定與原因 |
| --- | --- |
| HTML／CSS／原操作方式 | 保留。本次只修改四個 JS：POS 傳輸、配藥室傳輸、圖庫資產載入，以及主程式的一個圖片常數 |
| 現有 Django 搜尋／掛號／病歷／處方／收款 | 保留並沿用，不重新實作 |
| 待付款／調劑／配藥室請求契約 | 已搬到專用 Django API；固定可用動作與欄位，保留 SQL 最終檢查 |
| PostgreSQL、RPC、RLS、trigger、GRANT | 保留。沒有 SQL 變更；不引入第二套資料庫或 Django migration 重建現有表 |
| Supabase Storage | 暫不動。原 clinic-imaging 與 genblue bucket、病患影像及分享入口不改 |
| 四個 Edge Functions | 暫不動。包內僅有 online-booking 原始碼；不猜寫其他三支，也不重新部署 |
| 登入、LINE、Calendar、Turnstile、Secrets、排程 | 暫不動，沿用現有正式設定 |
| 作廢／重開、錢櫃、交班／核對等其餘 POS 動作 | 保留既有相容閘道路徑。避免把已驗證的財務流程同時全面改寫；沒有刪除舊入口 |
| 大型主 JS 中的剩餘規則 | 保留；本次不重新切割昨天核心流程 |

## 實際執行的檢查

- 全部 Python 檔通過 AST 語法檢查。
- 81 個前端 JavaScript 檔通過 node --check。
- 455 個前端 manifest 項目的 SHA256 全部吻合。
- 46 個受保護檔與原始 ZIP 副本一致，另核對 8 個未改動病歷函式的 AST 雜湊，主程式只替換一個圖片常數且可還原核對原 SHA256；配藥室 UI／撤回處理區段與原檔一致。
- 350 個拆出 JPEG 及 1 個 PNG 的 SHA256、長度與原始 base64 解碼結果逐項一致。
- 原有 medical-ui、desk-checkout-ui、visit-status-ui 本機模擬通過。
- checkout-ui 更新為本次具名 API 路由契約後通過；新增 workflow-routing 本機傳輸檢查通過。
- 新增 8 個協調讀取情境：事件同步證明唯讀重疊，檢查新存、重送、不同內容、失效接診、錯掛號、查核失敗、讀取失敗及寫入回覆遺失；不自動重試、不碰庫存。
- 125 個本機請求／回覆／原資料轉送檢查通過，涵蓋跨院回覆、錯單、錯版本格式、非管理者拒絕、SQL 錯誤代碼及不自動重試。它直接載入實際函式定義，但不執行 Django 裝飾器／middleware，不能代替完整 Django HTTP 測試。
- 既有靜態 API 清單與包內資料庫介面名稱對照通過；不是正式庫 schema diff。

沒有病患資料、正式帳號、外部 SQL 執行、正式站登入、LINE 推播或正式部署。

使用者核准本機安裝後，已於獨立目錄安裝 Django 5.2.18，manage.py check 無問題；完整 clinic 後端測試 217 項全數通過，包含12項 Django HTTP 邊界測試及5項正式病歷修訂檢查。Supabase／Auth 回覆使用測試替身，只有傳輸測試使用本機 HTTP 伺服器，未連線正式系統。舊版193項測試紀錄另存於 BASELINE_BUILD_INFO.json，不與本次混用。

可重現本機檢查：

```
python tools/verify_integration.py
node tests/medical-ui.cjs
node tests/desk-checkout-ui.cjs
node tests/visit-status-ui.cjs
node tests/checkout-ui.cjs
node tests/workflow-routing.cjs
```

這些命令不用資料庫或正式登入。本次已執行 manage.py check 及完整 clinic 測試；本包不自動安裝套件或部署。

## 統一交付與部署界線

本包只交付一次累積整合結果，包含完整工作樹、變更清單、保留證據與說明；不是再要求逐批套用。

1. 先依 CHANGESET-20261028.json 的原始 SHA256 比對欲更新的原專案檔案；若不同，保留目前檔案並做差異合併，不能直接整包強蓋。
2. 新增的 clinic/pos_workflow.py、clinic/pharmacy.py 必須與 config/urls.py 及相關變更 JS 一同更新；351 張圖必須與 block-01.js、block-04.js 及 manifest.json 同批交付。
3. 保留每個檔案的專案相對路徑，不能把 clinic、web 或 assets 內的檔案誤放根目錄。
4. 不需更新 SQL、Storage、Edge Functions、Secrets 或原環境變數。不要執行完整安裝 SQL，也不要把本包快照當作正式庫最新定義。
5. 正式部署沒有執行。部署時應使用獨立提交，回退整個同批提交；不要只回退 Python 或 manifest 而留下另一半前端。
6. 之後確認已部署版本，可使用 /api/health/ 的 edition；本文件不宣稱該版本已在線上。

如未來確實要搬移 RPC 交易或 Edge Functions，需先取得目前有效契約再另作具名變更。本次沒有為了完成清單而猜寫未知正式資料庫定義。

部署前可用唯讀比對工具（請把路徑換成現有專案根目錄）：

```
python tools/compare_update.py --target D:/your-genblue-project
```

它只列出可合併、已相同與衝突檔案，不會複製、覆蓋、提交 Git 或部署。出現衝突時須保留現有檔案並合併差異。
