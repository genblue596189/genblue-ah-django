# Windows 更新工具

將整合包解壓在現有 Git 專案以外的位置。需要 Python 3.10 以上與 Git。
在解壓後的 genblue-ah 目錄開啟 PowerShell，先檢查（不寫入）：

```powershell
.\update-windows.ps1 -Target 'D:\genblue-ah-django'
```

檢查通過後套用同一批整合檔：

```powershell
.\update-windows.ps1 -Target 'D:\genblue-ah-django' -Apply
```

Target 必須是含 manage.py、clinic 的 Git 根目錄，HEAD 必須為 34ae501b3ae7cca421905313f196761ba0fb28af。未提交修改、未追蹤檔案、版本不符、路徑或 SHA256 衝突都會停止。請先保留自己的修改，不要為了通過檢查刪除檔案。

工具只複製 CHANGESET 列出的檔案，逐一驗證來源與結果；不處理未列出的設定、資料庫或環境檔。首次寫入前，在目標專案旁建立 update-backup 目錄，recovery.json 記錄原目標及每個檔案的前後 SHA256；files 子目錄保留原檔。複製中途失敗會嘗試還原已碰觸檔案，仍須檢查錯誤與 Git diff。工具不提交、不推送、不呼叫 Supabase 或 Render。

手動回復時，先保留更新後新增的工作，依 recovery.json 將 files 內的原檔複製回相同路徑；baseline_sha256 為 null 的項目僅在目前雜湊仍等於 updated_sha256 時移除。不要使用清除整個專案的命令。

更新成功後用 git diff 檢閱，再依既有方式測試、提交與部署。
本次已在 Linux 以臨時 Git 專案驗證更新引擎；環境沒有 PowerShell，未實際執行 Windows 包裝器。前一輪 217 項 Django 結果屬包內既有紀錄，本輪未重跑整套臨床測試。
