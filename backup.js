export const BACKUP_VERSION = 1;

export const BACKUP_KEYS = [
  { key: "weian-theme", format: "text" },
  { key: "weian-journal-v0", format: "json" },
  { key: "weian-paper-search-history", format: "json" },
  { key: "weian-paper-library-v1", format: "json" },
  { key: "weian-pending-journal-entry", format: "json" },
  { key: "weian-language-hub-v1", format: "json" },
];

function readStorageRecord(storage, definition, warnings) {
  const rawValue = storage.getItem(definition.key);

  if (rawValue === null) {
    return {
      present: false,
      format: definition.format,
      value: null,
    };
  }

  if (definition.format === "text") {
    return {
      present: true,
      format: "text",
      value: rawValue,
    };
  }

  try {
    return {
      present: true,
      format: "json",
      value: JSON.parse(rawValue),
    };
  } catch {
    warnings.push(
      `${definition.key} contained invalid JSON, so its original text was preserved.`
    );

    return {
      present: true,
      format: "raw",
      value: rawValue,
    };
  }
}

export function createBackupPayload(storage, exportedAt = new Date()) {
  const warnings = [];
  const data = {};

  BACKUP_KEYS.forEach((definition) => {
    data[definition.key] = readStorageRecord(storage, definition, warnings);
  });

  return {
    app: "Weian Learning Portfolio",
    version: BACKUP_VERSION,
    exportedAt: exportedAt.toISOString(),
    data,
    warnings,
  };
}

export function createBackupFilename(exportedAt = new Date()) {
  const date = exportedAt.toISOString().slice(0, 10);
  return `weian-learning-portfolio-backup-${date}.json`;
}

function downloadBackup(payload, filename) {
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();

  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function initializeBackupExport() {
  const exportButton = document.getElementById("exportBackupButton");
  const backupStatus = document.getElementById("backupStatus");

  if (!exportButton || !backupStatus) return;

  exportButton.addEventListener("click", () => {
    try {
      const exportedAt = new Date();
      const payload = createBackupPayload(localStorage, exportedAt);
      const storedCount = Object.values(payload.data).filter(
        (record) => record.present
      ).length;

      downloadBackup(payload, createBackupFilename(exportedAt));

      backupStatus.textContent =
        `Backup downloaded · ${storedCount} stored data group${
          storedCount === 1 ? "" : "s"
        } included.`;
    } catch (error) {
      console.error("Backup export failed:", error);
      backupStatus.textContent =
        "Backup could not be created. Please try again.";
    }
  });
}

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", initializeBackupExport);
}
