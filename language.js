export const LANGUAGE_STORAGE_KEY = "weian-language-hub-v1";
export const LANGUAGE_STORAGE_VERSION = 1;

export function createEmptyLanguageHub() {
  return {
    version: LANGUAGE_STORAGE_VERSION,
    activeLanguageId: "all",
    languages: [],
    sessions: [],
  };
}

function createId(prefix) {
  if (globalThis.crypto?.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[character]));
}

function formatCount(value, singular, plural = `${singular}s`) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function getStartOfDay(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getDate(value) {
  const date = new Date(value || "");
  return Number.isNaN(date.getTime()) ? null : date;
}

function getLastSevenDaysStart(now = new Date()) {
  const start = getStartOfDay(now);
  start.setDate(start.getDate() - 6);
  return start;
}

export function normalizeLanguageHub(raw) {
  const fallback = createEmptyLanguageHub();
  if (!raw || typeof raw !== "object") return fallback;

  const languages = Array.isArray(raw.languages)
    ? raw.languages
        .filter((language) => language && typeof language.id === "string")
        .map((language) => ({
          id: language.id,
          name: String(language.name || "Untitled language").trim().slice(0, 40),
          weeklyGoal: Math.min(14, Math.max(1, Number(language.weeklyGoal) || 3)),
          createdAt: language.createdAt || new Date().toISOString(),
        }))
        .filter((language) => language.name)
    : [];
  const knownIds = new Set(languages.map((language) => language.id));
  const sessions = Array.isArray(raw.sessions)
    ? raw.sessions
        .filter((session) => session && knownIds.has(session.languageId))
        .map((session) => ({
          id: typeof session.id === "string" ? session.id : createId("session"),
          languageId: session.languageId,
          type: String(session.type || "Practice").slice(0, 40),
          minutes: Math.min(600, Math.max(1, Number(session.minutes) || 1)),
          note: String(session.note || "").slice(0, 280),
          createdAt: getDate(session.createdAt)?.toISOString() || new Date().toISOString(),
        }))
    : [];
  const activeLanguageId = knownIds.has(raw.activeLanguageId)
    ? raw.activeLanguageId
    : "all";

  return {
    version: LANGUAGE_STORAGE_VERSION,
    activeLanguageId,
    languages,
    sessions,
  };
}

export function getLanguageMetrics(hub, languageId, now = new Date()) {
  const weekStart = getLastSevenDaysStart(now);
  const matchingSessions = hub.sessions.filter((session) => {
    const date = getDate(session.createdAt);
    return session.languageId === languageId && date && date >= weekStart && date <= now;
  });
  const minutes = matchingSessions.reduce((total, session) => total + session.minutes, 0);
  const days = new Set(
    matchingSessions.map((session) => getStartOfDay(session.createdAt).toDateString())
  ).size;

  return {
    sessions: matchingSessions.length,
    minutes,
    days,
  };
}

export function getLanguageNextStep(language, metrics) {
  if (!language) {
    return {
      title: "Start small",
      detail: "Add a language, then log a short practice session.",
    };
  }

  if (!metrics.sessions) {
    return {
      title: `Begin ${language.name}`,
      detail: "A 10-minute vocabulary, listening, or reading session is enough to begin.",
    };
  }

  const remaining = Math.max(0, language.weeklyGoal - metrics.sessions);
  if (remaining) {
    return {
      title: "Keep the rhythm",
      detail: `${formatCount(remaining, "more session")} to reach this week's ${language.weeklyGoal}-session goal.`,
    };
  }

  return {
    title: "Weekly goal reached",
    detail: "Nice work. Add an optional short session or switch to another language.",
  };
}

export function readLanguageHub(storage) {
  try {
    const raw = storage.getItem(LANGUAGE_STORAGE_KEY);
    return normalizeLanguageHub(raw ? JSON.parse(raw) : null);
  } catch {
    return createEmptyLanguageHub();
  }
}

function saveLanguageHub(storage, hub) {
  storage.setItem(LANGUAGE_STORAGE_KEY, JSON.stringify(hub));
}

function formatDate(value) {
  const date = getDate(value);
  if (!date) return "Recently";
  return date.toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
  });
}

function initializeLanguageHub() {
  const app = document.querySelector("[data-language-hub]");
  if (!app) return;

  const themeToggle = document.getElementById("themeToggle");
  const languageTabs = document.getElementById("languageTabs");
  const addForm = document.getElementById("languageAddForm");
  const formStatus = document.getElementById("languageFormStatus");
  const languageNameInput = document.getElementById("newLanguageName");
  const languageGoalInput = document.getElementById("newLanguageGoal");
  const overview = document.getElementById("languageOverview");
  const overviewDescription = document.getElementById("languageOverviewDescription");
  const practiceForm = document.getElementById("practiceForm");
  const practiceLanguage = document.getElementById("practiceLanguage");
  const practiceType = document.getElementById("practiceType");
  const practiceMinutes = document.getElementById("practiceMinutes");
  const practiceNote = document.getElementById("practiceNote");
  const savePracticeButton = document.getElementById("savePracticeButton");
  const nextTitle = document.getElementById("nextStepTitle");
  const nextDetail = document.getElementById("languageNextDetail");
  const recentDescription = document.getElementById("recentPracticeDescription");
  const practiceList = document.getElementById("practiceList");
  let hub = readLanguageHub(localStorage);

  function save() {
    saveLanguageHub(localStorage, hub);
  }

  function setThemeIcon() {
    if (!themeToggle) return;
    themeToggle.textContent = document.documentElement.classList.contains("dark") ? "☀︎" : "☾";
  }

  function getSelectedLanguage() {
    return hub.languages.find((language) => language.id === hub.activeLanguageId) || null;
  }

  function renderTabs() {
    if (!languageTabs) return;
    const buttons = [
      { id: "all", name: "All languages" },
      ...hub.languages.map((language) => ({ id: language.id, name: language.name })),
    ];

    languageTabs.innerHTML = buttons
      .map((language) => {
        const isActive = hub.activeLanguageId === language.id;
        return `
          <button
            class="language-tab ${isActive ? "is-active" : ""}"
            type="button"
            role="tab"
            aria-selected="${isActive}"
            data-language-tab="${escapeHtml(language.id)}"
          >${escapeHtml(language.name)}</button>
        `;
      })
      .join("");
  }

  function renderPracticeLanguageOptions() {
    if (!practiceLanguage || !savePracticeButton) return;
    const selectedLanguage = getSelectedLanguage();
    const selectedId = selectedLanguage?.id || practiceLanguage.value || hub.languages[0]?.id || "";

    practiceLanguage.innerHTML = hub.languages.length
      ? hub.languages
          .map((language) => `<option value="${escapeHtml(language.id)}">${escapeHtml(language.name)}</option>`)
          .join("")
      : '<option value="">Add a language first</option>';
    practiceLanguage.value = selectedId;
    practiceLanguage.disabled = !hub.languages.length;
    savePracticeButton.disabled = !hub.languages.length;
  }

  function renderOverview() {
    if (!overview || !overviewDescription) return;
    const visibleLanguages = hub.activeLanguageId === "all"
      ? hub.languages
      : hub.languages.filter((language) => language.id === hub.activeLanguageId);

    if (!visibleLanguages.length) {
      overview.innerHTML = `
        <article class="language-empty-state">
          <strong>Your first language starts here.</strong>
          <p>Add a language above, set a weekly session goal, and keep each short practice in one clear place.</p>
        </article>
      `;
      overviewDescription.textContent = "Add a language to start your overview.";
      return;
    }

    overviewDescription.textContent = hub.activeLanguageId === "all"
      ? `${formatCount(visibleLanguages.length, "language")} in one clear overview.`
      : "This view is focused on your selected language.";
    overview.innerHTML = visibleLanguages
      .map((language) => {
        const metrics = getLanguageMetrics(hub, language.id);
        const progress = Math.min(100, Math.round((metrics.sessions / language.weeklyGoal) * 100));
        return `
          <article class="language-overview-card">
            <div class="language-card-top">
              <span>${escapeHtml(language.name)}</span>
              <small>${language.weeklyGoal} sessions / week</small>
            </div>
            <strong>${metrics.sessions}<span> / ${language.weeklyGoal}</span></strong>
            <p>${formatCount(metrics.minutes, "minute")} · ${formatCount(metrics.days, "learning day")}</p>
            <div class="language-progress" aria-label="${escapeHtml(language.name)} weekly progress">
              <span style="--language-progress: ${progress}%"></span>
            </div>
          </article>
        `;
      })
      .join("");
  }

  function renderNextStep() {
    if (!nextTitle || !nextDetail) return;
    const selected = getSelectedLanguage();
    const referenceLanguage = selected || (hub.activeLanguageId === "all" ? hub.languages[0] : null);
    const nextStep = getLanguageNextStep(
      referenceLanguage,
      referenceLanguage ? getLanguageMetrics(hub, referenceLanguage.id) : null
    );
    nextTitle.textContent = nextStep.title;
    nextDetail.textContent = nextStep.detail;
  }

  function renderPracticeList() {
    if (!practiceList || !recentDescription) return;
    const visibleSessions = hub.sessions
      .filter((session) => hub.activeLanguageId === "all" || session.languageId === hub.activeLanguageId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 8);
    const languageById = new Map(hub.languages.map((language) => [language.id, language]));

    recentDescription.textContent = hub.activeLanguageId === "all"
      ? "Your latest sessions across every language."
      : "Your latest sessions for the selected language.";

    if (!visibleSessions.length) {
      practiceList.innerHTML = `
        <article class="language-empty-state compact">
          <strong>No practice logged yet.</strong>
          <p>Your short vocabulary, reading, listening, speaking, or writing sessions will appear here.</p>
        </article>
      `;
      return;
    }

    practiceList.innerHTML = visibleSessions
      .map((session) => {
        const language = languageById.get(session.languageId);
        return `
          <article class="practice-item">
            <div>
              <p class="practice-item-meta">${escapeHtml(language?.name || "Language")} · ${escapeHtml(session.type)} · ${session.minutes} min · ${formatDate(session.createdAt)}</p>
              <p class="practice-item-note">${escapeHtml(session.note || "Short practice session recorded.")}</p>
            </div>
            <button type="button" class="practice-delete" data-session-id="${escapeHtml(session.id)}" aria-label="Delete practice record">Delete</button>
          </article>
        `;
      })
      .join("");
  }

  function render() {
    renderTabs();
    renderPracticeLanguageOptions();
    renderOverview();
    renderNextStep();
    renderPracticeList();
  }

  function selectLanguage(languageId) {
    hub.activeLanguageId = languageId === "all" || hub.languages.some((language) => language.id === languageId)
      ? languageId
      : "all";
    save();
    render();
  }

  const savedTheme = localStorage.getItem("weian-theme");
  if (savedTheme === "dark") document.documentElement.classList.add("dark");
  setThemeIcon();

  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      document.documentElement.classList.toggle("dark");
      localStorage.setItem("weian-theme", document.documentElement.classList.contains("dark") ? "dark" : "light");
      setThemeIcon();
    });
  }

  if (languageTabs) {
    languageTabs.addEventListener("click", (event) => {
      const button = event.target.closest("[data-language-tab]");
      if (button) selectLanguage(button.dataset.languageTab);
    });
  }

  if (addForm && languageNameInput && languageGoalInput && formStatus) {
    addForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const name = languageNameInput.value.trim();
      const duplicate = hub.languages.some((language) => language.name.toLowerCase() === name.toLowerCase());
      if (!name) return;
      if (duplicate) {
        formStatus.textContent = "This language is already in your workspace.";
        return;
      }

      const language = {
        id: createId("language"),
        name: name.slice(0, 40),
        weeklyGoal: Math.min(14, Math.max(1, Number(languageGoalInput.value) || 3)),
        createdAt: new Date().toISOString(),
      };
      hub.languages.push(language);
      hub.activeLanguageId = language.id;
      save();
      addForm.reset();
      languageGoalInput.value = "3";
      formStatus.textContent = `${language.name} is ready. Log a short first practice below.`;
      render();
    });
  }

  if (practiceForm && practiceLanguage && practiceType && practiceMinutes && practiceNote) {
    practiceForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const languageId = practiceLanguage.value;
      if (!hub.languages.some((language) => language.id === languageId)) return;

      hub.sessions.unshift({
        id: createId("session"),
        languageId,
        type: practiceType.value,
        minutes: Math.min(600, Math.max(1, Number(practiceMinutes.value) || 1)),
        note: practiceNote.value.trim().slice(0, 280),
        createdAt: new Date().toISOString(),
      });
      hub.activeLanguageId = languageId;
      save();
      practiceNote.value = "";
      practiceMinutes.value = "15";
      render();
    });
  }

  if (practiceList) {
    practiceList.addEventListener("click", (event) => {
      const button = event.target.closest("[data-session-id]");
      if (!button) return;
      hub.sessions = hub.sessions.filter((session) => session.id !== button.dataset.sessionId);
      save();
      render();
    });
  }

  window.addEventListener("storage", (event) => {
    if (event.key !== LANGUAGE_STORAGE_KEY) return;
    hub = readLanguageHub(localStorage);
    render();
  });

  render();
}

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", initializeLanguageHub);
}
