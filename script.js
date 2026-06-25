const root = document.documentElement;
const themeToggle = document.getElementById("themeToggle");
const savedTheme = localStorage.getItem("weian-theme");

if (savedTheme === "dark") {
  root.classList.add("dark");
}

themeToggle.addEventListener("click", () => {
  root.classList.toggle("dark");
  localStorage.setItem("weian-theme", root.classList.contains("dark") ? "dark" : "light");
});

const uploadButton = document.getElementById("uploadButton");
const fileInput = document.getElementById("fileInput");
const fileName = document.getElementById("fileName");
const articleText = document.getElementById("articleText");
const summaryButton = document.getElementById("summaryButton");
const summaryOutput = document.getElementById("summaryOutput");
const AI_API_URL = "https://weian-summary-api.fdr5hn7ry7.workers.dev/summarize";

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
      <p class="placeholder">目前無法產生摘要：${escapeHtml(error.message)}</p>
    `;
  }
}

function formatSummary(text) {
  return escapeHtml(text)
    // 刪掉 Gemini 常常產生的分隔線 ---
    .replace(/^---$/gm, "")

    // Markdown 標題
    .replace(/^### (.*)$/gm, "<h3>$1</h3>")
    .replace(/^## (.*)$/gm, "<h2>$1</h2>")

    // 粗體標題，例如 **1. 一句話摘要**
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")

    // 條列
    .replace(/^- (.*)$/gm, "<li>$1</li>")

    // 換行
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
