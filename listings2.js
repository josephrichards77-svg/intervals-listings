console.log("🧪 listings2.js LOADED", new Date().toISOString());

document.addEventListener("DOMContentLoaded", function () {

  // -------------------------------------------------------
  // VENUE DETECTION (FROM URL)
  // -------------------------------------------------------
  function getVenueFromURL() {
    // Query string takes priority
    const params = new URLSearchParams(window.location.search);
    if (params.get("venue")) return params.get("venue");

    // Otherwise derive from slug
    const slug = window.location.pathname
      .replace(/^\/|\/$/g, "")
      .toLowerCase();

    const venueMap = {
      "barbican": "Barbican"
    };

    return venueMap[slug] || null;
  }

  const container = document.getElementById("cinema-listings");
const venue = container?.dataset.cinema || null;

console.log("VENUE FROM DATA ATTRIBUTE:", venue);

console.log("VENUE FORCED:", venue);

  console.log("VENUE DETECTED:", venue);

  // -------------------------------------------------------
  // DATE HELPERS
  // -------------------------------------------------------
  function atLocalMidnight(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  let currentDate = atLocalMidnight(new Date());

  function getOrdinal(n) {
    if (n > 3 && n < 21) return "th";
    return ["th", "st", "nd", "rd"][n % 10] || "th";
  }

  function formatFullDate(date) {
    const day = date.getDate();
    return `${date.toLocaleDateString("en-GB", { weekday: "long" })}, ` +
           `${date.toLocaleDateString("en-GB", { month: "long" })} ` +
           `${day}${getOrdinal(day)}, ${date.getFullYear()}`;
  }

  function updateCalendar() {
    const el = document.getElementById("calendar-date");
    if (el) el.textContent = formatFullDate(currentDate);
  }

  // -------------------------------------------------------
  // NORMALISERS
  // -------------------------------------------------------
  function normaliseFormat(fmt) {
    if (!fmt) return "DCP";
    const f = fmt.trim().toUpperCase();
    if (["35", "35MM"].includes(f)) return "35mm";
    if (["70", "70MM"].includes(f)) return "70mm";
    if (["16", "16MM"].includes(f)) return "16mm";
    return "DCP";
  }

  function normaliseTime(t) {
    if (!t) return "";
    let clean = t.replace(/\./g, "").trim().toUpperCase();
    if (/^\d{2}:\d{2}$/.test(clean)) return clean;

    const m = clean.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
    if (!m) return clean;

    let hh = parseInt(m[1], 10);
    const mm = m[2];
    const suffix = m[3];

    if (suffix === "PM" && hh !== 12) hh += 12;
    if (suffix === "AM" && hh === 12) hh = 0;

    return `${String(hh).padStart(2, "0")}:${mm}`;
  }

  // -------------------------------------------------------
  // LOAD LISTINGS
  // -------------------------------------------------------
  function loadListingsFor(date) {

    const container = document.getElementById("cinema-listings");
    if (!container) {
      console.warn("No #cinema-listings element found");
      return;
    }

    container.innerHTML = "";

    const formattedDate =
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

    const SHEET_URL =
      "https://sheets.googleapis.com/v4/spreadsheets/1JgcHZ2D-YOfqAgnOJmFhv7U5lgFrSYRVFfwdn3BPczY/values/Master?key=AIzaSyDwO660poWTz5En2w5Tz-Z0JmtAEXFfo0g";

    fetch(SHEET_URL)
      .then(r => r.json())
      .then(sheet => {

        if (!sheet.values || sheet.values.length < 2) {
          container.innerHTML = "<p>No listings.</p>";
          return;
        }

        const data = {};

        sheet.values.slice(1).forEach(row => {

          const safe = Array.from({ length: 9 }, (_, i) => row[i] || "");
          const rowDate = safe[0];
          const cinema = safe[1];

          if (rowDate !== formattedDate || !cinema) return;
          if (venue && cinema !== venue) return;

          const rawTitle = safe[2].trim();
          let titleText = rawTitle;
          let titleLink = "";

          const m = rawTitle.match(/<a[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/i);
          if (m) {
            titleLink = m[1];
            titleText = m[2];
          }

          if (!data[cinema]) data[cinema] = [];

          data[cinema].push({
            title: titleText,
            titleLink,
            notes: safe[8],
            details: [
              safe[3],
              safe[7],
              safe[4] ? `${safe[4]} min` : "",
              normaliseFormat(safe[5])
            ].filter(Boolean).join(", "),
            times: safe[6]
              ? safe[6].split(",").map(t => normaliseTime(t.trim()))
              : []
          });
        });

        if (!Object.keys(data).length) {
          container.innerHTML = "<p>No listings.</p>";
          return;
        }

        Object.keys(data).forEach(cinema => {
          container.innerHTML += `
            <div class="cinema">
              <h2>${cinema}</h2>
              <div class="screenings">
                ${data[cinema].map(s => `
                  <div class="screening">
                    ${s.notes ? `<div class="notes-tag">${s.notes}</div>` : ""}
                    <a href="${s.titleLink || '#'}">${s.title}</a>
                    <div class="details">${s.details}</div>
                    <div class="time">${s.times.join(", ")}</div>
                  </div>
                `).join("")}
              </div>
            </div>
          `;
        });
      })
      .catch(err => {
        console.error("Listings fetch error:", err);
        container.innerHTML = "<p>Unable to load listings.</p>";
      });
  }

  // -------------------------------------------------------
  // NAV
  // -------------------------------------------------------
  const prev = document.getElementById("prev-btn");
  const next = document.getElementById("next-btn");
  const picker = document.getElementById("date-picker");
  const dateLabel = document.getElementById("calendar-date");

  if (prev) prev.onclick = () => {
    currentDate.setDate(currentDate.getDate() - 1);
    updateCalendar();
    loadListingsFor(currentDate);
  };

  if (next) next.onclick = () => {
    currentDate.setDate(currentDate.getDate() + 1);
    updateCalendar();
    loadListingsFor(currentDate);
  };

  if (dateLabel && picker) {
    dateLabel.onclick = () => picker.showPicker();
    picker.onchange = e => {
      currentDate = atLocalMidnight(new Date(e.target.value));
      updateCalendar();
      loadListingsFor(currentDate);
    };
  }

  // -------------------------------------------------------
  // INIT
  // -------------------------------------------------------
  updateCalendar();
  loadListingsFor(currentDate);

});
