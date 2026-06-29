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

  let lastPaperResults = [];
let currentPaperPage = 1;
let activeReadingFilter = "all";
const PAPERS_PER_PAGE = 5;
  let thinkingTimer = null;
let thinkingIndex = 0;

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
        }

        generateLocalSummary(text);
      } else if (summaryOutput) {
        summaryOutput.innerHTML = `
          <p class="output-title">Prototype Notice</p>
          <p>已收到檔案：${escapeHtml(file.name)}</p>
          <p>這個版本先完成上傳介面。PDF / Word 的真正 AI 摘要需要後續串接後端與 AI API。</p>
        `;
      }
    });
  }

  if (summaryButton) {
    summaryButton.addEventListener("click", () => {
      if (!articleText || !summaryOutput) return;

      const text = articleText.value.trim();

      if (!text) {
        summaryOutput.innerHTML = `
          <p class="output-title">Summary Output</p>
          <p class="placeholder">請先貼上文章內容，或上傳 TXT 檔。</p>
        `;
        return;
      }

      generateLocalSummary(text);
    });
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
        paperStatus.textContent = "請輸入關鍵字開始搜尋。";
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

  async function generateLocalSummary(text) {
    if (!summaryOutput) return;

    const clean = text.replace(/\s+/g, " ").trim();

    if (!clean) {
      summaryOutput.innerHTML = `
        <p class="output-title">Summary Output</p>
        <p class="placeholder">請先貼上文章內容。</p>
      `;
      return;
    }

   summaryOutput.innerHTML = `
  <p class="output-title">AI Summary</p>

  <div class="ai-thinking">
    <span class="thinking-dot"></span>

    <div>
      <p class="thinking-label">AI Research Assistant</p>
      <p class="thinking-text" id="thinkingText">Reading paper metadata...</p>
    </div>
  </div>
`;

startThinkingLines();
scrollToSummaryOutput();

    try {
      const response = await fetch(AI_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: clean,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "AI 摘要失敗。");
      }

     stopThinkingLines();

summaryOutput.innerHTML = `
  <p class="output-title">AI Summary</p>
  <div class="ai-summary summary-pop">
    ${formatSummary(data.summary || "沒有收到摘要內容。")}
  </div>
`;

      scrollToSummaryOutput();
    } catch (error) {
  stopThinkingLines();

  summaryOutput.innerHTML = `
        <p class="output-title">AI Summary</p>
        <div class="ai-summary">
          目前無法產生摘要：${escapeHtml(error.message)}
        </div>
      `;
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

  async function searchPapers() {
    if (!paperQuery || !paperStatus || !paperResults) return;

    const query = paperQuery.value.trim();

    if (!query) {
      paperStatus.textContent = "請先輸入研究主題。";
      setSearchButtonState("idle");
      return;
    }

    paperStatus.textContent = "正在搜尋文獻，請稍等...";
    renderPaperSkeletons();
    setSearchButtonState("loading");

    try {
      const response = await fetch(
        `${PAPER_SEARCH_API_URL}?q=${encodeURIComponent(query)}&limit=20`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "文獻搜尋失敗。");
      }

     lastPaperResults = data.papers || [];
currentPaperPage = 1;
activeReadingFilter = "all";

updateReadingFilterUI();
renderPaperResults(lastPaperResults);

      setSearchButtonState("done");

      setTimeout(() => {
        setSearchButtonState("idle");
      }, 1200);
    } catch (error) {
      paperStatus.textContent = `搜尋失敗：${error.message}`;
      setSearchButtonState("idle");
    }
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
    paperStatus.textContent = "找不到相關文獻。";

    paperResults.innerHTML = `
      <div class="paper-empty">
        找不到相關文獻，請換一個關鍵字。
      </div>
    `;
    return;
  }

  const filteredPapers = filterPapersByReadingLabel(papers);

  if (!filteredPapers.length) {
    paperStatus.textContent = `目前沒有 ${getFilterDisplayName(activeReadingFilter)} 類型的文獻。`;

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

  if (activeReadingFilter === "all") {
    paperStatus.textContent = `找到 ${papers.length} 篇文獻，目前顯示第 ${currentPaperPage} / ${totalPages} 頁。`;
  } else {
    paperStatus.textContent = `${getFilterDisplayName(activeReadingFilter)}：${filteredPapers.length} 篇，目前顯示第 ${currentPaperPage} / ${totalPages} 頁。`;
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

      return `
        <article class="paper-card">
          <div class="paper-card-top">
            <div>
              <p class="paper-priority">
                ${escapeHtml(paper.stars || "")} ${escapeHtml(paper.priority || "")}
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
            · ${escapeHtml(paper.venue || "Unknown source")}
            · Citations: ${paper.citedByCount || 0}
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
        ← Previous
      </button>

      <span>
        Page ${currentPaperPage} of ${totalPages}
      </span>

      <button
        type="button"
        id="nextPaperPage"
        ${currentPaperPage === totalPages ? "disabled" : ""}
      >
        Next →
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
${(paper.reasons || []).join("、")}

Abstract:
${paper.abstract}
      `.trim();

      articleText.value = text;

      summaryOutput.innerHTML = `
        <p class="output-title">AI Summary</p>
        <p class="placeholder">已將文獻資料放入下方分析框，正在產生摘要...</p>
      `;

      scrollToSummaryOutput();
      generateLocalSummary(text);
    }
  }

  function updateThemeIcon() {
    if (!themeToggle) return;

    if (root.classList.contains("dark")) {
      themeToggle.textContent = "☀︎";
    } else {
      themeToggle.textContent = "☾";
    }
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
      const headerOffset = 120;
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
});
