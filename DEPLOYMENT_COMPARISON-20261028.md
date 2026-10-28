# Render 部署來源比對｜2026-10-28

## 確認的來源

- 使用者提供的 Render 畫面：genblue596189/genblue-ah-django，main，Live 提交 34ae501。
- GitHub 原始 ZIP 的 comment：34ae501b3ae7cca421905313f196761ba0fb28af。
- 兩者提交編號一致；本版以 genblue-ah-django-main.zip 為正式比對基準。
- 先前 genblue-ah-main.zip 是純 HTML 的另一個程式庫，不作為本次 Django 部署基準。

## 比對實際找到的差異

正式 ZIP 相對先前 genblue-AH-django版(2).zip，有6個不同檔案：clinic/medical.py、assets/frontend/index/block-01.js、assets/frontend/manifest.json、web/index.html，以及兩個期間收據／核對測試。另有9個新增靜態資產／說明，及2個先前封存才有的文件／測試。

這次正式比對擋下三個整合衝突：medical.py、block-01.js、manifest.json。先前整合包不能直接覆蓋本次正式來源；本版已完成合併。

## 保留的正式修正

- /api/medical/revise/ 與 revise_consultation_draft_v1 的原參數契約。
- 病歷儲存時的 appointment_id／claim_id 關聯與 row_version 回覆。
- visit.checkoutRecordV1 使返回後修改同一病歷，攜帶 expected_version；不改成新增另一筆。
- 未確認儲存結果時阻擋換內容另存的前端保護。
- 「返回修改本次病歷」按鈕、原看診／處方狀態還原，以及已送待付款／配藥保留／未確認收款時的阻擋。
- 備份 booking_tables 數量相容修正。

## 合併方式與驗證界線

block-01.js 對正式 GitHub 版本僅替換 JOURNAL_BRITISH_CAT 圖片常數，其他全部文字一致；web/index.html 完全與正式來源一致。
medical.py 保留正式 revise、row_version、vaccine_info 規則，只加上既有唯讀查核重疊整理。保存8個與正式來源AST一致的醫療函式，以及新增病歷修訂與返回流程檢查。
manifest 依合併後全部455個資產重新產生。GitHub新增檔案保留；兩個期間收據測試沿用整合版較完整的測試資料，未變更其正式業務實作。

沒有部署 Render、執行 Supabase SQL 或修改帳號與環境變數。此比對根據使用者提供的ZIP與Render畫面，沒有登入遠端控制台。

正式已使用的 revise_consultation_draft_v1 沿用，不要求重跑舊 SQL。包內資料庫安裝檔仍是歷史快照，不可因本次交付就拿來重建正式庫；本次也不宣稱該快照可完整建立目前正式版本。
