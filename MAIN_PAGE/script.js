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
  TITLE: 0, //HEADER
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

  const thead = document.querySelector("#TitleHeader thead");

  // ---- Build dataRows with stable ids
  dataRows = rows.slice(1).map((cells) => {
    const hover = (cells[COL.MP3_HOVER] || "").trim(); //CREATES A UNIQUE ID - HAS NOTHING TO DO WITH MP3
    const click = (cells[COL.MP3_CLICK] || "").trim(); //CREATES A UNIQUE ID - HAS NOTHING TO DO WITH MP3
    const id = [cells[COL.TITLE] || "", cells[COL.YEAR] || "", hover, click].join("||");
    return { id, cells };
  });

  // ---- Build table header (columns 0..4) ---> HEADER/TITLE
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
  const ths = document.querySelectorAll("#TitleHeader thead th");
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
  
  // Animate menu elements after table is loaded
  setTimeout(() => {
    animateMenuElements();
  }, 100);

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
// Animate menu elements when table is visible
// ------------------------------
function animateMenuElements() {
  // Animate TitleHeader from top
  const titleHeader = document.querySelector("#TitleHeader");
  if (titleHeader) {
    gsap.fromTo(titleHeader, 
      {
        y: -50,
        opacity: 0
      },
      {
        y: 0,
        opacity: 1,
        duration: 0.6,
        ease: "power2.out"
      }
    );
  }

  // Animate category pills from bottom with stagger
  const pills = document.querySelectorAll(".pill");
  if (pills.length > 0) {
    gsap.fromTo(pills,
      {
        y: 30,
        opacity: 0,
        scale: 0.9
      },
      {
        y: 0,
        opacity: 1,
        scale: 1,
        duration: 0.5,
        stagger: 0.05,
        ease: "power2.out",
        delay: 0.2 // Start after TitleHeader
      }
    );
  }
}

// ------------------------------
// Table rendering (list view)
// ------------------------------
function renderTable(rowObjs) {
  const tbody = document.querySelector("#sheetTable tbody");
  if (!tbody) return;

  // Get existing rows before clearing
  const existingRows = Array.from(tbody.querySelectorAll("tr"));

  // Animate existing rows sliding down and fading out
  existingRows.forEach((row, index) => {
    gsap.to(row, {
      y: 50,
      opacity: 0,
      scale: 0.95,
      duration: 0.3,
      delay: index * 0.01,
      ease: "power2.in"
    });
  });

  // Wait for rows to slide out, then render new content
  setTimeout(() => {
    // Clear tbody
    tbody.innerHTML = "";

    // Create new rows
    rowObjs.forEach(({ id, cells }, i) => {
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

      tbody.appendChild(tr);

      // Start row off-screen above
      gsap.set(tr, {
        y: -30,
        opacity: 0,
        scale: 0.95
      });

      // Animate row sliding in from top
      gsap.to(tr, {
        y: 0,
        opacity: 1,
        scale: 1,
        duration: 0.4,
        delay: i * 0.02,
        ease: "power2.out"
      });
    });
  }, 300); // Wait 300ms for rows to slide out
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

  // Get existing cards before clearing
  const existingCards = Array.from(grid.querySelectorAll(".grid-card"));

  // Animate existing cards sliding down and fading out
  existingCards.forEach((card, index) => {
    gsap.to(card, {
      y: 100,
      opacity: 0,
      scale: 0.9,
      duration: 0.4,
      delay: index * 0.02,
      ease: "power2.in"
    });
  });

  // Wait for cards to slide out, then render new content
  setTimeout(() => {
    // Clear grid
    grid.innerHTML = "";

    // Create new cards
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

      // Start card off-screen above
      gsap.set(card, {
        y: -100,
        opacity: 0,
        scale: 0.9
      });

      // Animate card sliding in from top
      gsap.to(card, {
        y: 0,
        opacity: 1,
        scale: 1,
        duration: 0.5,
        delay: i * 0.03,
        ease: "power2.out"
      });
    });

    // GSAP hover with space creation + fisheye effect ⚠️⚠️⚠️⚠️⚠️ WORKS NICELY --- ADJUST! 
    requestAnimationFrame(() => {
      document.querySelectorAll(".grid-card").forEach((card) => {
        card.addEventListener("mouseenter", () => {
          // Get all other cards
          const allCards = document.querySelectorAll(".grid-card");
          const otherCards = Array.from(allCards).filter(c => c !== card);
          
          // Animate the hovered card with fisheye effect
          gsap.to(card, {
            scale: 1.625,
            y: -2,
            duration: 0.5,
            ease: "power4.out",
            overwrite: "auto"
          });
          
          // Add fisheye distortion to hovered card
          gsap.to(card, {
            filter: "blur(0.5px) brightness(1.1) contrast(1)",
            duration: 0.3,
            ease: "power2.out"
          });
          
          card.style.zIndex = "10";
          
          // Animate other cards to shrink and move away
          otherCards.forEach((otherCard, index) => {
            // Calculate distance and direction from hovered card
            const cardRect = card.getBoundingClientRect();
            const otherRect = otherCard.getBoundingClientRect();
            
            // Get center points
            const cardCenterX = cardRect.left + cardRect.width / 2;
            const cardCenterY = cardRect.top + cardRect.height / 2;
            const otherCenterX = otherRect.left + otherRect.width / 2;
            const otherCenterY = otherRect.top + otherRect.height / 2;
            
            // Calculate direction vector
            const deltaX = otherCenterX - cardCenterX;
            const deltaY = otherCenterY - cardCenterY;
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            
            // Normalize and scale the movement
            const moveDistance = 75; // How far cards move away
            const moveX = (deltaX / distance) * moveDistance;
            const moveY = (deltaY / distance) * moveDistance;
            
            // Stagger the animation based on distance
            const staggerDelay = Math.min(distance / 200, 0.3);
            
            // Add fisheye distortion to other cards (more blur for distant ones)
            const blurAmount = Math.min(distance / 200, 0.125); // More blur for distant cards
            
            gsap.to(otherCard, {
              scale: 0.9,
              x: moveX,
              y: moveY,
              opacity: 1,
              filter: `blur(${blurAmount}px) brightness(1)`,
              duration: 1,
              delay: staggerDelay * 0.2,
              ease: "power2.out",
              overwrite: "auto"
            });
          });
        });

        card.addEventListener("mouseleave", () => {
          // Reset hovered card
          gsap.to(card, {
            scale: 1,
            y: 0,
            filter: "blur(0px) brightness(1) contrast(1)",
            duration: 0.5,
            ease: "circ.out",
            overwrite: "auto"
          });
          card.style.zIndex = "1";
          
          // Reset all other cards
          const allCards = document.querySelectorAll(".grid-card");
          allCards.forEach((otherCard) => {
            gsap.to(otherCard, {
              scale: 1,
              x: 0,
              y: 0,
              opacity: 1,
              filter: "blur(0px) brightness(1)",
              duration: 0.8,
              ease: "power2.out",
              overwrite: "auto"
            });
          });
        });
      });
    });
  }, 500); // Wait 500ms for cards to slide out
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
    pill.className = "pill";
    if (selectedCategories.includes(cat)) {
      pill.classList.add("selected");
    }

    pill.addEventListener("click", () => {
      const isCurrentlySelected = selectedCategories.includes(cat);
      
      if (isCurrentlySelected) {
        // Animate deselection: add a temporary class for animation
        pill.classList.add("deselecting");
        setTimeout(() => {
          selectedCategories = selectedCategories.filter((c) => c !== cat);
          renderCategoryPills();
          filterByCategories();
        }, 400);
      } else {
        // Animate selection: add a temporary class for animation
        pill.classList.add("selecting");
        setTimeout(() => {
          selectedCategories.push(cat);
          renderCategoryPills();
          filterByCategories();
        }, 200);
      }
    });

    if (selectedCategories.includes(cat)) {
      const x = document.createElement("span");
      x.textContent = "X";
      x.style.marginLeft = "8px";
      x.style.cursor = "pointer";
      x.addEventListener("click", (e) => {
        e.stopPropagation();
        
        // Add animation class
        pill.classList.add("deselecting");
        setTimeout(() => {
          selectedCategories = selectedCategories.filter((c) => c !== cat);
          renderCategoryPills();
          filterByCategories();
        }, 500);
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
    clearBtn.addEventListener("click", () => {
      // Add animation class to all selected pills
      const selectedPills = document.querySelectorAll(".pill.selected");
      selectedPills.forEach((pill, index) => {
        setTimeout(() => {
          pill.classList.add("deselecting");
        }, index * 50);
      });
      
      setTimeout(() => {
        selectedCategories = [];
        renderCategoryPills();
        filterByCategories();
      }, 400 + (selectedPills.length * 50));
    });
    container.appendChild(clearBtn);
  }
}
  // !! HEADER
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
      pill.classList.add("highlighted");  // ← Add CSS class instead
    } else {
      pill.classList.remove("highlighted");
    }
  });
}

function resetPills() {
  const pills = document.querySelectorAll(".pill");
  pills.forEach((pill) => {
    pill.classList.remove("highlighted");  // ← Remove CSS class
  });
}

// ------------------------------
// Toggle list/grid + ANIMATION
// ------------------------------
const toggleBtn = document.getElementById("toggleView");
if (toggleBtn) {
  toggleBtn.addEventListener("click", () => {
    const sheetTable = document.getElementById("sheetTable");
    const gridWrapper = document.getElementById("gridWrapper");
    const isGridHidden = gridWrapper.classList.contains("hidden");

    // Prevent multiple clicks during animation
    if (toggleBtn.dataset.animating === "true") return;
    toggleBtn.dataset.animating = "true";

    if (isGridHidden) {
      // Switch to GRID view
      animateToGridView(sheetTable, gridWrapper, toggleBtn);
    } else {
      // Switch to TABLE view  
      animateToTableView(sheetTable, gridWrapper, toggleBtn);
    }
  });
}

// Animate to Grid View
function animateToGridView(sheetTable, gridWrapper, toggleBtn) {
  // 1. Animate toggle button
  gsap.to(toggleBtn, {
    scale: 0.8,
    duration: 0.2,
    ease: "power2.in",
    onComplete: () => {
      toggleBtn.textContent = "VIEW: ✜";
      gsap.to(toggleBtn, {
        scale: 1.1,
        duration: 0.3,
        ease: "back.out(1.7)"
      });
    }
  });

  // 2. Fade out table with scale
  gsap.to(sheetTable, {
    opacity: 0,
    scale: 0.95,
    y: -1000,
    duration: 0.7,
    ease: "power2.inOut",
    onComplete: () => {
      gsap.set(sheetTable, { display: "none" });
    }
  });

  // 3. Show grid wrapper and render content
  gsap.set(gridWrapper, { display: "block", opacity: 0, scale: 0.9 });
  renderGridView(filteredRows);
  
  // 4. Fade in grid wrapper
  gsap.to(gridWrapper, {
    opacity: 1,
    scale: 1,
    duration: 1.5,
    ease: "power2.out",
    delay: 0.5,
    onComplete: () => {
      gridWrapper.classList.remove("hidden");
      toggleBtn.dataset.animating = "false";
    }
  });

  // 5. Stagger animate grid cards in batches
  requestAnimationFrame(() => {
    const allGridCards = document.querySelectorAll(".grid-card");
    const gridBatchSize = 15;

    for (let i = 0; i < allGridCards.length; i += gridBatchSize) {
      const batch = Array.from(allGridCards).slice(i, i + gridBatchSize);
      gsap.fromTo(batch, 
        {
          opacity: 0,
          scale: 0.8,
          y: 30,
          rotation: 0
        },
        {
          opacity: 1,
          scale: 1,
          y: 0,
          rotation: 0,
          duration: 0.6,
          stagger: 0.05,  // Keep the nice stagger speed
          ease: "back.out(1.7)",
          delay: 0.12 + (i / gridBatchSize) * 0.1 // Each batch starts after the previous
        }
      );
    }
  });
}

// Animate to Table View
function animateToTableView(sheetTable, gridWrapper, toggleBtn) {
  // 1. Animate toggle button
  gsap.to(toggleBtn, {
    scale: 0.8,
    duration: 0.2,
    ease: "power2.in",
    onComplete: () => {
      toggleBtn.textContent = "VIEW: ≡";
      gsap.to(toggleBtn, {
        scale: 1.1,
        duration: 0.3,
        ease: "back.out(1.7)"
      });
    }
  });

  // 2. Fade out grid with scale
  gsap.to(gridWrapper, {
    opacity: 0,
    scale: 0.95,
    y: 20,
    duration: 0.4,
    ease: "power2.inOut",
    onComplete: () => {
      gsap.set(gridWrapper, { display: "none" });
      gridWrapper.classList.add("hidden");
    }
  });

  // 3. Show table and render content
  gsap.set(sheetTable, { display: "table", opacity: 0, scale: 0.9, y: -0 });
  renderTable(filteredRows);

  // 4. Fade in table
  gsap.to(sheetTable, {
    opacity: 1,
    scale: 1,
    y: 0,
    duration: 0.7,
    ease: "power2.out",
    onComplete: () => {
      toggleBtn.dataset.animating = "false";
      
      // Animate menu elements after table is visible
      setTimeout(() => {
        animateMenuElements();
      }, 100);
    }
  });
}

// ------------------------------
// GO!
// ------------------------------
loadCSV();