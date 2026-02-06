document.addEventListener("DOMContentLoaded", function () {

  // -------------------------------------------------------
  // SCROLL AUTHORITY
  // -------------------------------------------------------
  if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";
  }

  // -------------------------------------------------------
  // DATE HELPERS
  // -------------------------------------------------------
  function atLocalMidnight(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function getOrdinal(n) {
    if (n > 3 && n < 21) return "th";
    return ["th","st","nd","rd"][Math.min(n % 10, 4)] || "th";
  }

  function formatFullDate(date) {
    const d = date.getDate();
    return `${date.toLocaleDateString("en-GB", { weekday: "long" })}, ${d}${getOrdinal(d)} ${date.toLocaleDateString("en-GB", { month: "long" })} ${date.getFullYear()}`;
  }

  // -------------------------------------------------------
  // STATE
  // -------------------------------------------------------
  let currentDate = atLocalMidnight(new Date());
  let FILM_ONLY = false;
  let datePicker = null;

  const container    = document.getElementById("cinema-listings");
  const filmFilter   = document.getElementById("filter-film");
  const calendarDate = document.getElementById("calendar-date");
  const prevBtn      = document.getElementById("prev-btn");
  const nextBtn      = document.getElementById("next-btn");

  if (!container) return;

  function updateCalendar() {
    if (calendarDate) {
      calendarDate.textContent = formatFullDate(currentDate);
    }
  }

  function resetFilmFilter() {
    FILM_ONLY = false;
    filmFilter?.classList.remove("active");
  }

  // -------------------------------------------------------
  // NORMALISERS
  // -------------------------------------------------------
  function normaliseFormat(fmt) {
    if (!fmt) return "DCP";
    const raw = fmt.trim();
    if (!raw) return "DCP";
    if (/^(—|none|hide|x)$/i.test(raw)) return "";

    const f = raw.toUpperCase().replace(/\s+/g, "");
    if (["DIGITAL","DIG","HD","DCP","4K","4KRESTORATION"].includes(f)) return "DCP";
    if (["35","35MM"].includes(f)) return "35mm";
    if (["70","70MM"].includes(f)) return "70mm";
    if (["16","16MM"].includes(f)) return "16mm";
    return raw;
  }

  function normaliseTime(t) {
    if (!t) return "";
    const clean = t.replace(/\./g, "").trim().toUpperCase();
    if (/^\d{2}:\d{2}$/.test(clean)) return clean;

    const m = clean.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
    if (!m) return clean;

    let hh = parseInt(m[1], 10);
    if (m[3] === "PM" && hh !== 12) hh += 12;
    if (m[3] === "AM" && hh === 12) hh = 0;

    return `${String(hh).padStart(2, "0")}:${m[2]}`;
  }

  function normaliseCinemaName(name) {
    return name.replace(/^(the|a|an)\s+/i, "").trim().toLowerCase();
  }

  // -------------------------------------------------------
  // LOAD LISTINGS (CORE)
  // -------------------------------------------------------
  function loadListingsFor(date) {
    container.innerHTML = "";
    const formatted = date.toISOString().slice(0, 10);

    fetch("https://sheets.googleapis.com/v4/spreadsheets/1JgcHZ2D-YOfqAgnOJmFhv7U5lgFrSYRVFfwdn3BPczY/values/Master?key=AIzaSyDwO660poWTz5En2w5Tz-Z0JmtAEXFfo0g")
      .then(r => r.json())
      .then(sheet => {
        if (!sheet.values || sheet.values.length < 2) return;

        const data = {};

        sheet.values.slice(1).forEach(row => {
          const safe = Array.from({ length: 11 }, (_, i) => row[i] || "");
          if (safe[0] !== formatted) return;

          const format = normaliseFormat(safe[5]);
          if (FILM_ONLY && !/(16mm|35mm|70mm)/i.test(format)) return;

          const rawTitle = safe[2].trim();
          const m = rawTitle.match(/<a[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/i);
          const title = m ? m[2] : rawTitle;
          const link  = m ? m[1] : "";

          if (!data[safe[1]]) data[safe[1]] = [];

          let film = data[safe[1]].find(f => f.title === title);
          if (!film) {
            film = {
              title,
              link,
              notes: safe[8],
              screeningNotes: String(safe[10] || "").replace(/\u00a0/g," ").trim(),
              details: [
                safe[3],
                safe[7],
                safe[4] ? `${safe[4]} min` : "",
                format
              ].filter(Boolean).join(", "),
              times: []
            };
            data[safe[1]].push(film);
          }

          (safe[6] || "").split(",").forEach(t => {
            const nt = normaliseTime(t.trim());
            if (nt && !film.times.includes(nt)) film.times.push(nt);
          });
        });

        Object.keys(data)
          .sort((a,b)=>normaliseCinemaName(a).localeCompare(normaliseCinemaName(b)))
          .forEach(cinema => {
            container.innerHTML += `
              <div class="cinema">
                <h2>${cinema}</h2>
                <div class="screenings">
                  ${data[cinema].map(s => `
                    <div class="screening">
                      ${s.notes ? `<div class="notes-tag">${s.notes}</div>` : ""}
                      <a href="${s.link || "#"}">${s.title}</a>
                      ${s.screeningNotes ? `<div class="screening-notes">${s.screeningNotes}</div>` : ""}
                      ${s.details ? `<div class="details">${s.details}</div>` : ""}
                      <div class="time">${s.times.join(", ")}</div>
                    </div>
                  `).join("")}
                </div>
              </div>
            `;
          });
      });
  }

  // -------------------------------------------------------
  // CONTROLS
  // -------------------------------------------------------
  filmFilter && (filmFilter.onclick = () => {
    FILM_ONLY = !FILM_ONLY;
    filmFilter.classList.toggle("active", FILM_ONLY);
    loadListingsFor(currentDate);
  });

  prevBtn && (prevBtn.onclick = () => {
    currentDate.setDate(currentDate.getDate() - 1);
    if (datePicker?.setDate) datePicker.setDate(currentDate, false);
    resetFilmFilter();
    updateCalendar();
    loadListingsFor(currentDate);
  });

  nextBtn && (nextBtn.onclick = () => {
    currentDate.setDate(currentDate.getDate() + 1);
    if (datePicker?.setDate) datePicker.setDate(currentDate, false);
    resetFilmFilter();
    updateCalendar();
    loadListingsFor(currentDate);
  });

  // -------------------------------------------------------
  // FLATPICKR (WORDPRESS-SAFE SELECTION)
  // -------------------------------------------------------
  try {
    const fp =
      typeof window.flatpickr === "function"
        ? window.flatpickr
        : window.flatpickr && typeof window.flatpickr.default === "function"
          ? window.flatpickr.default
          : null;

    if (fp && document.getElementById("date-picker")) {

      const handleDate = (dates) => {
        if (!dates || !dates.length) return;
        currentDate = atLocalMidnight(dates[0]);
        resetFilmFilter();
        updateCalendar();
        loadListingsFor(currentDate);
      };

      datePicker = fp("#date-picker", {
        dateFormat: "Y-m-d",
        clickOpens: false,
        onChange: handleDate,
        onValueUpdate: handleDate,
        onClose: handleDate
      });

      calendarDate && calendarDate.addEventListener("click", () => {
        datePicker.open();
      });
    }
  } catch (e) {
    console.warn("Flatpickr disabled safely:", e);
    datePicker = null;
  }

  // -------------------------------------------------------
  // INIT
  // -------------------------------------------------------
  updateCalendar();
  loadListingsFor(currentDate);

});
