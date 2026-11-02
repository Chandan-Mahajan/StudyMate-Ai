
"use strict";


const STORAGE = {
  sessions: "studymate_sessions",
  settings: "studymate_settings",
  preferences: "studymate_preferences",
  theme: "studymate_theme"
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) =>
  Array.from(root.querySelectorAll(selector));

const get = (id) => document.getElementById(id);

const state = {
  currentPage: "dashboard",
  currentSession: null,
  activeResultTab: "summary",
  quizIndex: 0,
  quizAnswers: [],
  quizSubmitted: false,
  flashcardIndex: 0,
  knownCards: new Set(),
  revisionCards: new Set(),
  pendingConfirmation: null,
  speech: null,
  markdownWarningShown: false
};

/* =========================================================
   Safe storage helpers
   ========================================================= */

function readJSON(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    console.warn("Could not read local storage:", error);
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error("Could not save local data:", error);
    showToast("Could not save data in this browser.", "error");
    return false;
  }
}

function getSessions() {
  const sessions = readJSON(STORAGE.sessions, []);
  return Array.isArray(sessions) ? sessions : [];
}

function getSettings() {
  return readJSON(STORAGE.settings, {
    provider: "openai",
    apiKey: ""
  });
}

function getPreferences() {
  return readJSON(STORAGE.preferences, {
    difficulty: "medium",
    style: "structured"
  });
}

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit"
  });
}

/* =========================================================
   Notifications and confirmation dialog
   ========================================================= */

function showToast(message, type = "success") {
  const container = get("toastContainer");

  if (!container) {
    console.log(`[${type}] ${message}`);
    return;
  }

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.setAttribute("role", "status");
  toast.textContent = message;
  container.appendChild(toast);

  window.setTimeout(() => {
    toast.remove();
  }, 3500);
}

function confirmActionDialog(title, message, callback) {
  const dialog = get("confirmationDialog");

  state.pendingConfirmation = callback;

  if (!dialog) {
    if (window.confirm(message)) {
      callback?.();
    }
    state.pendingConfirmation = null;
    return;
  }

  if (get("confirmationTitle")) {
    get("confirmationTitle").textContent = title;
  }

  if (get("confirmationMessage")) {
    get("confirmationMessage").textContent = message;
  }

  if (typeof dialog.showModal === "function") {
    if (!dialog.open) dialog.showModal();
  } else {
    const confirmed = window.confirm(`${title}\n\n${message}`);
    if (confirmed) callback?.();
    state.pendingConfirmation = null;
  }
}

function closeConfirmation() {
  const dialog = get("confirmationDialog");

  if (dialog?.open) dialog.close();
  state.pendingConfirmation = null;
}

/* =========================================================
   Page navigation
   ========================================================= */


function navigateTo(page) {
  const validPages = [
    "dashboard",
    "workspace",
    "history",
    "notes",
    "settings"
  ];

  if (!validPages.includes(page)) page = "dashboard";

  state.currentPage = page;

  $$("[data-page]").forEach((section) => {
    const active = section.dataset.page === page;
    section.hidden = !active;
    section.classList.toggle("active", active);
  });

  $$("[data-page-link]").forEach((link) => {
    const active = link.dataset.pageLink === page;
    link.classList.toggle("active", active);

    if (active) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });

  const breadcrumb = get("breadcrumbCurrent");

  if (breadcrumb) {
    const labels = {
      dashboard: "Dashboard",
      workspace: "Study workspace",
      history: "Study history",
      notes: "My Notes",
      settings: "Settings"
    };

    breadcrumb.textContent = labels[page];
  }

  closeSidebar();
  window.scrollTo({ top: 0, behavior: "smooth" });

  if (page === "dashboard") renderDashboard();
  if (page === "history") renderHistory();
  if (page === "notes") renderNotesList();
  if (page === "settings") loadSettingsForm();
}


function openWorkspace() {
  navigateTo("workspace");

  if (get("topicInput")) {
    get("topicInput").focus();
  }
}

function openSidebar() {
  document.body.classList.add("sidebar-open");

  const overlay = get("sidebarOverlay");
  if (overlay) overlay.hidden = false;
  get("mobileMenuToggle")?.setAttribute("aria-expanded", "true");
}

function closeSidebar() {
  document.body.classList.remove("sidebar-open");

  const overlay = get("sidebarOverlay");
  if (overlay) overlay.hidden = true;
  get("mobileMenuToggle")?.setAttribute("aria-expanded", "false");
}

function setDesktopSidebarCollapsed(collapsed) {
  document.body.classList.toggle("sidebar-collapsed", collapsed);

  const collapseButton = get("sidebarCollapseToggle");
  if (!collapseButton) return;

  collapseButton.setAttribute("aria-expanded", String(!collapsed));
  collapseButton.setAttribute(
    "aria-label",
    collapsed ? "Expand sidebar" : "Collapse sidebar"
  );
  collapseButton.setAttribute(
    "title",
    collapsed ? "Expand sidebar" : "Collapse sidebar"
  );
}

function setupNavigation() {
  // Main page navigation
  $$("[data-page-link]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();

      if (
        link.classList.contains("brand") &&
        !window.matchMedia("(max-width: 1024px)").matches &&
        document.body.classList.contains("sidebar-collapsed")
      ) {
        setDesktopSidebarCollapsed(false);
      }

      navigateTo(link.dataset.pageLink);
    });
  });

  // Desktop sidebar collapse / expand
  const collapseButton = get("sidebarCollapseToggle");

  if (collapseButton) {
    collapseButton.addEventListener("click", () => {
      // Keep the mobile and tablet slide-in menu behavior.
      if (window.matchMedia("(max-width: 1024px)").matches) {
        return;
      }

      setDesktopSidebarCollapsed(
        !document.body.classList.contains("sidebar-collapsed")
      );
    });
  }

  // Existing page action buttons
  const pageButtons = {
    startStudyingButton: openWorkspace,
    sidebarNewSession: openWorkspace,
    quickStartButton: openWorkspace,
    emptyStateStartButton: openWorkspace,
    historyStartButton: openWorkspace,
    viewAllHistory: () => navigateTo("history"),
    openSettings: () => navigateTo("settings")
  };

  Object.entries(pageButtons).forEach(([id, callback]) => {
    get(id)?.addEventListener("click", callback);
  });

  // Mobile sidebar
  get("mobileMenuToggle")?.addEventListener("click", openSidebar);
  get("sidebarOverlay")?.addEventListener("click", closeSidebar);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeSidebar();
  });
}


/* =========================================================
   Theme
   ========================================================= */

function applyTheme(theme) {
  const isDark = theme === "dark";

  document.body.classList.toggle("dark-theme", isDark);

  const toggle = get("themeToggle");
  if (toggle) {
    toggle.setAttribute(
      "aria-label",
      isDark ? "Switch to light theme" : "Switch to dark theme"
    );
    toggle.setAttribute("aria-pressed", String(isDark));
  }

  try {
    localStorage.setItem(STORAGE.theme, isDark ? "dark" : "light");
  } catch (error) {
    console.warn("Could not save theme preference.");
  }
}

function setupTheme() {
  let savedTheme = "light";

  try {
    savedTheme =
      localStorage.getItem(STORAGE.theme) ||
      (window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light");
  } catch (error) {
    console.warn("Could not read theme preference.");
  }

  applyTheme(savedTheme);

  get("themeToggle")?.addEventListener("click", () => {
    const nextTheme = document.body.classList.contains("dark-theme")
      ? "light"
      : "dark";

    applyTheme(nextTheme);
  });

}

/* =========================================================
   Study input
   ========================================================= */

function updateCharacterCount() {
  const input = get("notesInput");
  const counter = get("characterCount");

  if (!input || !counter) return;

  counter.textContent = input.value.length.toLocaleString();
}

function setInputError(message) {
  const errorElement = get("inputError");

  if (errorElement) {
    errorElement.textContent = message;
    errorElement.hidden = !message;
  }

  if (message) {
    get("topicInput")?.setAttribute("aria-invalid", "true");
    get("notesInput")?.setAttribute("aria-invalid", "true");
  } else {
    get("topicInput")?.removeAttribute("aria-invalid");
    get("notesInput")?.removeAttribute("aria-invalid");
  }
}

function validateStudyInput() {
  const topic = get("topicInput")?.value.trim() || "";
  const notes = get("notesInput")?.value.trim() || "";

  if (!topic && !notes) {
    setInputError("Enter a topic or paste your study notes to continue.");
    get("topicInput")?.focus();
    return null;
  }

  if (topic.length > 200) {
    setInputError("Keep the topic under 200 characters.");
    get("topicInput")?.focus();
    return null;
  }

  if (notes.length > 50000) {
    setInputError("Your notes are too long. Please use fewer than 50,000 characters.");
    get("notesInput")?.focus();
    return null;
  }

  setInputError("");
  return { topic, notes };
}

function setupStudyInput() {
  get("notesInput")?.addEventListener("input", updateCharacterCount);

  ["topicInput", "notesInput"].forEach((id) => {
    get(id)?.addEventListener("input", () => setInputError(""));
  });

  updateCharacterCount();

  const preferences = getPreferences();

  if (get("difficultySelect")) {
    get("difficultySelect").value = preferences.difficulty || "medium";
  }

  if (get("styleSelect")) {
    get("styleSelect").value = preferences.style || "structured";
  }

  get("studyForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const input = validateStudyInput();
    if (!input) return;

    await generateStudyContent(input);
  });
}

/* =========================================================
   API settings
   ========================================================= */

function loadSettingsForm() {
  const settings = getSettings();
  const preferences = getPreferences();

  if (get("providerSelect")) {
    get("providerSelect").value = settings.provider || "openai";
  }

  if (get("apiKeyInput")) {
    get("apiKeyInput").value = settings.apiKey || "";
  }

  if (get("defaultDifficulty")) {
    get("defaultDifficulty").value = preferences.difficulty || "medium";
  }

  if (get("defaultStyle")) {
    get("defaultStyle").value = preferences.style || "structured";
  }

}

function setupSettings() {
  loadSettingsForm();

  get("toggleApiKey")?.addEventListener("click", () => {
    const input = get("apiKeyInput");
    if (!input) return;

    const show = input.type === "password";
    input.type = show ? "text" : "password";

    get("toggleApiKey").setAttribute(
      "aria-label",
      show ? "Hide API key" : "Show API key"
    );
  });

  get("settingsForm")?.addEventListener("submit", (event) => {
    event.preventDefault();

    const provider = get("providerSelect")?.value || "openai";
    const apiKey = get("apiKeyInput")?.value.trim() || "";

    if (apiKey && apiKey.length < 10) {
      if (get("settingsMessage")) {
        get("settingsMessage").textContent = "Please check your API key.";
      }
      showToast("The API key looks too short.", "warning");
      return;
    }

    const success = writeJSON(STORAGE.settings, { provider, apiKey });

    if (success) {
      if (get("settingsMessage")) {
        get("settingsMessage").textContent = apiKey
          ? "API settings saved in this browser."
          : "Provider saved. Add an API key to enable AI generation.";
      }

      showToast("API settings saved.", "success");
    }
  });

  get("removeApiKey")?.addEventListener("click", () => {
    confirmActionDialog(
      "Remove API key?",
      "This removes the saved API key from this browser.",
      () => {
        const settings = getSettings();
        settings.apiKey = "";

        writeJSON(STORAGE.settings, settings);

        if (get("apiKeyInput")) get("apiKeyInput").value = "";
        if (get("settingsMessage")) {
          get("settingsMessage").textContent = "API key removed.";
        }

        showToast("API key removed.", "success");
      }
    );
  });

  get("saveStudyPreferences")?.addEventListener("click", () => {
    const preferences = {
      difficulty: get("defaultDifficulty")?.value || "medium",
      style: get("defaultStyle")?.value || "structured"
    };

    if (writeJSON(STORAGE.preferences, preferences)) {
      if (get("preferencesMessage")) {
        get("preferencesMessage").textContent = "Preferences saved.";
      }

      if (get("difficultySelect")) {
        get("difficultySelect").value = preferences.difficulty;
      }

      if (get("styleSelect")) {
        get("styleSelect").value = preferences.style;
      }

      showToast("Study preferences saved.", "success");
    }
  });

  get("clearDataSettings")?.addEventListener("click", () => {
    confirmActionDialog(
      "Clear study data?",
      "This permanently deletes saved study sessions and progress from this browser. Your API settings will remain.",
      () => {
        writeJSON(STORAGE.sessions, []);
        state.currentSession = null;
        state.knownCards.clear();
        state.revisionCards.clear();

        renderDashboard();
        renderHistory();

        showToast("Study history and progress cleared.", "success");
      }
    );
  });
}

/* =========================================================
   Result tabs
   ========================================================= */

function activateResultTab(tabName) {
  const allowed = ["summary", "quiz", "flashcards", "assistant"];
  if (!allowed.includes(tabName)) return;

  state.activeResultTab = tabName;

  $$("[data-result-tab]").forEach((tab) => {
    const active = tab.dataset.resultTab === tabName;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  });

  $$("[data-result-panel]").forEach((panel) => {
    const active = panel.dataset.resultPanel === tabName;
    panel.hidden = !active;
    panel.classList.toggle("active", active);
  });
}

function setupResultTabs() {
  $$("[data-result-tab]").forEach((tab) => {
    tab.addEventListener("click", () => {
      activateResultTab(tab.dataset.resultTab);
    });
  });
}

/* =========================================================
   AI generation
   ========================================================= */

const GEMINI_MODEL = "gemini-3.8-flash";
const AI_REQUEST_TIMEOUT_MS = 120000;
const AI_MAX_ATTEMPTS = 3;
const AI_RETRYABLE_STATUSES = new Set([500, 502, 503, 504]);

function setLoading(isLoading) {
  const button = get("generateButton");
  const indicator = get("loadingIndicator");

  if (button) {
    button.disabled = isLoading;
    button.setAttribute("aria-busy", String(isLoading));
  }

  if (indicator) indicator.hidden = !isLoading;
}

function setGenerationStatus(message) {
  const status = get("loadingIndicator")?.querySelector("p");
  if (status) status.textContent = message;
}

async function generateStudyContent(input) {
  const settings = getSettings();

  if (!settings.apiKey) {
    setLoading(false);
    showToast("Add your API key in Settings to generate AI content.", "warning");
    navigateTo("settings");
    return;
  }

  setLoading(true);
  setGenerationStatus("The summary and practice materials are generating in parallel.");

  const startedAt = performance.now();
  const difficulty = get("difficultySelect")?.value || "medium";
  const style = get("styleSelect")?.value || "structured";
  const session = {
    id: createId(),
    topic: input.topic || inferTopic(input.notes),
    notes: input.notes,
    difficulty,
    style,
    createdAt: new Date().toISOString(),
    summary: "",
    quiz: [],
    flashcards: [],
    assistantMessages: [],
    quizScore: null,
    knownCount: 0,
    revisionCount: 0
  };
  const request = {
    topic: session.topic,
    notes: input.notes,
    difficulty,
    style,
    provider: settings.provider,
    apiKey: settings.apiKey
  };

  state.currentSession = session;
  state.quizIndex = 0;
  state.quizAnswers = [];
  state.quizSubmitted = false;
  state.flashcardIndex = 0;
  state.knownCards = new Set();
  state.revisionCards = new Set();

  renderSession(session);
  navigateTo("workspace");

  const summaryTask = requestAIStudySummary(request).then((summary) => {
    session.summary = summary;
    saveSession(session);

    if (state.currentSession?.id === session.id) {
      state.currentSession.summary = summary;
      renderSummary(summary);
      setGenerationStatus(
        `Summary ready in ${((performance.now() - startedAt) / 1000).toFixed(1)}s. Practice materials are still generating.`
      );
    }

    return "summary";
  });

  const practiceTask = requestAIPracticeContent(request).then((practice) => {
    session.quiz = practice.quiz;
    session.flashcards = practice.flashcards;
    saveSession(session);

    if (state.currentSession?.id === session.id) {
      state.currentSession.quiz = practice.quiz;
      state.currentSession.flashcards = practice.flashcards;
      renderQuiz();
      renderFlashcard();
    }

    return "practice materials";
  });

  try {
    const results = await Promise.allSettled([summaryTask, practiceTask]);
    const failures = results
      .map((result, index) => ({
        result,
        label: index === 0 ? "Summary" : "Quiz and flashcards"
      }))
      .filter(({ result }) => result.status === "rejected");
    const elapsed = ((performance.now() - startedAt) / 1000).toFixed(1);

    if (results[0].status === "rejected") {
      session.summaryError = results[0].reason instanceof Error
        ? results[0].reason.message
        : String(results[0].reason);
    }
    if (results[1].status === "rejected") {
      session.practiceError = results[1].reason instanceof Error
        ? results[1].reason.message
        : String(results[1].reason);
    }

    if (results.some((result) => result.status === "fulfilled")) {
      saveSession(session);
    }

    if (state.currentSession?.id === session.id) {
      if (session.summaryError) {
        state.currentSession.summaryError = session.summaryError;
        renderSummary(`The summary could not be generated: ${session.summaryError}`);
      }
      if (session.practiceError) {
        state.currentSession.practiceError = session.practiceError;
        if (get("quizQuestion")) {
          get("quizQuestion").textContent = "Quiz questions could not be generated.";
        }
        if (get("flashcardText")) {
          get("flashcardText").textContent = "Flashcards could not be generated.";
        }
      }
    }

    if (failures.length === 0) {
      showToast(`Study materials generated in ${elapsed}s.`, "success");
    } else {
      const details = failures
        .map(({ result, label }) =>
          `${label}: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`
        )
        .join(" ");
      const completed = results
        .map((result, index) => ({
          result,
          label: index === 0 ? "Summary" : "Quiz and flashcards"
        }))
        .filter(({ result }) => result.status === "fulfilled")
        .map(({ label }) => label);
      console.error("Study content generation failed:", details);
      showToast(
        `${details} ${completed.length ? `${completed.join(" and ")} saved in ${elapsed}s.` : "No study materials were saved."}`,
        "error"
      );
    }
  } finally {
    setLoading(false);
  }
}

function inferTopic(notes) {
  const firstLine = notes.split("\n").find((line) => line.trim());
  return firstLine ? firstLine.trim().slice(0, 100) : "Study session";
}

function buildStudyContext({ topic, notes, difficulty, style }) {
  const difficultyLabel = {
    easy: "Easy — explain foundations clearly",
    medium: "Medium — college semester exam level",
    hard: "Hard — deeper analysis and challenging details"
  }[difficulty] || difficulty;
  const styleLabel = {
    simple: "Simple and concise",
    exam: "Exam-focused notes",
    detailed: "Detailed explanation"
  }[style] || style;

  return `Topic: ${topic || "Infer from the supplied notes"}
Difficulty: ${difficultyLabel}
Summary style: ${styleLabel}

${notes?.trim()
    ? `Supplied source material (prioritize it; do not claim absent details came from it):\n${notes}`
    : "No source notes were supplied. Use general subject knowledge and make that distinction clear."}`;
}

async function requestAIStudySummary({
  topic,
  notes,
  difficulty,
  style,
  provider,
  apiKey
}) {
  const prompt = `Create structured Markdown revision notes for college semester exams.
${buildStudyContext({ topic, notes, difficulty, style })}

Select relevant sections only: topic introduction, definitions, key concepts, detailed explanation, classifications, syntax/code examples (when relevant), useful comparison tables, practical examples, important exam points, and quick revision takeaways.
Use logical headings/subheadings, simple accurate language, bold key terms, bullets, tables where useful, and valid fenced code with a short explanation when relevant. Avoid repetition and irrelevant sections.
Prioritize supplied notes. Do not invent source-specific details; clearly identify any limitation when notes are insufficient. With no notes, explain from general knowledge and state that.
Return Markdown only, with no surrounding code fence.`;

  if (provider === "gemini") {
    const summary = await requestGeminiText(apiKey, prompt, {
      temperature: 0.4,
      maxOutputTokens: 6000
    });
    if (!summary?.trim()) throw new Error("Gemini returned an empty summary.");
    return summary.trim();
  }

  return requestOpenAIText(apiKey, prompt, 6000);
}

async function requestAIPracticeContent({
  topic,
  notes,
  difficulty,
  style,
  provider,
  apiKey
}) {
  const prompt = `Create exam practice materials for the topic. Use supplied notes as the primary source; do not invent facts or attribute unsupported facts to the notes. When notes are absent, use general subject knowledge.
${buildStudyContext({ topic, notes, difficulty, style })}

Return only a JSON object with:
- "quiz": exactly 5 MCQs; each has "question", four "options", zero-based integer "answer", and a concise "explanation".
- "flashcards": 5 to 8 concise {"front","back"} objects testing distinct key ideas.
Keep quiz and cards complementary rather than repeating the same wording.`;

  if (provider === "gemini") {
    const text = await requestGeminiText(apiKey, prompt, {
      responseMimeType: "application/json",
      temperature: 0.4,
      maxOutputTokens: 4096
    });
    return parsePracticeResponse(text, "Gemini");
  }

  const text = await requestOpenAIText(apiKey, prompt, 4096, true);
  return parsePracticeResponse(text, "OpenAI");
}

async function fetchAIWithRetries(url, options, provider) {
  const deadline = Date.now() + AI_REQUEST_TIMEOUT_MS;

  for (let attempt = 1; attempt <= AI_MAX_ATTEMPTS; attempt++) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      throw new Error(`${provider} request timed out after 120 seconds. Please try again.`);
    }

    const controller = new AbortController();
    let timedOut = false;
    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, remaining);

    let response;
    try {
      response = await fetch(url, { ...options, signal: controller.signal });
    } catch (error) {
      window.clearTimeout(timeout);
      if (timedOut) {
        throw new Error(`${provider} request timed out after 120 seconds. Please try again.`);
      }
      if (!(error instanceof TypeError)) throw error;
      if (attempt === AI_MAX_ATTEMPTS) {
        throw new Error(`Could not reach ${provider}. Check your internet connection and try again.`);
      }
      await new Promise((resolve) => window.setTimeout(resolve, 500 * 2 ** (attempt - 1)));
      continue;
    }

    if (AI_RETRYABLE_STATUSES.has(response.status) && attempt < AI_MAX_ATTEMPTS) {
      const retryAfter = Number(response.headers.get("Retry-After"));
      const retryDelay = Math.min(
        Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : 500 * 2 ** (attempt - 1),
        2000
      );
      try {
        await response.text();
      } finally {
        window.clearTimeout(timeout);
      }
      if (Date.now() + retryDelay >= deadline) {
        throw new Error(`${provider} request timed out after 120 seconds. Please try again.`);
      }
      await new Promise((resolve) => window.setTimeout(resolve, retryDelay));
      continue;
    }

    let responseText;
    let responseReadError;
    try {
      responseText = await response.text();
    } catch (error) {
      responseReadError = error;
    } finally {
      window.clearTimeout(timeout);
    }

    if (responseReadError) {
      if (timedOut) {
        throw new Error(`${provider} request timed out after 120 seconds. Please try again.`);
      }
      if (!(responseReadError instanceof TypeError)) throw responseReadError;
      if (attempt === AI_MAX_ATTEMPTS) {
        throw new Error(`${provider} response could not be read. Please try again.`);
      }
      await new Promise((resolve) => window.setTimeout(resolve, 500 * 2 ** (attempt - 1)));
      continue;
    }

    return { response, responseText };
  }

  throw new Error(`${provider} request failed after the maximum number of attempts.`);
}

function readAIResponse(responseText, provider) {
  let data;

  try {
    data = responseText ? JSON.parse(responseText) : {};
  } catch {
    throw new Error(`${provider} returned an invalid response.`);
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error(`${provider} returned an invalid response.`);
  }

  return data;
}

function parsePracticeResponse(text, provider) {
  if (!text?.trim()) throw new Error(`${provider} returned empty practice materials.`);

  try {
    return validateAIPracticeContent(JSON.parse(text));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`${provider} returned invalid practice-material JSON. Please try again.`);
    }
    throw error;
  }
}

async function requestOpenAIText(apiKey, prompt, maxTokens, json = false) {
  const { response, responseText } = await fetchAIWithRetries("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: json
            ? "Return a valid JSON object only. Do not use Markdown code fences."
            : "Create accurate, structured Markdown study notes. Return Markdown only."
        },
        { role: "user", content: prompt }
      ],
      ...(json ? { response_format: { type: "json_object" } } : {}),
      max_completion_tokens: maxTokens,
      temperature: 0.4
    })
  }, "OpenAI");
  const data = readAIResponse(responseText, "OpenAI");

  if (!response.ok) {
    throw new Error(data.error?.message || `OpenAI API error (${response.status}).`);
  }

  const text = data.choices?.[0]?.message?.content;
  if (!text?.trim()) throw new Error("OpenAI returned an empty response.");
  return text;
}

async function requestGeminiText(apiKey, prompt, generationConfig = {}) {
  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
  const isDevelopmentHost = ["localhost", "127.0.0.1", "::1"].includes(
    window.location.hostname
  );
  const sanitizeDiagnosticMessage = (message) => {
    return String(message || "")
      .replaceAll(apiKey, "[redacted]")
      .replaceAll(prompt, "[redacted request content]")
      .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted email]")
      .slice(0, 300);
  };

  const { response, responseText } = await fetchAIWithRetries(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig
    })
  }, "Gemini");
  const data = readAIResponse(responseText, "Gemini");

  if (!response.ok) {
    const status = data.error?.status;
    const errorMessage = data.error?.message || "";

    if (response.status === 503 && isDevelopmentHost) {
      console.warn("[Gemini API diagnostic]", {
        httpStatus: response.status,
        providerStatus: status || "unknown",
        providerCode: data.error?.code || response.status,
        providerMessage: sanitizeDiagnosticMessage(errorMessage),
        requestId:
          response.headers.get("x-goog-request-id") ||
          response.headers.get("x-request-id") ||
          response.headers.get("x-guploader-uploadid") ||
          null
      });
    }

    if (
      response.status === 401 ||
      status === "UNAUTHENTICATED" ||
      status === "API_KEY_INVALID" ||
      /api key.{0,30}(invalid|not valid)|(?:invalid|not valid).{0,30}api key/i.test(errorMessage)
    ) {
      throw new Error("Gemini rejected the API key. Check that it is valid and enabled for the Gemini API.");
    }
    if (response.status === 403 || status === "PERMISSION_DENIED") {
      throw new Error("Gemini denied access. Check the API key restrictions and Gemini API permissions.");
    }
    if (response.status === 429 || status === "RESOURCE_EXHAUSTED") {
      throw new Error("Gemini quota or rate limit reached. Check your usage and try again later.");
    }
    if (response.status === 404 || status === "NOT_FOUND") {
      throw new Error(`The Gemini model "${GEMINI_MODEL}" is unavailable for this API key or endpoint.`);
    }
    if (response.status === 400 || status === "INVALID_ARGUMENT") {
      throw new Error("Gemini rejected the request. Check the prompt and generation settings.");
    }
    if (response.status === 503) {
      throw new Error("Gemini is temporarily unavailable right now. Please wait a moment and try again.");
    }
    throw new Error(`Gemini request failed (HTTP ${response.status}). Try again later.`);
  }

  const candidate = data.candidates?.[0];
  if (candidate?.finishReason === "MAX_TOKENS") {
    throw new Error("Gemini reached the response limit. Try a more focused topic or shorter notes.");
  }
  const text = candidate?.content?.parts?.map((part) => part.text || "").join("");
  if (!text && data.promptFeedback?.blockReason) {
    throw new Error("Gemini could not process this request. Try changing the study notes or question.");
  }
  return text;
}

function validateAIPracticeContent(content) {
  if (!content || typeof content !== "object") {
    throw new Error("The AI response did not contain valid practice materials.");
  }
  if (!Array.isArray(content.quiz) || content.quiz.length === 0) {
    throw new Error("The AI response did not contain quiz questions.");
  }

  const quiz = content.quiz.slice(0, 5).map((question) => {
    if (
      typeof question.question !== "string" ||
      !Array.isArray(question.options) ||
      question.options.length < 2
    ) {
      throw new Error("The AI returned an invalid quiz question.");
    }

    const answer = Number(question.answer);

    if (!Number.isInteger(answer) || answer < 0 || answer >= question.options.length) {
      throw new Error("The AI returned an invalid answer index.");
    }

    return {
      question: question.question,
      options: question.options.slice(0, 4).map(String),
      answer,
      explanation: String(question.explanation || "")
    };
  });

  if (!Array.isArray(content.flashcards) || content.flashcards.length === 0) {
    throw new Error("The AI response did not contain flashcards.");
  }

  const flashcards = content.flashcards.slice(0, 20).map((card) => ({
    front: String(card.front || ""),
    back: String(card.back || "")
  }));

  return { quiz, flashcards };
}

function renderSummary(markdown) {
  const summary = get("summaryOutput");
  if (!summary) return;

  const source = String(markdown ?? "");
  if (!window.marked?.parse || !window.DOMPurify?.sanitize) {
    summary.textContent = source;
    if (!state.markdownWarningShown) {
      state.markdownWarningShown = true;
      showToast("Markdown formatting is unavailable; showing the summary as plain text.", "warning");
    }
    return;
  }

  const html = window.marked.parse(source, { gfm: true });
  const fragment = window.DOMPurify.sanitize(html, {
    RETURN_DOM_FRAGMENT: true,
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["img", "svg", "math"]
  });

  fragment.querySelectorAll("table").forEach((table) => {
    const wrapper = document.createElement("div");
    wrapper.className = "summary-table-wrap";
    table.replaceWith(wrapper);
    wrapper.appendChild(table);
  });

  summary.replaceChildren(fragment);
}

/* =========================================================
   Render a study session
   ========================================================= */

function renderSession(session) {
  if (get("resultsHeading")) {
    get("resultsHeading").textContent = session.topic || "Study session";
  }

  if (get("resultsSubtitle")) {
    get("resultsSubtitle").textContent =
      `Generated ${formatDateTime(session.createdAt)} · ${session.difficulty} difficulty`;
  }

  renderSummary(
    session.summary ||
    (session.summaryError
      ? `The summary could not be generated: ${session.summaryError}`
      : "Generating revision summary…")
  );

  if (get("resultsSection")) get("resultsSection").hidden = false;

  renderQuiz();
  renderFlashcard();
  renderAssistantMessages();

  activateResultTab("summary");
}

/* =========================================================
   Summary: copy, download and speech
   ========================================================= */

function setupSummaryActions() {
  get("copySummary")?.addEventListener("click", async () => {
    const text = get("summaryOutput")?.innerText || "";

    if (!text.trim()) {
      showToast("There is no summary to copy.", "warning");
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      showToast("Summary copied.", "success");
    } catch (error) {
      showToast("Copy failed. Select the text and copy it manually.", "error");
    }
  });

  get("downloadSummary")?.addEventListener("click", () => {
    const text = state.currentSession?.summary || get("summaryOutput")?.innerText || "";

    if (!text.trim()) {
      showToast("There is no summary to download.", "warning");
      return;
    }

    const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `${safeFilename(state.currentSession?.topic || "studymate-summary")}.md`;
    link.click();

    URL.revokeObjectURL(url);
    showToast("Summary downloaded.", "success");
  });

  get("readSummary")?.addEventListener("click", () => {
    if (!("speechSynthesis" in window)) {
      showToast("Text-to-speech is not supported in this browser.", "warning");
      return;
    }

    const text = get("summaryOutput")?.innerText || "";
    if (!text.trim()) return;

    window.speechSynthesis.cancel();

    state.speech = new SpeechSynthesisUtterance(text);
    state.speech.rate = 1;
    window.speechSynthesis.speak(state.speech);

    showToast("Reading summary aloud.", "success");
  });

  get("stopSpeech")?.addEventListener("click", () => {
    window.speechSynthesis?.cancel();
  });
}

function safeFilename(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "studymate";
}

/* =========================================================
   Quiz
   ========================================================= */

function renderQuiz() {
  const session = state.currentSession;
  if (!session) return;

  if (!session.quiz?.length) {
    if (get("quizProgressText")) {
      get("quizProgressText").textContent = session.practiceError
        ? "Quiz unavailable"
        : "Preparing quiz…";
    }
    if (get("quizProgressFill")) get("quizProgressFill").style.width = "0";
    if (get("quizQuestion")) {
      get("quizQuestion").textContent = session.practiceError
        ? "Quiz questions could not be generated."
        : "Your questions will appear here.";
    }
    get("quizOptions")?.replaceChildren();
    if (get("quizFeedback")) get("quizFeedback").hidden = true;
    if (get("nextQuestion")) get("nextQuestion").disabled = true;
    if (get("restartQuiz")) get("restartQuiz").disabled = true;
    if (get("quizScoreStrip")) get("quizScoreStrip").hidden = true;
    if (get("quizFinalResult")) get("quizFinalResult").hidden = true;
    return;
  }

  if (get("restartQuiz")) get("restartQuiz").disabled = false;

  const total = session.quiz.length;
  const index = Math.min(state.quizIndex, total - 1);
  const question = session.quiz[index];

  if (get("quizProgressText")) {
    get("quizProgressText").textContent = `Question ${index + 1} of ${total}`;
  }

  if (get("quizProgressFill")) {
    get("quizProgressFill").style.width = `${((index + 1) / total) * 100}%`;
  }

  if (get("quizQuestion")) {
    get("quizQuestion").textContent = question.question;
  }

  const options = get("quizOptions");
  if (options) {
    options.replaceChildren();

    question.options.forEach((option, optionIndex) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "quiz-option";
      button.setAttribute("aria-pressed", "false");

      const letter = document.createElement("span");
      letter.className = "quiz-option-letter";
      letter.textContent = String.fromCharCode(65 + optionIndex);

      const text = document.createElement("span");
      text.textContent = option;

      button.append(letter, text);

      const existingAnswer = state.quizAnswers[index];
      if (existingAnswer === optionIndex) {
        button.classList.add("selected");
        button.setAttribute("aria-pressed", "true");
      }

      if (state.quizSubmitted) {
        button.disabled = true;

        if (optionIndex === question.answer) {
          button.classList.add("correct");
        } else if (optionIndex === existingAnswer) {
          button.classList.add("incorrect");
        }
      } else {
        button.addEventListener("click", () => {
          state.quizAnswers[index] = optionIndex;
          renderQuiz();
        });
      }

      options.appendChild(button);
    });
  }

  if (get("quizFeedback")) {
    const answer = state.quizAnswers[index];
    get("quizFeedback").textContent = state.quizSubmitted
      ? question.explanation
      : answer === undefined
        ? "Choose an answer to continue."
        : "Answer selected.";
  }

  const nextButton = get("nextQuestion");
  if (nextButton) {
    nextButton.textContent = index === total - 1 ? "Finish quiz" : "Next question";
    nextButton.disabled = !state.quizSubmitted && state.quizAnswers[index] === undefined;
  }

  if (get("quizScoreStrip")) get("quizScoreStrip").hidden = true;
  if (get("quizFinalResult")) get("quizFinalResult").hidden = true;
}

function finishQuiz() {
  const session = state.currentSession;
  if (!session) return;

  const total = session.quiz.length;
  const correct = session.quiz.reduce(
    (score, question, index) =>
      score + (state.quizAnswers[index] === question.answer ? 1 : 0),
    0
  );

  const percentage = Math.round((correct / total) * 100);

  session.quizScore = percentage;
  session.quizCorrect = correct;

  saveSession(session);

  if (get("quizFinalScore")) {
    get("quizFinalScore").textContent = `${percentage}%`;
  }

  if (get("quizFinalResult")) {
    get("quizFinalResult").hidden = false;
  }

  if (get("quizScoreStrip")) {
    get("quizScoreStrip").hidden = false;
  }

  if (get("quizScore")) {
    get("quizScore").textContent = `${correct}/${total}`;
  }

  renderDashboard();
  showToast(`Quiz completed: ${percentage}%`, "success");
}

function setupQuiz() {
  get("nextQuestion")?.addEventListener("click", () => {
    const session = state.currentSession;
    if (!session?.quiz?.length) return;

    if (state.quizAnswers[state.quizIndex] === undefined) {
      showToast("Choose an answer first.", "warning");
      return;
    }

    if (state.quizIndex < session.quiz.length - 1) {
      state.quizIndex++;
      renderQuiz();
    } else {
      state.quizSubmitted = true;
      renderQuiz();
      finishQuiz();
    }
  });

  const restart = () => {
    state.quizIndex = 0;
    state.quizAnswers = [];
    state.quizSubmitted = false;
    renderQuiz();
  };

  get("restartQuiz")?.addEventListener("click", restart);
  get("retakeQuiz")?.addEventListener("click", restart);
}

/* =========================================================
   Flashcards
   ========================================================= */

function renderFlashcard() {
  const session = state.currentSession;
  if (!session) return;

  if (!session.flashcards?.length) {
    if (get("flashcardCounter")) {
      get("flashcardCounter").textContent = session.practiceError
        ? "Flashcards unavailable"
        : "Preparing flashcards…";
    }
    if (get("flashcardLabel")) get("flashcardLabel").textContent = "QUESTION";
    if (get("flashcardText")) {
      get("flashcardText").textContent = session.practiceError
        ? "Flashcards could not be generated."
        : "Your flashcards will appear here.";
    }
    if (get("flashcardHint")) {
      get("flashcardHint").textContent = session.practiceError
        ? "Practice materials could not be generated."
        : "Your cards are being created.";
    }
    get("flashcard")?.classList.remove("flipped");
    if (get("previousCard")) get("previousCard").disabled = true;
    if (get("knownButton")) get("knownButton").disabled = true;
    if (get("notKnownButton")) get("notKnownButton").disabled = true;
    if (get("flashcardProgressFill")) get("flashcardProgressFill").style.width = "0";
    return;
  }

  if (get("knownButton")) get("knownButton").disabled = false;
  if (get("notKnownButton")) get("notKnownButton").disabled = false;

  const cards = session.flashcards;
  state.flashcardIndex = Math.max(0, Math.min(state.flashcardIndex, cards.length - 1));

  const card = cards[state.flashcardIndex];

  if (get("flashcardCounter")) {
    get("flashcardCounter").textContent =
      `${state.flashcardIndex + 1} / ${cards.length}`;
  }

  if (get("flashcardLabel")) {
    get("flashcardLabel").textContent = "QUESTION";
  }

  if (get("flashcardText")) {
    get("flashcardText").textContent = card.front;
  }

  if (get("flashcardHint")) {
    get("flashcardHint").textContent = "Click the card to reveal the answer";
  }

  get("flashcard")?.classList.remove("flipped");

  if (get("flashcardProgressFill")) {
    get("flashcardProgressFill").style.width =
      `${((state.flashcardIndex + 1) / cards.length) * 100}%`;
  }

  if (get("knownCounter")) {
    get("knownCounter").textContent =
      `${state.knownCards.size} known · ${state.revisionCards.size} to revise`;
  }

  if (get("previousCard")) {
    get("previousCard").disabled = state.flashcardIndex === 0;
  }

  updateFlashcardStatus();
}

function flipFlashcard() {
  const cardElement = get("flashcard");
  const session = state.currentSession;
  const card = session?.flashcards?.[state.flashcardIndex];

  if (!cardElement || !card) return;

  const flipped = cardElement.classList.toggle("flipped");

  if (get("flashcardLabel")) {
    get("flashcardLabel").textContent = flipped ? "ANSWER" : "QUESTION";
  }

  if (get("flashcardText")) {
    get("flashcardText").textContent = flipped ? card.back : card.front;
  }

  if (get("flashcardHint")) {
    get("flashcardHint").textContent = flipped
      ? "Click to see the question again"
      : "Click the card to reveal the answer";
  }
}

function updateFlashcardStatus() {
  const session = state.currentSession;
  if (!session) return;

  session.knownCount = state.knownCards.size;
  session.revisionCount = state.revisionCards.size;

  saveSession(session);
  renderDashboard();
}

function markFlashcard(known) {
  const index = state.flashcardIndex;

  if (known) {
    state.knownCards.add(index);
    state.revisionCards.delete(index);
  } else {
    state.revisionCards.add(index);
    state.knownCards.delete(index);
  }

  updateFlashcardStatus();

  const total = state.currentSession?.flashcards?.length || 0;
  if (state.flashcardIndex < total - 1) {
    state.flashcardIndex++;
  }

  renderFlashcard();
}

function setupFlashcards() {
  get("flashcard")?.addEventListener("click", flipFlashcard);

  get("flashcard")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      flipFlashcard();
    }
  });

  get("previousCard")?.addEventListener("click", () => {
    if (state.flashcardIndex > 0) {
      state.flashcardIndex--;
      renderFlashcard();
    }
  });

  get("knownButton")?.addEventListener("click", () => markFlashcard(true));
  get("notKnownButton")?.addEventListener("click", () => markFlashcard(false));
}

/* =========================================================
   AI study assistant
   ========================================================= */

function renderAssistantMessages() {
  const container = get("assistantMessages");
  const session = state.currentSession;

  if (!container || !session) return;

  container.replaceChildren();

  const messages = session.assistantMessages || [];

  if (!messages.length && get("assistantWelcome")) {
    get("assistantWelcome").hidden = false;
  } else if (get("assistantWelcome")) {
    get("assistantWelcome").hidden = true;
  }

  messages.forEach((message) => {
    const bubble = document.createElement("div");
    bubble.className = `assistant-message ${message.role}`;
    bubble.textContent = message.content;
    container.appendChild(bubble);
  });

  container.scrollTop = container.scrollHeight;
}

async function askAssistant(question) {
  const session = state.currentSession;
  const settings = getSettings();

  if (!session) {
    showToast("Generate study materials first.", "warning");
    return;
  }

  if (!settings.apiKey) {
    showToast("Add your API key in Settings first.", "warning");
    navigateTo("settings");
    return;
  }

  session.assistantMessages = session.assistantMessages || [];
  session.assistantMessages.push({ role: "user", content: question });
  renderAssistantMessages();
  saveSession(session);

  const button = get("assistantSendButton");
  if (button) button.disabled = true;

  try {
    const prompt = `
You are StudyMate AI, helping a college student prepare for semester exams.
Answer based on the study notes and generated summary below.
If the notes do not support an answer, say so clearly.

Topic: ${session.topic}

Study notes:
${session.notes || "(No original notes provided.)"}

Summary:
${session.summary}

Student question:
${question}

Give a clear, accurate, exam-focused explanation.
`;

    let answer;

    if (settings.provider === "gemini") {
      answer = await requestGeminiAssistant(settings.apiKey, prompt);
    } else {
      answer = await requestOpenAIAssistant(settings.apiKey, prompt);
    }

    session.assistantMessages.push({ role: "assistant", content: answer });
    saveSession(session);
    renderAssistantMessages();
  } catch (error) {
    console.error("Study assistant request failed:", error.message);
    session.assistantMessages.push({
      role: "assistant",
      content: `I couldn't get a response: ${error.message}`
    });
    renderAssistantMessages();
  } finally {
    if (button) button.disabled = false;
  }
}

async function requestOpenAIAssistant(apiKey, prompt) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || `OpenAI API error (${response.status}).`);
  }

  return data.choices?.[0]?.message?.content || "No answer was returned.";
}

async function requestGeminiAssistant(apiKey, prompt) {
  return (
    (await requestGeminiText(apiKey, prompt, { temperature: 0.4 })) ||
    "No answer was returned."
  );
}

function setupAssistant() {
  get("assistantForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const input = get("assistantInput");
    const question = input?.value.trim();

    if (!question) return;

    input.value = "";
    await askAssistant(question);
  });
}

/* =========================================================
   Session history
   ========================================================= */

function saveSession(session) {
  if (!session?.id) return;

  const sessions = getSessions();
  const index = sessions.findIndex((item) => item.id === session.id);

  if (index >= 0) {
    sessions[index] = session;
  } else {
    sessions.unshift(session);
  }

  writeJSON(STORAGE.sessions, sessions);
}

function loadSession(id) {
  const session = getSessions().find((item) => item.id === id);

  if (!session) {
    showToast("This study session could not be found.", "error");
    return;
  }

  state.currentSession = session;
  state.quizIndex = 0;
  state.quizAnswers = [];
  state.quizSubmitted = false;
  state.flashcardIndex = 0;

  state.knownCards = new Set();
  state.revisionCards = new Set();

  const cards = session.flashcards || [];
  cards.forEach((card, index) => {
    if (card.status === "known") state.knownCards.add(index);
    if (card.status === "revision") state.revisionCards.add(index);
  });

  renderSession(session);
  navigateTo("workspace");
  showToast("Study session opened.", "success");
}

function deleteSession(id) {
  const sessions = getSessions().filter((session) => session.id !== id);
  writeJSON(STORAGE.sessions, sessions);

  if (state.currentSession?.id === id) {
    state.currentSession = null;

    if (get("resultsSection")) get("resultsSection").hidden = true;
  }

  renderHistory();
  renderDashboard();
  showToast("Study session deleted.", "success");
}

function createSessionCard(session) {
  const article = document.createElement("article");
  article.className = "session-card";

  const icon = document.createElement("div");
  icon.className = "session-card-icon";
  icon.textContent = "📘";

  const content = document.createElement("div");
  content.className = "session-card-content";

  const title = document.createElement("h3");
  title.className = "session-card-title";
  title.textContent = session.topic || "Untitled session";

  const meta = document.createElement("p");
  meta.className = "session-card-meta";
  meta.textContent =
    `${formatDate(session.createdAt)} · ${(session.flashcards || []).length} flashcards`;

  content.append(title, meta);

  const actions = document.createElement("div");
  actions.className = "session-card-actions";

  if (session.quizScore !== null && session.quizScore !== undefined) {
    const score = document.createElement("span");
    score.className = "session-score";
    score.textContent = `${session.quizScore}%`;
    actions.appendChild(score);
  }

  const openButton = document.createElement("button");
  openButton.type = "button";
  openButton.textContent = "Open";
  openButton.addEventListener("click", () => loadSession(session.id));

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.textContent = "Delete";
  deleteButton.setAttribute("aria-label", `Delete ${session.topic || "session"}`);
  deleteButton.addEventListener("click", () => {
    confirmActionDialog(
      "Delete study session?",
      `Delete "${session.topic || "Untitled session"}" from your history?`,
      () => deleteSession(session.id)
    );
  });

  actions.append(openButton, deleteButton);
  article.append(icon, content, actions);

  return article;
}

function renderHistory() {
  const container = get("historyList");
  if (!container) return;

  const query = (get("historySearch")?.value || "").trim().toLowerCase();
  const filter = get("historyFilter")?.value || "all";

  let sessions = getSessions();

  if (query) {
    sessions = sessions.filter((session) =>
      `${session.topic} ${session.notes}`.toLowerCase().includes(query)
    );
  }

  if (filter === "quizzes") {
    sessions = sessions.filter((session) => session.quizScore !== null &&
      session.quizScore !== undefined);
  } else if (filter === "revision") {
    sessions = sessions.filter((session) => (session.revisionCount || 0) > 0);
  }

  container.replaceChildren();

  sessions.forEach((session) => {
    container.appendChild(createSessionCard(session));
  });

  const empty = get("historyEmpty");
  if (empty) empty.hidden = sessions.length > 0;

  if (get("historyMessage")) {
    get("historyMessage").textContent = sessions.length
      ? `${sessions.length} study session${sessions.length === 1 ? "" : "s"}`
      : "No matching study sessions.";
  }
}

function setupHistory() {
  get("historySearch")?.addEventListener("input", renderHistory);
  get("historyFilter")?.addEventListener("change", renderHistory);

  get("clearHistory")?.addEventListener("click", () => {
    confirmActionDialog(
      "Clear all history?",
      "All saved study sessions will be deleted from this browser.",
      () => {
        writeJSON(STORAGE.sessions, []);
        state.currentSession = null;

        if (get("resultsSection")) get("resultsSection").hidden = true;

        renderHistory();
        renderDashboard();
        showToast("Study history cleared.", "success");
      }
    );
  });
}

/* =========================================================
   Dashboard statistics
   ========================================================= */

function renderDashboard() {
  const sessions = getSessions();

  const totalSessions = sessions.length;
  const scores = sessions
    .map((session) => session.quizScore)
    .filter((score) => typeof score === "number");

  const averageScore = scores.length
    ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
    : 0;

  const known = sessions.reduce(
    (sum, session) => sum + (session.knownCount || 0),
    0
  );

  const revision = sessions.reduce(
    (sum, session) => sum + (session.revisionCount || 0),
    0
  );

  if (get("totalSessions")) get("totalSessions").textContent = totalSessions;
  if (get("averageQuizScore")) {
    get("averageQuizScore").textContent = scores.length ? `${averageScore}%` : "—";
  }
  if (get("knownFlashcards")) get("knownFlashcards").textContent = known;
  if (get("revisionNeeded")) get("revisionNeeded").textContent = revision;

  const recentContainer = get("recentSessionsList");

  if (recentContainer) {
    recentContainer.replaceChildren();

    sessions.slice(0, 4).forEach((session) => {
      recentContainer.appendChild(createSessionCard(session));
    });
  }

  const empty = get("dashboardEmptyState");
  if (empty) empty.hidden = totalSessions > 0;
}

/* =========================================================
   Dialog controls
   ========================================================= */

function setupDialogs() {
  get("cancelConfirmation")?.addEventListener("click", closeConfirmation);

  get("confirmAction")?.addEventListener("click", () => {
    const callback = state.pendingConfirmation;
    closeConfirmation();
    callback?.();
  });

  get("confirmationDialog")?.addEventListener("click", (event) => {
    if (event.target === get("confirmationDialog")) {
      closeConfirmation();
    }
  });
}

/* =========================================================
   My Notes — create, edit, search and save
   ========================================================= */

const NOTES_STORAGE_KEY = "studymate_personal_notes";
let currentNoteId = null;

function getPersonalNotes() {
  const notes = readJSON(NOTES_STORAGE_KEY, []);
  return Array.isArray(notes) ? notes : [];
}

function setNoteSaveStatus(message) {
  const status = get("noteSaveStatus");
  if (status) status.textContent = message;
}

function updateNoteCharacterCount() {
  const content = get("noteContent");
  const counter = get("noteCharacterCount");

  if (content && counter) {
    counter.textContent =
      `${content.value.length.toLocaleString()} / 30,000 characters`;
  }
}

function resetNoteEditor() {
  currentNoteId = null;

  if (get("noteTitle")) get("noteTitle").value = "";
  if (get("noteContent")) get("noteContent").value = "";

  if (get("deleteNoteButton")) {
    get("deleteNoteButton").disabled = true;
  }

  if (get("noteLastSaved")) {
    get("noteLastSaved").textContent = "New note";
  }

  setNoteSaveStatus("Ready");
  updateNoteCharacterCount();
  renderNotesList();
}

function renderNotesList() {
  const container = get("notesList");
  if (!container) return;

  const query = (get("notesSearch")?.value || "").trim().toLowerCase();

  const notes = getPersonalNotes()
    .filter((note) =>
      `${note.title || ""} ${note.content || ""}`
        .toLowerCase()
        .includes(query)
    )
    .sort((a, b) =>
      new Date(b.updatedAt || b.createdAt || 0) -
      new Date(a.updatedAt || a.createdAt || 0)
    );

  container.replaceChildren();

  if (notes.length === 0) {
    const empty = document.createElement("p");
    empty.className = "notes-empty";
    empty.textContent = query
      ? "No notes match your search."
      : "No notes yet. Create your first note.";

    container.appendChild(empty);
    return;
  }

  notes.forEach((note) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "note-list-item";

    if (note.id === currentNoteId) {
      button.classList.add("active");
      button.setAttribute("aria-current", "true");
    }

    const title = document.createElement("span");
    title.className = "note-list-item-title";
    title.textContent = note.title || "Untitled note";

    const preview = document.createElement("span");
    preview.className = "note-list-item-preview";
    preview.textContent = (note.content || "").trim() || "No content yet";

    const date = document.createElement("span");
    date.className = "note-list-item-date";
    date.textContent = `Edited ${formatDate(
      note.updatedAt || note.createdAt
    )}`;

    button.append(title, preview, date);

    button.addEventListener("click", () => {
      openPersonalNote(note.id);
    });

    container.appendChild(button);
  });
}

function openPersonalNote(noteId) {
  const note = getPersonalNotes().find((item) => item.id === noteId);
  if (!note) return;

  currentNoteId = note.id;

  if (get("noteTitle")) get("noteTitle").value = note.title || "";
  if (get("noteContent")) get("noteContent").value = note.content || "";

  if (get("deleteNoteButton")) {
    get("deleteNoteButton").disabled = false;
  }

  if (get("noteLastSaved")) {
    get("noteLastSaved").textContent =
      `Last saved ${formatDateTime(note.updatedAt || note.createdAt)}`;
  }

  setNoteSaveStatus("Saved");
  updateNoteCharacterCount();
  renderNotesList();
}

function savePersonalNote(isAutoSave = false) {
  const title = (get("noteTitle")?.value || "").trim();
  const content = get("noteContent")?.value || "";

  if (!title && !content.trim()) {
    showToast("Enter a title or some note content first.", "warning");
    get("noteTitle")?.focus();
    return;
  }

  const notes = getPersonalNotes();
  const now = new Date().toISOString();

  const existingIndex = notes.findIndex((note) => note.id === currentNoteId);

  let savedNote;

  if (existingIndex >= 0) {
    savedNote = {
      ...notes[existingIndex],
      title: title || "Untitled note",
      content,
      updatedAt: now
    };

    notes[existingIndex] = savedNote;
  } else {
    savedNote = {
      id: createId(),
      title: title || "Untitled note",
      content,
      createdAt: now,
      updatedAt: now
    };

    notes.push(savedNote);
  }

  if (!writeJSON(NOTES_STORAGE_KEY, notes)) {
    setNoteSaveStatus("Save failed");
    return;
  }

  currentNoteId = savedNote.id;

  if (get("noteTitle")) {
    get("noteTitle").value = savedNote.title;
  }

  if (get("deleteNoteButton")) {
    get("deleteNoteButton").disabled = false;
  }

  if (get("noteLastSaved")) {
    get("noteLastSaved").textContent = `Last saved ${formatDateTime(now)}`;
  }

  setNoteSaveStatus(isAutoSave ? "Auto-saved" : "Saved");
  renderNotesList();

  if (!isAutoSave) {
    showToast("Note saved successfully.", "success");
  }
}

function deletePersonalNote() {
  if (!currentNoteId) return;

  const note = getPersonalNotes().find(
    (item) => item.id === currentNoteId
  );

  if (!note) {
    resetNoteEditor();
    return;
  }

  confirmActionDialog(
    "Delete note?",
    `Permanently delete "${note.title || "Untitled note"}"?`,
    () => {
      const remainingNotes = getPersonalNotes().filter(
        (item) => item.id !== currentNoteId
      );

      if (!writeJSON(NOTES_STORAGE_KEY, remainingNotes)) return;

      resetNoteEditor();
      showToast("Note deleted.", "success");
    }
  );
}

function setupNotes() {
  get("createNoteButton")?.addEventListener("click", () => {
    resetNoteEditor();
    get("noteTitle")?.focus();
  });

  get("saveNoteButton")?.addEventListener("click", savePersonalNote);

  get("deleteNoteButton")?.addEventListener(
    "click",
    deletePersonalNote
  );

  get("clearNoteEditorButton")?.addEventListener("click", () => {
    resetNoteEditor();
    get("noteTitle")?.focus();
  });

  get("notesSearch")?.addEventListener("input", renderNotesList);

  let noteAutoSaveTimer = null;

  ["noteTitle", "noteContent"].forEach((id) => {
    get(id)?.addEventListener("input", () => {
      setNoteSaveStatus("Unsaved changes");
      updateNoteCharacterCount();

      // Wait until the user pauses typing before saving.
      clearTimeout(noteAutoSaveTimer);

      noteAutoSaveTimer = setTimeout(() => {
        const title = (get("noteTitle")?.value || "").trim();
        const content = get("noteContent")?.value || "";

        // Do not create empty notes automatically.
        if (!title && !content.trim()) return;

        savePersonalNote(true);
      }, 800);
    });
  });

  renderNotesList();
  updateNoteCharacterCount();
}
/* =========================================================
   Initialisation
   ========================================================= */

function initStudyMate() {
  setupNavigation();
  setupTheme();
  setupStudyInput();
  setupSettings();
  setupResultTabs();
  setupSummaryActions();
  setupQuiz();
  setupFlashcards();
  setupAssistant();
  setupHistory();
  setupNotes();
  setupDialogs();

  renderDashboard();
  renderHistory();

  // Start on the dashboard.
  navigateTo("dashboard");

}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initStudyMate);
} else {
  initStudyMate();
}
