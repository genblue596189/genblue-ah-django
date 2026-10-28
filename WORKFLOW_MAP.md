# genblue AH 流程維護對照

先找操作入口，再沿本表追到 Django 與 SQL。既有交易、RLS 與正式設定保留。這是程式維護索引，不代表全部 API 安全稽核完成。

| 操作 | Django 入口 | 程式 | 資料／交易負責處 | 保留事項 |
| --- | --- | --- | --- | --- |
| 登入與院所 | `/api/session/` | `clinic/views.py` | Supabase Auth／profile／trial | 即時寫入查核；唯讀快取沿用原規則 |
| 搜尋 | `/api/search/pets/` | `clinic/search.py` | owners／pets | 既有搜尋條件及院所篩選 |
| 建檔 | `/api/records/<entity>/` | `clinic/records.py` | owners／pets | 保留原 request_id |
| 掛號 | `/api/registration/` | `clinic/registration.py` | appointments | 原單程序鎖與資料庫約束；不宣稱分散式交易 |
| 指定醫師與接診 | `/api/clinic/<action>/` | `clinic/doctors.py` | 既有接診 RPC | 保留接診占用及原 SQL 權限 |
| 病歷與處方儲存 | `/api/medical/<action>/` | `clinic/medical.py` | medical_records／原封存 RPC | 接診權查核與既有儲存編號讀取可重疊；兩者成功才寫入 |
| 返回候診與歸檔 | `/api/medical-visit/<action>/` | `clinic/visit_status.py` | appointments／既有 claim RPC | 原流程保留 |
| 處方計算 | `/api/prescription/calculate/` | `clinic/prescription.py` | clinic/prescription_math.py | 已完成，不改既有劑量與單位規則 |
| 送待付款與收款 | `/api/checkout/<action>/` | `clinic/checkout.py` | pos_v77／家庭待付款 RPC | SQL 維持庫存與帳款交易；不自動重試寫入 |
| 待付款讀取與調劑 | `/api/pos/<action>/` | `clinic/pos_workflow.py` | pos_v77 | 固定動作與資料格式；原版本號 |
| 配藥室交接 | `/api/pharmacy/<action>/` | `clinic/pharmacy.py` | pharmacy_room_v9133 | 原送單 UUID／版本；SQL 權限與交接狀態 |
| 期間對帳 | `/api/period-reconciliation/` | `clinic/period_reconciliation.py` | period_reconcile_v20261027 | 原管理者核對／撤銷限制 |
| LINE 預約審核 | `/api/booking-review/<action>/` | `clinic/line_booking.py` | ob_line_staff_v1 | 原通知 outbox／排程，不改部署 |
| 既有相容路徑 | `/api/supabase/<path>/` | `clinic/gateway.py` | 明確 API allowlist／RLS | 其餘穩定入口保留；未知 RPC 不猜寫 |
