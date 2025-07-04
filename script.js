let currentSort = { column: null, direction: 'asc' };
let dataRows = [];
let filteredRows = []; // stores the currently filtered data

/*GIF*/
function formatGifURL(pathFromSheet) {
  if (!pathFromSheet || typeof pathFromSheet !== "string") return null;
  const relativePath = pathFromSheet.replace(/^\/?public_html/, '');
  return "https://offgrid.studio" + relativePath;
}
/*GIF*/

/*LOAD GOOGLE SHEET */
async function loadCSV() {
  const response = await fetch("https://docs.google.com/spreadsheets/d/164ps6mI666JLt-q4iVb0FMA5ztPykwRT4mOVAE_zbwE/export?format=csv&gid=11925201");
  const csvText = await response.text();
  const rows = csvText.trim().split("\n").map(row => row.split(","));

  const thead = document.querySelector("#sheetTable thead");
  const tbody = document.querySelector("#sheetTable tbody");

  const headers = rows[0];
  dataRows = rows.slice(1);
  filteredRows = [...dataRows]; // ✅ correct placement
/*GOOGLE SHEET LOADED*/



/*CREATE CAT-BAR*/
document.getElementById("categoryFilters").classList.add("sticky-category-bar");
renderCategoryPills(); // ✅ moved down to after dataRows
/*CAT-BAR CREATED*/

/*DONT DISPLAY F ONWARDS OF GOOGLESHEET*/
thead.innerHTML = ""; // ✅ clear any old headers
const trHead = document.createElement("tr");
headers.forEach((header, index) => {
    if (index > 4) return; // skip columns F and beyond
    const th = document.createElement("th");
    th.dataset.index = index;
    th.innerText = header;

    if (index !== 4) {
      th.addEventListener("click", () => sortByColumn(index));
    }

    trHead.appendChild(th);
  });
  thead.appendChild(trHead);
/*DONT DISPLAY F ONWARDS OF GOOGLESHEET*/
  
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
}
 /*HOW WILL TABLE(LIST) BE RENDERED*/ 

/*!!TABLE(LIST) IS BEING "RENDERED"!!*/
function renderTable(rows) {
  const tbody = document.querySelector("#sheetTable tbody");
  tbody.innerHTML = "";

  rows.forEach(cells => {
    const tr = document.createElement("tr");
    const rawGifPath = cells[6];
const formattedUrl = formatGifURL(rawGifPath) || "https://via.placeholder.com/150";
tr.dataset.previewImage = formattedUrl;

    const url = cells[5];
    if (url) {
      tr.style.cursor = "pointer";
      tr.addEventListener("click", (e) => {
  // Only trigger row link if not clicking a location pill
  if (e.target.closest(".location")) return;
  window.open(url, "_blank", "noopener,noreferrer");
});
    }
/*!!TABLE(LIST) IS "RENDERED!!*/

//!!!👇 THIS IS WHERE WE BUILD THE MOUSE INTERACTION 
/*MOUSEOVER: IMAGE PREVIEW + RESIZE*/
tr.addEventListener("mouseenter", () => {
  const preview = document.getElementById("imagePreview");
  const content = document.getElementById("previewContent");
  content.innerHTML = `<img src="${tr.dataset.previewImage}" style="max-width:150px; border-radius:12px; border:none;">`;
  preview.style.display = "block";
  requestAnimationFrame(() => {
    preview.style.opacity = "1";
  });

  // Cancel any hide timers
  clearTimeout(preview.hideTimer);

  // ✅ NEW: Resize hovered row
  tr.style.fontSize = "1.2em";
  tr.style.padding = "1em";
  tr.style.transition = "all 0.2s ease";

  // ✅ NEW: Shrink all other rows
  document.querySelectorAll("#sheetTable tbody tr").forEach((row) => {
    if (row !== tr) {
      row.style.fontSize = "0.9em";
      row.style.padding = "0.3em";
      row.style.transition = "all 0.2s ease";
    }
  });
});

tr.addEventListener("mousemove", (e) => {
  const preview = document.getElementById("imagePreview");
  preview.style.left = `${e.pageX + 20}px`;
  preview.style.top = `${e.pageY - 20}px`;
});

tr.addEventListener("mouseleave", () => {
  const preview = document.getElementById("imagePreview");
  const content = document.getElementById("previewContent");

  // Delay hiding to allow time to hover over the preview box or nearby row
  preview.hideTimer = setTimeout(() => {
    preview.style.opacity = "0";
    setTimeout(() => {
      if (!preview.matches(":hover")) {
        preview.style.display = "none";
        content.innerHTML = "";
      }
    }, 200);
  }, 300); // Adjust delay as needed

  // ✅ NEW: Reset all rows' styles
  document.querySelectorAll("#sheetTable tbody tr").forEach((row) => {
    row.style.fontSize = "";
    row.style.padding = "";
    row.style.transition = "";
  });
});
/*MOUSEOVER: IMAGE PREVIEW + RESIZE*/

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

 /*GOOGLESHEET: On Hover -> show lat/long of location*/
          link.addEventListener("mouseenter", (e) => {
  const preview = document.getElementById("imagePreview");
  const content = document.getElementById("previewContent");

  let previewText = "No preview text";
  const raw = cells[13]?.replace(/["']/g, "").trim(); // Column I, cleaned

  if (raw && raw.includes(",")) {
    const parts = raw.split(",");
    if (parts.length === 2) {
      const lat = parseFloat(parts[0].trim());
      const lng = parseFloat(parts[1].trim());

      if (!isNaN(lat) && !isNaN(lng)) {
        const dmsLat = toDMS(lat, true);
        const dmsLng = toDMS(lng, false);
        previewText = `${dmsLat}, ${dmsLng}`;
      } else {
        previewText = raw.trim(); // fallback to plain
      }
    } else {
      previewText = raw.trim(); // fallback to plain
    }
  } else if (raw) {
    previewText = raw.trim(); // fallback
  }

  content.textContent = previewText;
  preview.style.display = "block";
  requestAnimationFrame(() => {
    preview.style.opacity = "1";
  });

  e.stopPropagation();
});
/*GOOGLESHEET: On Hover -> show lat/long of location*/
 
/*not entirely sure -> is this still part of the image preview of row??*/
          link.addEventListener("mousemove", (e) => {
            const preview = document.getElementById("imagePreview");
            preview.style.left = `${e.pageX + 20}px`;
            preview.style.top = `${e.pageY - 20}px`;
          });

          link.addEventListener("mouseleave", (e) => {
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
/*not entirely sure -> is this still part of the image preview of row??*/

/*!!RENDER GRID -> can i move this up to where it renders the table? makes sense to categorically*/
    function renderGridView(rows) {
  const grid = document.getElementById("gridView");
  grid.innerHTML = "";

  rows.forEach((cells, i) => {
    const gifUrl = formatGifURL(cells[6]);
    const projectTitle = cells[0];
    const year = cells[3];
    const link = cells[5];

    const card = document.createElement("div");
    card.className = "grid-card animated"; // Add animated class
    card.style.animationDelay = `${i * 40}ms`; // Stagger animation

    card.innerHTML = `
      <img src="${gifUrl}" alt="${projectTitle}">
      <div class="meta">${projectTitle}<br>${year}</div>
    `;

    if (link) {
      card.addEventListener("click", () => {
        window.open(link, "_blank", "noopener,noreferrer");
      });
    }

    grid.appendChild(card);
  });
}
/*!!RENDER GRID -> can i move this up to where it renders the table? makes sense to categorically*/

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

  renderTable(sorted);
}
/*FUNCTION:------>CLICK ON Column to Sort*/
let selectedCategories = [];

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
    if (row[8]) {
      row[8].split(";").forEach(cat => {
        const trimmed = cat.trim();
        if (trimmed) allCategories.add(trimmed);
      });
    }
  });

  // Create pill elements
  [...allCategories].sort().forEach(cat => {
    const pill = document.createElement("span");
    pill.className = "pill";
    pill.textContent = cat;
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
    ? dataRows
    : dataRows.filter(row => {
        const tags = (row[8] || "").split(";").map(t => t.trim());
        return selectedCategories.some(cat => tags.includes(cat));
      });

  const sheetTable = document.getElementById("sheetTable");
  const gridWrapper = document.getElementById("gridWrapper"); // ✅ FIXED

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
/*CATEGORIES: Category funasdasd1
ction that uses COLUMN I to add categories to rows(items)*/

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

loadCSV();
/*STICKYHEADER: Adjust(?), move to sit right*/