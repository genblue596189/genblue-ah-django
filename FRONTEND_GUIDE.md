# 前端與後端維護導覽

| 位置 | 負責內容 |
| --- | --- |
| web/*.html | 頁面結構、載入順序；保留會動態修改的具名樣式 |
| assets/frontend/index/ | 主系統各段既有程式與獨立樣式 |
| assets/frontend/booking/ | 公開預約頁程式與樣式 |
| assets/frontend/imaging-share/ | 影像分享頁程式與樣式 |
| assets/frontend/images/ | 由原 HTML 拆出的圖片 |
| clinic/records.py | 新增飼主／寵物、同 UUID 核對、院所與關聯驗證 |
| clinic/prescription_math.py | Python 處方數量算式 |
| clinic/prescription.py | 登入與本院藥品驗證、換算 HTTP 入口 |
| clinic/frontend_assets.py | 前端資源提供範圍 |
| clinic/checkout.py、medical.py 等 | 已整合的業務請求 |

前端腳本仍使用原有全域函式關係；修改時維持依賴順序。檔名沿用原 script id 便於對照，不代表需保留舊邏輯的多份副本。block-01.js 是原主程式，其餘多為原先擴充功能，尚未全部重寫成無全域依賴的模組。

## JavaScript 檔案

| 檔案 | 部分入口／說明 |
| --- | --- |
| assets/frontend/booking/block-01.js | bookingHoursStateV9131, bookingAcceptingNowV9127, updateBookingHoursV9127, turnstileReady, load |
| assets/frontend/imaging-share/imagingShareViewerV76.js | status, scheduleExpiry, reset, fail, dateText |
| assets/frontend/index/billingPresetsV80.js | billingPresetScopeV80, billingPresetStatusV80, billingPresetValidateV80, billingPresetExistsV80, billingPresetRenderV80 |
| assets/frontend/index/block-01.js | initializeApp, staffMessage, staffInvoke, loadStaffMembers, createStaffMember |
| assets/frontend/index/block-02.js | updateJournalPageLayout, updateJournalClinicHeading, openJournalAppointmentForm, journalLocalDateKey, setJournalScheduleMode |
| assets/frontend/index/block-03.js | breedPictureKey, breedPictureMessage, resetBreedPictureCache, loadBreedPictures, fetchBreedPicture |
| assets/frontend/index/block-04.js | initializeBreedLibrary, setJournalDefaultAvatar, openBreedLibraryPicker, closeBreedLibraryPicker, renderBreedLibraryPicker |
| assets/frontend/index/block-05.js | appointmentPetSearchLabel, clearAppointmentPetSearch, invalidateAppointmentPetSearch, chooseAppointmentPet, searchAppointmentPets |
| assets/frontend/index/block-23.js | message, button, rpc, action, closeReview |
| assets/frontend/index/block-28.js | prescriptionCopyScopeV65, closePrescriptionCopyV65, makePrescriptionDraftRowV65, openPrescriptionCopyV65, applyPrescriptionCopyV65 |
| assets/frontend/index/block-30.js | update, clear, ensure, action, unbase64 |
| assets/frontend/index/block-31.js | deriveScheduledKeyV72, backupB64V72, backupUnb64V72, encryptScheduledV72, decryptScheduledV72 |
| assets/frontend/index/block-46.js | navigationScopeV802, navigationActiveV802, navigationStateV802, navigationReplaceV802 |
| assets/frontend/index/block-47.js | posScopeNowV77, posMedicalV77, posNodeV77, posButtonV77, posInputV77 |
| assets/frontend/index/block-66.js | controls, render, reset, load, save |
| assets/frontend/index/block-71.js | reset, refresh, action, configureGenblue |
| assets/frontend/index/block-72.js | parseCalendarIds, unload, remember, render, refresh |
| assets/frontend/index/block-73.js | nightRememberV93, nightRpcV93, nightVisitV93, nightAmountV93, nightCheckV93 |
| assets/frontend/index/block-74.js | openHomeRegistrationV931 |
| assets/frontend/index/block-75.js | periodEscapeV932, periodMoneyV932, periodDateV932, periodWarningsV932, periodDocumentV932 |
| assets/frontend/index/block-76.js | medicineProfileV94, speciesReferenceV94, profileFormV94, fillProfileV94, installProfileV94 |
| assets/frontend/index/closedReviewV905.js | paymentClosedScopeV905, paymentSavedCheckV905, paymentShowSavedV905, paymentMarkEditedV905 |
| assets/frontend/index/dicomEmbeddedV791.js | parseDicomV77, dicomDistanceV78, dicomAreaV78, dicomAngleV78, statusV78 |
| assets/frontend/index/dicomImportV77.js | parseDicomV77, convertDicomV77 |
| assets/frontend/index/dispensingGroupsV75.js | dispensingScopeV75, dispensingMetaV75, dispensingNowV75, dispensingRowMetaV75, dispensingGroupLabelV75 |
| assets/frontend/index/doctorOverviewV55.js | doctorCardTextV55 |
| assets/frontend/index/doctorStatsV57.js | queryDoctorDetailsV58, doctorStatsMoneyV57, doctorStatsDateV57, openDoctorStatsV57, doctorStatsCellV57 |
| assets/frontend/index/enterNavigationV9123.js | usable, reserved, focus |
| assets/frontend/index/familyFeaturesV74.js | visitPurposeV74, purposeNotesV74, familyAllowedV74, familyKeyV74, familyStateNowV74 |
| assets/frontend/index/familyRecoveryV903.js | familyRestoreOneV903, familyOpenNextV903, familyReturnOneV903 |
| assets/frontend/index/fastOwnerPetV908.js | ownerScopeV908, ownerPrepareV908, ownerMergeRowsV908, ownerCacheUpsertV908, ownerFormRenderV908 |
| assets/frontend/index/imagingDeleteV79.js | imagingDeleteKeyV79, imagingDeleteTasksV79, imagingDeleteWriteV79, imagingDeleteBadgeV79, imagingDeleteParamsV79 |
| assets/frontend/index/imagingRefreshV781.js | imShareRefreshAfterUploadV781 |
| assets/frontend/index/imagingShareAdminV76.js | imShareAllowedV76, imShareScopeV76, imShareStatusV76, imShareClearV76, imShareEnsureV76 |
| assets/frontend/index/imagingUploadV61.js | imagingScopeV61, imagingMessageV61, imagingElementV61, imagingLockV61, imagingResetV61 |
| assets/frontend/index/labEightFieldHeaderV35.js | labPrintHeaderValues, labPrintEightFieldHeader |
| assets/frontend/index/mediaBackupV62.js | backupCRCV62, backupHashBytesV62, backupScopeV62, validateBookingBackupV62, validateStorageBackupV62 |
| assets/frontend/index/medicalBillingHistoryV37.js | medicalBillingScope, medicalBillingMoney, renderMedicalBillingRows, loadMedicalBillingHistory |
| assets/frontend/index/medicalExchangeNavigationV47.js | medicalExchangeScope, syncMedicalExchangeReturn, goToDiagnosticExchangeFromMedical, backToMedicalFromDiagnosticExchange |
| assets/frontend/index/medicalImageShareV762.js | 頁面啟動與事件處理 |
| assets/frontend/index/medicalPetEditV792.js | medicalPetEditScopeV792, medicalPetEditValidV792, medicalPetEditStatusV792, medicalPetEditRenderV792, goToOwnerPetFromMedicalV792 |
| assets/frontend/index/medicalPurchaseHistoryV90.js | purchaseScopeV90, purchaseDayV90, purchaseResetV90, purchaseRowsV90, purchaseRenderV90 |
| assets/frontend/index/medicalReturnV918.js | medicalReturnSnapshotV918, returnToWaitingWithoutSaveV75_4 |
| assets/frontend/index/medicalReturnWithoutSaveV75_4.js | returnToWaitingWithoutSaveV75_4 |
| assets/frontend/index/medicalRevisionV53.js | medicalEditAllowedV53, medicalEditScopeV53, medicalEditStatusV53, medicalEditValidV53, medicalEditBusyV53 |
| assets/frontend/index/medicalTemperatureV43.js | setMedicalTemperatureStatus, markMedicalTemperatureDraft, readMedicalTemperatureForSave, persistMedicalTemperature, saveMedicalTemperatureOnBlur |
| assets/frontend/index/medicalVitalsV9121.js | confirmWeight |
| assets/frontend/index/medicalVitalsV9132.js | medicalVitalsOwnedLineV9132, medicalVitalsBodyV9132, medicalVitalsHeaderV9132, medicalVitalsSyncV9132 |
| assets/frontend/index/medicalWeightV42.js | medicalWeightScope, setMedicalWeightStatus, markMedicalWeightDraft, readMedicalWeightForSave, persistMedicalWeight |
| assets/frontend/index/medicationBillingV64.js | prepareMedicationGroupsV64, appendMedicationGroupsV64, collectMedicationFeesV64 |
| assets/frontend/index/movementCorrectionV9119.js | correctionRpcV9119, correctionMessageV9119, correctionLoadV9119 |
| assets/frontend/index/movementFeedbackV9118.js | movementNoticeV9118 |
| assets/frontend/index/multiDoctorV51.js | clinicDjangoRpcV4, doctorScopeV51, appointmentDoctorAssignmentV51, setAppointmentDoctorV51, renderDoctorChoicesV51 |
| assets/frontend/index/paidHistoryV907.js | paidTodayV907, paidDayV907, paidFilterResetV907, paidProgressMatchesV907, paidInvoicesV907 |
| assets/frontend/index/paidMedicalResetV9117.js | paidMedicalSnapshotV9117, clearCompletedMedicalV9117, checkCompletedMedicalV9117 |
| assets/frontend/index/paymentTotalV904.js | paymentCentsV904, paymentCheckV904, paymentRenderTotalV904, paymentMountV904 |
| assets/frontend/index/pharmacyRoomV9133.js | pharmacyScopeV9133, pharmacyKeyV9133, pharmacyNodeV9133, pharmacyMessageV9133, pharmacyRpcV9133 |
| assets/frontend/index/prescriptionDoseUnitV763.js | formatPrescriptionDoseV763, injectionConcentrationV9113, injectionDefaultUnitV9113, setInjectionVolumeV9113, syncPrescriptionDoseUnitV91 |
| assets/frontend/index/prescriptionKeyboardV901.js | prescriptionResultRowsV901, prescriptionHighlightV901, prescriptionCloseV901, prescriptionKeydownV901 |
| assets/frontend/index/prescriptionRoutesV66.js | singlePrescriptionRouteV9111, simpleRouteV944, renderPrescriptionRoutesV66, prescriptionRouteV66, prescriptionKindV66 |
| assets/frontend/index/previousChargesV75_2.js | previousChargeScopeV75_2, clearPreviousChargesV75_2, previousChargeDateV75_2, previousChargeItemsV75_2, previousChargeLineAmountV75_2 |
| assets/frontend/index/qrEncoderV76.js | qrPolynomial, toUTF8Array |
| assets/frontend/index/rabiesDefaultsV9112.js | rabiesDefaultKeyV9112, rabiesDefaultStatusV9112, rabiesDefaultScopeCheckV9112, rememberRabiesDefaultsV9112, applyRabiesDefaultsV9112 |
| assets/frontend/index/rapidDefaultFeeV41.js | parseRapidDefaultFee, applyRapidDefaultFee, saveRapidDefaultFee, refreshRapidFeeSettings, selectRapidFeeSetting |
| assets/frontend/index/restoreCenterScriptV63.js | restoreMessageV63, ensureRestoreAdminV63, restoreBusySetV63, resetRestoreComparisonV63, verifyRestoreArchiveV63 |
| assets/frontend/index/sharedRefreshV50.js | clinicRefreshScopeV50, clinicRefreshStatusV50, refreshOwnerPetCacheV50, refreshAppointmentsV50, refreshClinicDataV50 |
| assets/frontend/index/skylaIntegrationV33.js | skylaScope, skylaClinicalAllowed, skylaStatus, skylaDigest, skylaRecordId |
| assets/frontend/index/skylaSolutionParserV33.js | parse |
| assets/frontend/index/staffClinicianV52.js | appendStaffClinicianV52 |
| assets/frontend/index/staffNamesV56.js | appendStaffNameV56 |
| assets/frontend/index/vaccineCheckoutResetV9115.js | clearPaidVaccineFormV9115 |
| assets/frontend/index/vaccineDueV9114.js | vaccineIntervalV9114, vaccineDueDateV9114, syncVaccineDueV9114 |
| assets/frontend/index/vaccineRabiesRemindersV39.js | vaccineToday, rabiesName, syncRabiesForm, collectRabiesDetails, clearRabiesFields |
| assets/frontend/index/versionV9010.js | 頁面啟動與事件處理 |
| assets/frontend/index/versionV902.js | 頁面啟動與事件處理 |
| assets/frontend/index/versionV906.js | 頁面啟動與事件處理 |
| assets/frontend/index/versionV91.js | 頁面啟動與事件處理 |
| assets/frontend/index/waitingDoctorV54.js | waitingDoctorAllowedV54, waitingDoctorActionV54, waitingDoctorStatusV54, waitingDoctorValidV54, closeWaitingDoctorV54 |
