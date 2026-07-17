export const JOURNAL_STORAGE_KEY = "weian-journal-v0";
export const PAPER_LIBRARY_STORAGE_KEY = "weian-paper-library-v1";
export const PENDING_JOURNAL_STORAGE_KEY = "weian-pending-journal-entry";

function readJson(storage, key, fallback) {
  try {
    const rawValue = storage.getItem(key);
    return rawValue ? JSON.parse(rawValue) : fallback;
  } catch {
    return fallback;
  }
}

function getEntryDate(entry) {
  const rawDate = entry?.publishedAt || entry?.createdAt || entry?.updatedAt;
  const date = new Date(rawDate || "");
  return Number.isNaN(date.getTime()) ? null : date;
}

function getStartOfDay(date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

function formatCount(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function createLearningSnapshot({
  journalEntries = [],
  paperLibrary = [],
  hasPendingJournal = false,
  now = new Date(),
} = {}) {
  const today = getStartOfDay(now);
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - 6);

  const weeklyEntries = journalEntries.filter((entry) => {
    const entryDate = getEntryDate(entry);
    return entryDate && entryDate >= weekStart && entryDate <= now;
  });

  const studyDays = new Set(
    weeklyEntries.map((entry) => getStartOfDay(getEntryDate(entry)).toDateString())
  ).size;
  const weeklyHours = weeklyEntries.reduce(
    (total, entry) => total + Math.max(0, Number(entry?.timeSpent) || 0),
    0
  );
  const draftCount = journalEntries.filter(
    (entry) => entry?.status === "draft"
  ).length;
  const readingCount = paperLibrary.filter(
    (item) => item?.status === "reading"
  ).length;
  const toReadCount = paperLibrary.filter(
    (item) => item?.status === "to-read" || !item?.status
  ).length;
  const queueCount = readingCount + toReadCount;

  let nextStep = {
    value: "Start reflecting",
    detail: "A short Journal entry is enough to begin.",
  };

  if (draftCount) {
    nextStep = {
      value: "Finish a draft",
      detail: `${formatCount(draftCount, "Journal draft")} waiting to be completed.`,
    };
  } else if (hasPendingJournal) {
    nextStep = {
      value: "Review your AI summary",
      detail: "A summary is ready to turn into a Journal entry.",
    };
  } else if (readingCount) {
    nextStep = {
      value: "Continue reading",
      detail: `${formatCount(readingCount, "paper")} currently marked as Reading.`,
    };
  } else if (toReadCount) {
    nextStep = {
      value: "Choose your next paper",
      detail: `${formatCount(toReadCount, "paper")} saved in your reading queue.`,
    };
  } else if (journalEntries.length) {
    nextStep = {
      value: "Keep the rhythm",
      detail: "Your current learning queue is clear.",
    };
  }

  return {
    studyDays,
    weeklyEntries: weeklyEntries.length,
    weeklyHours,
    draftCount,
    readingCount,
    toReadCount,
    queueCount,
    nextStep,
  };
}

export function readLearningSnapshot(storage, now = new Date()) {
  const journalEntries = readJson(storage, JOURNAL_STORAGE_KEY, []);
  const paperLibrary = readJson(storage, PAPER_LIBRARY_STORAGE_KEY, []);
  const pendingJournal = readJson(storage, PENDING_JOURNAL_STORAGE_KEY, null);

  return createLearningSnapshot({
    journalEntries: Array.isArray(journalEntries) ? journalEntries : [],
    paperLibrary: Array.isArray(paperLibrary) ? paperLibrary : [],
    hasPendingJournal: Boolean(pendingJournal && typeof pendingJournal === "object"),
    now,
  });
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

export function renderLearningSnapshot(snapshot) {
  const hourLabel = Number.isInteger(snapshot.weeklyHours)
    ? snapshot.weeklyHours
    : snapshot.weeklyHours.toFixed(1);
  const rhythmDetail = snapshot.weeklyEntries
    ? `${formatCount(snapshot.weeklyHours, "hour")} recorded in the last 7 days.`
    : "No learning records in the last 7 days.";
  const journalDetail = snapshot.draftCount
    ? `${formatCount(snapshot.draftCount, "draft")} still waiting for you.`
    : snapshot.weeklyEntries
      ? "Keep adding short reflections while the details are fresh."
      : "Start your first learning record.";
  const readingDetail = snapshot.queueCount
    ? `${formatCount(snapshot.readingCount, "paper")} reading · ${formatCount(snapshot.toReadCount, "paper")} to read.`
    : "Save papers from Paper Scout to plan your reading.";

  setText("snapshotRhythmValue", formatCount(snapshot.studyDays, "day"));
  setText("snapshotRhythmDetail", rhythmDetail);
  setText("snapshotJournalValue", formatCount(snapshot.weeklyEntries, "entry", "entries"));
  setText("snapshotJournalDetail", journalDetail);
  setText("snapshotReadingValue", formatCount(snapshot.queueCount, "paper"));
  setText("snapshotReadingDetail", readingDetail);
  setText("snapshotNextValue", snapshot.nextStep.value);
  setText("snapshotNextDetail", snapshot.nextStep.detail);
  setText(
    "snapshotNote",
    `Last 7 days · ${hourLabel} ${snapshot.weeklyHours === 1 ? "hour" : "hours"} recorded · this data stays on your device.`
  );
}

function initializeLearningSnapshot() {
  if (!document.getElementById("learningSnapshot")) return;

  const refresh = () => renderLearningSnapshot(readLearningSnapshot(localStorage));
  const relevantKeys = new Set([
    JOURNAL_STORAGE_KEY,
    PAPER_LIBRARY_STORAGE_KEY,
    PENDING_JOURNAL_STORAGE_KEY,
  ]);

  refresh();

  window.addEventListener("storage", (event) => {
    if (relevantKeys.has(event.key)) refresh();
  });

  window.addEventListener("focus", refresh);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refresh();
  });

  document.addEventListener("change", (event) => {
    if (event.target.closest("[data-library-field]")) {
      setTimeout(refresh, 0);
    }
  });

  document.addEventListener("click", (event) => {
    if (event.target.closest('[data-library-action="remove"]')) {
      setTimeout(refresh, 0);
    }
  });
}

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", initializeLearningSnapshot);
}
