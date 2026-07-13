 function escapeHtml(string) {
  return String(string).replace(/[&<>"']/g, (match) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[match]));
}

function shortenText(text, maxLength) {
  if (!text) return "";

  if (text.length <= maxLength) {
    return text;
  }

  return text.slice(0, maxLength).trim() + "...";
}

document.addEventListener("DOMContentLoaded", () => {
  const root = document.documentElement;
  const themeToggle = document.getElementById("themeToggle");
  const savedTheme = localStorage.getItem("weian-theme");

  if (savedTheme === "dark") {
    root.classList.add("dark");
  }

  updateThemeIcon();

  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      root.classList.add("theme-changing");
      themeToggle.classList.add("icon-fade");

      void root.offsetWidth;

      requestAnimationFrame(() => {
        root.classList.toggle("dark");

        localStorage.setItem(
          "weian-theme",
          root.classList.contains("dark") ? "dark" : "light"
        );

        setTimeout(() => {
          updateThemeIcon();
          themeToggle.classList.remove("icon-fade");
        }, 120);

        setTimeout(() => {
          root.classList.remove("theme-changing");
        }, 450);
      });
    });
  }

  const uploadButton = document.getElementById("uploadButton");
  const fileInput = document.getElementById("fileInput");
  const fileName = document.getElementById("fileName");
  const articleText = document.getElementById("articleText");
 const articleClearButton = document.getElementById("articleClearButton");
  const summaryButton = document.getElementById("summaryButton");
  const summaryOutput = document.getElementById("summaryOutput");

  const AI_API_URL =
    "https://weian-summary-api.fdr5hn7ry7.workers.dev/summarize";
  const PAPER_SEARCH_API_URL =
    "https://paper-search.fdr5hn7ry7.workers.dev/search";

  const paperQuery = document.getElementById("paperQuery");
  const paperSearchButton = document.getElementById("paperSearchButton");
  const paperStatus = document.getElementById("paperStatus");
  const paperResults = document.getElementById("paperResults");
  const paperClearButton = document.getElementById("paperClearButton");
  const readingFilter = document.getElementById("readingFilter");
 const historyOpenButton = document.getElementById("historyOpenButton");
const historyCloseButton = document.getElementById("historyCloseButton");
const historyBackdrop = document.getElementById("historyBackdrop");
const historyDrawer = document.getElementById("historyDrawer");
const historyList = document.getElementById("historyList");
const historyClearButton = document.getElementById("historyClearButton");

const SEARCH_HISTORY_KEY = "weian-paper-search-history";

 let lastPaperResults = [];
let currentPaperPage = 1;
let activeReadingFilter = "all";
let searchHistory = loadSearchHistory();

let currentAnalysisContext = null;
let latestSummaryText = "";

const PAPERS_PER_PAGE = 5;
const MAX_SEARCH_HISTORY = 10;
const PENDING_JOURNAL_KEY = "weian-pending-journal-entry";

let thinkingTimer = null;
let thinkingIndex = 0;

  const SUMMARY_EMPTY_HTML = `
    <div class="summary-empty">
      <div class="summary-empty-icon">â¦</div>
      <p>ä½ çæè¦çµææåºç¾å¨éè£¡ã</p>
      <span>è²¼ä¸æç« å§å®¹å¾ï¼é¸æåææ¹å¼ä¸¦éå§çæã</span>
    </div>
  `;

  function setSummaryState(state, html) {
    const summaryOutput = document.getElementById("summaryOutput");
    const summaryBody = document.getElementById("summaryBody");

    if (!summaryOutput || !summaryBody) return;

    summaryOutput.dataset.state = state;
    summaryBody.innerHTML = html;
    summaryBody.scrollTop = 0;
  }

  function resetSummaryState() {
    setSummaryState("empty", SUMMARY_EMPTY_HTML);
  }

  function getFriendlySummaryError(error) {
    const message = error?.message || String(error);

    const isBusy =
      message.includes("503") ||
      message.includes("UNAVAILABLE") ||
      message.includes("high demand") ||
      message.includes("overloaded");

    if (isBusy) {
      return "AI ç®åå¤ªå¿äºï¼è«ç¨å¾åè©¦ã\n\nä½ çæç« å§å®¹å·²ä¿çï¼ä¸éè¦éæ°è²¼ä¸ã";
    }

    return `ç®åç¡æ³ç¢çæè¦ï¼\n\n${message}`;
  }

  if (uploadButton && fileInput) {
    uploadButton.addEventListener("click", () => fileInput.click());
  }

  if (fileInput) {
    fileInput.addEventListener("change", async (event) => {
      const file = event.target.files[0];
      if (!file) return;

      if (fileName) {
        fileName.textContent = `Selected: ${file.name}`;
      }

      if (
        file.type === "text/plain" ||
        file.name.endsWith(".md") ||
        file.name.endsWith(".txt")
      ) {
        const text = await file.text();

        if (articleText) {
  articleText.value = text.slice(0, 8000);
  updateArticleClearButton();
}

currentAnalysisContext = {
  title: file.name.replace(/\.(txt|md)$/i, ""),
  category: "Research",
  tags: ["Uploaded Text", "AI Summary"],
  sourceUrl: "",
  researchTopic: "Uploaded article",
};

generateLocalSummary(text);
      } else {
        setSummaryState("error", `
          <div class="summary-error">
            <strong>Prototype Notice</strong>

            å·²æ¶å°æªæ¡ï¼${escapeHtml(file.name)}

            éåçæ¬åå®æä¸å³ä»é¢ãPDF / Word ççæ­£ AI æè¦éè¦å¾çºä¸²æ¥å¾ç«¯è AI APIã
          </div>
        `);

        scrollToSummaryOutput();
      }
    });
  }

  if (summaryButton) {
    summaryButton.addEventListener("click", () => {
      if (!articleText || !summaryOutput) return;

      const text = articleText.value.trim();

      if (!text) {
        setSummaryState("empty", `
          <div class="summary-empty">
            <div class="summary-empty-icon">â¦</div>
            <p>è«åè²¼ä¸æç« å§å®¹ã</p>
            <span>è²¼ä¸ä¸æ®µæç« æä¸å³ TXT æªå¾ï¼åé»æ Generate Summaryã</span>
          </div>
        `);

        scrollToSummaryOutput();
        return;
      }
currentAnalysisContext = {
  title: "AI Research Note",
  category: "Research",
  tags: ["AI Summary", "Research"],
  sourceUrl: "",
  researchTopic: "Manual input",
};
      generateLocalSummary(text);
    });
  }

 if (articleText) {
  articleText.addEventListener("input", updateArticleClearButton);
}

if (articleClearButton) {
  articleClearButton.addEventListener("click", clearArticleAnalysis);
}

  if (paperSearchButton) {
    paperSearchButton.addEventListener("click", searchPapers);
  }

  if (paperQuery) {
    paperQuery.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        searchPapers();
      }
    });

    paperQuery.addEventListener("input", updateClearButton);
  }

  if (paperClearButton) {
    paperClearButton.addEventListener("click", () => {
      if (paperQuery) {
        paperQuery.value = "";
        paperQuery.focus();
      }

      if (paperResults) {
        paperResults.innerHTML = "";
      }

      if (paperStatus) {
        paperStatus.textContent = "è«è¼¸å¥ééµå­éå§æå°ã";
      }

      lastPaperResults = [];
      currentPaperPage = 1;

      updateClearButton();
      setSearchButtonState("idle");
    });
  }

  document.querySelectorAll("[data-topic]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!paperQuery) return;

      paperQuery.value = button.dataset.topic;
      updateClearButton();
      searchPapers();
    });
  });

  if (readingFilter) {
    readingFilter.addEventListener("click", (event) => {
      const button = event.target.closest("[data-reading-filter]");
      if (!button) return;

      activeReadingFilter = button.dataset.readingFilter;
      currentPaperPage = 1;

      updateReadingFilterUI();
      renderPaperResults(lastPaperResults);
    });
  }
 if (historyOpenButton) {
  historyOpenButton.addEventListener("click", openHistoryDrawer);
}

if (historyCloseButton) {
  historyCloseButton.addEventListener("click", closeHistoryDrawer);
}

if (historyBackdrop) {
  historyBackdrop.addEventListener("click", closeHistoryDrawer);
}

if (historyClearButton) {
  historyClearButton.addEventListener("click", () => {
    searchHistory = [];
    localStorage.removeItem(SEARCH_HISTORY_KEY);
    renderSearchHistory();
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeHistoryDrawer();
  }
});

  async function generateLocalSummary(text) {
    const cleanText = text.trim();
   hideCreateJournalEntryButton();

    if (!cleanText) {
      resetSummaryState();
      return;
    }

    setSummaryState("loading", `
      <div class="summary-loading">
        <span class="thinking-dot"></span>
        <div>
          <p class="thinking-label">AI Research Assistant</p>
          <p class="thinking-text show" id="thinkingText">Reading your text...</p>
        </div>
      </div>
    `);

    scrollToSummaryOutput();
    startThinkingLines();

    try {
      const response = await fetch(AI_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          text: cleanText
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
          data?.message ||
          JSON.stringify(data, null, 2) ||
          "Unknown AI summary error"
        );
      }

      const summary =
        data?.summary ||
        data?.result ||
        data?.text ||
        "";

      if (!summary) {
        throw new Error("AI æ²æåå³æè¦å§å®¹ã");
      }

      stopThinkingLines();

     latestSummaryText = summary;

setSummaryState("result", `
  <div class="ai-summary summary-pop">
    ${formatSummary(summary)}
  </div>
`);

showCreateJournalEntryButton();
scrollToSummaryOutput();
    } catch (error) {
      stopThinkingLines();

      const friendlyMessage = getFriendlySummaryError(error);

      setSummaryState("error", `
  <div class="summary-error">
    <p>${escapeHtml(friendlyMessage).replace(/\n/g, "<br>")}</p>

    <div class="summary-error-actions">
      <a
        href="https://gemini.google.com/"
        target="_blank"
        rel="noreferrer"
      >
        Open Gemini
      </a>
    </div>
  </div>
`);

      scrollToSummaryOutput();
    }
  }

  function formatSummary(text) {
    return escapeHtml(text)
      .replace(/^---$/gm, "")
      .replace(/^\s*---\s*$/gm, "")
      .replace(/^## (.*)$/gm, "<h2>$1</h2>")
      .replace(/^### (.*)$/gm, "<h3>$1</h3>")
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(
        /^\s*(\d+)\.\s*(.*)$/gm,
        '<p class="summary-point"><span>$1.</span> $2</p>'
      )
      .replace(
        /^\s*- (.*)$/gm,
        '<p class="summary-point"><span>â¢</span> $1</p>'
      )
      .replace(
        /^\s*â¢\s*(.*)$/gm,
        '<p class="summary-point"><span>â¢</span> $1</p>'
      )
      .replace(/\n{3,}/g, "\n\n")
      .split("\n")
      .filter((line) => line.trim() !== "")
      .join("<br>");
  }

  async function searchPapers() {
    if (!paperQuery || !paperStatus || !paperResults) return;

    const query = paperQuery.value.trim();

    if (!query) {
      paperStatus.textContent = "è«åè¼¸å¥ç ç©¶ä¸»é¡ã";
      setSearchButtonState("idle");
      return;
    }

    paperStatus.textContent = "æ­£å¨æå°æç»ï¼è«ç¨ç­...";
    renderPaperSkeletons();
    setSearchButtonState("loading");

    try {
      const response = await fetch(
        `${PAPER_SEARCH_API_URL}?q=${encodeURIComponent(query)}&limit=50`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "æç»æå°å¤±æã");
      }

      lastPaperResults = cleanAndRankPapers(data.papers || []);
currentPaperPage = 1;
activeReadingFilter = "all";

saveSearchHistory(query, lastPaperResults.length);

updateReadingFilterUI();
renderPaperResults(lastPaperResults);

      setSearchButtonState("done");

      setTimeout(() => {
        setSearchButtonState("idle");
      }, 1200);
    } catch (error) {
      paperStatus.textContent = `æå°å¤±æï¼${error.message}`;
      setSearchButtonState("idle");
    }
  }


  function getCitationPerYear(paper) {
    const year = Number(paper.year || 0);
    const citations = Number(paper.citedByCount || 0);
    const currentYear = new Date().getFullYear();

    if (!year || !citations) return 0;

    const age = Math.max(1, currentYear - year + 1);
    return Math.round((citations / age) * 10) / 10;
  }

  function getJournalBadge(paper) {
    const venue = String(paper.venue || "").toLowerCase().trim();

    if (
      venue === "nature" ||
      venue.startsWith("nature ") ||
      venue.includes("nature communications") ||
      venue.includes("nature materials") ||
      venue.includes("nature chemistry") ||
      venue.includes("nature catalysis") ||
      venue.includes("nature energy") ||
      venue.includes("nature nanotechnology") ||
      venue.includes("nature biotechnology")
    ) {
      return "Nature Family";
    }

    if (
      venue === "science" ||
      venue.includes("science advances") ||
      venue.includes("science robotics") ||
      venue.includes("science translational medicine") ||
      venue.includes("science immunology") ||
      venue.includes("science signaling")
    ) {
      return "Science Family";
    }

    if (
      venue.includes("advanced materials") ||
      venue.includes("chemical reviews") ||
      venue.includes("journal of the american chemical society") ||
      venue.includes("angewandte chemie") ||
      venue.includes("acs nano") ||
      venue.includes("nano letters") ||
      venue.includes("energy & environmental science")
    ) {
      return "High Impact";
    }

    return "";
  }

  function getPaperQualityScore(paper) {
    const year = Number(paper.year || 0);
    const currentYear = new Date().getFullYear();
    const citationPerYear = getCitationPerYear(paper);
    const journalBadge = getJournalBadge(paper);

    let score = citationPerYear * 10;

    if (year >= currentYear - 1) score += 25;
    else if (year >= currentYear - 3) score += 16;
    else if (year >= 2020) score += 8;

    if (journalBadge === "Nature Family" || journalBadge === "Science Family") {
      score += 30;
    } else if (journalBadge === "High Impact") {
      score += 18;
    }

    return score;
  }

  function cleanAndRankPapers(papers) {
    const currentYear = new Date().getFullYear();

    const withTitle = papers.filter((paper) => {
      return String(paper.title || "").trim();
    });

    const recentPapers = withTitle.filter((paper) => {
      const year = Number(paper.year || 0);
      return year >= 2020;
    });

    const papersToUse = recentPapers.length >= 5 ? recentPapers : withTitle;

    return papersToUse.sort((a, b) => {
      return getPaperQualityScore(b) - getPaperQualityScore(a);
    });
  }

  function renderPaperSkeletons(count = 5) {
    if (!paperResults) return;

    paperResults.innerHTML = Array.from({ length: count })
      .map(
        () => `
          <article class="paper-card skeleton-card">
            <div class="skeleton-top">
              <div class="skeleton-content">
                <div class="skeleton-line skeleton-small"></div>
                <div class="skeleton-line skeleton-title"></div>
                <div class="skeleton-line skeleton-title short"></div>
              </div>
              <div class="skeleton-score"></div>
            </div>

            <div class="skeleton-line skeleton-meta"></div>
            <div class="skeleton-line skeleton-author"></div>

            <div class="skeleton-line"></div>
            <div class="skeleton-line"></div>
            <div class="skeleton-line short"></div>

            <div class="skeleton-tags">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </article>
        `
      )
      .join("");
  }

  function renderPaperResults(papers) {
    if (!paperStatus || !paperResults) return;

    updateReadingFilterUI();

    if (!papers.length) {
      paperStatus.textContent = "æ¾ä¸å°ç¸éæç»ã";

      paperResults.innerHTML = `
        <div class="paper-empty">
          æ¾ä¸å°ç¸éæç»ï¼è«æä¸åééµå­ã
        </div>
      `;
      return;
    }

    const filteredPapers = filterPapersByReadingLabel(papers);

    if (!filteredPapers.length) {
      paperStatus.textContent = `ç®åæ²æ ${getFilterDisplayName(activeReadingFilter)} é¡åçæç»ã`;

      paperResults.innerHTML = `
        <div class="paper-empty">
          ç®åæ²æç¬¦åéååé¡çæç»ï¼å¯ä»¥åå All æ¥çå¨é¨çµæã
        </div>
      `;
      return;
    }

    const totalPages = Math.ceil(filteredPapers.length / PAPERS_PER_PAGE);

    if (currentPaperPage > totalPages) {
      currentPaperPage = totalPages;
    }

    const startIndex = (currentPaperPage - 1) * PAPERS_PER_PAGE;
    const visiblePapers = filteredPapers.slice(
      startIndex,
      startIndex + PAPERS_PER_PAGE
    );

    if (activeReadingFilter === "all") {
      paperStatus.textContent = `æ¾å° ${papers.length} ç¯æç»ï¼ç®åé¡¯ç¤ºç¬¬ ${currentPaperPage} / ${totalPages} é ã`;
    } else {
      paperStatus.textContent = `${getFilterDisplayName(activeReadingFilter)}ï¼${filteredPapers.length} ç¯ï¼ç®åé¡¯ç¤ºç¬¬ ${currentPaperPage} / ${totalPages} é ã`;
    }

    const paperCards = visiblePapers
      .map((paper) => {
        const index = lastPaperResults.indexOf(paper);

        const reasons = (paper.reasons || [])
          .slice(0, 3)
          .map((reason) => `<li>${escapeHtml(reason)}</li>`)
          .join("");

        const concepts = (paper.concepts || [])
          .slice(0, 4)
          .map((concept) => `<span>${escapeHtml(concept)}</span>`)
          .join("");

        const journalBadge = getJournalBadge(paper);
        const citationPerYear = getCitationPerYear(paper);

        return `
          <article class="paper-card">
            <div class="paper-card-top">
              <div>
                <p class="paper-priority">
                  ${escapeHtml(paper.stars || "")} ${escapeHtml(paper.priority || "")}
                  ${journalBadge ? `<span class="journal-badge">${escapeHtml(journalBadge)}</span>` : ""}
                </p>
                <h3>${escapeHtml(paper.title || "Untitled")}</h3>
              </div>

              <div class="paper-score">
                <span>${paper.score || 0}</span>
                <small>${getReadingLabel(paper)}</small>
              </div>
            </div>

            <p class="paper-meta">
              ${escapeHtml(String(paper.year || "Unknown"))}
              Â· ${escapeHtml(paper.venue || "Unknown source")}
              Â· Citations: ${paper.citedByCount || 0}
              ${citationPerYear ? ` Â· ${citationPerYear}/year` : ""}
            </p>

            <p class="paper-authors">
              ${escapeHtml(paper.authors || "Unknown authors")}
            </p>

            <p class="paper-abstract">
              ${escapeHtml(
                shortenText(
                  paper.abstract || "No abstract available.",
                  360
                )
              )}
            </p>

            <div class="paper-tags">
              ${concepts}
            </div>

            <div class="paper-reasons">
              <strong>æ¨è¦åå </strong>
              <ul>${reasons}</ul>
            </div>

            <div class="paper-actions">
              <button type="button" data-action="analyze" data-index="${index}">
                Analyze
              </button>
              <button type="button" data-action="open" data-index="${index}">
                Open
              </button>
            </div>
          </article>
        `;
      })
      .join("");

    const pagination = `
      <div class="paper-pagination">
        <button
          type="button"
          id="prevPaperPage"
          ${currentPaperPage === 1 ? "disabled" : ""}
        >
          â Previous
        </button>

        <span>
          Page ${currentPaperPage} of ${totalPages}
        </span>

        <button
          type="button"
          id="nextPaperPage"
          ${currentPaperPage === totalPages ? "disabled" : ""}
        >
          Next â
        </button>
      </div>
    `;

    paperResults.innerHTML = paperCards + pagination;

    paperResults.querySelectorAll("[data-action]").forEach((button) => {
      button.addEventListener("click", handlePaperAction);
    });

    const prevButton = document.getElementById("prevPaperPage");
    const nextButton = document.getElementById("nextPaperPage");

    if (prevButton) {
      prevButton.addEventListener("click", () => {
        if (currentPaperPage > 1) {
          currentPaperPage -= 1;
          renderPaperResults(lastPaperResults);
          scrollToPaperResultsTop();
        }
      });
    }

    if (nextButton) {
      nextButton.addEventListener("click", () => {
        if (currentPaperPage < totalPages) {
          currentPaperPage += 1;
          renderPaperResults(lastPaperResults);
          scrollToPaperResultsTop();
        }
      });
    }
  }

  function handlePaperAction(event) {
    const button = event.currentTarget;
    const index = Number(button.dataset.index);
    const action = button.dataset.action;
    const paper = lastPaperResults[index];

    if (!paper) return;

    if (action === "open") {
      const url = paper.openAccessUrl || paper.doi || paper.openAlexUrl;

      if (url) {
        window.open(url, "_blank");
      }

      return;
    }

    if (action === "analyze") {
      if (!articleText || !summaryOutput) return;

      const text = `
Title:
${paper.title}

Authors:
${paper.authors}

Year:
${paper.year}

Source:
${paper.venue}

Citations:
${paper.citedByCount}

Priority:
${paper.priority}

Reasons:
${(paper.reasons || []).join("ã")}

Abstract:
${paper.abstract}
      `.trim();
currentAnalysisContext = {
  title: paper.title || "Research Note",
  category: "Research",
  tags: (paper.concepts || []).slice(0, 4),
  sourceUrl: paper.openAccessUrl || paper.doi || paper.openAlexUrl || "",
  researchTopic: paperQuery?.value?.trim() || "",
};
      articleText.value = text;
      updateArticleClearButton();

      setSummaryState("loading", `
        <div class="summary-loading">
          <span class="thinking-dot"></span>
          <div>
            <p class="thinking-label">AI Research Assistant</p>
            <p class="thinking-text show" id="thinkingText">Preparing paper analysis...</p>
          </div>
        </div>
      `);

      scrollToSummaryOutput();
      generateLocalSummary(text);
    }
  }
function ensureSummaryJournalActions() {
  if (!summaryOutput) return null;

  let actions = document.getElementById("summaryJournalActions");

  if (actions) {
    return actions;
  }

  actions = document.createElement("div");
  actions.id = "summaryJournalActions";
  actions.className = "summary-journal-actions";
  actions.hidden = true;

  actions.innerHTML = `
    <button
      type="button"
      class="create-journal-entry-button"
      id="createJournalEntryButton"
    >
      ï¼ Create Journal Entry
    </button>
  `;

  summaryOutput.insertAdjacentElement("afterend", actions);

  const button = actions.querySelector("#createJournalEntryButton");

  if (button) {
    button.addEventListener("click", createJournalEntryFromSummary);
  }

  return actions;
}

function showCreateJournalEntryButton() {
  const actions = ensureSummaryJournalActions();

  if (!actions) return;

  actions.hidden = false;

  requestAnimationFrame(() => {
    actions.classList.add("is-visible");
  });
}

function hideCreateJournalEntryButton() {
  const actions = document.getElementById("summaryJournalActions");

  if (!actions) return;

  actions.classList.remove("is-visible");

  setTimeout(() => {
    actions.hidden = true;
  }, 180);
}

function createJournalEntryFromSummary() {
  const context = currentAnalysisContext || {};

  const payload = {
    title: context.title || "AI Research Note",
    category: context.category || "Research",
    tags:
      Array.isArray(context.tags) && context.tags.length
        ? context.tags
        : ["AI Summary", "Research"],
    sourceUrl: context.sourceUrl || "",
    researchTopic: context.researchTopic || paperQuery?.value?.trim() || "",
    summary: latestSummaryText || "",
    createdAt: new Date().toISOString(),
  };

  localStorage.setItem(PENDING_JOURNAL_KEY, JSON.stringify(payload));

  window.location.href = "journal.html?from=summary#editor";
}
  function updateThemeIcon() {
    if (!themeToggle) return;

    if (root.classList.contains("dark")) {
      themeToggle.textContent = "âï¸";
    } else {
      themeToggle.textContent = "â¾";
    }
  }
function openHistoryDrawer() {
  renderSearchHistory();

  if (historyBackdrop) {
    historyBackdrop.hidden = false;

    requestAnimationFrame(() => {
      historyBackdrop.classList.add("is-open");
    });
  }

  if (historyDrawer) {
    historyDrawer.classList.add("is-open");
    historyDrawer.setAttribute("aria-hidden", "false");
  }
}

function closeHistoryDrawer() {
  if (historyBackdrop) {
    historyBackdrop.classList.remove("is-open");

    setTimeout(() => {
      historyBackdrop.hidden = true;
    }, 240);
  }

  if (historyDrawer) {
    historyDrawer.classList.remove("is-open");
    historyDrawer.setAttribute("aria-hidden", "true");
  }
}

function loadSearchHistory() {
  try {
    const saved = JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY));

    if (Array.isArray(saved)) {
      return saved;
    }

    return [];
  } catch {
    return [];
  }
}

function saveSearchHistory(query, resultCount = 0) {
  const cleanQuery = query.trim();

  if (!cleanQuery) return;

  const normalizedQuery = cleanQuery.toLowerCase();

  searchHistory = searchHistory.filter((item) => {
    return item.query.toLowerCase() !== normalizedQuery;
  });

  searchHistory.unshift({
    id: `history-${Date.now()}`,
    query: cleanQuery,
    resultCount,
    searchedAt: new Date().toISOString(),
  });

  searchHistory = searchHistory.slice(0, MAX_SEARCH_HISTORY);

  localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(searchHistory));
  renderSearchHistory();
}

function renderSearchHistory() {
  if (!historyList) return;

  if (!searchHistory.length) {
    historyList.innerHTML = `
      <div class="history-empty">
        <p>No search history yet.</p>
        <span>æå°æç»å¾ï¼ç´éæåºç¾å¨éè£¡ã</span>
      </div>
    `;
    return;
  }

  historyList.innerHTML = searchHistory
    .map((item) => {
      return `
        <button
          type="button"
          class="history-item"
          data-history-query="${escapeHtml(item.query)}"
        >
          <p class="history-query">${escapeHtml(item.query)}</p>
          <p class="history-meta">
            ${Number(item.resultCount || 0)} papers Â· ${formatHistoryTime(item.searchedAt)}
          </p>
        </button>
      `;
    })
    .join("");

  historyList.querySelectorAll("[data-history-query]").forEach((button) => {
    button.addEventListener("click", () => {
      const query = button.dataset.historyQuery;

      if (!paperQuery || !query) return;

      paperQuery.value = query;
      updateClearButton();
      closeHistoryDrawer();
      searchPapers();
    });
  });
}

function formatHistoryTime(dateString) {
  if (!dateString) return "unknown time";

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return "unknown time";
  }

  return date.toLocaleString("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
 function updateArticleClearButton() {
  if (!articleClearButton || !articleText) return;

  articleClearButton.hidden = !articleText.value.trim();
}

function clearArticleAnalysis() {
  if (!articleText) return;

  articleText.value = "";
  latestSummaryText = "";
  currentAnalysisContext = null;

  if (fileInput) {
    fileInput.value = "";
  }

  if (fileName) {
    fileName.textContent = "æ¯æ´ TXT ç¤ºç¯æè¦ï¼PDF / DOC æåé¡¯ç¤ºç­å¾ä¸²æ¥ AIã";
  }

  hideCreateJournalEntryButton();

  setSummaryState("empty", `
    <div class="summary-empty">
      <div class="summary-empty-icon">â¦</div>
      <p>ä½ çæè¦çµææåºç¾å¨éè£¡ã</p>
      <span>è²¼ä¸æç« å§å®¹å¾ï¼é¸æåææ¹å¼ä¸¦éå§çæã</span>
    </div>
  `);

  updateArticleClearButton();
  articleText.focus();
}
  function updateClearButton() {
    if (!paperClearButton || !paperQuery) return;

    if (paperQuery.value.trim()) {
      paperClearButton.classList.add("show");
    } else {
      paperClearButton.classList.remove("show");
    }
  }

  function getReadingLabel(paper) {
    const score = Number(paper.score || 0);
    const priority = String(paper.priority || "").toLowerCase();
    const reasons = (paper.reasons || []).join(" ").toLowerCase();

    if (
      score >= 90 ||
      priority.includes("essential") ||
      reasons.includes("review")
    ) {
      return "Start Here";
    }

    if (score >= 75) {
      return "Core";
    }

    return "Explore";
  }

  function getReadingFilterKey(paper) {
    const label = getReadingLabel(paper);

    if (label === "Start Here") return "start";
    if (label === "Core") return "core";
    return "explore";
  }

  function filterPapersByReadingLabel(papers) {
    if (activeReadingFilter === "all") {
      return papers;
    }

    return papers.filter((paper) => {
      return getReadingFilterKey(paper) === activeReadingFilter;
    });
  }

  function getFilterDisplayName(filter) {
    if (filter === "start") return "Start Here";
    if (filter === "core") return "Core";
    if (filter === "explore") return "Explore";
    return "All";
  }

  function updateReadingFilterUI() {
    if (!readingFilter) return;

    const counts = {
      all: lastPaperResults.length,
      start: 0,
      core: 0,
      explore: 0,
    };

    lastPaperResults.forEach((paper) => {
      const key = getReadingFilterKey(paper);
      counts[key] += 1;
    });

    readingFilter.querySelectorAll("[data-reading-filter]").forEach((button) => {
      const key = button.dataset.readingFilter;
      const count = button.querySelector(".filter-count");

      button.classList.toggle("active", key === activeReadingFilter);

      if (count) {
        count.textContent = counts[key] || 0;
      }
    });
  }

  function setSearchButtonState(state) {
    if (!paperSearchButton) return;

    if (state === "loading") {
      paperSearchButton.disabled = true;
      paperSearchButton.classList.add("is-searching");
      paperSearchButton.textContent = "Searching...";
      return;
    }

    if (state === "done") {
      paperSearchButton.disabled = true;
      paperSearchButton.classList.remove("is-searching");
      paperSearchButton.textContent = "â Done";
      return;
    }

    paperSearchButton.disabled = false;
    paperSearchButton.classList.remove("is-searching");
    paperSearchButton.textContent = "Search Papers";
  }

  function startThinkingLines() {
    const thinkingText = document.getElementById("thinkingText");

    if (!thinkingText) return;

    const lines = [
      "Reading paper metadata...",
      "Extracting abstract...",
      "Checking research relevance...",
      "Identifying key findings...",
      "Building structured notes...",
      "Preparing AI summary...",
    ];

    clearInterval(thinkingTimer);

    thinkingIndex = 0;
    thinkingText.textContent = lines[thinkingIndex];

    requestAnimationFrame(() => {
      thinkingText.classList.add("show");
    });

    thinkingTimer = setInterval(() => {
      thinkingText.classList.remove("show");

      setTimeout(() => {
        thinkingIndex = (thinkingIndex + 1) % lines.length;
        thinkingText.textContent = lines[thinkingIndex];
        thinkingText.classList.add("show");
      }, 420);
    }, 1700);
  }

  function stopThinkingLines() {
    clearInterval(thinkingTimer);
    thinkingTimer = null;
  }

  function scrollToPaperResultsTop() {
    if (!paperStatus) return;

    requestAnimationFrame(() => {
      const headerOffset = 110;
      const targetPosition =
        paperStatus.getBoundingClientRect().top +
        window.scrollY -
        headerOffset;

      smoothScrollTo(targetPosition, 720);
    });
  }

  function smoothScrollTo(targetY, duration = 720) {
    const startY = window.scrollY;
    const distance = targetY - startY;
    const startTime = performance.now();

    function easeInOutCubic(t) {
      return t < 0.5
        ? 4 * t * t * t
        : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    function step(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeInOutCubic(progress);

      window.scrollTo(0, startY + distance * easedProgress);

      if (progress < 1) {
        requestAnimationFrame(step);
      }
    }

    requestAnimationFrame(step);
  }

  function scrollToSummaryOutput() {
    if (!summaryOutput) return;

    requestAnimationFrame(() => {
      const summaryBody = document.getElementById("summaryBody");

      if (summaryBody) {
        summaryBody.scrollTop = 0;
      }

      const scrollableSummary = summaryOutput.querySelector(
        ".ai-summary, .summary-error, .summary-body"
      );

      if (scrollableSummary) {
        scrollableSummary.scrollTop = 0;
      }

      summaryOutput.scrollTop = 0;

      const headerOffset = 210;
      const targetPosition =
        summaryOutput.getBoundingClientRect().top +
        window.scrollY -
        headerOffset;

      window.scrollTo({
        top: targetPosition,
        behavior: "smooth",
      });
    });
  }

 updateClearButton();
updateArticleClearButton();
renderSearchHistory();
});

(() => {
  const app = document.querySelector("[data-journal-app]");
  if (!app) return;

  const STORAGE_KEY = "weian-journal-v0";
  const PENDING_JOURNAL_KEY = "weian-pending-journal-entry";
  const MAX_IMAGES = 3;

  const elements = {
    list: document.getElementById("journalEntryList"),
    search: document.getElementById("journalSearch"),
    filters: [...document.querySelectorAll("[data-journal-filter]")],

    newEntry: document.getElementById("newEntryBtn"),
    editEntry: document.getElementById("editEntryBtn"),
    deleteEntry: document.getElementById("deleteEntryBtn"),
    clearEditor: document.getElementById("clearEditorBtn"),
    saveDraft: document.getElementById("saveDraftBtn"),
    publish: document.getElementById("publishEntryBtn"),

    detailDate: document.getElementById("detailDate"),
    detailTitle: document.getElementById("detailTitle"),
    detailMeta: document.getElementById("detailMeta"),
    detailContent: document.getElementById("detailContent"),
    detailTags: document.getElementById("detailTags"),
    detailImages: document.getElementById("detailImages"),
    detail: document.getElementById("journalDetail"),
    detailClose: document.getElementById("journalDetailClose"),
    detailBackdrop: document.getElementById("journalDetailBackdrop"),

    title: document.getElementById("entryTitle"),
    category: document.getElementById("entryCategory"),
    visibility: document.getElementById("entryVisibility"),
    mood: document.getElementById("entryMood"),
    time: document.getElementById("entryTime"),
    date: document.getElementById("entryDate"),
    tags: document.getElementById("entryTags"),
    content: document.getElementById("entryContent"),
    editor: document.getElementById("editor"),

    imageButton: document.getElementById("entryImageButton"),
    imageInput: document.getElementById("entryImageInput"),
    imagePreview: document.getElementById("entryImagePreview"),

    lightbox: document.getElementById("journalLightbox"),
    lightboxImage: document.getElementById("journalLightboxImage"),
    lightboxClose: document.getElementById("journalLightboxClose"),
  };

  const requiredEditorElements = [
    elements.list,
    elements.newEntry,
    elements.clearEditor,
    elements.saveDraft,
    elements.publish,
    elements.title,
    elements.category,
    elements.visibility,
    elements.mood,
    elements.time,
    elements.tags,
    elements.content,
    elements.editor,
  ];

  if (requiredEditorElements.some((element) => !element)) {
    console.error("Journal HTML è script.js æ²æå°ä¸ï¼è«ç¢ºèª Journal æ¬ä½ IDã");
    return;
  }

  const seedEntries = [
    {
      id: "seed-1",
      title: "Building Paper Scout UI",
      category: "Development",
      visibility: "public",
      status: "published",
      mood: "ðµ",
      timeSpent: 4,
      tags: ["CSS", "JavaScript", "Paper Scout"],
      images: [],
      content:
        "ä»å¤©æ´çäº Paper Scout çä»é¢ãAI Summary é¢æ¿èæå°çµæäºåã\n\néå°æå¤§çåé¡æ¯ Summary åå¡çæ²åèåºå® Navbar äºç¸å½±é¿ã\n\nä¸ä¸æ­¥æ¯å»ºç« Journal Workspaceï¼è®å­¸ç¿ç´éå¯ä»¥ç´æ¥å¨ç¶²ç«ä¸æ°å¢èç®¡çã",
      createdAt: "2026-07-01T12:00:00.000Z",
      updatedAt: "2026-07-01T12:00:00.000Z",
      publishedAt: "2026-07-01T12:00:00.000Z",
    },
    {
      id: "seed-2",
      title: "Testing AI Research Notes",
      category: "Research",
      visibility: "private",
      status: "draft",
      mood: "ð",
      timeSpent: 2,
      tags: ["AI", "Literature", "Research Notes"],
      images: [],
      content:
        "æ¸¬è©¦æ AI Summary æ¹æ Research Notes æ ¼å¼ã\n\nå¸ææªä¾æ¯ç¯æç»é½å¯ä»¥èªåæ´çç ç©¶åé¡ãæ¹æ³ãéè¦ç¼ç¾ãéå¶èé±è®ç­ç¥ã",
      createdAt: "2026-06-30T12:00:00.000Z",
      updatedAt: "2026-06-30T12:00:00.000Z",
      publishedAt: null,
    },
  ];

  let state = {
    entries: loadEntries(),
    selectedId: null,
    editingId: null,
    filter: "all",
    search: "",
  };

  let editorImages = [];

  function loadEntries() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);

      if (raw === null) {
        return seedEntries.map((entry) => ({ ...entry }));
      }

      const saved = JSON.parse(raw);

      if (!Array.isArray(saved)) {
        return seedEntries.map((entry) => ({ ...entry }));
      }

      return saved.map((entry) => ({
        ...entry,
        tags: Array.isArray(entry.tags) ? entry.tags : [],
        images: Array.isArray(entry.images) ? entry.images : [],
      }));
    } catch (error) {
      console.error("Journal è®åå¤±æï¼", error);
      return seedEntries.map((entry) => ({ ...entry }));
    }
  }

  function saveEntries() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.entries));
      return true;
    } catch (error) {
      console.error("Journal å²å­å¤±æï¼", error);
      alert("Journal å²å­å¤±æãåçå¯è½å¤ªå¤§ï¼è«ç§»é¤ä¸å¼µåçå¾åè©¦ã");
      return false;
    }
  }

  function showToast(message) {
    let toast = document.querySelector(".journal-toast");

    if (!toast) {
      toast = document.createElement("div");
      toast.className = "journal-toast";
      document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => {
      toast.classList.remove("show");
    }, 1800);
  }

  function todayValue() {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
  }

  function createId() {
    if (window.crypto?.randomUUID) {
      return crypto.randomUUID();
    }

    return `entry-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function getEntryDate(entry) {
    return entry?.publishedAt || entry?.createdAt || entry?.updatedAt || "";
  }

  function formatDate(dateString) {
    if (!dateString) return "Draft";

    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "Unknown date";

    return date
      .toLocaleDateString("en-CA", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
      .replaceAll("-", ".");
  }

  function formatJournalContent(content) {
    const cleanContent = String(content || "").trim();

    if (!cleanContent) {
      return "<p>å°æªè¼¸å¥å§å®¹ã</p>";
    }

    return cleanContent
      .split(/\n\s*\n/)
      .map((paragraph) => {
        return `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`;
      })
      .join("");
  }

  function getVisibleEntries() {
    const keyword = state.search.trim().toLowerCase();

    return state.entries
      .filter((entry) => {
        if (state.filter === "all") return true;
        if (state.filter === "private") return entry.visibility === "private";
        if (state.filter === "draft") return entry.status === "draft";
        return entry.category === state.filter;
      })
      .filter((entry) => {
        if (!keyword) return true;

        return [
          entry.title,
          entry.category,
          entry.visibility,
          entry.status,
          entry.content,
          ...(entry.tags || []),
        ]
          .join(" ")
          .toLowerCase()
          .includes(keyword);
      })
      .sort((a, b) => {
        return new Date(getEntryDate(b)) - new Date(getEntryDate(a));
      });
  }

  function renderEditorImages() {
    if (!elements.imagePreview) return;

    elements.imagePreview.innerHTML = editorImages
      .map(
        (image, index) => `
          <div class="journal-image-thumb">
            <img
              src="${escapeHtml(image.dataUrl || "")}"
              alt="${escapeHtml(image.name || "Journal image")}"
            />
            <button
              type="button"
              class="journal-image-remove"
              data-remove-image="${index}"
              aria-label="Remove image"
            >
              Ã
            </button>
          </div>
        `
      )
      .join("");

    elements.imagePreview
      .querySelectorAll("[data-remove-image]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          editorImages.splice(Number(button.dataset.removeImage), 1);
          renderEditorImages();
        });
      });
  }

  function compressImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onerror = () => reject(new Error(`ç¡æ³è®å ${file.name}`));

      reader.onload = () => {
        const image = new Image();

        image.onerror = () => reject(new Error(`ç¡æ³èç ${file.name}`));

        image.onload = () => {
          const maxSize = 1200;
          const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
          const width = Math.max(1, Math.round(image.width * scale));
          const height = Math.max(1, Math.round(image.height * scale));

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;

          const context = canvas.getContext("2d");
          if (!context) {
            reject(new Error("çè¦½å¨ç¡æ³èçåçã"));
            return;
          }

          context.drawImage(image, 0, 0, width, height);

          resolve({
            name: file.name,
            type: "image/jpeg",
            dataUrl: canvas.toDataURL("image/jpeg", 0.76),
          });
        };

        image.src = reader.result;
      };

      reader.readAsDataURL(file);
    });
  }

  function openJournalLightbox(imageUrl) {
    if (!elements.lightbox || !elements.lightboxImage || !imageUrl) return;

    elements.lightboxImage.src = imageUrl;
    elements.lightbox.hidden = false;
  }

  function closeJournalLightbox() {
    if (!elements.lightbox || !elements.lightboxImage) return;

    elements.lightbox.hidden = true;
    elements.lightboxImage.src = "";
  }

  function openJournalDetailModal() {
    if (!elements.detail) return;

    elements.detail.hidden = false;

    if (elements.detailBackdrop) {
      elements.detailBackdrop.hidden = false;
    }

    requestAnimationFrame(() => {
      elements.detail.classList.add("is-open");
    });
  }

  function closeJournalDetailModal() {
    if (!elements.detail) return;

    elements.detail.classList.remove("is-open");

    setTimeout(() => {
      elements.detail.hidden = true;

      if (elements.detailBackdrop) {
        elements.detailBackdrop.hidden = true;
      }
    }, 220);
  }

  function openEditor() {
    closeJournalDetailModal();
    closeJournalLightbox();
    app.classList.add("editor-open");

    elements.newEntry.textContent = "Close Editor";
    elements.newEntry.setAttribute("aria-expanded", "true");
  }

  function closeEditor() {
    app.classList.remove("editor-open");
    elements.newEntry.textContent = "ï¼ New Entry";
    elements.newEntry.setAttribute("aria-expanded", "false");
  }

  function renderList() {
    const entries = getVisibleEntries();

    if (!entries.length) {
      elements.list.innerHTML = `
        <article class="journal-entry journal-empty-entry">
          <div>
            <p class="journal-date">No results</p>
            <h3>No journal found</h3>
            <p>æåééµå­æåé¡è©¦è©¦çã</p>
          </div>
        </article>
      `;
      renderDetail(null);
      return;
    }

    if (!state.selectedId || !entries.some((entry) => entry.id === state.selectedId)) {
      state.selectedId = entries[0].id;
    }

    elements.list.innerHTML = entries
      .map((entry) => {
        const tags = (entry.tags || [])
          .slice(0, 3)
          .map((tag) => `<span>${escapeHtml(tag)}</span>`)
          .join("");

        const images = (entry.images || [])
          .slice(0, 3)
          .map(
            (image) => `
              <button
                type="button"
                class="journal-entry-image"
                data-lightbox-image="${escapeHtml(image.dataUrl || "")}"
                aria-label="Preview image"
              >
                <img
                  src="${escapeHtml(image.dataUrl || "")}"
                  alt="${escapeHtml(image.name || "Journal image")}"
                />
              </button>
            `
          )
          .join("");

        return `
          <article
            class="journal-entry ${entry.id === state.selectedId ? "active" : ""}"
            data-entry-id="${escapeHtml(entry.id)}"
          >
            <div class="journal-entry-main">
              <p class="journal-date">${formatDate(getEntryDate(entry))}</p>
              <h3>${escapeHtml(entry.title || "Untitled")}</h3>
              <p class="journal-entry-excerpt">
                ${escapeHtml(String(entry.content || "")).slice(0, 220)}
                ${String(entry.content || "").length > 220 ? "..." : ""}
              </p>

              ${images ? `<div class="journal-entry-images">${images}</div>` : ""}

              <div class="journal-tags">
                <span>${escapeHtml(entry.category || "Other")}</span>
                ${tags}
              </div>
            </div>

            <div class="journal-meta">
              <span class="status ${entry.visibility === "public" ? "public" : "private"}">
                ${escapeHtml(entry.visibility || "private")}
              </span>
              <span>${entry.status === "published" ? "Published" : "Draft"}</span>
              <span>â± ${Number(entry.timeSpent || 0)}h</span>
              <span>${escapeHtml(entry.mood || "ð")}</span>
            </div>
          </article>
        `;
      })
      .join("");

    elements.list.querySelectorAll("[data-entry-id]").forEach((card) => {
      card.addEventListener("click", () => {
        state.selectedId = card.dataset.entryId;
        state.editingId = null;
        renderList();
        renderDetail(getSelectedEntry());
        openJournalDetailModal();
      });
    });

    elements.list.querySelectorAll("[data-lightbox-image]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        openJournalLightbox(button.dataset.lightboxImage);
      });
    });

    renderDetail(getSelectedEntry());
  }

  function getSelectedEntry() {
    return state.entries.find((entry) => entry.id === state.selectedId) || null;
  }

  function renderDetail(entry) {
    if (
      !elements.detailDate ||
      !elements.detailTitle ||
      !elements.detailMeta ||
      !elements.detailContent ||
      !elements.detailTags
    ) {
      return;
    }

    if (!entry) {
      elements.detailDate.textContent = "Select an entry";
      elements.detailTitle.textContent = "No journal selected";
      elements.detailMeta.innerHTML = "";
      elements.detailContent.innerHTML = "<p>å¾ä¸æ¹é¸ä¸ç¯ Journalï¼ææ New Entry æ°å¢ä¸ç¯ã</p>";
      elements.detailTags.innerHTML = "";

      if (elements.detailImages) {
        elements.detailImages.innerHTML = "";
      }
      return;
    }

    elements.detailDate.textContent = formatDate(getEntryDate(entry));
    elements.detailTitle.textContent = entry.title || "Untitled";

    elements.detailMeta.innerHTML = `
      <span>${escapeHtml(entry.category || "Other")}</span>
      <span>${entry.status === "published" ? "Published" : "Draft"}</span>
      <span>${escapeHtml(entry.visibility || "private")}</span>
      <span>â± ${Number(entry.timeSpent || 0)}h</span>
      <span>${escapeHtml(entry.mood || "ð")}</span>
    `;

    elements.detailContent.innerHTML = formatJournalContent(entry.content);

    if (elements.detailImages) {
      elements.detailImages.innerHTML = (entry.images || []).length
        ? `
          <div class="journal-detail-image-grid">
            ${(entry.images || [])
              .map(
                (image) => `
                  <button
                    type="button"
                    class="journal-detail-image"
                    data-detail-lightbox-image="${escapeHtml(image.dataUrl || "")}"
                    aria-label="Preview image"
                  >
                    <img
                      src="${escapeHtml(image.dataUrl || "")}"
                      alt="${escapeHtml(image.name || "Journal image")}"
                    />
                  </button>
                `
              )
              .join("")}
          </div>
        `
        : "";

      elements.detailImages
        .querySelectorAll("[data-detail-lightbox-image]")
        .forEach((button) => {
          button.addEventListener("click", () => {
            openJournalLightbox(button.dataset.detailLightboxImage);
          });
        });
    }

    elements.detailTags.innerHTML = (entry.tags || [])
      .map((tag) => `<span>${escapeHtml(tag)}</span>`)
      .join("");
  }

  function setEditor(entry = null) {
    state.editingId = entry?.id || null;
    openEditor();

    elements.title.value = entry?.title || "";
    elements.category.value = entry?.category || "Development";
    elements.visibility.value = entry?.visibility || "public";
    elements.mood.value = entry?.mood || "ð";
    elements.time.value = entry?.timeSpent ?? "";

    if (elements.date) {
      const entryDate = getEntryDate(entry);
      elements.date.value = entryDate
        ? new Date(entryDate).toISOString().slice(0, 10)
        : todayValue();
    }

    elements.tags.value = (entry?.tags || []).join(", ");
    elements.content.value = entry?.content || "";
    editorImages = Array.isArray(entry?.images)
      ? entry.images.map((image) => ({ ...image }))
      : [];
    renderEditorImages();

    const editorTitle = elements.editor.querySelector("h2");
    if (editorTitle) {
      editorTitle.textContent = entry ? "Edit Entry" : "New Entry";
    }

    setTimeout(() => {
      elements.editor.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 80);
  }

  function readEditor(status) {
    const title = elements.title.value.trim();
    const content = elements.content.value.trim();

    if (!title) {
      alert("åè¼¸å¥æ¨é¡ã");
      elements.title.focus();
      return null;
    }

    if (!content) {
      alert("åè¼¸å¥å§å®¹ã");
      elements.content.focus();
      return null;
    }

    const now = new Date().toISOString();
    const oldEntry = state.entries.find((entry) => entry.id === state.editingId);
    const selectedDate = elements.date?.value || todayValue();
    const selectedDateISO = `${selectedDate}T12:00:00.000Z`;

    return {
      id: oldEntry?.id || createId(),
      title,
      category: elements.category.value,
      visibility: elements.visibility.value,
      status,
      mood: elements.mood.value,
      timeSpent: Number(elements.time.value || 0),
      tags: elements.tags.value
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      content,
      images: editorImages.map((image) => ({ ...image })),
      createdAt: selectedDateISO,
      updatedAt: now,
      publishedAt:
        status === "published"
          ? selectedDateISO
          : oldEntry?.publishedAt || null,
    };
  }

  function upsertEntry(status) {
    const entry = readEditor(status);
    if (!entry) return;

    const previousEntries = state.entries.map((item) => ({ ...item }));
    const existingIndex = state.entries.findIndex((item) => item.id === entry.id);

    if (existingIndex >= 0) {
      state.entries[existingIndex] = entry;
    } else {
      state.entries.unshift(entry);
    }

    if (!saveEntries()) {
      state.entries = previousEntries;
      return;
    }

    state.selectedId = entry.id;
    state.editingId = null;

    renderList();
    renderDetail(entry);
    showToast(status === "published" ? "â Published" : "â Draft saved");
    clearEditor();
    closeEditor();
  }

  function deleteSelectedEntry() {
    const entry = getSelectedEntry();
    if (!entry) return;

    if (!confirm(`ç¢ºå®è¦åªé¤ã${entry.title}ãåï¼`)) return;

    const previousEntries = state.entries.map((item) => ({ ...item }));
    state.entries = state.entries.filter((item) => item.id !== entry.id);

    if (!saveEntries()) {
      state.entries = previousEntries;
      return;
    }

    state.selectedId = null;
    state.editingId = null;
    clearEditor();
    renderList();
    closeJournalDetailModal();
  }

  function buildPendingJournalContent(pending) {
    const tags = Array.isArray(pending.tags)
      ? pending.tags.filter(Boolean)
      : [];

    const tagLine = tags.length
      ? `Tags: ${tags
          .map((tag) => `#${String(tag).replace(/\s+/g, "-")}`)
          .join(" ")}\n`
      : "";

    const topicLine = pending.researchTopic
      ? `Topic: ${pending.researchTopic}\n`
      : "";

    const sourceLine = pending.sourceUrl
      ? `Source: ${pending.sourceUrl}\n`
      : "";

    return `## My Reflection

Created from AI Summary

ä»å¤©é±è®éç¯æç»å¾ï¼æçæ³æ³æ¯ï¼


---

## Research Info

${topicLine}${sourceLine}${tagLine}

---

## AI Summary

${pending.summary || "å°æªç¢çæè¦å§å®¹ã"}`;
  }

  function consumePendingJournalEntry() {
    const raw = localStorage.getItem(PENDING_JOURNAL_KEY);
    if (!raw) return;

    try {
      const pending = JSON.parse(raw);
      localStorage.removeItem(PENDING_JOURNAL_KEY);

      setEditor({
        title: pending.title || "AI Research Note",
        category: pending.category || "Research",
        visibility: "private",
        mood: "ð",
        timeSpent: "",
        tags:
          Array.isArray(pending.tags) && pending.tags.length
            ? pending.tags
            : ["AI Summary", "Research"],
        images: [],
        content: buildPendingJournalContent(pending),
        createdAt: pending.createdAt || new Date().toISOString(),
      });
    } catch (error) {
      console.error("AI Summary è½ Journal å¤±æï¼", error);
      localStorage.removeItem(PENDING_JOURNAL_KEY);
    }
  }

  function clearEditor() {
    state.editingId = null;

    elements.title.value = "";
    elements.category.value = "Development";
    elements.visibility.value = "public";
    elements.mood.value = "ð";
    elements.time.value = "";

    if (elements.date) {
      elements.date.value = todayValue();
    }

    elements.tags.value = "";
    elements.content.value = "";
    editorImages = [];
    renderEditorImages();

    const editorTitle = elements.editor.querySelector("h2");
    if (editorTitle) {
      editorTitle.textContent = "New Entry";
    }
  }

  if (elements.imageButton && elements.imageInput) {
    elements.imageButton.addEventListener("click", () => {
      elements.imageInput.click();
    });

    elements.imageInput.addEventListener("change", async (event) => {
      const files = Array.from(event.target.files || []).filter((file) =>
        file.type.startsWith("image/")
      );

      if (!files.length) return;

      const remainingSlots = Math.max(0, MAX_IMAGES - editorImages.length);

      if (remainingSlots === 0) {
        alert(`æ¯ç¯ Journal æå¤ ${MAX_IMAGES} å¼µåçã`);
        elements.imageInput.value = "";
        return;
      }

      try {
        const selectedFiles = files.slice(0, remainingSlots);
        const images = await Promise.all(selectedFiles.map(compressImage));
        editorImages = [...editorImages, ...images].slice(0, MAX_IMAGES);
        renderEditorImages();

        if (files.length > remainingSlots) {
          alert(`æ¯ç¯ Journal æå¤ ${MAX_IMAGES} å¼µåçã`);
        }
      } catch (error) {
        alert(error.message || "åçèçå¤±æã");
      } finally {
        elements.imageInput.value = "";
      }
    });
  }

  elements.newEntry.addEventListener("click", () => {
    if (app.classList.contains("editor-open")) {
      clearEditor();
      closeEditor();
      return;
    }

    setEditor(null);
  });

  if (elements.editEntry) {
    elements.editEntry.addEventListener("click", () => {
      const entry = getSelectedEntry();
      if (!entry) return;

      closeJournalDetailModal();
      setEditor(entry);
    });
  }

  if (elements.deleteEntry) {
    elements.deleteEntry.addEventListener("click", deleteSelectedEntry);
  }

  elements.clearEditor.addEventListener("click", (event) => {
    event.preventDefault();
    clearEditor();
    closeEditor();
  });

  elements.saveDraft.addEventListener("click", (event) => {
    event.preventDefault();
    upsertEntry("draft");
  });

  elements.publish.addEventListener("click", (event) => {
    event.preventDefault();
    upsertEntry("published");
  });

  if (elements.search) {
    elements.search.addEventListener("input", (event) => {
      state.search = event.target.value;
      renderList();
    });
  }

  elements.filters.forEach((button) => {
    button.addEventListener("click", () => {
      state.filter = button.dataset.journalFilter;

      elements.filters.forEach((item) => item.classList.remove("active"));
      button.classList.add("active");

      renderList();
    });
  });

  if (elements.detailClose) {
    elements.detailClose.addEventListener("click", closeJournalDetailModal);
  }

  if (elements.detailBackdrop) {
    elements.detailBackdrop.addEventListener("click", closeJournalDetailModal);
  }

  if (elements.lightboxClose) {
    elements.lightboxClose.addEventListener("click", closeJournalLightbox);
  }

  if (elements.lightbox) {
    elements.lightbox.addEventListener("click", (event) => {
      if (event.target === elements.lightbox) {
        closeJournalLightbox();
      }
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeJournalLightbox();
      closeJournalDetailModal();
    }
  });

  if (elements.date && !elements.date.value) {
    elements.date.value = todayValue();
  }

  closeEditor();
  renderList();
  consumePendingJournalEntry();
})();
