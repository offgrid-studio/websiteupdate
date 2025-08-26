// ===============================
// Offgrid Studio Index — Main JS
// Stable audio mapping + sorting/filtering-safe
// ===============================

const audioPlayers = {}; // { [stableId]: { hover: Tone.Player|null, click: Tone.Player|null } }
let selectedCategories = [];
let currentPlayer = null;
// Track the currently playing voice so we can release + dispose nodes
let currentVoice = null; // { player, ampEnv, filterEnv, nodesToDispose: [] }

let currentSort = { column: null, direction: "asc" };
let dataRows = [];     // [{ id, cells }]
let filteredRows = []; // same shape as dataRows

// Start Tone.js after first user gesture
document.addEventListener(
  "click",
  async () => {
    if (Tone.context.state !== "running") {
      await Tone.start();
      console.log("🔊 Tone.js context started");
    }
  },
  { once: true }
);

// ------------------------------
// Column map — update once here
// ------------------------------
const COL = {
  TITLE: 0,
  CLIENT: 1,
  DESC: 2,
  YEAR: 3,
  LOCATION: 4,
  MP3_HOVER: 5,   // F
  MP3_CLICK: 6,   // G
  GIF_PATH: 7,    // H
  PROJECT_URL: 8, // I
  LOCATION_URL: 9,// J
  TAGS: 10        // K  (⚠️ If your tags are actually in I, set TAGS: 8 and shift others accordingly)
};

// ------------------------------
// Helpers
// ------------------------------

// 🔧 Where your GIFs live (adjust if needed)
// ⚠️ Case-sensitive on most servers: your folder is "GIFS" (all caps)
const GIF_BASE = "https://offgrid.studio"; // or "https://files.offgrid.studio"
const GIF_DIR  = "/GIFS/";                 // default folder when the sheet has only a filename

// Build a URL from a filename, relative path, or legacy /public_html path
function formatGifURL(raw) {
  if (!raw || typeof raw !== "string") return null;
  let s = raw.trim();

  // Fix common "https//" or "http//" (missing colon)
  if (/^https?\/\//i.test(s) && !/^https?:\/\//i.test(s)) {
    s = s.replace(/^https?\/\//i, (m) =>
      m.toLowerCase().startsWith("https") ? "https://" : "http://"
    );
  }

  // Full URL? keep as-is
  if (/^https?:\/\//i.test(s)) return s;

  // Protocol-relative
  if (/^\/\//.test(s)) return "https:" + s;

  // Strip anything up to and including 'public_html'
  const phIdx = s.toLowerCase().indexOf("public_html");
  if (phIdx >= 0) s = s.slice(phIdx + "public_html".length);

  // Normalize slashes
  s = s.replace(/\\/g, "/").replace(/\/{2,}/g, "/");
  // Remove leading slashes for joining logic
  const stripped = s.replace(/^\/+/, "");

  // If it already includes a directory, use it as a site-root path.
  // If it's just a bare filename, prepend GIF_DIR.
  const hasDir = stripped.includes("/");
  const path = hasDir
    ? "/" + stripped
    : (GIF_DIR.replace(/\/+$/, "") + "/" + stripped).replace(/\/{2,}/g, "/");

  // Final absolute URL
  return GIF_BASE.replace(/\/+$/, "") + path;
}

function formatAudioURL(filename) {
  if (!filename || typeof filename !== "string") return null;
  return "https://files.offgrid.studio/" + filename.trim();
}

function parseTags(tagString) {
  return (tagString || "")
    .split(";")
    .map((t) => t.trim())
    .filter((t) => !!t && t.toLowerCase() !== "location");
}

// ------------------------------
// Preload audio using STABLE IDs
// ------------------------------
async function preloadAudioPlayers(rows) {
  for (const { id, cells } of rows) {
    const hoverUrl = formatAudioURL(cells[COL.MP3_HOVER]);
    const clickUrl = formatAudioURL(cells[COL.MP3_CLICK]);

    const hoverPlayer = hoverUrl
      ? new Tone.Player({ url: hoverUrl, autostart: false }).toDestination()
      : null;

    const clickPlayer = clickUrl
      ? new Tone.Player({ url: clickUrl, autostart: false }).toDestination()
      : null;

    audioPlayers[id] = { hover: hoverPlayer, click: clickPlayer };

    // Tiny stagger to avoid hammering on mobile
    await new Promise((r) => setTimeout(r, 10));
  }
  console.log("✅ All audio preloaded");
}

// ------------------------------
// Load rows from Google Sheets
// ------------------------------
async function loadCSV() {
  const response = await fetch(
    "https://docs.google.com/spreadsheets/d/164ps6mI666JLt-q4iVb0FMA5ztPykwRT4mOVAE_zbwE/export?format=csv&gid=11925201"
  );
  const csvText = await response.text();

  // ⚠️ If your data contains commas inside cells, consider using a CSV parser (PapaParse).
  const rows = csvText.trim().split(/\r?\n/).map((row) => row.split(","));

  const thead = document.querySelector("#sheetTable thead");

  // ---- Build dataRows with stable ids
  dataRows = rows.slice(1).map((cells) => {
    const hover = (cells[COL.MP3_HOVER] || "").trim();
    const click = (cells[COL.MP3_CLICK] || "").trim();
    const id = [cells[COL.TITLE] || "", cells[COL.YEAR] || "", hover, click].join("||");
    return { id, cells };
  });

  // ---- Build table header (columns 0..4)
  const headers = rows[0] || [];
  thead.innerHTML = "";
  const trHead = document.createElement("tr");
  headers.forEach((header, index) => {
    if (index > 4) return; // show only first five columns
    const th = document.createElement("th");
    th.dataset.index = index;
    th.textContent = header;
    // Skip sorting on the LOCATION column if you like (matches your previous behavior)
    if (index !== COL.LOCATION) th.addEventListener("click", () => sortByColumn(index));
    trHead.appendChild(th);
  });
  thead.appendChild(trHead);

  // ---- Preload audio (by stable id)
  await preloadAudioPlayers(dataRows);

  // ---- Default sort: YEAR desc
  dataRows.sort(
    (a, b) => parseInt(b.cells[COL.YEAR] || "0", 10) - parseInt(a.cells[COL.YEAR] || "0", 10)
  );
  filteredRows = dataRows.slice();

  // ---- Set sort indicator
  const ths = document.querySelectorAll("#sheetTable thead th");
  currentSort = { column: COL.YEAR, direction: "desc" };
  ths.forEach((th) => {
    th.classList.remove("sorted", "sorted-desc");
    if (parseInt(th.dataset.index, 10) === COL.YEAR) {
      th.classList.add("sorted", "sorted-desc");
    }
  });

  // ---- Make category bar sticky once
  const catBar = document.getElementById("categoryFilters");
  if (catBar) catBar.classList.add("sticky-category-bar");

  // ---- Initial render
  renderCategoryPills();
  renderTable(filteredRows);

  // ---- Hide grid initially
  const gridWrapper = document.getElementById("gridWrapper");
  const gridView = document.getElementById("gridView");
  if (gridWrapper && gridView) {
    gridWrapper.classList.add("hidden");
    gridView.innerHTML = "";
  }

  updateStickyHeaderOffset();
}

// ------------------------------
// Table rendering (list view)
// ------------------------------
function renderTable(rowObjs) {
  const tbody = document.querySelector("#sheetTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  rowObjs.forEach(({ id, cells }) => {
    const tr = document.createElement("tr");

    // Image preview URL
    const rawGifPath = cells[COL.GIF_PATH];
    const formattedUrl = formatGifURL(rawGifPath) || "https://via.placeholder.com/150";
    tr.dataset.previewImage = formattedUrl;

    const tags = parseTags(cells[COL.TAGS]);

    // Ensure players exist even if preload missed something (rare)
    if (!audioPlayers[id]) audioPlayers[id] = {};
    const hoverUrl = formatAudioURL(cells[COL.MP3_HOVER]);
    const clickUrl = formatAudioURL(cells[COL.MP3_CLICK]);
    if (hoverUrl && !audioPlayers[id].hover)
      audioPlayers[id].hover = new Tone.Player({ url: hoverUrl, autostart: false }).toDestination();
    if (clickUrl && !audioPlayers[id].click)
      audioPlayers[id].click = new Tone.Player({ url: clickUrl, autostart: false }).toDestination();

    // Hook audio to row
    attachHoverAndClickAudio(tr, id, tags);

    // Row click → open project URL (unless clicking the location pill)
    const projectUrl = cells[COL.PROJECT_URL];
    if (projectUrl) {
      tr.style.cursor = "pointer";
      tr.addEventListener("click", (e) => {
        if (e.target.closest(".location")) return;
        window.open(projectUrl, "_blank", "noopener,noreferrer");
      });
    }

    // Tags for pill highlighting
    tr.dataset.tags = JSON.stringify(tags);
    tr.addEventListener("mouseenter", () => highlightPills(tags));
    tr.addEventListener("mouseleave", resetPills);

    // Image preview (requires #imagePreview and #previewContent in DOM)
    tr.addEventListener("mouseenter", () => {
      const preview = document.getElementById("imagePreview");
      const content = document.getElementById("previewContent");
      if (!preview || !content) return;
      content.innerHTML = `<img src="${tr.dataset.previewImage}" style="max-width:150px; border-radius:12px; border:none;">`;
      preview.classList.remove("active");
      void preview.offsetWidth;
      preview.classList.add("active");
      clearTimeout(preview.hideTimer);
    });

    tr.addEventListener("mousemove", (e) => {
      const preview = document.getElementById("imagePreview");
      if (!preview) return;
      preview.style.left = `${e.pageX + 20}px`;
      preview.style.top = `${e.pageY - 20}px`;
    });

    tr.addEventListener("mouseleave", () => {
      const preview = document.getElementById("imagePreview");
      const content = document.getElementById("previewContent");
      if (!preview || !content) return;
      preview.hideTimer = setTimeout(() => {
        preview.classList.remove("active");
        setTimeout(() => {
          content.innerHTML = "";
        }, 500);
      }, 50);
    });

    // Cells: render first 5 columns (0..4)
    for (let index = 0; index <= 4; index++) {
      const cell = cells[index] || "";
      const td = document.createElement("td");

      // Special handling for LOCATION column (index 1 in your earlier logic; adjust if needed)
      if (index === 1 && cell.includes("@")) {
        const locationUrl = cells[COL.LOCATION_URL];
        const pill = document.createElement("span");
        pill.className = "location";
        pill.textContent = `${cell} 📍`;
        if (locationUrl && locationUrl.startsWith("http")) {
          const link = document.createElement("a");
          link.href = locationUrl;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.appendChild(pill);
          td.appendChild(link);
          link.addEventListener("click", (e) => e.stopPropagation());
        } else {
          td.appendChild(pill);
        }
      } else if (typeof cell === "string" && cell.toLowerCase().includes("places")) {
        const pill = document.createElement("span");
        pill.className = "pill";
        pill.textContent = cell;
        td.appendChild(pill);
      } else {
        td.textContent = cell;
      }

      tr.appendChild(td);
    }

    // GSAP row hover
    tr.addEventListener("mouseenter", () => {
      gsap.to(tr, {
        scale: 1.03,
        duration: 0.3,
        ease: "power2.out",
        overwrite: "auto"
      });
    });

    tr.addEventListener("mouseleave", () => {
      gsap.to(tr, {
        scale: 1.0,
        duration: 0.3,
        ease: "power2.out",
        overwrite: "auto"
      });
    });

    tbody.appendChild(tr);
  });
}

// ------------------------------
// Audio envelope + FX  (Option A integrated)
// ------------------------------
async function playShapedAudio(player, tags = []) {
  // If not loaded yet, retry once it's ready
  if (!player || !player.buffer || !player.buffer.loaded) {
    if (player && !player._retryHooked) {
      player._retryHooked = true;
      player.onload = () => playShapedAudio(player, tags);
    }
    console.warn("⚠️ No player or not loaded");
    return;
  }

  // Release + dispose previous voice (if any)
  if (currentVoice) {
    try {
      currentVoice.ampEnv?.triggerRelease();
      currentVoice.filterEnv?.triggerRelease();
      currentVoice.player?.stop();
      // dispose previous nodes we created
      currentVoice.nodesToDispose?.forEach(n => {
        try { n.dispose?.(); } catch (_) {}
      });
    } catch (_) {}
    currentVoice = null;
  }

  const now = Tone.now();
  const attack = Math.random() * 0.2 + 0.0075;
  const decay = Math.random() * 2 + 1;
  const sustain = Math.random() * 0;
  const release = Math.random() * 0.2 + 0.05;
  const cutoff = Math.random() * 20000 + 15000;

  // Core voice nodes
  const filter = new Tone.Filter({ type: "lowpass", frequency: cutoff });
  const gainNode = new Tone.Gain(0); // will be driven by amp envelope

  const effectsChain = [];

  // Tag helper
  const tagMatch = (needles) =>
    Array.isArray(tags) &&
    tags.some((tag) => needles.some((n) => tag.trim().toLowerCase() === n.trim().toLowerCase()));

  // FX matches
  if (tagMatch(["Octaphonic", "Quadrophonic"])) {
    const startFreq = Math.random() * 25 + 25;
    const endFreq = 0.1;
    const rampTime = 2;
    const panner = new Tone.AutoPanner({ frequency: startFreq, depth: 1, type: "sine" }).start();
    panner.frequency.setValueAtTime(startFreq, now);
    panner.frequency.exponentialRampToValueAtTime(endFreq, now + rampTime);
    effectsChain.push(panner);
  }

  if (tagMatch(["Social Media", "Ad Campaign"])) {
    const highDepth = Math.random() * 0.5 + 0.5;
    const lowDepth = Math.random() * 0.3 + 0.1;
    const rampTime = Math.random() * 1.5 + 0.5;

    const chorus = new Tone.Chorus({
      frequency: 1.5,
      delayTime: 3.5,
      depth: highDepth,
      type: "sine",
      spread: 180,
      wet: 0.6
    }).start();

    setTimeout(() => {
      chorus.depth = lowDepth;
    }, rampTime * 1000);

    const delay = new Tone.FeedbackDelay({
      delayTime: 0.2,
      feedback: 0.3,
      wet: 0.3
    });

    const startDelay = Math.random() * 0.4 + 0.1;
    const endDelay = Math.random() * 0.04 + 0.01;
    delay.delayTime.setValueAtTime(startDelay, now);
    delay.delayTime.exponentialRampToValueAtTime(endDelay, now + rampTime);

    chorus.connect(delay);
    effectsChain.push(chorus, delay);
  }

  // Fallback FX
  if (effectsChain.length === 0) {
    if (Math.random() < 0.5) {
      const reverb = new Tone.Reverb({ decay: 1.5, preDelay: 0.01 });
      reverb.wet.value = 0.3;
      await reverb.generate();
      effectsChain.push(reverb);
    } else {
      const delay = new Tone.FeedbackDelay("16n", 0.3);
      delay.wet.value = 0.1;
      effectsChain.push(delay);
    }
  }

  // Chain FX
  for (let i = 0; i < effectsChain.length - 1; i++) {
    effectsChain[i].connect(effectsChain[i + 1]);
  }
  const fx = effectsChain[effectsChain.length - 1];

  // Connect graph: player -> filter -> gain -> fx -> destination
  gainNode.connect(fx);
  fx.toDestination();

  player.disconnect();
  player.connect(filter);
  filter.connect(gainNode);

  // ===== Envelopes (Option A) =====
  // Amplitude envelope → controls gain
  const ampEnv = new Tone.Envelope({ attack, decay, sustain, release });
  ampEnv.connect(gainNode.gain);

  // Filter envelope → sweeps cutoff over time (in octaves above baseFrequency)
  const filterEnv = new Tone.FrequencyEnvelope({
    attack: Math.max(0.01, attack * 0.6),
    decay,
    sustain: Math.min(0.8, sustain + 0.2),
    release,
    baseFrequency: Math.max(50, cutoff * 0.4),
    octaves: 3
  });
  filterEnv.connect(filter.frequency);

  // Trigger envelopes + playback
  ampEnv.triggerAttack(now);
  filterEnv.triggerAttack(now);
  player.start(now);

  // Schedule releases slightly before sample end
  const end = now + player.buffer.duration;
  ampEnv.triggerRelease(end - release);
  filterEnv.triggerRelease(end - release);
  player.stop(end + 0.05);

  // Save refs so we can release/dispose next time
  currentVoice = {
    player,
    ampEnv,
    filterEnv,
    nodesToDispose: [filter, gainNode, ...effectsChain, ampEnv, filterEnv]
  };
  currentPlayer = player;
}

// ------------------------------
// Hover + Click audio binding
// ------------------------------
function attachHoverAndClickAudio(el, stableId, tags) {
  el.addEventListener("mouseenter", () => {
    const player = audioPlayers[stableId]?.hover;
    if (player) playShapedAudio(player, tags);
  });

  el.addEventListener("click", () => {
    const player = audioPlayers[stableId]?.click;
    if (player) playShapedAudio(player, tags);
  });
}

// ------------------------------
// Grid rendering (card view)
// ------------------------------
function renderGridView(rowObjs) {
  const grid = document.getElementById("gridView");
  if (!grid) return;
  grid.innerHTML = "";

  rowObjs.forEach(({ id, cells }, i) => {
    const gifUrl = formatGifURL(cells[COL.GIF_PATH]) || "https://via.placeholder.com/150";
    const projectTitle = cells[COL.TITLE] || "";
    const year = cells[COL.YEAR] || "";
    const link = cells[COL.PROJECT_URL];
    const tags = parseTags(cells[COL.TAGS]);

    const card = document.createElement("div");
    card.className = "grid-card animated";
    card.style.animationDelay = `${i * 10}ms`;
    card.dataset.tags = JSON.stringify(tags);

    card.addEventListener("mouseenter", () => highlightPills(tags));
    card.addEventListener("mouseleave", resetPills);

    card.innerHTML = `
      <img src="${gifUrl}" alt="${projectTitle}">
      <div class="meta">${projectTitle}<br>${year}</div>
    `;

    if (link) {
      card.addEventListener("click", () => {
        window.open(link, "_blank", "noopener,noreferrer");
      });
    }

    attachHoverAndClickAudio(card, id, tags);
    grid.appendChild(card);
  });

  // GSAP hover
  requestAnimationFrame(() => {
    document.querySelectorAll(".grid-card").forEach((card) => {
      card.addEventListener("mouseenter", () => {
        gsap.to(card, {
          scale: 1.5,
          y: -2,
          duration: 0.5,
          ease: "power4.out",
          overwrite: "auto"
        });
        card.style.zIndex = "10";
      });

      card.addEventListener("mouseleave", () => {
        gsap.to(card, {
          scale: 1,
          y: 0,
          duration: 1,
          ease: "circ.out",
          overwrite: "auto"
        });
        card.style.zIndex = "1";
      });
    });
  });
}

// ------------------------------
// Category pills (from COL.TAGS)
// ------------------------------
function renderCategoryPills() {
  const container = document.getElementById("categoryFilters");
  if (!container) return;
  container.innerHTML = "";

  const allCategories = new Set();
  dataRows.forEach(({ cells }) => {
    parseTags(cells[COL.TAGS]).forEach((cat) => allCategories.add(cat));
  });

  [...allCategories].sort().forEach((cat) => {
    const pill = document.createElement("span");
    pill.className = "pill";
    pill.textContent = cat;
    pill.setAttribute("data-category", cat); // used by highlightPills

    // Inline styling (replace with CSS if you prefer)
    Object.assign(pill.style, {
      margin: "4px",
      padding: "6px 10px",
      minWidth: "80px",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "space-between",
      borderRadius: "999px",
      border: "1px solid #ccc",
      cursor: "pointer",
      backgroundColor: selectedCategories.includes(cat) ? "#fff" : "#000",
      color: selectedCategories.includes(cat) ? "#000" : "#fff"
    });

    pill.addEventListener("click", () => {
      if (selectedCategories.includes(cat)) {
        selectedCategories = selectedCategories.filter((c) => c !== cat);
      } else {
        selectedCategories.push(cat);
      }
      renderCategoryPills();
      filterByCategories();
    });

    if (selectedCategories.includes(cat)) {
      const x = document.createElement("span");
      x.textContent = "X";
      x.style.marginLeft = "8px";
      x.style.cursor = "pointer";
      x.addEventListener("click", (e) => {
        e.stopPropagation();
        selectedCategories = selectedCategories.filter((c) => c !== cat);
        renderCategoryPills();
        filterByCategories();
      });
      pill.appendChild(x);
    }

    container.appendChild(pill);
  });

  // Clear All
  if (selectedCategories.length > 0) {
    const clearBtn = document.createElement("button");
    clearBtn.className = "clear-all-btn";
    clearBtn.textContent = "×";
    Object.assign(clearBtn.style, {
      marginLeft: "12px",
      padding: "6px 12px",
      borderRadius: "999px",
      border: "1px solid #ccc",
      background: "#444",
      color: "white",
      cursor: "pointer"
    });
    clearBtn.addEventListener("click", () => {
      selectedCategories = [];
      renderCategoryPills();
      filterByCategories();
    });
    container.appendChild(clearBtn);
  }
}

function filterByCategories() {
  filteredRows =
    selectedCategories.length === 0
      ? dataRows.slice()
      : dataRows.filter(({ cells }) => {
          const tags = parseTags(cells[COL.TAGS]);
          return selectedCategories.some((cat) => tags.includes(cat));
        });

  const sheetTable = document.getElementById("sheetTable");
  const gridWrapper = document.getElementById("gridWrapper");

  if (gridWrapper && gridWrapper.classList.contains("hidden")) {
    sheetTable?.classList.remove("hidden");
    gridWrapper?.classList.add("hidden");
    renderTable(filteredRows);
  } else {
    gridWrapper?.classList.remove("hidden");
    sheetTable?.classList.add("hidden");
    renderGridView(filteredRows);
  }
}

// ------------------------------
// Sort handler
// ------------------------------
function sortByColumn(index) {
  const ths = document.querySelectorAll("thead th");
  ths.forEach((th) => th.classList.remove("sorted", "sorted-desc"));

  if (currentSort.column === index) {
    currentSort.direction = currentSort.direction === "asc" ? "desc" : "asc";
  } else {
    currentSort.column = index;
    currentSort.direction = "asc";
  }
  const dir = currentSort.direction === "asc" ? 1 : -1;

  const sorted = [...dataRows].sort((a, b) => {
    const valA = a.cells[index] ?? "";
    const valB = b.cells[index] ?? "";
    const numA = parseFloat(valA);
    const numB = parseFloat(valB);
    const isNum = !isNaN(numA) && !isNaN(numB);
    return isNum ? (numA - numB) * dir : String(valA).localeCompare(String(valB)) * dir;
  });

  filteredRows = sorted;

  const activeTh = Array.from(ths).find((th) => parseInt(th.dataset.index, 10) === index);
  if (activeTh) {
    activeTh.classList.add("sorted");
    if (currentSort.direction === "desc") activeTh.classList.add("sorted-desc");
  }

  const gridWrapper = document.getElementById("gridWrapper");
  if (gridWrapper && gridWrapper.classList.contains("hidden")) {
    renderTable(filteredRows);
  } else {
    renderGridView(filteredRows);
  }
}

// ------------------------------
// Highlight pills while hovering
// ------------------------------
function highlightPills(tags) {
  const pills = document.querySelectorAll(".pill");
  pills.forEach((pill) => {
    const category = pill.getAttribute("data-category");
    if (category && tags.includes(category)) {
      pill.style.transform = "scale(1.5)";
      pill.style.margin = "0 12px";
      pill.style.transition = "transform 0.2s ease, margin 0.2s ease";
    } else {
      pill.style.transform = "scale(1)";
      pill.style.margin = "0 6px";
    }
  });
}

function resetPills() {
  const pills = document.querySelectorAll(".pill");
  pills.forEach((pill) => {
    pill.style.transform = "scale(1)";
    pill.style.margin = "0 8px";
    pill.style.transition = "transform 0.2s ease, margin 0.2s ease";
  });
}

// ------------------------------
// Toggle list/grid
// ------------------------------
const toggleBtn = document.getElementById("toggleView");
if (toggleBtn) {
  toggleBtn.addEventListener("click", () => {
    const sheetTable = document.getElementById("sheetTable");
    const gridWrapper = document.getElementById("gridWrapper");
    const isGridHidden = gridWrapper?.classList.contains("hidden");

    if (isGridHidden) {
      // Show grid
      sheetTable?.classList.add("hidden");
      gridWrapper?.classList.remove("hidden");
      renderGridView(filteredRows);
      toggleBtn.textContent = "VIEW: ✜";
    } else {
      // Show table
      gridWrapper?.classList.add("hidden");
      setTimeout(() => {
        sheetTable?.classList.remove("hidden");
        sheetTable?.classList.add("animated");
        renderTable(filteredRows);
        setTimeout(() => sheetTable?.classList.remove("animated"), 300);
      }, 300);
      toggleBtn.textContent = "VIEW: ≡";
    }
  });
}

// ------------------------------
// Sticky header offset
// ------------------------------
function updateStickyHeaderOffset() {
  const categoryBar = document.getElementById("categoryFilters");
  const tableHeaders = document.querySelectorAll("#sheetTable thead th");

  if (categoryBar && tableHeaders.length > 0) {
    const offset = categoryBar.offsetHeight + "-1px";
    tableHeaders.forEach((th) => {
      th.style.top = offset;
    });
  }
}
window.addEventListener("load", updateStickyHeaderOffset);
window.addEventListener("resize", updateStickyHeaderOffset);

// ------------------------------
// GO!
// ------------------------------
loadCSV();