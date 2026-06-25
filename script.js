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

function generateLocalSummary(text) {
  const clean = text.replace(/\s+/g, " ").trim();
  const sentences = clean
    .split(/(?<=[。！？.!?])\s+/)
    .filter(sentence => sentence.length > 18);

  const selected = sentences.slice(0, 3);
  const words = extractKeywords(clean);

  summaryOutput.innerHTML = `
    <p class="output-title">Local Prototype Summary</p>
    <ul>
      ${selected.map(sentence => `<li>${escapeHtml(sentence)}</li>`).join("")}
    </ul>
    <p><strong>Possible Keywords:</strong> ${words.map(escapeHtml).join(" · ") || "尚無足夠文字可分析"}</p>
    <p class="placeholder">註：這是本地端原型摘要，不是真正 AI 分析。未來可串接 OpenAI API 或其他模型。</p>
  `;
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
