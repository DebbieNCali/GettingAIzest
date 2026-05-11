// ============================================================
// Zest — meals, weekends, vacations, memoir
// All data stored in localStorage under the "zest" key.
// ============================================================

const STORE_KEY = "zest";
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MEALS = ["breakfast", "lunch", "dinner"];

// ---------- store ----------
function loadStore() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY)) || {};
  } catch {
    return {};
  }
}
function saveStore(s) {
  localStorage.setItem(STORE_KEY, JSON.stringify(s));
}
const store = loadStore();
store.weeks      ??= {};   // { "2026-W19": { days: { "2026-05-10": { breakfast:{text,source}, lunch, dinner, notes } }, grocery: "" } }
store.weekend    ??= "";   // free-text scratch for now
store.vacations  ??= [];   // [{ id, destination, startDate, endDate, notes }]
store.memoir     ??= { stories: [] }; // [{ id, title, body, updatedAt }]

// ---------- date helpers ----------
function startOfWeek(d) {       // Sunday-anchored
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay());
  return x;
}
function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function ymd(d) {
  return d.toISOString().slice(0, 10);
}
function weekKey(d) {
  const s = startOfWeek(d);
  // ISO-ish week key based on Sunday start
  const year = s.getFullYear();
  const firstSun = startOfWeek(new Date(year, 0, 1));
  const diffWeeks = Math.round((s - firstSun) / (7 * 24 * 3600 * 1000)) + 1;
  return `${year}-W${String(diffWeeks).padStart(2, "0")}`;
}
function fmtRange(start) {
  const end = addDays(start, 6);
  const opts = { month: "short", day: "numeric" };
  return `${start.toLocaleDateString(undefined, opts)} – ${end.toLocaleDateString(undefined, opts)}`;
}

// ---------- meals ----------
let viewStart = startOfWeek(new Date());

function getWeek(start) {
  const key = weekKey(start);
  store.weeks[key] ??= { days: {}, grocery: "" };
  return store.weeks[key];
}

function renderMeals() {
  const week = getWeek(viewStart);
  document.getElementById("weekRange").textContent = fmtRange(viewStart);
  document.getElementById("groceryNotes").value = week.grocery || "";

  const grid = document.getElementById("weekGrid");
  grid.innerHTML = "";
  const todayStr = ymd(new Date());

  for (let i = 0; i < 7; i++) {
    const date = addDays(viewStart, i);
    const key = ymd(date);
    week.days[key] ??= { breakfast: {}, lunch: {}, dinner: {}, notes: "" };
    const day = week.days[key];

    const card = document.createElement("div");
    card.className = "day-card" + (key === todayStr ? " today" : "");

    const head = document.createElement("h3");
    head.innerHTML = `${DAY_NAMES[date.getDay()]} <span class="date">${date.getDate()}</span>`;
    card.appendChild(head);

    for (const meal of MEALS) {
      const slot = document.createElement("div");
      slot.className = "meal-slot";
      const lbl = document.createElement("label");
      lbl.textContent = meal;
      const input = document.createElement("input");
      input.type = "text";
      input.value = day[meal]?.text || "";
      input.placeholder = "—";
      if (day[meal]?.source) input.classList.add(day[meal].source);
      input.addEventListener("input", () => {
        day[meal] = { text: input.value, source: day[meal]?.source || "self" };
        if (!input.value) day[meal] = {};
        input.className = "";
        if (day[meal]?.source) input.classList.add(day[meal].source);
        saveStore(store);
      });
      slot.appendChild(lbl);
      slot.appendChild(input);
      card.appendChild(slot);
    }

    const notes = document.createElement("textarea");
    notes.className = "day-notes";
    notes.placeholder = "notes…";
    notes.value = day.notes || "";
    notes.addEventListener("input", () => {
      day.notes = notes.value;
      saveStore(store);
    });
    card.appendChild(notes);

    grid.appendChild(card);
  }
  saveStore(store);
}

// Delivery quick-add: prompt for items and which day(s) they cover
function addDelivery(source) {
  const label = source === "shef" ? "Shef" : "Thistle";
  const itemsRaw = prompt(
    `What did you receive from ${label} this week?\n` +
    `Enter one meal per line. We'll spread them across the days you pick next.`
  );
  if (!itemsRaw) return;
  const items = itemsRaw.split("\n").map(s => s.trim()).filter(Boolean);
  if (!items.length) return;

  const slotRaw = prompt(
    `Which meal slot? (breakfast / lunch / dinner)`,
    source === "thistle" ? "lunch" : "dinner"
  );
  const slot = (slotRaw || "").toLowerCase().trim();
  if (!MEALS.includes(slot)) { alert("Unknown meal slot."); return; }

  const startRaw = prompt(
    `Starting which day of the week? (0=Sun, 1=Mon, …, 6=Sat)`,
    "1"
  );
  const startIdx = parseInt(startRaw, 10);
  if (isNaN(startIdx) || startIdx < 0 || startIdx > 6) { alert("Invalid day."); return; }

  const week = getWeek(viewStart);
  for (let i = 0; i < items.length && startIdx + i < 7; i++) {
    const date = addDays(viewStart, startIdx + i);
    const k = ymd(date);
    week.days[k] ??= { breakfast: {}, lunch: {}, dinner: {}, notes: "" };
    week.days[k][slot] = { text: items[i], source };
  }
  saveStore(store);
  renderMeals();
}

// AI suggestion: open claude.ai with a prefilled prompt
function openClaudeWith(prompt) {
  const url = "https://claude.ai/new?q=" + encodeURIComponent(prompt);
  window.open(url, "_blank", "noopener");
}

function suggestPairings() {
  const week = getWeek(viewStart);
  const lines = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(viewStart, i);
    const k = ymd(date);
    const d = week.days[k] || {};
    const parts = MEALS
      .map(m => d[m]?.text ? `${m}: ${d[m].text} (${d[m].source || "self"})` : null)
      .filter(Boolean);
    lines.push(`${DAY_NAMES[date.getDay()]} ${date.getMonth() + 1}/${date.getDate()} — ${parts.join("; ") || "(open)"}`);
  }
  const p =
    `Here's my meal plan for the week of ${fmtRange(viewStart)}.\n\n` +
    lines.join("\n") +
    `\n\nMost meals come from Shef and Thistle deliveries. ` +
    `For the open slots, please suggest simple sides, snacks, or light meals that pair well with what's already planned. ` +
    `Also flag any nights that look heavy or unbalanced and suggest a tweak.`;
  openClaudeWith(p);
}

// ---------- weekends ----------
function renderWeekends() {
  document.getElementById("weekendNotes").value = store.weekend || "";
}
function suggestWeekend() {
  const p =
    `Help me plan something to do this weekend. ` +
    `Here are my current notes:\n\n${store.weekend || "(none yet)"}\n\n` +
    `Suggest 5 specific weekend activity ideas — mix of low-effort at-home, social, and outdoor. ` +
    `Bias toward things I could actually do this Saturday or Sunday.`;
  openClaudeWith(p);
}

// ---------- vacations ----------
function renderVacations() {
  const list = document.getElementById("vacationList");
  list.innerHTML = "";
  const sorted = [...store.vacations].sort((a, b) =>
    (a.startDate || "9999").localeCompare(b.startDate || "9999")
  );
  for (const v of sorted) {
    const row = document.createElement("div");
    row.className = "vacation-card";
    row.innerHTML = `
      <input type="text" placeholder="Destination" value="${escapeAttr(v.destination || "")}" data-field="destination" />
      <input type="date" value="${v.startDate || ""}" data-field="startDate" title="Start date" />
      <input type="date" value="${v.endDate || ""}" data-field="endDate" title="End date" />
      <button class="delete" data-id="${v.id}">Delete</button>
    `;
    row.querySelectorAll("input").forEach(input => {
      input.addEventListener("input", () => {
        v[input.dataset.field] = input.value;
        saveStore(store);
      });
    });
    row.querySelector(".delete").addEventListener("click", () => {
      store.vacations = store.vacations.filter(x => x.id !== v.id);
      saveStore(store);
      renderVacations();
    });
    list.appendChild(row);
  }
}
function suggestVacation() {
  const known = store.vacations
    .map(v => `- ${v.destination || "(idea)"}${v.startDate ? ` (${v.startDate} to ${v.endDate || "?"})` : ""}`)
    .join("\n") || "(none yet)";
  const p =
    `I want to plan more vacations this year. Here are the trips I'm already considering:\n\n${known}\n\n` +
    `Suggest 5 more vacation ideas — a mix of weekend getaways, week-long trips, and one bigger adventure. ` +
    `For each, give: where, best time of year, why it's worth it, and a rough budget category (cheap / mid / splurge).`;
  openClaudeWith(p);
}

// ---------- memoir ----------
const PROMPTS = [
  "Earliest memory you can recall",
  "A meal that reminds you of childhood",
  "The day you met your spouse",
  "A grandparent's hands",
  "A trip that changed something",
  "The house you grew up in — room by room",
  "An ordinary Tuesday from another decade",
  "A family recipe and who made it best",
  "Something you wish you'd asked your parents",
  "A song that takes you back",
  "An apology you owe or are owed",
  "The hardest year, and how it ended",
  "A tradition you want to pass on",
];

let editingStoryId = null;

function renderMemoir() {
  const promptList = document.getElementById("promptList");
  promptList.innerHTML = "";
  for (const p of PROMPTS) {
    const li = document.createElement("li");
    li.textContent = p;
    li.addEventListener("click", () => {
      document.getElementById("memoirTitle").value = p;
      document.getElementById("memoirBody").focus();
    });
    promptList.appendChild(li);
  }
  renderStoryList();
}
function renderStoryList() {
  const ul = document.getElementById("storyList");
  ul.innerHTML = "";
  const stories = [...store.memoir.stories].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  for (const s of stories) {
    const li = document.createElement("li");
    li.innerHTML = `
      <span><strong>${escapeHtml(s.title || "Untitled")}</strong></span>
      <span class="story-meta">${new Date(s.updatedAt).toLocaleDateString()}</span>
    `;
    li.addEventListener("click", () => {
      editingStoryId = s.id;
      document.getElementById("memoirTitle").value = s.title || "";
      document.getElementById("memoirBody").value = s.body || "";
    });
    ul.appendChild(li);
  }
}
function saveStory() {
  const title = document.getElementById("memoirTitle").value.trim();
  const body = document.getElementById("memoirBody").value;
  if (!title && !body) return;
  if (editingStoryId) {
    const s = store.memoir.stories.find(x => x.id === editingStoryId);
    if (s) { s.title = title; s.body = body; s.updatedAt = Date.now(); }
  } else {
    store.memoir.stories.push({ id: cryptoId(), title, body, updatedAt: Date.now() });
  }
  saveStore(store);
  renderStoryList();
}
function newStory() {
  editingStoryId = null;
  document.getElementById("memoirTitle").value = "";
  document.getElementById("memoirBody").value = "";
  document.getElementById("memoirTitle").focus();
}
function exportMemoir() {
  const stories = [...store.memoir.stories].sort((a, b) => (a.updatedAt || 0) - (b.updatedAt || 0));
  const md = stories.map(s =>
    `# ${s.title || "Untitled"}\n\n_${new Date(s.updatedAt).toLocaleDateString()}_\n\n${s.body || ""}`
  ).join("\n\n---\n\n");
  download("family-memoir.md", md, "text/markdown");
}

// ---------- export / import ----------
function exportAll() {
  download("zest-backup.json", JSON.stringify(store, null, 2), "application/json");
}
function importAll(file) {
  const r = new FileReader();
  r.onload = () => {
    try {
      const data = JSON.parse(r.result);
      if (!confirm("Replace current data with this backup?")) return;
      Object.keys(store).forEach(k => delete store[k]);
      Object.assign(store, data);
      saveStore(store);
      bootRender();
    } catch (e) {
      alert("Could not parse that file: " + e.message);
    }
  };
  r.readAsText(file);
}

// ---------- utils ----------
function download(name, content, mime) {
  const blob = new Blob([content], { type: mime });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }
function cryptoId() {
  return (crypto.randomUUID && crypto.randomUUID()) || String(Date.now()) + Math.random().toString(16).slice(2);
}

// ---------- wiring ----------
function setupTabs() {
  document.querySelectorAll(".tab").forEach(t => {
    t.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
      document.querySelectorAll(".panel").forEach(x => x.classList.remove("active"));
      t.classList.add("active");
      document.getElementById("panel-" + t.dataset.tab).classList.add("active");
    });
  });
}

function bootRender() {
  renderMeals();
  renderWeekends();
  renderVacations();
  renderMemoir();
}

document.addEventListener("DOMContentLoaded", () => {
  setupTabs();
  bootRender();

  document.getElementById("prevWeek").onclick = () => { viewStart = addDays(viewStart, -7); renderMeals(); };
  document.getElementById("nextWeek").onclick = () => { viewStart = addDays(viewStart, 7);  renderMeals(); };
  document.getElementById("thisWeek").onclick = () => { viewStart = startOfWeek(new Date()); renderMeals(); };
  document.getElementById("addShef").onclick    = () => addDelivery("shef");
  document.getElementById("addThistle").onclick = () => addDelivery("thistle");
  document.getElementById("suggestPairings").onclick = suggestPairings;

  document.getElementById("groceryNotes").addEventListener("input", e => {
    getWeek(viewStart).grocery = e.target.value;
    saveStore(store);
  });

  document.getElementById("weekendNotes").addEventListener("input", e => {
    store.weekend = e.target.value;
    saveStore(store);
  });
  document.getElementById("suggestWeekend").onclick = suggestWeekend;

  document.getElementById("addVacation").onclick = () => {
    store.vacations.push({ id: cryptoId(), destination: "", startDate: "", endDate: "", notes: "" });
    saveStore(store);
    renderVacations();
  };
  document.getElementById("suggestVacation").onclick = suggestVacation;

  document.getElementById("saveStory").onclick = saveStory;
  document.getElementById("newStory").onclick = newStory;
  document.getElementById("exportMemoir").onclick = exportMemoir;

  document.getElementById("exportBtn").onclick = exportAll;
  document.getElementById("importBtn").onclick = () => document.getElementById("importFile").click();
  document.getElementById("importFile").addEventListener("change", e => {
    if (e.target.files[0]) importAll(e.target.files[0]);
  });
});
