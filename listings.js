/* ============================
   INTERVALS LISTINGS.JS (v3)
   Clean + Sorted + Ordinals
   ============================ */

// --- CONFIG ---
const API_URL = "https://intervalslondon.com/wp-json/intervals/v1/listings";

// --- DATE HANDLING ---
let currentDate = new Date();

// Add ordinal suffix: 1st, 2nd, 3rd, 4th...
function getOrdinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

// Format date as: Tuesday, 26th November 2025
function formatFullDate(date) {
  const weekday = date.toLocaleString("en-GB", { weekday: "long" });
  const day = date.getDate();
  const month = date.toLocaleString("en-GB", { month: "long" });
  const year = date.getFullYear();
  return `${weekday}, ${day}${getOrdinal(day)} ${month} ${year}`;
}

// Update calendar header
function updateCalendar() {
  document.getElementById("calendar-date").textContent = formatFullDate(currentDate);
}

// --- PARSE TIME UTILS ---
function parseTimeString(t) {
  // converts "14:30" into a Date object for sorting
  const [h, m] = t.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

// Extract earliest screening time from an array like ["14:00", "18:30"]
function getEarliestTime(times) {
  if (!times || times.length === 0) return null;
  const parsed = times.map(parseTimeString);
  parsed.sort((a, b) => a - b);
  return parsed[0]; // earliest
}

// --- FETCH LISTINGS ---
async function loadListingsFor(date) {
  const isoDate = date.toISOString().split("T")[0];

  const res = await fetch(`${API_URL}?date=${isoDate}`);
  const data = await res.json();

  renderListings(data);
}

// --- RENDER ---
function renderListings(cinemaData) {
  const container = document.getElementById("cinema-listings");
  container.innerHTML = "";

  Object.entries(cinemaData).forEach(([cinemaName, screenings]) => {
    // ---- SORT SCREENINGS BY EARLIEST TIME ----
    screenings.sort((a, b) => {
      const aTime = getEarliestTime(a.times);
      const bTime = getEarliestTime(b.times);
      if (!aTime) return 1;
      if (!bTime) return -1;
      return aTime - bTime;
    });

    // ---- BUILD CINEMA SECTION ----
    let html = `
      <div class="cinema">
        <h2>${cinemaName}</h2>
        <div class="screenings">
    `;

    screenings.forEach(screening => {
      const { title, details, times } = screening;

      // Convert array of times into comma-separated string
      const timeString = times.join(", ");

      html += `
        <div class="screening">
          <a href="#">${title}</a>
          <div class="details">${details}</div>
          <div class="time">${timeString}</div>
        </div>
      `;
    });

    html += `</div></div>`;
    container.innerHTML += html;
  });
}

// --- NAVIGATION ---
document.getElementById("prev-btn").addEventListener("click", () => {
  currentDate.setDate(currentDate.getDate() - 1);
  updateCalendar();
  loadListingsFor(currentDate);
});

document.getElementById("next-btn").addEventListener("click", () => {
  currentDate.setDate(currentDate.getDate() + 1);
  updateCalendar();
  loadListingsFor(currentDate);
});

// --- DATE PICKER ---
document.getElementById("calendar-date").addEventListener("click", () => {
  document.getElementById("date-picker").showPicker();
});

document.getElementById("date-picker").addEventListener("change", (e) => {
  currentDate = new Date(e.target.value);
  updateCalendar();
  loadListingsFor(currentDate);
});

// --- ON LOAD ---
updateCalendar();
loadListingsFor(currentDate);
