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
  const paperSort = document.getElementById("paperSort");
  const paperLibraryCount = document.getElementById("paperLibraryCount");
  const libraryStatusFilter = document.getElementById("libraryStatusFilter");
  const paperLibraryList = document.getElementById("paperLibraryList");
  const compareSelectedCount = document.getElementById("compareSelectedCount");
  const compareSelectionList = document.getElementById("compareSelectionList");
  const compareRunButton = document.getElementById("compareRunButton");
  const compareClearButton = document.getElementById("compareClearButton");
  const paperCompareOutput = document.getElementById("paperCompareOutput");
 const historyOpenButton = document.getElementById("historyOpenButton");
const historyCloseButton = document.getElementById("historyCloseButton");
const historyBackdrop = document.getElementById("historyBackdrop");
const historyDrawer = document.getElementById("historyDrawer");
const historyList = document.getElementById("historyList");
const historyClearButton = document.getElementById("historyClearButton");

const SEARCH_HISTORY_KEY = "weian-paper-search-history";
const PAPER_LIBRARY_KEY = "weian-paper-library-v1";

 let lastPaperResults = [];
let currentPaperPage = 1;
let activeReadingFilter = "all";
let activePaperSort = "citations-desc";
let searchHistory = loadSearchHistory();
let paperLibrary = loadPaperLibrary();
let selectedPaperKeys = new Set();

let currentAnalysisContext = null;
let latestSummaryText = "";

const PAPERS_PER_PAGE = 5;
const MAX_SEARCH_HISTORY = 10;
const PENDING_JOURNAL_KEY = "weian-pending-journal-entry";

let thinkingTimer = null;
let thinkingIndex = 0;

  const SUMMARY_EMPTY_HTML = `
    <div class="summary-empty">
      <div class="summary-empty-icon">✦</div>
      <p>你的摘要結果會出現在這裡。</p>
      <span>貼上文章內容後，選擇分析方式並開始生成。</span>
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
      return "AI 目前太忙了，請稍後再試。\n\n你的文章內容已保留，不需要重新貼上。";
    }

    return `目前無法產生摘要：\n\n${message}`;
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

            已收到檔案：${escapeHtml(file.name)}

            這個版本先完成上傳介面。PDF / Word 的真正 AI 摘要需要後續串接後端與 AI API。
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
            <div class="summary-empty-icon">✦</div>
            <p>請先貼上文章內容。</p>
            <span>貼上一段文章或上傳 TXT 檔後，再點擊 Generate Summary。</span>
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
        paperResults.setAttribute("aria-busy", "false");
      }

      lastPaperResults = [];
      currentPaperPage = 1;
      activeReadingFilter = "all";

      setPaperStatus("請輸入關鍵字開始搜尋。", "idle");
      setPaperControlsAvailable(false);
      updateReadingFilterUI();
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

  if (paperSort) {
    paperSort.addEventListener("change", () => {
      activePaperSort =
        paperSort.value === "citations-asc"
          ? "citations-asc"
          : "citations-desc";
      currentPaperPage = 1;
      renderPaperResults(lastPaperResults);
    });
  }

  if (libraryStatusFilter) {
    libraryStatusFilter.addEventListener("change", renderPaperLibrary);
  }

  if (paperLibraryList) {
    paperLibraryList.addEventListener("click", handleLibraryClick);
    paperLibraryList.addEventListener("change", handleLibraryChange);
    paperLibraryList.addEventListener("input", handleLibraryChange);
  }

  if (compareRunButton) {
    compareRunButton.addEventListener("click", renderPaperComparison);
  }

  if (compareClearButton) {
    compareClearButton.addEventListener("click", clearPaperComparison);
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
    window.showFeedbackToast?.("Search history cleared", "info");
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeHistoryDrawer();
  }
});

  async function generateLocalSummary(text, options = {}) {
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
      const requestBody = {
        mode: options.mode === "compare" ? "compare" : "summary",
        text: cleanText,
      };

      if (
        requestBody.mode === "compare" &&
        Array.isArray(options.papers)
      ) {
        requestBody.papers = options.papers.slice(0, 4);
      }

      const response = await fetch(AI_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody)
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
        throw new Error("AI 沒有回傳摘要內容。");
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
        '<p class="summary-point"><span>•</span> $1</p>'
      )
      .replace(
        /^\s*•\s*(.*)$/gm,
        '<p class="summary-point"><span>•</span> $1</p>'
      )
      .replace(/\n{3,}/g, "\n\n")
      .split("\n")
      .filter((line) => line.trim() !== "")
      .join("<br>");
  }

  function setPaperStatus(message, state = "idle") {
    if (!paperStatus) return;

    paperStatus.textContent = message;
    paperStatus.dataset.state = state;
  }

  function setPaperControlsAvailable(isAvailable) {
    if (paperSort) {
      paperSort.disabled = !isAvailable;
    }
  }

  function getPaperSortDisplayName() {
    return activePaperSort === "citations-asc"
      ? "引用數低至高"
      : "引用數高至低";
  }

  function createPaperSearchError(response, data) {
    const error = new Error(data?.error || "文獻搜尋失敗。");
    error.status = response.status;
    error.code = data?.code || "";
    error.upstreamStatus = Number(data?.upstreamStatus || 0);
    return error;
  }

  function getFriendlyPaperSearchError(error) {
    if (error?.name === "AbortError" || error?.code === "OPENALEX_TIMEOUT") {
      return "搜尋時間較久，OpenAlex 目前回應較慢。請稍後再試，或換一組較精簡的關鍵字。";
    }

    if (
      error?.status === 503 ||
      error?.upstreamStatus === 429 ||
      error?.code === "OPENALEX_UPSTREAM_ERROR"
    ) {
      return "文獻服務目前較忙，請稍後再試。你的搜尋關鍵字仍保留在上方。";
    }

    return "目前無法完成搜尋，請檢查網路後再試一次。你的搜尋關鍵字仍保留在上方。";
  }

  function renderPaperSearchError(message) {
    if (!paperResults) return;

    paperResults.setAttribute("aria-busy", "false");
    paperResults.innerHTML = `
      <div class="paper-empty paper-empty-error" role="alert">
        <strong>Search unavailable</strong>
        <span>${escapeHtml(message)}</span>
      </div>
    `;
  }

  async function searchPapers() {
    if (!paperQuery || !paperStatus || !paperResults) return;

    const query = paperQuery.value.trim();

    if (!query) {
      setPaperStatus("請先輸入研究主題。", "error");
      setSearchButtonState("idle");
      return;
    }

    setPaperStatus("正在搜尋 OpenAlex，通常需要幾秒鐘…", "loading");
    paperResults.setAttribute("aria-busy", "true");
    setPaperControlsAvailable(false);
    renderPaperSkeletons();
    setSearchButtonState("loading");

    const searchController = new AbortController();
    const searchTimeout = setTimeout(() => searchController.abort(), 25000);

    try {
      const response = await fetch(
        `${PAPER_SEARCH_API_URL}?q=${encodeURIComponent(query)}&limit=100`,
        { signal: searchController.signal }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw createPaperSearchError(response, data);
      }

      lastPaperResults = cleanAndRankPapers(data.papers || []);
      currentPaperPage = 1;
      activeReadingFilter = "all";

      saveSearchHistory(query, lastPaperResults.length);

      setPaperControlsAvailable(lastPaperResults.length > 0);
      updateReadingFilterUI();
      renderPaperResults(lastPaperResults);
      renderCompareWorkspace();

      setSearchButtonState("done");

      setTimeout(() => {
        setSearchButtonState("idle");
      }, 1200);
    } catch (error) {
      const message = getFriendlyPaperSearchError(error);

      setPaperStatus(message, "error");
      renderPaperSearchError(message);
      setPaperControlsAvailable(lastPaperResults.length > 0);
      setSearchButtonState("idle");
    } finally {
      clearTimeout(searchTimeout);
      paperResults.setAttribute("aria-busy", "false");
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

  function normalizePaperTitle(title) {
    return String(title || "")
      .toLowerCase()
      .replace(/<[^>]*>/g, " ")
      .replace(/[^a-z0-9\u00c0-\u024f\u4e00-\u9fff]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function getPaperDoi(paper) {
    const rawDoi = paper?.doi || paper?.ids?.doi || "";

    return String(rawDoi)
      .toLowerCase()
      .replace(/^doi:\s*/, "")
      .replace(/^https?:\/\/(dx\.)?doi\.org\//, "")
      .replace(/[?#].*$/, "")
      .trim();
  }

  function getPaperKey(paper) {
    const doi = getPaperDoi(paper);

    if (doi) {
      return `doi:${doi}`;
    }

    const normalizedTitle = normalizePaperTitle(paper?.title);
    const year = Number(paper?.year || 0);

    return `title:${normalizedTitle}|year:${year}`;
  }

  function cleanAndRankPapers(papers) {
    const uniquePapers = new Map();

    papers
      .filter((paper) => String(paper?.title || "").trim())
      .forEach((paper) => {
        const key = getPaperKey(paper);
        const savedPaper = uniquePapers.get(key);

        if (
          !savedPaper ||
          Number(paper.citedByCount || 0) >
            Number(savedPaper.citedByCount || 0)
        ) {
          uniquePapers.set(key, paper);
        }
      });

    return [...uniquePapers.values()]
      .sort((a, b) => {
        const citationDifference =
          Number(b.citedByCount || 0) - Number(a.citedByCount || 0);

        if (citationDifference !== 0) {
          return citationDifference;
        }

        return Number(b.year || 0) - Number(a.year || 0);
      })
      .slice(0, 50);
  }

  function sortPapersByCitation(papers) {
    const direction = activePaperSort === "citations-asc" ? 1 : -1;

    return [...papers].sort((a, b) => {
      const citationDifference =
        Number(a.citedByCount || 0) - Number(b.citedByCount || 0);

      if (citationDifference !== 0) {
        return citationDifference * direction;
      }

      const yearDifference = Number(b.year || 0) - Number(a.year || 0);

      if (yearDifference !== 0) {
        return yearDifference;
      }

      return String(a.title || "").localeCompare(String(b.title || ""));
    });
  }

  function renderPaperSkeletons(count = 5) {
    if (!paperResults) return;

    paperResults.innerHTML = Array.from({ length: count })
      .map(
        () => `
          <article class="paper-card skeleton-card" aria-hidden="true">
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
      setPaperStatus("找不到相關文獻。", "empty");
      setPaperControlsAvailable(false);
      paperResults.setAttribute("aria-busy", "false");

      paperResults.innerHTML = `
        <div class="paper-empty">
          找不到相關文獻，請換一個關鍵字。
        </div>
      `;
      return;
    }

    const filteredPapers = sortPapersByCitation(
      filterPapersByReadingLabel(papers)
    );

    if (!filteredPapers.length) {
      setPaperStatus(
        `目前沒有 ${getFilterDisplayName(activeReadingFilter)} 類型的文獻。`,
        "empty"
      );
      paperResults.setAttribute("aria-busy", "false");

      paperResults.innerHTML = `
        <div class="paper-empty">
          目前沒有符合這個分類的文獻，可以切回 All 查看全部結果。
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

    const sortDisplayName = getPaperSortDisplayName();

    if (activeReadingFilter === "all") {
      setPaperStatus(
        `找到 ${papers.length} 篇文獻 · ${sortDisplayName} · 第 ${currentPaperPage} / ${totalPages} 頁`,
        "success"
      );
    } else {
      setPaperStatus(
        `${getFilterDisplayName(activeReadingFilter)}：${filteredPapers.length} 篇 · ${sortDisplayName} · 第 ${currentPaperPage} / ${totalPages} 頁`,
        "success"
      );
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
        const paperKey = getPaperKey(paper);
        const isSaved = paperLibrary.some((item) => item.key === paperKey);
        const isSelected = selectedPaperKeys.has(paperKey);

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

           <div class="paper-meta-row">
  <p class="paper-meta">
    ${escapeHtml(String(paper.year || "Unknown"))}
    · ${escapeHtml(paper.venue || "Unknown source")}
  </p>

  <span class="paper-citation-count">
    Cited by ${Number(paper.citedByCount || 0).toLocaleString()}
  </span>
</div>
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
              <strong>推薦原因</strong>
              <ul>${reasons}</ul>
            </div>

            <div class="paper-actions">
              <button type="button" data-action="analyze" data-index="${index}">
                Analyze
              </button>
              <button type="button" data-action="open" data-index="${index}">
                Open
              </button>
              <button
                type="button"
                data-action="save"
                data-index="${index}"
                class="${isSaved ? "is-active" : ""}"
              >
                ${isSaved ? "Saved" : "Save"}
              </button>
              <button
                type="button"
                data-action="compare"
                data-index="${index}"
                class="${isSelected ? "is-active" : ""}"
              >
                ${isSelected ? "Selected" : "Compare"}
              </button>
            </div>
          </article>
        `;
      })
      .join("");

    const pagination = `
      <nav class="paper-pagination" aria-label="Paper result pages">
        <button
          type="button"
          id="prevPaperPage"
          aria-label="Previous paper result page"
          ${currentPaperPage === 1 ? "disabled" : ""}
        >
          ← Previous
        </button>

        <span aria-current="page">
          Page ${currentPaperPage} of ${totalPages}
        </span>

        <button
          type="button"
          id="nextPaperPage"
          aria-label="Next paper result page"
          ${currentPaperPage === totalPages ? "disabled" : ""}
        >
          Next →
        </button>
      </nav>
    `;

    paperResults.setAttribute("aria-busy", "false");
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

    if (action === "save") {
      togglePaperInLibrary(paper);
      return;
    }

    if (action === "compare") {
      togglePaperComparison(paper);
      return;
    }

    if (action === "open") {
      openPaper(paper);
      return;
    }

    if (action === "analyze") {
      analyzePaper(paper);
    }
  }

  function openPaper(paper) {
    const url = getPaperUrl(paper);

    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }

  function analyzePaper(paper) {
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
${(paper.reasons || []).join("、")}

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

  function getPaperUrl(paper) {
    const directUrl = paper?.openAccessUrl || paper?.openAlexUrl || "";

    if (directUrl) {
      return directUrl;
    }

    const doi = getPaperDoi(paper);
    return doi ? `https://doi.org/${doi}` : "";
  }

  function createPaperSnapshot(paper) {
    return {
      title: paper.title || "Untitled",
      year: paper.year || "",
      venue: paper.venue || "Unknown source",
      doi: paper.doi || "",
      citedByCount: Number(paper.citedByCount || 0),
      authors: paper.authors || "Unknown authors",
      abstract: paper.abstract || "",
      openAccessUrl: paper.openAccessUrl || "",
      openAlexUrl: paper.openAlexUrl || "",
      priority: paper.priority || "",
      score: Number(paper.score || 0),
      reasons: Array.isArray(paper.reasons) ? paper.reasons.slice(0, 3) : [],
      concepts: Array.isArray(paper.concepts) ? paper.concepts.slice(0, 6) : [],
      stars: paper.stars || "",
    };
  }

  function loadPaperLibrary() {
    try {
      const saved = JSON.parse(localStorage.getItem(PAPER_LIBRARY_KEY));

      if (!Array.isArray(saved)) {
        return [];
      }

      return saved.filter((item) => {
        return (
          item &&
          typeof item.key === "string" &&
          item.paper &&
          String(item.paper.title || "").trim()
        );
      });
    } catch {
      return [];
    }
  }

  function savePaperLibrary() {
    localStorage.setItem(PAPER_LIBRARY_KEY, JSON.stringify(paperLibrary));
  }

  function togglePaperInLibrary(paper) {
    const key = getPaperKey(paper);
    const savedIndex = paperLibrary.findIndex((item) => item.key === key);
    const paperTitle = String(paper?.title || "Paper").trim().slice(0, 72);

    if (savedIndex >= 0) {
      paperLibrary.splice(savedIndex, 1);

      const remainsInResults = lastPaperResults.some(
        (result) => getPaperKey(result) === key
      );

      if (!remainsInResults) {
        selectedPaperKeys.delete(key);
      }
    } else {
      const now = new Date().toISOString();

      paperLibrary.unshift({
        key,
        paper: createPaperSnapshot(paper),
        status: "to-read",
        note: "",
        savedAt: now,
        updatedAt: now,
      });
    }

    savePaperLibrary();
    renderPaperLibrary();
    renderCompareWorkspace();

    if (lastPaperResults.length) {
      renderPaperResults(lastPaperResults);
    }

    window.showFeedbackToast?.(
      savedIndex >= 0
        ? `Removed ${paperTitle} from Reading Library`
        : `Saved ${paperTitle} to Reading Library`
    );
  }

  function renderPaperLibrary() {
    if (!paperLibraryList) return;

    const activeStatus = libraryStatusFilter?.value || "all";
    const visibleItems =
      activeStatus === "all"
        ? paperLibrary
        : paperLibrary.filter((item) => item.status === activeStatus);

    if (paperLibraryCount) {
      paperLibraryCount.textContent = `${paperLibrary.length} ${
        paperLibrary.length === 1 ? "paper" : "papers"
      }`;
    }

    if (!visibleItems.length) {
      paperLibraryList.innerHTML = `
        <div class="paper-workspace-empty">
          ${
            paperLibrary.length
              ? "這個閱讀狀態目前沒有論文。"
              : "儲存搜尋結果後，可在這裡管理閱讀狀態與筆記。"
          }
        </div>
      `;
      return;
    }

    paperLibraryList.innerHTML = visibleItems
      .map((item) => {
        const paper = item.paper;
        const isSelected = selectedPaperKeys.has(item.key);

        return `
          <article class="library-item">
            <div class="library-item-top">
              <div>
                <p class="library-item-meta">
                  ${escapeHtml(String(paper.year || "Unknown"))}
                  · ${escapeHtml(paper.venue || "Unknown source")}
                  · Cited by ${Number(paper.citedByCount || 0).toLocaleString()}
                </p>
                <h4>${escapeHtml(paper.title || "Untitled")}</h4>
              </div>
              <button
                type="button"
                class="library-remove-button"
                data-library-action="remove"
                data-paper-key="${escapeHtml(item.key)}"
                aria-label="Remove paper from Reading Library"
              >
                ×
              </button>
            </div>

            <div class="library-controls">
              <label>
                <span>Reading status</span>
                <select
                  data-library-field="status"
                  data-paper-key="${escapeHtml(item.key)}"
                >
                  <option value="to-read" ${item.status === "to-read" ? "selected" : ""}>To Read</option>
                  <option value="reading" ${item.status === "reading" ? "selected" : ""}>Reading</option>
                  <option value="read" ${item.status === "read" ? "selected" : ""}>Read</option>
                </select>
              </label>

              <label>
                <span>Reading note</span>
                <textarea
                  data-library-field="note"
                  data-paper-key="${escapeHtml(item.key)}"
                  rows="3"
                  placeholder="記下問題、發現或下一步…"
                >${escapeHtml(item.note || "")}</textarea>
              </label>
            </div>

            <div class="library-item-actions">
              <button type="button" data-library-action="analyze" data-paper-key="${escapeHtml(item.key)}">
                Analyze
              </button>
              <button type="button" data-library-action="open" data-paper-key="${escapeHtml(item.key)}">
                Open
              </button>
              <button
                type="button"
                data-library-action="compare"
                data-paper-key="${escapeHtml(item.key)}"
                class="${isSelected ? "is-active" : ""}"
              >
                ${isSelected ? "Selected" : "Compare"}
              </button>
            </div>
          </article>
        `;
      })
      .join("");
  }

  function handleLibraryClick(event) {
    const button = event.target.closest("[data-library-action]");
    if (!button) return;

    const key = button.dataset.paperKey;
    const action = button.dataset.libraryAction;
    const item = paperLibrary.find((entry) => entry.key === key);

    if (!item) return;

    if (action === "remove") {
      togglePaperInLibrary(item.paper);
      return;
    }

    if (action === "open") {
      openPaper(item.paper);
      return;
    }

    if (action === "analyze") {
      analyzePaper(item.paper);
      return;
    }

    if (action === "compare") {
      togglePaperComparison(item.paper);
    }
  }

  function handleLibraryChange(event) {
    const field = event.target.closest("[data-library-field]");
    if (!field) return;

    const item = paperLibrary.find(
      (entry) => entry.key === field.dataset.paperKey
    );

    if (!item) return;

    if (field.dataset.libraryField === "status") {
      item.status = ["to-read", "reading", "read"].includes(field.value)
        ? field.value
        : "to-read";
    }

    if (field.dataset.libraryField === "note") {
      item.note = field.value;
    }

    item.updatedAt = new Date().toISOString();
    savePaperLibrary();

    if (field.dataset.libraryField === "status") {
      window.showFeedbackToast?.(`Reading status: ${item.status.replace("-", " ")}`, "info");
    }

    if (
      field.dataset.libraryField === "status" &&
      libraryStatusFilter?.value !== "all"
    ) {
      renderPaperLibrary();
    }
  }

  function getPaperByKey(key) {
    const searchPaper = lastPaperResults.find(
      (paper) => getPaperKey(paper) === key
    );

    if (searchPaper) {
      return searchPaper;
    }

    return paperLibrary.find((item) => item.key === key)?.paper || null;
  }

  function togglePaperComparison(paper) {
    const key = getPaperKey(paper);

    if (selectedPaperKeys.has(key)) {
      selectedPaperKeys.delete(key);
    } else if (selectedPaperKeys.size >= 4) {
      if (paperCompareOutput) {
        paperCompareOutput.innerHTML = `
          <div class="compare-message is-error">
            最多可比較 4 篇論文；請先取消一篇再加入。
          </div>
        `;
      }
      return;
    } else {
      selectedPaperKeys.add(key);
    }

    if (paperCompareOutput) {
      paperCompareOutput.innerHTML = "";
    }

    renderCompareWorkspace();
    renderPaperLibrary();

    if (lastPaperResults.length) {
      renderPaperResults(lastPaperResults);
    }
  }

  function renderCompareWorkspace() {
    if (!compareSelectionList) return;

    selectedPaperKeys = new Set(
      [...selectedPaperKeys].filter((key) => getPaperByKey(key))
    );

    const selectedPapers = [...selectedPaperKeys]
      .map((key) => ({ key, paper: getPaperByKey(key) }))
      .filter((item) => item.paper);

    if (compareSelectedCount) {
      compareSelectedCount.textContent = `${selectedPapers.length} / 4`;
    }

    if (compareRunButton) {
      compareRunButton.disabled = selectedPapers.length < 2;
    }

    if (compareClearButton) {
      compareClearButton.disabled = selectedPapers.length === 0;
    }

    if (!selectedPapers.length) {
      compareSelectionList.innerHTML = `
        <div class="paper-workspace-empty">
          從搜尋結果或 Reading Library 選擇 2–4 篇論文。
        </div>
      `;
      return;
    }

    compareSelectionList.innerHTML = selectedPapers
      .map(
        ({ key, paper }, index) => `
          <div class="compare-selection-item">
            <span>${index + 1}</span>
            <p>${escapeHtml(paper.title || "Untitled")}</p>
            <button
              type="button"
              data-compare-remove="${escapeHtml(key)}"
              aria-label="Remove paper from comparison"
            >
              ×
            </button>
          </div>
        `
      )
      .join("");

    compareSelectionList
      .querySelectorAll("[data-compare-remove]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          const paper = getPaperByKey(button.dataset.compareRemove);

          if (paper) {
            togglePaperComparison(paper);
          }
        });
      });
  }

  function clearPaperComparison() {
    selectedPaperKeys.clear();

    if (paperCompareOutput) {
      paperCompareOutput.innerHTML = "";
    }

    renderCompareWorkspace();
    renderPaperLibrary();

    if (lastPaperResults.length) {
      renderPaperResults(lastPaperResults);
    }
  }

  function renderPaperComparison() {
    const papers = [...selectedPaperKeys]
      .map((key) => getPaperByKey(key))
      .filter(Boolean);

    if (!paperCompareOutput || papers.length < 2 || papers.length > 4) {
      return;
    }

    const paperColumns = papers
      .map(
        (paper, index) => `
          <th scope="col">
            <span>Paper ${index + 1}</span>
            ${escapeHtml(shortenText(paper.title || "Untitled", 90))}
          </th>
        `
      )
      .join("");

    const comparisonRows = [
      [
        "Year",
        ...papers.map((paper) => escapeHtml(String(paper.year || "Unknown"))),
      ],
      [
        "Venue",
        ...papers.map((paper) =>
          escapeHtml(paper.venue || "Unknown source")
        ),
      ],
      [
        "Cited by",
        ...papers.map((paper) =>
          Number(paper.citedByCount || 0).toLocaleString()
        ),
      ],
      [
        "Authors",
        ...papers.map((paper) =>
          escapeHtml(shortenText(paper.authors || "Unknown authors", 150))
        ),
      ],
      [
        "Research focus",
        ...papers.map((paper) =>
          escapeHtml(
            shortenText(paper.abstract || "No abstract available.", 260)
          )
        ),
      ],
      [
        "Source",
        ...papers.map((paper) => {
          const url = getPaperUrl(paper);
          return url
            ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Open paper</a>`
            : "Unavailable";
        }),
      ],
    ];

    paperCompareOutput.innerHTML = `
      <div class="compare-message">
        比較表已建立；AI Research Assistant 正在整理共同點、差異與閱讀建議。
      </div>
      <div class="paper-compare-table-wrap">
        <table class="paper-compare-table">
          <thead>
            <tr>
              <th scope="col">Field</th>
              ${paperColumns}
            </tr>
          </thead>
          <tbody>
            ${comparisonRows
              .map(
                ([label, ...values]) => `
                  <tr>
                    <th scope="row">${label}</th>
                    ${values.map((value) => `<td>${value}</td>`).join("")}
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;

    const comparisonText = papers
      .map(
        (paper, index) => `
Paper ${index + 1}
Title: ${paper.title || "Untitled"}
Authors: ${paper.authors || "Unknown authors"}
Year: ${paper.year || "Unknown"}
Source: ${paper.venue || "Unknown source"}
Citations: ${Number(paper.citedByCount || 0)}
Abstract: ${shortenText(paper.abstract || "No abstract available.", 1800)}
        `.trim()
      )
      .join("\n\n");

    const comparisonTags = [
      "Paper Comparison",
      ...papers.flatMap((paper) => paper.concepts || []),
    ].slice(0, 6);

    currentAnalysisContext = {
      title: `Paper Comparison: ${
        paperQuery?.value?.trim() || `${papers.length} selected papers`
      }`,
      category: "Research",
      tags: comparisonTags,
      sourceUrl: getPaperUrl(papers[0]),
      researchTopic: paperQuery?.value?.trim() || "Paper comparison",
    };

    if (articleText) {
      articleText.value = comparisonText;
      updateArticleClearButton();
    }

    const comparisonPapers = papers.map((paper, index) => ({
      label: `Paper ${index + 1}`,
      title: paper.title || "Untitled",
      authors: paper.authors || "Unknown authors",
      year: paper.year || "",
      venue: paper.venue || "Unknown source",
      citedByCount: Number(paper.citedByCount || 0),
      abstract: shortenText(
        paper.abstract || "No abstract available.",
        2400
      ),
      concepts: Array.isArray(paper.concepts)
        ? paper.concepts.slice(0, 6)
        : [],
    }));

    generateLocalSummary(comparisonText, {
      mode: "compare",
      papers: comparisonPapers,
    });
    scrollToSummaryOutput();
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
      ＋ Create Journal Entry
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
      themeToggle.textContent = "☀︎";
    } else {
      themeToggle.textContent = "☾";
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
        <span>搜尋文獻後，紀錄會出現在這裡。</span>
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
            ${Number(item.resultCount || 0)} papers · ${formatHistoryTime(item.searchedAt)}
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
    fileName.textContent = "支援 TXT 示範摘要；PDF / DOC 會先顯示等待串接 AI。";
  }

  hideCreateJournalEntryButton();

  setSummaryState("empty", `
    <div class="summary-empty">
      <div class="summary-empty-icon">✦</div>
      <p>你的摘要結果會出現在這裡。</p>
      <span>貼上文章內容後，選擇分析方式並開始生成。</span>
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
      paperSearchButton.textContent = "✓ Done";
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
renderPaperLibrary();
renderCompareWorkspace();
});

(() => {
  const app = document.querySelector("[data-journal-app]");
  if (!app) return;

  const STORAGE_KEY = "weian-journal-v0";
 const PENDING_JOURNAL_KEY = "weian-pending-journal-entry";

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
  };

  const seedEntries = [
    {
      id: "seed-1",
      title: "Building Paper Scout UI",
      category: "Development",
      visibility: "public",
      status: "published",
      mood: "😵",
      timeSpent: 4,
      tags: ["CSS", "JavaScript", "Paper Scout"],
      content:
        "今天整理了 Paper Scout 的介面、AI Summary 面板與搜尋結果互動。\n\n遇到最大的問題是 Summary 區塊的捲動與固定 Navbar 互相影響。\n\n下一步是建立 Journal Workspace，讓學習紀錄可以直接在網站上新增與管理。",
      createdAt: "2026-07-01T10:00:00.000Z",
      updatedAt: "2026-07-01T10:00:00.000Z",
      publishedAt: "2026-07-01T10:00:00.000Z",
    },
    {
      id: "seed-2",
      title: "Testing AI Research Notes",
      category: "Research",
      visibility: "private",
      status: "draft",
      mood: "🙂",
      timeSpent: 2,
      tags: ["AI", "Literature", "Research Notes"],
      content:
        "測試把 AI Summary 改成 Research Notes 格式。\n\n希望未來每篇文獻都可以自動整理研究問題、方法、重要發現、限制與閱讀策略。",
      createdAt: "2026-06-30T10:00:00.000Z",
      updatedAt: "2026-06-30T10:00:00.000Z",
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
let journalDetailCloseTimer = null;

function lockJournalDetailPageScroll() {
  document.documentElement.classList.add("journal-detail-open");
  document.body.classList.add("journal-detail-open");
}

function unlockJournalDetailPageScroll() {
  document.documentElement.classList.remove("journal-detail-open");
  document.body.classList.remove("journal-detail-open");
}

function bindJournalDetailScrollContainment(container) {
  if (!container || container.dataset.scrollContainmentBound === "true") return;

  let lastTouchY = null;
  const reachesScrollBoundary = (deltaY) => {
    const maxScrollTop = Math.max(0, container.scrollHeight - container.clientHeight);
    const atTop = container.scrollTop <= 0;
    const atBottom = container.scrollTop >= maxScrollTop - 1;

    return (deltaY < 0 && atTop) || (deltaY > 0 && atBottom);
  };

  container.addEventListener(
    "wheel",
    (event) => {
      if (reachesScrollBoundary(event.deltaY)) event.preventDefault();
    },
    { passive: false }
  );

  container.addEventListener(
    "touchstart",
    (event) => {
      lastTouchY = event.touches[0]?.clientY ?? null;
    },
    { passive: true }
  );

  container.addEventListener(
    "touchmove",
    (event) => {
      const currentTouchY = event.touches[0]?.clientY;
      if (lastTouchY === null || currentTouchY === undefined) return;

      const scrollDelta = lastTouchY - currentTouchY;
      if (reachesScrollBoundary(scrollDelta)) event.preventDefault();
      lastTouchY = currentTouchY;
    },
    { passive: false }
  );

  container.addEventListener("touchend", () => {
    lastTouchY = null;
  });
  container.addEventListener("touchcancel", () => {
    lastTouchY = null;
  });

  container.dataset.scrollContainmentBound = "true";
}

bindJournalDetailScrollContainment(elements.detail);

 function loadEntries() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return Array.isArray(saved) && saved.length ? saved : seedEntries;
    } catch {
      return seedEntries;
    }
  }

  function saveEntries() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.entries));
  }

  function showToast(message) {
    if (typeof window.showFeedbackToast === "function") {
      window.showFeedbackToast(message);
      return;
    }

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
 function renderEditorImages() {
  if (!elements.imagePreview) return;

  if (!editorImages.length) {
    elements.imagePreview.innerHTML = "";
    return;
  }

  elements.imagePreview.innerHTML = editorImages
    .map((image, index) => {
      return `
        <div class="journal-image-thumb">
          <img src="${escapeHtml(image.dataUrl)}" alt="${escapeHtml(image.name || "Journal image")}" />

          <button
            type="button"
            class="journal-image-remove"
            data-remove-image="${index}"
          >
            ×
          </button>
        </div>
      `;
    })
    .join("");

  elements.imagePreview.querySelectorAll("[data-remove-image]").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.removeImage);
      editorImages.splice(index, 1);
      renderEditorImages();
    });
  });
}

function readImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      resolve({
        name: file.name,
        type: file.type,
        dataUrl: reader.result,
      });
    };

    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
function openJournalLightbox(imageUrl) {
  const lightbox = document.getElementById("journalLightbox");
  const lightboxImage = document.getElementById("journalLightboxImage");

  if (!lightbox || !lightboxImage || !imageUrl) return;

  lightboxImage.src = imageUrl;
  lightbox.hidden = false;
}

function closeJournalLightbox() {
  const lightbox = document.getElementById("journalLightbox");
  const lightboxImage = document.getElementById("journalLightboxImage");

  if (!lightbox || !lightboxImage) return;

  lightbox.hidden = true;
  lightboxImage.src = "";
}
 function openJournalDetailModal() {
  if (!elements.detail) return;

  clearTimeout(journalDetailCloseTimer);
  lockJournalDetailPageScroll();

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

  clearTimeout(journalDetailCloseTimer);
  journalDetailCloseTimer = setTimeout(() => {
    elements.detail.hidden = true;

    if (elements.detailBackdrop) {
      elements.detailBackdrop.hidden = true;
    }

    unlockJournalDetailPageScroll();
  }, 220);
}
  function openEditor() {
  closeJournalDetailModal();
  closeJournalLightbox();

  app.classList.add("editor-open");

  if (elements.newEntry) {
    elements.newEntry.textContent = "Close Editor";
    elements.newEntry.setAttribute("aria-expanded", "true");
  }
}
  function closeEditor() {
    app.classList.remove("editor-open");

    if (elements.newEntry) {
      elements.newEntry.textContent = "＋ New Entry";
      elements.newEntry.setAttribute("aria-expanded", "false");
    }
  }

  function createId() {
    if (window.crypto && crypto.randomUUID) {
      return crypto.randomUUID();
    }

    return `entry-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function formatDate(dateString) {
    if (!dateString) return "Draft";
    const date = new Date(dateString);

    return date.toLocaleDateString("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).replaceAll("-", ".");
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
  return new Date(b.publishedAt || b.createdAt) - new Date(a.publishedAt || a.createdAt);
});
  }

  function renderList() {
    const entries = getVisibleEntries();

    if (!entries.length) {
      elements.list.innerHTML = `
        <article class="journal-entry">
          <div>
            <p class="journal-date">No results</p>
            <h3>No journal found</h3>
            <p>換個關鍵字或分類試試看。</p>
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
        const isActive = entry.id === state.selectedId;
        const tags = (entry.tags || [])
          .slice(0, 3)
          .map((tag) => `<span>${escapeHtml(tag)}</span>`)
          .join("");
       const images = (entry.images || [])
  .slice(0, 3)
  .map((image) => {
    return `
      <button
        type="button"
        class="journal-entry-image"
        data-lightbox-image="${escapeHtml(image.dataUrl)}"
      >
        <img src="${escapeHtml(image.dataUrl)}" alt="${escapeHtml(image.name || "Journal image")}" />
      </button>
    `;
  })
  .join("");

const imageBlock = images
  ? `<div class="journal-entry-images">${images}</div>`
  : "";

        return `
          <article class="journal-entry ${isActive ? "active" : ""}" data-entry-id="${entry.id}">
            <div>
              <p class="journal-date">${formatDate(entry.publishedAt || entry.createdAt)}</p>
              <h3>${escapeHtml(entry.title)}</h3>
              <p>${escapeHtml(entry.content).slice(0, 180)}${entry.content.length > 180 ? "..." : ""}</p>

${imageBlock}

<div class="journal-tags">
  <span>${escapeHtml(entry.category)}</span>
  ${tags}
</div>
            </div>

            <div class="journal-meta">
              <span class="status ${entry.visibility === "public" ? "public" : "private"}">
                ${escapeHtml(entry.visibility)}
              </span>
              <span>${entry.status === "published" ? "Published" : "Draft"}</span>
              <span>⏱ ${entry.timeSpent || 0}h</span>
              <span>${escapeHtml(entry.mood || "🙂")}</span>
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
      elements.detailContent.textContent = "從左邊選一篇 Journal，或按 New Entry 新增一篇。";
      elements.detailTags.innerHTML = "";
      return;
    }

    elements.detailDate.textContent = formatDate(entry.publishedAt || entry.createdAt);
    elements.detailTitle.textContent = entry.title;

    elements.detailMeta.innerHTML = `
      <span>${escapeHtml(entry.category)}</span>
      <span>${entry.status === "published" ? "Published" : "Draft"}</span>
      <span>${escapeHtml(entry.visibility)}</span>
      <span>⏱ ${entry.timeSpent || 0}h</span>
      <span>${escapeHtml(entry.mood || "🙂")}</span>
    `;

    elements.detailContent.textContent = entry.content;

    elements.detailTags.innerHTML = (entry.tags || [])
      .map((tag) => `<span>${escapeHtml(tag)}</span>`)
      .join("");
  }

  function setEditor(entry = null) {
    state.editingId = entry ? entry.id : null;

    openEditor();

    elements.title.value = entry?.title || "";
    elements.category.value = entry?.category || "Development";
    elements.visibility.value = entry?.visibility || "public";
    elements.mood.value = entry?.mood || "🙂";
    elements.time.value = entry?.timeSpent || "";

if (elements.date) {
  const entryDate = entry?.createdAt
    ? new Date(entry.createdAt).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  elements.date.value = entryDate;
}

elements.tags.value = (entry?.tags || []).join(", ");
elements.content.value = entry?.content || "";
editorImages = Array.isArray(entry?.images) ? [...entry.images] : [];
renderEditorImages();
    const editorTitle = elements.editor.querySelector("h2");
    editorTitle.textContent = entry ? "Edit Entry" : "New Entry";

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
      alert("先輸入標題。");
      elements.title.focus();
      return null;
    }

    if (!content) {
      alert("先輸入內容。");
      elements.content.focus();
      return null;
    }

    const now = new Date().toISOString();
const oldEntry = state.entries.find((entry) => entry.id === state.editingId);

const selectedDate = elements.date?.value;
const selectedDateISO = selectedDate
  ? `${selectedDate}T12:00:00.000Z`
  : oldEntry?.createdAt || now;

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
images: editorImages,
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

    const existingIndex = state.entries.findIndex((item) => item.id === entry.id);

    if (existingIndex >= 0) {
      state.entries[existingIndex] = entry;
    } else {
      state.entries.unshift(entry);
    }

    state.selectedId = entry.id;
    state.editingId = entry.id;

    saveEntries();
    renderList();
    renderDetail(entry);

    showToast(status === "published" ? "✓ Published" : "✓ Draft saved");
    clearEditor();
    closeEditor();
  }

  function deleteSelectedEntry() {
    const entry = getSelectedEntry();
    if (!entry) return;

    const confirmDelete = confirm(`確定要刪除「${entry.title}」嗎？`);

    if (!confirmDelete) return;

    state.entries = state.entries.filter((item) => item.id !== entry.id);
    state.selectedId = null;
    state.editingId = null;

    saveEntries();
    clearEditor();
    renderList();
    showToast("Entry deleted");
  }
function buildPendingJournalContent(pending) {
  const tags = Array.isArray(pending.tags)
    ? pending.tags.filter(Boolean)
    : [];

  const tagLine = tags.length
    ? `Tags: ${tags.map((tag) => `#${String(tag).replace(/\s+/g, "-")}`).join(" ")}\n`
    : "";

  const topicLine = pending.researchTopic
    ? `Topic: ${pending.researchTopic}\n`
    : "";

  const sourceLine = pending.sourceUrl
    ? `Source: ${pending.sourceUrl}\n`
    : "";

  return `## My Reflection

Created from AI Summary

今天閱讀這篇文獻後，我的想法是：


---

## Research Info

${topicLine}${sourceLine}${tagLine}

---

## AI Summary

${pending.summary || "尚未產生摘要內容。"}`;
}

function consumePendingJournalEntry() {
  const raw = localStorage.getItem(PENDING_JOURNAL_KEY);

  if (!raw) return;

  let pending = null;

  try {
    pending = JSON.parse(raw);
  } catch {
    localStorage.removeItem(PENDING_JOURNAL_KEY);
    return;
  }

  localStorage.removeItem(PENDING_JOURNAL_KEY);

  setEditor({
    title: pending.title || "AI Research Note",
    category: pending.category || "Research",
    visibility: "private",
    mood: "🙂",
    timeSpent: "",
    tags:
      Array.isArray(pending.tags) && pending.tags.length
        ? pending.tags
        : ["AI Summary", "Research"],
    content: buildPendingJournalContent(pending),
  });

  setTimeout(() => {
    elements.content.focus();

    const marker = "今天閱讀這篇文獻後，我的想法是：\n";
    const position = elements.content.value.indexOf(marker);

    if (position >= 0) {
      const cursorPosition = position + marker.length;
      elements.content.setSelectionRange(cursorPosition, cursorPosition);
    }
  }, 260);
}
  function clearEditor() {
    state.editingId = null;

    elements.title.value = "";
    elements.category.value = "Development";
    elements.visibility.value = "public";
    elements.mood.value = "🙂";
    elements.time.value = "";

if (elements.date) {
  elements.date.value = new Date().toISOString().slice(0, 10);
}

elements.tags.value = "";
elements.content.value = "";
   editorImages = [];
renderEditorImages();

    const editorTitle = elements.editor.querySelector("h2");
    editorTitle.textContent = "New Entry";
  }
const journalLightbox = document.getElementById("journalLightbox");
const journalLightboxClose = document.getElementById("journalLightboxClose");

if (journalLightboxClose) {
  journalLightboxClose.addEventListener("click", closeJournalLightbox);
}

if (journalLightbox) {
  journalLightbox.addEventListener("click", (event) => {
    if (event.target === journalLightbox) {
      closeJournalLightbox();
    }
  });
}
 if (elements.detailClose) {
  elements.detailClose.addEventListener("click", closeJournalDetailModal);
}

if (elements.detailBackdrop) {
  elements.detailBackdrop.addEventListener("click", closeJournalDetailModal);
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeJournalDetailModal();
  }
});
  if (elements.newEntry) {
   if (elements.imageButton && elements.imageInput) {
  elements.imageButton.addEventListener("click", () => {
    elements.imageInput.click();
  });
}

if (elements.imageInput) {
  elements.imageInput.addEventListener("change", async (event) => {
    const files = Array.from(event.target.files || []);

    if (!files.length) return;

    const remainingSlots = Math.max(0, 3 - editorImages.length);
    const selectedFiles = files.slice(0, remainingSlots);

    const images = await Promise.all(selectedFiles.map(readImageFile));

    editorImages = [...editorImages, ...images].slice(0, 3);

    renderEditorImages();

    elements.imageInput.value = "";
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
  }

  if (elements.editEntry) {
    elements.editEntry.addEventListener("click", () => {
      const entry = getSelectedEntry();

      if (!entry) return;

      closeJournalDetailModal();
      setEditor(entry);
    });
  }

  if (elements.deleteEntry) {
    elements.deleteEntry.addEventListener("click", () => {
      deleteSelectedEntry();
      closeJournalDetailModal();
    });
  }

  if (elements.clearEditor) {
  elements.clearEditor.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();

    clearEditor();
    closeEditor();
  });
}

if (elements.saveDraft) {
  elements.saveDraft.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();

    upsertEntry("draft");
  });
}

if (elements.publish) {
  elements.publish.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();

    upsertEntry("published");
  });
}

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

  // Extra safe: make sure these three editor buttons always work.
  // This is here to protect Journal from older modal/detail changes.
  document.addEventListener("click", (event) => {
    const publishButton = event.target.closest("#publishEntryBtn");
    const draftButton = event.target.closest("#saveDraftBtn");
    const cancelButton = event.target.closest("#clearEditorBtn");

    if (!publishButton && !draftButton && !cancelButton) return;

    event.preventDefault();

    if (publishButton) {
      upsertEntry("published");
      return;
    }

    if (draftButton) {
      upsertEntry("draft");
      return;
    }

    if (cancelButton) {
      clearEditor();
      closeEditor();
    }
  }, true);

  closeEditor();
renderList();
consumePendingJournalEntry();
})();
