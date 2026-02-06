document.addEventListener("DOMContentLoaded", function () {

  // -------------------------------------------------------
  // SCROLL AUTHORITY — PREVENT BROWSER JUMPING
  // -------------------------------------------------------
  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }

  // -------------------------------------------------------
  // DATE SAFETY — FORCE LOCAL MIDNIGHT
  // -------------------------------------------------------
  function atLocalMidnight(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function getEarliestMatchingDate(values) {
    return values
      .slice(1)
      .map(row => {
        const date  = row[0];
        const notes = row[8] || "";
        if (!date) return null;

        if (window.LOCKED_NOTES_TAG) {
          const notesNorm = String(notes)
            .toLowerCase()
            .replace(/\u00a0/g, " ")
            .replace(/[^a-z0-9]+/g, " ")
            .replace(/\s+/g, " ")
            .trim();

          const tagNorm = String(window.LOCKED_NOTES_TAG)
            .toLowerCase()
            .replace(/\u00a0/g, " ")
            .replace(/[^a-z0-9]+/g, " ")
            .replace(/\s+/g, " ")
            .trim();

          const notesTokens = new Set(notesNorm.split(" "));
          const tagTokens = tagNorm.split(" ").filter(Boolean);

          if (!tagTokens.every(t => notesTokens.has(t))) return null;
        }

        return atLocalMidnight(new Date(date));
      })
      .filter(Boolean)
      .sort((a, b) => a - b)[0] || null;
  }

  // -------------------------------------------------------
  // STATE
  // -------------------------------------------------------
  let currentDate = null;
  let FILM_ONLY = false;

  const filmFilter = document.getElementById("filter-film");

  function resetFilmFilter() {
    FILM_ONLY = false;
    filmFilter?.classList.remove("active");
  }

  // -------------------------------------------------------
  // LOCKED FILTERS
  // -------------------------------------------------------
  const LOCKED_CINEMA =
    typeof window.LOCKED_CINEMA !== "undefined"
      ? window.LOCKED_CINEMA
      : null;

  const LOCKED_NOTES_TAG =
    typeof window.LOCKED_NOTES_TAG !== "undefined"
      ? window.LOCKED_NOTES_TAG
      : null;

  // -------------------------------------------------------
  // DATE FORMAT
  // -------------------------------------------------------
  function getOrdinal(n) {
    if (n > 3 && n < 21) return "th";
    return ["th","st","nd","rd"][Math.min(n % 10, 4)] || "th";
  }

  function formatFullDate(date) {
    const d = date.getDate();
    return `${date.toLocaleDateString("en-GB", { weekday: "long" })}, ${d}${getOrdinal(d)} ${date.toLocaleDateString("en-GB", { month: "long" })} ${date.getFullYear()}`;
  }

  function updateCalendar() {
    if (currentDate) {
      document.getElementById("calendar-date").textContent =
        formatFullDate(currentDate);
    }
  }

  // -------------------------------------------------------
  // NORMALISERS
  // -------------------------------------------------------
  function normaliseFormat(fmt) {
    if (fmt === undefined || fmt === null) return "DCP";

    const raw = fmt.trim();
    if (raw === "") return "DCP";

    if (/^(—|none|hide|x)$/i.test(raw)) return "";

    const f = raw.toUpperCase().replace(/\s+/g, "");

    if (["DIGITAL", "DIG", "HD", "DCP", "4K", "4KRESTORATION"].includes(f)) return "DCP";
    if (["35", "35MM"].includes(f)) return "35mm";
    if (["70", "70MM"].includes(f)) return "70mm";
    if (["16", "16MM"].includes(f)) return "16mm";

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
  // LOAD LISTINGS
  // -------------------------------------------------------
  function loadListingsFor(date) {
    currentDate = date;
    const scrollY = window.scrollY;

    const container = document.getElementById("cinema-listings");
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
          if (LOCKED_CINEMA && safe[1] !== LOCKED_CINEMA) return;

          const format = normaliseFormat(safe[5]);
          const isFilm = /(16mm|35mm|70mm)/i.test(format);
          if (FILM_ONLY && !isFilm) return;

          const rawTitle = safe[2].trim();
          const m = rawTitle.match(/<a[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/i);

          const title = m ? m[2] : rawTitle;
          const link  = m ? m[1] : "";

          const programmeFilms = safe[9]
            ? safe[9].split("||").map(p => {
                const [t,d,y,r,f] = p.split("|").map(x => x.trim());
                return { title:t, director:d, year:y, runtime:r, format:f };
              }).filter(p => p.title)
            : [];

          if (!data[safe[1]]) data[safe[1]] = [];

          const cleanedScreeningNotes = String(safe[10] || "")
            .replace(/\u00a0/g, " ")
            .trim();

          let film = data[safe[1]].find(f => f.title === title);
          if (!film) {
            film = {
              title,
              link,
              notes: safe[8],
              screeningNotes: cleanedScreeningNotes,
              programmeFilms,
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
                      ${s.programmeFilms.length ? `
                        <ul class="programme-films">
                          ${s.programmeFilms.map(f => `
                            <li>
                              <div class="pf-title">${f.title}</div>
                              ${[f.director,f.year,f.runtime,f.format].some(Boolean)
                                ? `<div class="pf-meta">${[f.director,f.year,f.runtime,f.format].filter(Boolean).join(", ")}</div>`
                                : ""
                              }
                            </li>
                          `).join("")}
                        </ul>` : ""
                      }
                      <div class="time">${s.times.join(", ")}</div>
                    </div>
                  `).join("")}
                </div>
              </div>
            `;
          });

        window.scrollTo(0, scrollY);
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

  document.getElementById("prev-btn").onclick = () => {
    currentDate.setDate(currentDate.getDate() - 1);
    resetFilmFilter(); updateCalendar(); loadListingsFor(currentDate);
  };

  document.getElementById("next-btn").onclick = () => {
    currentDate.setDate(currentDate.getDate() + 1);
    resetFilmFilter(); updateCalendar(); loadListingsFor(currentDate);
  };

  // -------------------------------------------------------
  // INIT
  // -------------------------------------------------------
  fetch("https://sheets.googleapis.com/v4/spreadsheets/1JgcHZ2D-YOfqAgnOJmFhv7U5lgFrSYRVFfwdn3BPczY/values/Master?key=AIzaSyDwO660poWTz5En2w5Tz-Z0JmtAEXFfo0g")
    .then(r => r.json())
    .then(sheet => {
      currentDate = atLocalMidnight(new Date());
      if (LOCKED_NOTES_TAG) {
        const first = getEarliestMatchingDate(sheet.values);
        if (first && first > currentDate) currentDate = first;
      }
      updateCalendar();
      loadListingsFor(currentDate);
    });

});
