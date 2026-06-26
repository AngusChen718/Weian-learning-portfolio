const root = document.documentElement;
const themeToggle = document.getElementById("themeToggle");
const savedTheme = localStorage.getItem("weian-theme");

if (savedTheme === "dark") {
  root.classList.add("dark");
}

updateThemeIcon();
if (savedTheme === "dark") {
  root.classList.add("dark");
}

themeToggle.addEventListener("click", () => {
  root.classList.add("theme-changing");

  void root.offsetWidth;

  requestAnimationFrame(() => {
    root.classList.toggle("dark");

    localStorage.setItem(
      "weian-theme",
      root.classList.contains("dark") ? "dark" : "light"
    );

    updateThemeIcon();

    setTimeout(() => {
      root.classList.remove("theme-changing");
    }, 650);
  });
});

const uploadButton = document.getElementById("uploadButton");
const fileInput = document.getElementById("fileInput");
const fileName = document.getElementById("fileName");
const articleText = document.getElementById("articleText");
const summaryButton = document.getElementById("summaryButton");
const summaryOutput = document.getElementById("summaryOutput");
const AI_API_URL = "https://weian-summary-api.fdr5hn7ry7.workers.dev/summarize";

const PAPER_SEARCH_API_URL = "https://paper-search.fdr5hn7ry7.workers.dev/search";

const paperQuery = document.getElementById("paperQuery");
const paperSearchButton = document.getElementById("paperSearchButton");
const paperStatus = document.getElementById("paperStatus");
const paperResults = document.getElementById("paperResults");

let lastPaperResults = [];

uploadButton.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  fileName.textContent = `Selected: ${file.name}`;

  if (file.type === "text/plain" || file.name.endsWith(".md") || file.name.endsWith(".txt")) {
    const text = await file.text();
    articleText.value = text.slice(0, 8000);
    generateLocalSummary(text);
  } else {
    summaryOutput.innerHTML = `
      <p class="output-title">Prototype Notice</p>
      <p>已收到檔案：${escapeHtml(file.name)}</p>
      <p>這個版本先完成上傳介面。PDF / Word 的真正 AI 摘要需要後續串接後端與 AI API。</p>
    `;
  }
});

summaryButton.addEventListener("click", () => {
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

async function generateLocalSummary(text) {
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
    <p class="placeholder">AI 正在整理文章，請稍等...</p>
  `;

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

    summaryOutput.innerHTML = `
      <p class="output-title">AI Summary</p>
      <div class="ai-summary">${formatSummary(data.summary)}</div>
    `;
  } catch (error) {
    summaryOutput.innerHTML = `
  <p class="output-title">AI Summary</p>
  <div 
    class="ai-summary" 
    style="
      height: 390px;
      overflow-y: auto;
      overflow-x: hidden;
      -webkit-overflow-scrolling: touch;
      padding-right: 12px;
      line-height: 1.75;
    "
  >
    ${formatSummary(data.summary)}
  </div>
`;
  }
}

function formatSummary(text) {
  return escapeHtml(text)
    .replace(/^---$/gm, "")
    .replace(/^\s*---\s*$/gm, "")
    .replace(/^### (.*)$/gm, "<h3>$1</h3>")
    .replace(/^## (.*)$/gm, "<h2>$1</h2>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/^- (.*)$/gm, "<li>$1</li>")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\n/g, "<br>");
}

function extractKeywords(text) {
  const stopwords = new Set([
    "the","and","for","with","that","this","from","into","about","were","have","has","are","was","is","to","of","in","on","as","by","an","a",
    "我們","以及","因為","所以","可以","透過","進行","一個","這個","主要","未來","目前","使用","建立","學習"
  ]);

  const tokens = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(token => token.length > 2 && !stopwords.has(token));

  const counts = {};
  for (const token of tokens) {
    counts[token] = (counts[token] || 0) + 1;
  }

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([word]) => word);
}

function escapeHtml(string) {
  return String(string).replace(/[&<>"']/g, (match) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[match]));
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
}

document.querySelectorAll("[data-topic]").forEach((button) => {
  button.addEventListener("click", () => {
    paperQuery.value = button.dataset.topic;
    searchPapers();
  });
});

async function searchPapers() {
  const query = paperQuery.value.trim();

  if (!query) {
    paperStatus.textContent = "請先輸入研究主題。";
    return;
  }

  paperStatus.textContent = "正在搜尋文獻，請稍等...";
  paperResults.innerHTML = "";

  try {
    const response = await fetch(
      `${PAPER_SEARCH_API_URL}?q=${encodeURIComponent(query)}&limit=20`
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "文獻搜尋失敗。");
    }

    lastPaperResults = data.papers || [];

    paperStatus.textContent = `找到 ${lastPaperResults.length} 篇文獻，已依閱讀優先度排序。`;

    renderPaperResults(lastPaperResults);
  } catch (error) {
    paperStatus.textContent = `搜尋失敗：${error.message}`;
  }
}

function renderPaperResults(papers) {
  if (!papers.length) {
    paperResults.innerHTML = `
      <div class="paper-empty">
        找不到相關文獻，請換一個關鍵字。
      </div>
    `;
    return;
  }

  paperResults.innerHTML = papers
    .map((paper, index) => {
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
              <p class="paper-priority">${escapeHtml(paper.stars || "")} ${escapeHtml(paper.priority || "")}</p>
              <h3>${escapeHtml(paper.title || "Untitled")}</h3>
            </div>
            <div class="paper-score">
              <span>${paper.score || 0}</span>
              <small>Score</small>
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
            ${escapeHtml(shortenText(paper.abstract || "No abstract available.", 360))}
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

  paperResults.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", handlePaperAction);
  });
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

    summaryButton.click();
  }
}

function shortenText(text, maxLength) {
  if (!text) return "";

  if (text.length <= maxLength) {
    return text;
  }

  return text.slice(0, maxLength).trim() + "...";
}

function updateThemeIcon() {
  if (!themeToggle) return;

  if (root.classList.contains("dark")) {
    themeToggle.textContent = "☀";
  } else {
    themeToggle.textContent = "☾";
  }
}
