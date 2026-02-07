document.addEventListener("DOMContentLoaded", function () {

/* =======================================================
   SCROLL AUTHORITY
======================================================= */
if ("scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}

/* =======================================================
   DATE SAFETY
======================================================= */
function atLocalMidnight(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/* =======================================================
   STATE
======================================================= */
let currentDate = null;
let FILM_ONLY = false;

const filmFilter = document.getElementById("filter-film");

/* =======================================================
   HELPERS
======================================================= */
function resetFilmFilter() {
  FILM_ONLY = false;
  filmFilter?.classList.remove("active");
}

function getOrdinal(n) {
  if (n > 3 && n < 21) return "th";
  return ["th","st","nd","rd"][Math.min(n % 10, 4)] || "th";
}

function formatFullDate(date) {
  const d = date.getDate();
  return `${date.toLocaleDateString("en-GB",{weekday:"long"})}, ${d}${getOrdinal(d)} ${date.toLocaleDateString("en-GB",{month:"long"})} ${date.getFullYear()}`;
}

function updateCalendar() {
  if (!currentDate) return;
  document.getElementById("calendar-date").textContent =
    formatFullDate(currentDate);
}

function normaliseFormat(fmt) {
  if (!fmt || fmt.trim() === "") return "DCP";
  const f = fmt.trim().toUpperCase().replace(/\s+/g,"");
  if (["DIGITAL","DIG","HD","DCP","4K","4KRESTORATION"].includes(f)) return "DCP";
  if (["35","35MM"].includes(f)) return "35mm";
  if (["70","70MM"].includes(f)) return "70mm";
  if (["16","16MM"].includes(f)) return "16mm";
  return fmt.trim();
}

function normaliseTime(t) {
  if (!t) return "";
  const clean = t.replace(/\./g,"").trim().toUpperCase();
  if (/^\d{2}:\d{2}$/.test(clean)) return clean;
  const m = clean.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
  if (!m) return clean;
  let hh = parseInt(m[1],10);
  if (m[3]==="PM" && hh!==12) hh+=12;
  if (m[3]==="AM" && hh===12) hh=0;
  return `${String(hh).padStart(2,"0")}:${m[2]}`;
}

function normaliseCinemaName(name) {
  return name.replace(/^(the|a|an)\s+/i,"").trim().toLowerCase();
}

/* === ADDITION: TIME SORTING HELPER === */
function timeToMinutes(t) {
  if (!t) return Infinity;
  const [h,m] = t.split(":").map(Number);
  return h * 60 + m;
}

/* =======================================================
   LOAD LISTINGS
======================================================= */
function loadListingsFor(date) {

  currentDate = date;
  const scrollY = window.scrollY;

  const container = document.getElementById("cinema-listings");
  container.innerHTML = "";

  const formatted = [
    date.getFullYear(),
    String(date.getMonth()+1).padStart(2,"0"),
    String(date.getDate()).padStart(2,"0")
  ].join("-");

  fetch("https://sheets.googleapis.com/v4/spreadsheets/1JgcHZ2D-YOfqAgnOJmFhv7U5lgFrSYRVFfwdn3BPczY/values/Master?key=AIzaSyDwO660poWTz5En2w5Tz-Z0JmtAEXFfo0g")
    .then(r=>r.json())
    .then(sheet=>{
      if (!sheet.values || sheet.values.length<2) {
        container.innerHTML = `<p style="text-align:center;padding:20px;">No listings for this date.</p>`;
        window.scrollTo(0,scrollY);
        return;
      }

      const data = {};

      sheet.values.slice(1).forEach(row=>{
        const safe = Array.from({length:11},(_,i)=>row[i]||"");
        if (safe[0]!==formatted) return;

        const cinema = safe[1];
        if (!cinema) return;

        const format = normaliseFormat(safe[5]);
        if (FILM_ONLY && !/(16mm|35mm|70mm)/i.test(format)) return;

        const rawTitle = safe[2].trim();
        const m = rawTitle.match(/<a[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/i);
        const title = m ? m[2] : rawTitle;
        const link  = m ? m[1] : "";

        const screeningNotes = String(safe[10]||"")
          .replace(/\u00a0/g," ")
          .replace(/[\u2000-\u200B\u202F\u205F\u3000]/g," ")
          .replace(/\s+/g," ")
          .trim();

        const programmeFilms = safe[9]
          ? safe[9].split("||").map(p=>{
              const [t,d,y,r,f] = p.split("|").map(x=>x.trim());
              return {title:t,director:d,year:y,runtime:r,format:f};
            }).filter(p=>p.title)
          : [];

        if (!data[cinema]) data[cinema]=[];

        let film = data[cinema].find(f=>f.title===title);
        if (!film) {
          film = {
            title,
            link,
            notes: safe[8],
            screeningNotes,
            programmeFilms,
            details: [
              safe[3],
              safe[7],
              safe[4] ? `${safe[4]} min` : "",
              format
            ].filter(Boolean).join(", "),
            times:[]
          };
          data[cinema].push(film);
        }

        (safe[6]||"").split(",").forEach(t=>{
          const nt = normaliseTime(t.trim());
          if (nt && !film.times.includes(nt)) film.times.push(nt);
        });

        /* === ADDITION: SORT TIMES WITHIN FILM === */
        film.times.sort((a,b)=>timeToMinutes(a)-timeToMinutes(b));
      });

      /* === ADDITION: SORT FILMS BY EARLIEST TIME === */
      Object.values(data).forEach(films=>{
        films.sort((a,b)=>timeToMinutes(a.times[0]) - timeToMinutes(b.times[0]));
      });

      if (!Object.keys(data).length) {
        container.innerHTML = `<p style="text-align:center;padding:20px;">No listings for this date.</p>`;
        window.scrollTo(0,scrollY);
        return;
      }

      Object.keys(data)
        .sort((a,b)=>normaliseCinemaName(a).localeCompare(normaliseCinemaName(b)))
        .forEach(cinema=>{
          container.innerHTML += `
            <div class="cinema">
              <h2>${cinema}</h2>
              <div class="screenings">
                ${data[cinema].map(s=>`
                  <div class="screening">
                    ${s.notes ? `<div class="notes-tag">${s.notes}</div>` : ""}
                    <a href="${s.link||"#"}">${s.title}</a>
                    ${s.screeningNotes ? `<div class="screening-notes">${s.screeningNotes}</div>` : ""}
                    <div class="details">${s.details}</div>
                    ${s.programmeFilms.length ? `
                      <ul class="programme-films">
                        ${s.programmeFilms.map(f=>`
                          <li>
                            <div class="pf-title">${f.title}</div>
                            ${[f.director,f.year,f.runtime,f.format].some(Boolean)
                              ? `<div class="pf-meta">${[f.director,f.year,f.runtime,f.format].filter(Boolean).join(", ")}</div>`
                              : ""
                            }
                          </li>
                        `).join("")}
                      </ul>` : ""}
                    <div class="time">${s.times.join(", ")}</div>
                  </div>
                `).join("")}
              </div>
            </div>
          `;
        });

      window.scrollTo(0,scrollY);
    });
}

/* =======================================================
   CONTROLS (UNCHANGED)
======================================================= */
filmFilter && (filmFilter.onclick = ()=>{
  FILM_ONLY = !FILM_ONLY;
  filmFilter.classList.toggle("active",FILM_ONLY);
  loadListingsFor(currentDate);
});

document.getElementById("prev-btn").onclick = ()=>{
  currentDate = atLocalMidnight(new Date(currentDate.getFullYear(),currentDate.getMonth(),currentDate.getDate()-1));
  resetFilmFilter(); updateCalendar(); loadListingsFor(currentDate);
};

document.getElementById("next-btn").onclick = ()=>{
  currentDate = atLocalMidnight(new Date(currentDate.getFullYear(),currentDate.getMonth(),currentDate.getDate()+1));
  resetFilmFilter(); updateCalendar(); loadListingsFor(currentDate);
};

document.getElementById("date-picker").onchange = e=>{
  currentDate = atLocalMidnight(new Date(e.target.value+"T00:00:00"));
  resetFilmFilter(); updateCalendar(); loadListingsFor(currentDate);
};

document.getElementById("calendar-date").onclick = ()=>{
  document.getElementById("date-picker").showPicker?.();
};

/* =======================================================
   INIT
======================================================= */
currentDate = atLocalMidnight(new Date());
updateCalendar();
loadListingsFor(currentDate);

});
