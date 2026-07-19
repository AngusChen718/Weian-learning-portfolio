import { Storage, getLocalDateString } from "./storage.js";

export const BACKUP_VERSION = 1;
const JOURNAL_KEY = "weian-journal-v0";
const PAPER_LIBRARY_KEY = "weian-paper-library-v1";
const PAPER_HISTORY_KEY = "weian-paper-search-history";
const PENDING_JOURNAL_KEY = "weian-pending-journal-entry";
const LANGUAGE_KEY = "weian-language-hub-v1";

function moduleEnvelope(schemaVersion, fields) {
  return { schemaVersion, ...fields };
}

export function createBackupPayload(exportedAt = new Date()) {
  const journalEntries = Storage.get(JOURNAL_KEY, []);
  const paperLibrary = Storage.get(PAPER_LIBRARY_KEY, []);
  const searchHistory = Storage.get(PAPER_HISTORY_KEY, []);
  const pendingJournalEntry = Storage.get(PENDING_JOURNAL_KEY, null);
  const languageHub = Storage.get(LANGUAGE_KEY, null);

  return {
    backupVersion: BACKUP_VERSION,
    exportedAt: exportedAt.toISOString(),
    app: "weian-learning-portfolio",
    data: {
      journal: moduleEnvelope(1, { entries: Array.isArray(journalEntries) ? journalEntries : [] }),
      paperScout: moduleEnvelope(1, {
        papers: Array.isArray(paperLibrary) ? paperLibrary : [],
        searchHistory: Array.isArray(searchHistory) ? searchHistory : [],
        pendingJournalEntry: pendingJournalEntry && typeof pendingJournalEntry === "object" ? pendingJournalEntry : null,
      }),
      languageHub: moduleEnvelope(1, {
        languages: languageHub && typeof languageHub === "object" ? languageHub : { version: 1, activeLanguageId: "all", languages: [], sessions: [] },
      }),
    },
  };
}

export function createBackupFilename(exportedAt = new Date()) {
  return `weian-backup-${getLocalDateString(exportedAt)}.json`;
}

function downloadBackup(payload, filename) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function validateModule(module, requiredField) {
  return module && typeof module === "object" && Number(module.schemaVersion) <= 1 && requiredField in module;
}

export function restoreBackupPayload(payload) {
  if (!payload || typeof payload !== "object" || payload.app !== "weian-learning-portfolio") {
    throw new Error("檔案格式錯誤，無法讀取");
  }
  if (!Number.isFinite(Number(payload.backupVersion))) throw new Error("檔案格式錯誤，無法讀取");
  const notices = [];
  if (Number(payload.backupVersion) > BACKUP_VERSION) notices.push("此備份檔案版本較新，部分資料可能無法正確還原。");
  const data = payload.data || {};

  if (validateModule(data.journal, "entries") && Array.isArray(data.journal.entries)) {
    Storage.set(JOURNAL_KEY, data.journal.entries);
    notices.push("Journal 已還原");
  } else notices.push("Journal 資料格式不符，已跳過");

  if (validateModule(data.paperScout, "papers") && Array.isArray(data.paperScout.papers)) {
    Storage.set(PAPER_LIBRARY_KEY, data.paperScout.papers);
    Storage.set(PAPER_HISTORY_KEY, Array.isArray(data.paperScout.searchHistory) ? data.paperScout.searchHistory : []);
    if (data.paperScout.pendingJournalEntry) Storage.set(PENDING_JOURNAL_KEY, data.paperScout.pendingJournalEntry);
    else Storage.remove(PENDING_JOURNAL_KEY);
    notices.push("Paper Scout 已還原");
  } else notices.push("Paper Scout 資料格式不符，已跳過");

  if (validateModule(data.languageHub, "languages") && data.languageHub.languages && typeof data.languageHub.languages === "object") {
    Storage.set(LANGUAGE_KEY, data.languageHub.languages);
    notices.push("Language Hub 已還原");
  } else notices.push("Language Hub 資料格式不符，已跳過");
  return notices;
}

function initializeBackupControls() {
  const exportButton = document.getElementById("exportBackupButton");
  const importInput = document.getElementById("importBackupInput");
  const status = document.getElementById("backupStatus");
  if (!exportButton || !importInput || !status) return;

  exportButton.addEventListener("click", () => {
    try {
      const now = new Date();
      downloadBackup(createBackupPayload(now), createBackupFilename(now));
      status.textContent = "備份已下載。資料只會保留在你的裝置上。";
    } catch (error) {
      console.error("Backup export failed:", error);
      status.textContent = "無法建立備份，請再試一次。";
    }
  });

  importInput.addEventListener("change", async () => {
    const [file] = importInput.files || [];
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      const confirmed = window.confirm("匯入將覆蓋目前瀏覽器中的 Journal、Paper Scout 與 Language Hub 資料，此動作無法復原。建議先匯出目前資料作為備份。要繼續嗎？");
      if (!confirmed) return;
      status.textContent = `${restoreBackupPayload(payload).join("；")}。建議重新整理頁面確認資料。`;
    } catch (error) {
      console.warn("Backup import failed:", error);
      status.textContent = error?.message || "檔案格式錯誤，無法讀取。";
    } finally {
      importInput.value = "";
    }
  });
}

if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", initializeBackupControls);
