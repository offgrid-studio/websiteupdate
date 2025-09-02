// ----- Config -----
const MESSAGE = `offgrid.studio is a netizen-collective of laptop musicians breathing life into the time-based arts...
We do sound installations, create complex systems for exhibition spaces and help evoke emotions on screen.

We collaborate with curators, museums, studios and filmmakers to build time-based systems that feel alive.`;

const TYPE_SPEED = 28;
const PAUSE_COMMA = 150;
const PAUSE_PERIOD = 240;
const AUTO_DELAY = 100; //change to longer later

// ----- Elements -----
const bubble = document.querySelector(".chat-bubble");
const content = document.getElementById("chat-scroll");
const textEl = document.getElementById("chat-text");
const cursor = document.querySelector(".cursor");
const shine = document.querySelector(".shine");
const replayBtn = document.getElementById("replay");
const jumpBtn = document.getElementById("jumpLatest");

// ----- State -----
let autoTimer = null;
let sessionId = 0;
let autoscroll = true;
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let dragStartLeft = 0;
let dragStartTop = 0;
let hasTypedBefore = false; // Track if text has been typed before

const prefersReduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// reliable bottom snap (no smooth)
const snapToBottom = () => { content.scrollTop = content.scrollHeight; };

function nearBottom(el, threshold = 6){
  return el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
}

// Drag functionality
function startDrag(e) {
  // Allow dragging from anywhere in the chat bubble, including text
  // No restrictions - drag from anywhere!
  
  isDragging = true;
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  
  const rect = bubble.getBoundingClientRect();
  dragStartLeft = rect.left;
  dragStartTop = rect.top;
  
  document.addEventListener('mousemove', onDrag);
  document.addEventListener('mouseup', stopDrag);
  
  e.preventDefault();
}

function onDrag(e) {
  if (!isDragging) return;
  
  const deltaX = e.clientX - dragStartX;
  const deltaY = e.clientY - dragStartY;
  
  bubble.style.left = `${dragStartLeft + deltaX}px`;
  bubble.style.top = `${dragStartTop + deltaY}px`;
  bubble.style.right = 'auto';
  bubble.style.bottom = 'auto';
}

function stopDrag() {
  isDragging = false;
  document.removeEventListener('mousemove', onDrag);
  document.removeEventListener('mouseup', stopDrag);
}

// Add drag event listeners
bubble.addEventListener('mousedown', startDrag);
bubble.style.cursor = 'grab';
bubble.addEventListener('mouseenter', () => {
  if (!isDragging) bubble.style.cursor = 'grab';
});
bubble.addEventListener('mouseleave', () => {
  if (!isDragging) bubble.style.cursor = 'grab';
});

content.addEventListener("scroll", () => {
  const atBottom = nearBottom(content);
  if (atBottom){
    autoscroll = true;
    if (jumpBtn) jumpBtn.classList.remove("show");
  } else {
    autoscroll = false;
    if (jumpBtn) jumpBtn.classList.add("show");
  }
});

if (jumpBtn) {
  jumpBtn.addEventListener("click", () => {
    snapToBottom();
    autoscroll = true;
    jumpBtn.classList.remove("show");
  });
}

// Hardened typewriter: no stalls, always advances, updates data-count
async function typewriter(text, mySession){
  textEl.textContent = "";
  textEl.setAttribute("data-count", " (0/"+text.length+")");
  cursor.style.opacity = "1";

  for (let i = 0; i < text.length; i++){
    if (mySession !== sessionId) return; // canceled

    const ch = text[i];
    textEl.textContent += ch;
    textEl.setAttribute("data-count", ` (${i+1}/${text.length})`);

    if (autoscroll) snapToBottom();

    let delay = TYPE_SPEED;
    if (",;:".includes(ch)) delay += PAUSE_COMMA;
    if (".!?…".includes(ch)) delay += PAUSE_PERIOD;

    // Simple sleep without microtask interference
    await sleep(delay);
  }
  if (mySession === sessionId) cursor.style.opacity = "0";
}

async function openChat(){
  const mySession = ++sessionId;
  clearTimeout(autoTimer);

  // reset visuals/state
  textEl.textContent = "";
  textEl.setAttribute("data-count", "");
  cursor.style.opacity = "0";
  gsap.set(shine, { x: "-150%" });
  gsap.set(content, { opacity: 0 });
  content.scrollTop = 0;
  autoscroll = true;
  if (jumpBtn) jumpBtn.classList.remove("show");

  if (prefersReduced){
    bubble.dataset.state = "open";
    gsap.set(content, { opacity: 1 });
    textEl.textContent = MESSAGE;
    textEl.setAttribute("data-count", ` (${MESSAGE.length}/${MESSAGE.length})`);
    snapToBottom();
    return;
  }

  // Flip dot -> open
  const state = Flip.getState(bubble);
  bubble.dataset.state = "open";
  Flip.from(state, { duration: 0.6, ease: "power3.inOut", absolute: true });

  // reveal content + shine
  gsap.to(content, { opacity: 1, duration: 0.25, delay: 0.15 });
  gsap.fromTo(shine, { x: "-150%" }, { x: "150%", duration: 1.2, ease: "power2.inOut", delay: 0.2 });

  await sleep(380);
  if (mySession === sessionId) {
    if (hasTypedBefore) {
      // Show text immediately if typed before
      textEl.textContent = MESSAGE;
      textEl.setAttribute("data-count", ` (${MESSAGE.length}/${MESSAGE.length})`);
      cursor.style.opacity = "0";
    } else {
      // First time - type it out
      hasTypedBefore = true;
      typewriter(MESSAGE, mySession);
    }
  }
}

function resetToDot(){
  ++sessionId; // cancel typing
  textEl.textContent = "";
  textEl.setAttribute("data-count", "");
  cursor.style.opacity = "0";
  bubble.dataset.state = "dot";
  gsap.set(content, { opacity: 0 });
  gsap.set(shine, { x: "-150%" });
  autoscroll = true;
  if (jumpBtn) jumpBtn.classList.remove("show");
}

// auto trigger - delay by 3 seconds to show pulsing dot effect
autoTimer = setTimeout(openChat, 3000);

// replay
if (replayBtn) {
  replayBtn.addEventListener("click", () => {
    resetToDot();
    setTimeout(openChat, 200);
  });
}

// close button - collapse chat back to dot using FLIP
const closeBtn = document.getElementById("closeChat");
if (closeBtn) {
  closeBtn.addEventListener("click", () => {
    // Get current state before collapsing
    const state = Flip.getState(bubble);
    
    // Reset to dot state
    resetToDot();
    
    // Animate the collapse using FLIP
    Flip.from(state, { 
      duration: 0.6, 
      ease: "power3.inOut", 
      absolute: true 
    });
  });
}
