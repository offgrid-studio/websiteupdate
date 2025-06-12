const audioPlayers = {}; // { uniqueKey: { hover: Tone.Player, click: Tone.Player } }
let selectedCategories = [];
let currentPlayer = null;

// Start Tone.js after first user gesture
document.addEventListener("click", async () => {
  if (Tone.context.state !== "running") {
    await Tone.start();
    console.log("🔊 Tone.js context started");
  }
}, { once: true }); // only run once

let currentSort = { column: null, direction: 'asc' };
let dataRows = [];
let filteredRows = []; // stores the currently filtered data

/*GIF formats Column filename to full URL ---> where does it define the column?*/
function formatGifURL(pathFromSheet) {
  if (!pathFromSheet || typeof pathFromSheet !== "string") return null;
  const relativePath = pathFromSheet.replace(/^\/?public_html/, '');
  return "https://offgrid.studio" + relativePath;
}
/*GIF*/

/*AUDIO
 formats Column filename to full URL ---> where does it define the column?*/
function formatAudioURL(filename) {
  if (!filename || typeof filename !== "string") return null;
  return "https://files.offgrid.studio/" + filename.trim();
}
/*AUDIO formats Column filename to full URL ---> where does it define the column?*


/* ✅ TAG PARSER: cleanly extract tags, removing empty/invalid ones */
function parseTags(tagString) {
  return (tagString || "")
    .split(";")
    .map(t => t.trim())
    .filter(t => !!t && t.toLowerCase() !== "location");
}

/*GOOGLE SHEET LOADED*/
async function loadCSV() {
  const response = await fetch("https://docs.google.com/spreadsheets/d/164ps6mI666JLt-q4iVb0FMA5ztPykwRT4mOVAE_zbwE/export?format=csv&gid=11925201");
  const csvText = await response.text();
  const rows = csvText.trim().split("\n").map(row => row.split(","));

  const thead = document.querySelector("#sheetTable thead");
  const tbody = document.querySelector("#sheetTable tbody");

  const headers = rows[0];
  dataRows = rows.slice(1); // ✅ keep it as arrays

  // === 🧠 Create table headers (skip columns F and beyond) ===
  thead.innerHTML = ""; // clear old
  const trHead = document.createElement("tr");
  headers.forEach((header, index) => {
    if (index > 4) return; // skip columns F onward
    const th = document.createElement("th");
    th.dataset.index = index;
    th.innerText = header;

    if (index !== 4) {
      th.addEventListener("click", () => sortByColumn(index));
    }

    trHead.appendChild(th);
  });
  thead.appendChild(trHead);

  // === 🔊 Preload audio ===
  await preloadAudioPlayers(dataRows);

  // === 🗂 Sort by year (Column D = index 3), newest to oldest ===
  dataRows.sort((a, b) => parseInt(b[3], 10) - parseInt(a[3], 10));
  filteredRows = dataRows.map((row, i) => ({ row, index: i })); // copy sorted data

  // Set visual indicator on sorted column
  const ths = document.querySelectorAll("thead th");
  currentSort = { column: 3, direction: 'desc' };
  ths.forEach(th => {
    th.classList.remove("sorted", "sorted-desc");
    if (parseInt(th.dataset.index) === 3) {
      th.classList.add("sorted", "sorted-desc");
    }
  });

  // === 🧪 Render categories AFTER dataRows is set ===
  renderCategoryPills();

  // === 📋 Render initial table view ===
  renderTable(filteredRows);

  // === 🧼 Hide grid view initially ===
  const gridWrapper = document.getElementById("gridWrapper");
  const gridView = document.getElementById("gridView");
  gridWrapper.classList.add("hidden");
  gridView.innerHTML = "";

  // === 🔧 Update sticky header offset ===
  updateStickyHeaderOffset();
}
/*GOOGLE SHEET LOADED*/

/*Audio: preload Audio Player*/
async function preloadAudioPlayers(rows) {
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    const hoverUrl = formatAudioURL(row[15]);
    const clickUrl = formatAudioURL(row[17]);
    const key = `row${index}`;

    const hoverPlayer = hoverUrl ? new Tone.Player({ url: hoverUrl, autostart: false }).toDestination() : null;
    const clickPlayer = clickUrl ? new Tone.Player({ url: clickUrl, autostart: false }).toDestination() : null;

    audioPlayers[key] = { hover: hoverPlayer, click: clickPlayer };

    await new Promise(r => setTimeout(r, 10));
  }

  console.log("✅ All audio preloaded");
}
/*Audio: preload Audio Player*/


// CATEG
document.getElementById("categoryFilters").classList.add("sticky-category-bar");
renderCategoryPills(); // ✅ moved down to after dataRows
// CATEG
  
/*THIS IS HOW THE TABLE(LIST) IS SORTED WHEN LOADED*/
 // Sort dataRows by year (Column D = index 3), newest to oldest
dataRows.sort((a, b) => parseInt(b[3], 10) - parseInt(a[3], 10));
filteredRows = [...dataRows]; // copy sorted

// Set initial sort indicator for Column D
currentSort = { column: 3, direction: 'desc' };
const ths = document.querySelectorAll("thead th");
ths.forEach(th => {
  th.classList.remove("sorted", "sorted-desc");
  if (parseInt(th.dataset.index) === 3) {
    th.classList.add("sorted", "sorted-desc");
  }
});
/*THIS IS HOW THE TABLE(LIST) IS SORTED WHEN LOADED*/
  
  
 /*!!HOW WILL TABLE(LIST) BE RENDERED!!*/ 
  // Sticky header offset
  updateStickyHeaderOffset();

  // ✅ Render only the table initially with filtered data
  renderTable(filteredRows);

  // ✅ Ensure grid is hidden and cleared
  const gridWrapper = document.getElementById("gridWrapper");
  const gridView = document.getElementById("gridView");
  gridWrapper.classList.add("hidden");
  gridView.innerHTML = "";
 /*HOW WILL TABLE(LIST) BE RENDERED*/ 

/*!!TABLE(LIST) IS BEING "RENDERED"!!*/
function renderTable(rowsWithIndex) {
  const tbody = document.querySelector("#sheetTable tbody");
  tbody.innerHTML = "";

  rowsWithIndex.forEach(({ row: cells, index: i }) => {
    const tr = document.createElement("tr");
    const rawGifPath = cells[6];
    const formattedUrl = formatGifURL(rawGifPath) || "https://via.placeholder.com/150";
    tr.dataset.previewImage = formattedUrl;

    /*Audio: P R in TABLE*/
    const tags = parseTags(cells[8]);

    const rowKey = `row${i}`;
    const hoverUrl = formatAudioURL(cells[15]); // Column P
    const clickUrl = formatAudioURL(cells[17]); // Column R

    // ✅ Ensure audioPlayers exists and preload hover/click
    if (!audioPlayers[rowKey]) audioPlayers[rowKey] = {};

    if (hoverUrl && !audioPlayers[rowKey].hover) {
      audioPlayers[rowKey].hover = new Tone.Player(hoverUrl).toDestination();
      audioPlayers[rowKey].hover.autostart = false;
    }

    if (clickUrl && !audioPlayers[rowKey].click) {
      audioPlayers[rowKey].click = new Tone.Player(clickUrl).toDestination();
      audioPlayers[rowKey].click.autostart = false;
    }

    attachHoverAndClickAudio(tr, rowKey, tags); // ✅ for table
    /*Audio: P R in TABLE*/

    const url = cells[5];
    if (url) {
      tr.style.cursor = "pointer";
      tr.addEventListener("click", (e) => {
        // Only trigger row link if not clicking a location pill
        if (e.target.closest(".location")) return;
        window.open(url, "_blank", "noopener,noreferrer");
      });
    }

    /*!!PILLZOOMSTUFF!!*/
    tr.dataset.tags = JSON.stringify(tags);
    tr.addEventListener("mouseenter", () => highlightPills(tags));
    tr.addEventListener("mouseleave", resetPills);
    /*!!TABLE(LIST) IS "RENDERED!!*/

/*MOUSEOVER STUFF*/

/*MOUSEOVER IMAGE PREVIEW*/
tr.addEventListener("mouseenter", () => {
  const preview = document.getElementById("imagePreview");
  const content = document.getElementById("previewContent");

  content.innerHTML = `<img src="${tr.dataset.previewImage}" style="max-width:150px; border-radius:12px; border:none;">`;

  // Reset the animation even if it was already active
  preview.classList.remove("active");
  void preview.offsetWidth; // Force reflow to reset animation
  preview.classList.add("active");

  clearTimeout(preview.hideTimer);
});

tr.addEventListener("mousemove", (e) => {
  const preview = document.getElementById("imagePreview");
  preview.style.left = `${e.pageX + 20}px`;
  preview.style.top = `${e.pageY - 20}px`;
});

tr.addEventListener("mouseleave", (e) => {
  const preview = document.getElementById("imagePreview");
  const content = document.getElementById("previewContent");

  // Remove the preview immediately or after a short delay
  preview.hideTimer = setTimeout(() => {
    preview.classList.remove("active");
    setTimeout(() => {
      content.innerHTML = "";
    }, 500); // match CSS transition time
  }, 50); // small delay to prevent flicker
});
/*MOUSEOVER IMAGE PREVIEW*/

/*GOOGLESHEET: if location - make pill*/
    cells.forEach((cell, index) => {
      if (index > 4) return; // hide columns F, G, H+

      const td = document.createElement("td");

      if (index === 1 && cell.includes("@")) {
        const locationUrl = cells[7];
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
          link.addEventListener("click", (e) => {
    e.stopPropagation(); // stops row click
  });

  td.appendChild(link);
  /*GOOGLESHEET: if location - make pill*/
 
/*GIF PREVIEW ON HOVER*/
          link.addEventListener("mousemove", (e) => {//GIF PREVIEW FOLLOWS MOUSE MOVEMENT
            const preview = document.getElementById("imagePreview");
            preview.style.left = `${e.pageX + 20}px`;
            preview.style.top = `${e.pageY - 20}px`;
          });

          link.addEventListener("mouseleave", (e) => { //GIF PREVIEW STOPS
            const preview = document.getElementById("imagePreview");
            const content = document.getElementById("previewContent");
            const tr = e.currentTarget.closest("tr");
            const rowImageUrl = tr.dataset.previewImage;
            content.innerHTML = `<img src="${tr.dataset.previewImage}" style="max-width:150px; border-radius:12px; border:none;">`;
          });

        } else {
          td.appendChild(pill);
        }

      } else if (cell.toLowerCase().includes("places")) {
        const pill = document.createElement("span");
        pill.className = "pill";
        pill.textContent = cell;
        td.appendChild(pill);
      } else {
        td.textContent = cell;
      }

      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });
}
/*GIF PREVIEW ON HOVER*/


/*Audio Envelope*/
async function playShapedAudio(player, tags = []) {
  console.log("🎯 Tags received:", tags);
  if (!player || !player.buffer.loaded) {
    console.warn("⚠️ No player or not loaded");
    return;
  }

  if (currentPlayer) {
    currentPlayer.stop();
    currentPlayer.disconnect();
  }

  const now = Tone.now();
  const attack = Math.random() * 0.3 + 0.1;
  const decay = Math.random() * 0.2 + 0.05;
  const sustain = Math.random() * 0.1 + 0.01;
  const release = Math.random() * 0.3 + 0.005;
  const cutoff = Math.random() * 12000 + 50;

  console.log(`🎛️ Attack: ${attack.toFixed(2)}s | Decay: ${decay.toFixed(2)}s | Sustain: ${sustain.toFixed(2)} | Release: ${release.toFixed(2)}s`);
  console.log(`🎚️ Filter cutoff: ${Math.round(cutoff)} Hz`);

  const filter = new Tone.Filter({ type: "lowpass", frequency: cutoff });
  const gainNode = new Tone.Gain(0);

  const effectsChain = [];

  // 🎯 Tag matching helper
  const tagMatch = (needles) => {
    return Array.isArray(tags) && tags.some(tag =>
      needles.some(needle =>
        tag.trim().toLowerCase() === needle.trim().toLowerCase()
      )
    );
  };

  // === 🎛 FX MATCHES ===
  if (tagMatch(["Octaphonic", "Quadrophonic"])) {
    console.log("🌐 Auto-panner activated");
    const startFreq = Math.random() * 25 + 25;
    const endFreq = 0.1;
    const rampTime = 2;

    const panner = new Tone.AutoPanner({
      frequency: startFreq,
      depth: 1,
      type: "sine"
    }).start();

    panner.frequency.setValueAtTime(startFreq, now);
    panner.frequency.exponentialRampToValueAtTime(endFreq, now + rampTime);
    effectsChain.push(panner);
  }

  if (tagMatch(["Social Media", "Ad Campaign"])) {
    console.log("🎧 Chorus + animated delay");

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

  // === Fallback if nothing matched ===
  if (effectsChain.length === 0) {
    console.log("🎲 No matching FX — using fallback");
    const useReverb = Math.random() < 0.5;

    if (useReverb) {
      console.log("🧼 Using reverb");
      const reverb = new Tone.Reverb({ decay: 1.5, preDelay: 0.01 });
      reverb.wet.value = 0.3;
      await reverb.generate();
      effectsChain.push(reverb);
    } else {
      console.log("🔁 Using delay");
      const delay = new Tone.FeedbackDelay("16n", 0.3);
      delay.wet.value = 0.1;
      effectsChain.push(delay);
    }
  }

  // 🔗 Chain all FX together
  for (let i = 0; i < effectsChain.length - 1; i++) {
    effectsChain[i].connect(effectsChain[i + 1]);
  }
  const fx = effectsChain[effectsChain.length - 1];

  gainNode.connect(fx);
  fx.toDestination();

  player.disconnect();
  player.connect(filter);
  filter.connect(gainNode);

  // Envelope
  gainNode.gain.setValueAtTime(0, now);
  gainNode.gain.linearRampToValueAtTime(1, now + attack);
  gainNode.gain.linearRampToValueAtTime(sustain, now + attack + decay);
  gainNode.gain.linearRampToValueAtTime(0, now + player.buffer.duration - release);

  player.start(now);
  currentPlayer = player;
}
/*Audio Envelope*/

/*Audio MouseOver + Click*/
function attachHoverAndClickAudio(el, rowKey, tags) {
  el.addEventListener("mouseenter", () => {
    const player = audioPlayers[rowKey]?.hover;
    if (player) playShapedAudio(player, tags);
  });

  el.addEventListener("click", () => {
    const player = audioPlayers[rowKey]?.click;
    if (player) playShapedAudio(player, tags);
  });
}
/*Audio MouseOver + Click*/

/*!!RENDER GRID!!*/
    function renderGridView(rows) {
  const grid = document.getElementById("gridView");
  grid.innerHTML = "";

  rows.forEach((cells, i) => {
    const gifUrl = formatGifURL(cells[6]);
    const projectTitle = cells[0];
    const year = cells[3];
    const link = cells[5];

    const tags = parseTags(cells[8]);

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

    // ✅ Pass tags to audio
    const hoverUrl = formatAudioURL(cells[15]); // Column P
    const clickUrl = formatAudioURL(cells[17]); // Column R
    attachHoverAndClickAudio(card, `row${i}`, tags);

    grid.appendChild(card);
  });
}
/*!!RENDER GRID!!*/

/*!!HIGHLIGHTPILLSTUFF!!*/
function highlightPills(tags) {
  const pills = document.querySelectorAll(".pill");
  document.querySelectorAll(".pill[data-category]");
  pills.forEach(pill => {
    const category = pill.getAttribute("data-category");
    if (tags.includes(category)) {
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
  pills.forEach(pill => {
    pill.style.transform = "scale(1)";
    pill.style.margin = "0 8px";
    pill.style.transition = "transform 0.2s ease, margin 0.2s ease"; // 🆕 Add this line
  });
}

loadCSV();
/*!!HIGHLIGHTPILLSTUFF!!*/
/*!!RENDER GRID!!*/

/*SORT ITEMS IN DIFF WAYS: Can I move this after the table/grid render?*/
function sortByColumn(index) {
  const ths = document.querySelectorAll("thead th");

  // Remove existing sort classes
  ths.forEach(th => th.classList.remove("sorted", "sorted-desc"));

  // Set sort direction
  if (currentSort.column === index) {
    currentSort.direction = currentSort.direction === "asc" ? "desc" : "asc";
  } else {
    currentSort.column = index;
    currentSort.direction = "asc";
  }

  const dir = currentSort.direction === "asc" ? 1 : -1;

  const sorted = [...dataRows].sort((a, b) => {
    const valA = a[index];
    const valB = b[index];

    const numA = parseFloat(valA);
    const numB = parseFloat(valB);
    const isNum = !isNaN(numA) && !isNaN(numB);

    if (isNum) return (numA - numB) * dir;
    return valA.localeCompare(valB) * dir;
  });

  // Add appropriate sort class
  const activeTh = Array.from(ths).find(th => parseInt(th.dataset.index) === index);
  if (activeTh) {
    activeTh.classList.add("sorted");
    if (currentSort.direction === "desc") {
      activeTh.classList.add("sorted-desc");
    }
  }

  renderTable(sorted.map((row, i) => ({ row, index: i })));
}
/*FUNCTION:------>CLICK ON Column to Sort*/


//categories(?)
/*SORT ITEMS IN DIFF WAYS: Can I move this after the table/grid render?*/

/*TOGGLE BETWEEN TABLE(LIST)/GRID: Can I move this under SORT ITEMS(...) when that has moved up?*/
const toggleBtn = document.getElementById("toggleView");

toggleBtn.addEventListener("click", () => {
  const sheetTable = document.getElementById("sheetTable");
  const gridWrapper = document.getElementById("gridWrapper");

  const isGridHidden = gridWrapper.classList.contains("hidden"); // ✅ Define this early

  if (isGridHidden) {
    // Show grid view
    sheetTable.classList.add("hidden");
    gridWrapper.classList.remove("hidden");
    renderGridView(filteredRows);
    toggleBtn.textContent = "VIEW: ✜";
  } else {
    // Show table view
    gridWrapper.classList.add("hidden");

    setTimeout(() => {
      sheetTable.classList.remove("hidden");
      sheetTable.classList.add("animated");
      renderTable(filteredRows);

      setTimeout(() => {
        sheetTable.classList.remove("animated");
      }, 300);
    }, 300);

    toggleBtn.textContent = "VIEW: ≡";
  }
});
/*TOGGLE BETWEEN TABLE(LIST)/GRID: Can I move this under SORT ITEMS(...) when that has moved up?*/


/*CATEGORIES: Category function that uses COLUMN I to add categories to rows(items)*/
function renderCategoryPills() {
  const container = document.getElementById("categoryFilters");
  if (!container) return;
  container.innerHTML = "";

  const allCategories = new Set();

  // Gather all unique categories from column I (index 8)
  dataRows.forEach(row => {
  parseTags(row[8]).forEach(cat => allCategories.add(cat));
});

  // Create pill elements
  [...allCategories].sort().forEach(cat => {
    const pill = document.createElement("span");
pill.className = "pill";
pill.textContent = cat;
pill.setAttribute("data-category", cat); // ✅ Allows pill to be matched on hover
    pill.style.margin = "4px";
    pill.style.padding = "6px 10px";
pill.style.minWidth = "80px"; // Add this to prevent size shifting
pill.style.display = "inline-flex";
pill.style.alignItems = "center";
pill.style.justifyContent = "space-between";
    pill.style.padding = "6px 10px";
    pill.style.borderRadius = "999px";
    pill.style.border = "1px solid #ccc";
    pill.style.cursor = "pointer";
    pill.style.backgroundColor = selectedCategories.includes(cat) ? "#fff" : "#000";
    pill.style.color = selectedCategories.includes(cat) ? "#000" : "#fff";

    pill.addEventListener("click", () => {
      if (selectedCategories.includes(cat)) {
        selectedCategories = selectedCategories.filter(c => c !== cat);
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
        selectedCategories = selectedCategories.filter(c => c !== cat);
        renderCategoryPills();
        filterByCategories();
      });
      pill.appendChild(x);
    }

    container.appendChild(pill);
  });

  // Add "Clear All" button
  if (selectedCategories.length > 0) {
    const clearBtn = document.createElement("button");
clearBtn.className = "clear-all-btn";
    clearBtn.textContent = "×";
    clearBtn.style.marginLeft = "12px";
    clearBtn.style.padding = "6px 12px";
    clearBtn.style.borderRadius = "999px";
    clearBtn.style.border = "1px solid #ccc";
    clearBtn.style.background = "#444";
    clearBtn.style.color = "white";
    clearBtn.style.cursor = "pointer";

    clearBtn.addEventListener("click", () => {
    selectedCategories = [];
    renderCategoryPills();
    filterByCategories(); // ✅ Use this instead of renderTable(dataRows)
  });

    container.appendChild(clearBtn);
  }
}
//filtersystem
function filterByCategories() {
  filteredRows = selectedCategories.length === 0
  ? dataRows.map((row, i) => ({ row, index: i }))
  : dataRows
      .map((row, i) => ({ row, index: i }))
      .filter(({ row }) => {
        const tags = parseTags(row[8]);
        return selectedCategories.some(cat => tags.includes(cat));
      });

  const sheetTable = document.getElementById("sheetTable");
  const gridWrapper = document.getElementById("gridWrapper");

  if (gridWrapper.classList.contains("hidden")) {
    sheetTable.classList.remove("hidden");
    gridWrapper.classList.add("hidden");
    renderTable(filteredRows);
  } else {
    gridWrapper.classList.remove("hidden");
    sheetTable.classList.add("hidden");
    renderGridView(filteredRows);
  }
}
//filtersystem
/*CATEGORIES: Category function that uses COLUMN I to add categories to rows(items)*/

/*STICKYHEADER: Adjust(?), move to sit right*/
function updateStickyHeaderOffset() {
  const categoryBar = document.getElementById("categoryFilters");
  const tableHeaders = document.querySelectorAll("#sheetTable thead th");

  if (categoryBar && tableHeaders.length > 0) {
    const offset = categoryBar.offsetHeight + "-1px";
    tableHeaders.forEach(th => {
      th.style.top = offset;
    });
  }
}
window.addEventListener("load", updateStickyHeaderOffset);
window.addEventListener("resize", updateStickyHeaderOffset);
/*STICKYHEADER: Adjust(?), move to sit right*/
