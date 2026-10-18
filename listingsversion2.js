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
const LOCKED_NOTES_TAG = typeof window.LOCKED_NOTES_TAG === "string"
  ? window.LOCKED_NOTES_TAG
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase()
  : "";

// Set window.LOCKED_CINEMA on a page to restrict listings to one venue.
// Unset everywhere else, so the main listings page is unaffected.
const LOCKED_CINEMA = typeof window.LOCKED_CINEMA === "string"
  ? normaliseCinemaName(window.LOCKED_CINEMA)
  : "";

/* =======================================================
   SEASON LINKS
   season_pages.py publishes {tag: season page URL} for every published
   season page into a hidden block on the /seasons/ page. Fetched once, in
   parallel with the sheet; if it's slow or missing, tags stay plain text.
======================================================= */
const SEASON_LINKS = Promise.race([
  fetch("https://intervalslondon.com/wp-json/wp/v2/pages/5983?_fields=content")
    .then(r => r.ok ? r.json() : null)
    .then(page => {
      const html = page && page.content && page.content.rendered;
      if (!html) return {};
      const el = new DOMParser().parseFromString(html, "text/html")
        .getElementById("iv-season-links");
      return el ? JSON.parse(el.getAttribute("data-links") || "{}") : {};
    }),
  new Promise(resolve => setTimeout(() => resolve({}), 3000))
]).catch(() => ({}));

// Same normalisation season_pages.py's norm_key applies to the keys.
function tagKey(s) {
  const ta = document.createElement("textarea");
  ta.innerHTML = s;
  return ta.value
    .replace(/\u00a0/g, " ")
    .replace(/[\u2000-\u200B\u202F\u205F\u3000]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

// Link each "|"-separated tag that has a published season page. A notes
// cell that already carries a link (added by hand or by a scraper) is left
// exactly as it is.
function linkNotes(notes, cinema, links) {
  if (/<a\s/i.test(notes)) return notes;
  const venue = tagKey(cinema);
  return notes.split("|").map(part => {
    const key = tagKey(part);
    const url = key && (links[venue + "::" + key] || links[key]);
    if (!url) return part;
    const lead = part.match(/^\s*/)[0];
    const trail = part.match(/\s*$/)[0];
    return `${lead}<a href="${url}">${part.trim()}</a>${trail}`;
  }).join("|");
}

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
  // Two pieces, so phones can stack them as two lines that each hug
  // their text (see "Listings date" in Additional CSS).
  const d = currentDate.getDate();
  const day   = `${currentDate.toLocaleDateString("en-GB",{weekday:"long"})}, ${d}${getOrdinal(d)}`;
  const month = `${currentDate.toLocaleDateString("en-GB",{month:"long"})} ${currentDate.getFullYear()}`;
  document.getElementById("calendar-date").innerHTML =
    `<span class="cd-day">${day}</span> <span class="cd-month">${month}</span>`;
}

function normaliseFormat(fmt) {
  if (!fmt || fmt.trim() === "") return "";
  const f = fmt.trim().toUpperCase().replace(/\s+/g,"");
  if (["DIGITAL","DIG","HD","DCP","4K","4KRESTORATION"].includes(f)) return "DCP";
  if (["35","35MM"].includes(f)) return "35mm";
  if (["70","70MM"].includes(f)) return "70mm";
  if (["16","16MM"].includes(f)) return "16mm";
  if (["8","8MM"].includes(f)) return "8mm"; 
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

// Key for merging rows of the same film: "La Cérémonie" and "La Ceremonie"
// (or differing case/spacing) are one film.
function titleKey(title) {
  return String(title)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function hasAccents(s) {
  return String(s).normalize("NFD") !== String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// "*parent & baby screening" for one kind of special screening, or
// "*11:00 members' screening, *14:00 relaxed screening" when there are several.
function screeningNotesLine(s) {
  const strip = n => String(n || "").replace(/^[*+\s]+/, "").trim();
  const starredTimes = s.times.filter(t => s.starred[t] !== undefined);
  const kinds = [...new Set(starredTimes.map(t => strip(s.starred[t])))].filter(Boolean);
  let star = "";
  if (kinds.length === 1) star = "*" + kinds[0];
  else if (kinds.length > 1) star = starredTimes.map(t => `*${t} ${strip(s.starred[t])}`).join(", ");
  return [strip(s.screeningNotes), star].filter(Boolean).join(" · ");
}

function timeToMinutes(t) {
  if (!t) return Infinity;
  const [h,m] = t.split(":").map(Number);
  return h * 60 + m;
}

/* =======================================================
   METADATA CLEANERS
======================================================= */

function cleanValue(v) {
  return String(v || "").trim();
}

function cleanRuntime(v) {
  return String(v || "")
    .trim()
    .replace(/\bminutes?\b/gi,"")
    .replace(/\bmins?\b/gi,"")
    .replace(/\bmin\b/gi,"")
    .trim();
}

function buildDetails(director, year, runtime, format) {
  const rt = cleanRuntime(runtime);

  const known = [
    cleanValue(director),
    cleanValue(year),
    rt ? `${rt} min` : ""
  ].filter(Boolean);

  // A lone "DCP" tells the reader nothing: it's usually a shorts
  // programme with no director/year/runtime, and digital is the
  // default anyway. Film and tape formats (35mm, 16mm, VHS) still
  // show on their own, since those are why people go.
  if (!known.length && cleanValue(format) === "DCP") return "";

  return [...known, cleanValue(format)].filter(Boolean).join(", ");
}

function buildProgrammeMeta(director, year, runtime, format) {
  const rt = cleanRuntime(runtime);

  const parts = [
    cleanValue(director),
    cleanValue(year),
    rt ? `${rt} min` : "",
    normaliseFormat(format)
  ].filter(Boolean);

  return parts.join(", ");
}

/* =======================================================
   LOAD LISTINGS
======================================================= */
function loadListingsFor(date) {
  currentDate = date;

  // Do NOT touch container.innerHTML here. Clearing it before the fetch
  // resolves collapses the page height and yanks the scroll position up
  // (the "jump to top" bug). We only swap content in once, in one go,
  // after everything is built.
  const container = document.getElementById("cinema-listings");

  const formatted = [
    date.getFullYear(),
    String(date.getMonth()+1).padStart(2,"0"),
    String(date.getDate()).padStart(2,"0")
  ].join("-");

  Promise.all([
    fetch("https://sheets.googleapis.com/v4/spreadsheets/1drykEGaf8YsMpWOsGLn7iGJwMQeLEYzJNtybd_8aY5Q/values/live?key=AIzaSyDwO660poWTz5En2w5Tz-Z0JmtAEXFfo0g")
      .then(r=>r.json()),
    SEASON_LINKS
  ])
    .then(([sheet, seasonLinks])=>{

      const scrollY = window.scrollY;

      if (!sheet.values || sheet.values.length < 2) {
        container.innerHTML = `<p style="text-align:center;padding:20px;">No listings for this date.</p>`;
        window.scrollTo(0,scrollY);
        return;
      }

      const data = {};

      sheet.values.slice(1).forEach(row=>{

        const safe = Array.from({length:11},(_,i)=>row[i]||"");

        if (safe[0] !== formatted) return;

        const cinema = safe[1];
        if (!cinema) return;

        if (LOCKED_CINEMA && normaliseCinemaName(cinema) !== LOCKED_CINEMA) return;

        const rawNotes = String(safe[8] || "");
        const normalisedNotes = rawNotes
          .replace(/\u00a0/g, " ")
          .replace(/[\u2000-\u200B\u202F\u205F\u3000]/g, " ")
          .replace(/\s+/g, " ")
          .trim();

        if (
          LOCKED_NOTES_TAG &&
          !normalisedNotes.toLowerCase().includes(LOCKED_NOTES_TAG)
        ) return;

        const format = normaliseFormat(safe[5]);

        if (FILM_ONLY && !/\b(8|16|35|70)mm\b|super\s*8/i.test(format)) return;

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

        if (!data[cinema]) data[cinema] = [];

        const key = titleKey(title);
        let film = data[cinema].find(f=>titleKey(f.title)===key);

        // Prefer the accented spelling when the same film appears both ways.
        if (film && !hasAccents(film.title) && hasAccents(title)) {
          film.title = title;
          if (link) film.link = link;
        }

        // A row with a screening note (members', parent & baby, relaxed, Q&A…)
        // is a special screening. When the same film also has an ordinary
        // screening that day, the ordinary one supplies the link and the
        // special times are marked with * instead of taking over the entry.
        // Also catch special screenings from the link alone, in case a row's
        // note column is blank (Barbican: /parent-baby-screening-…, etc).
        const SPECIAL_LINKS = [
          [/parent-?(?:and-|&-)?baby|baby-?friendly|carers-?(?:and-)?babies/i, "parent & baby screening"],
          [/members?-screening|member-preview/i, "members' screening"],
          [/relaxed-screening/i, "relaxed screening"],
        ];
        const linkKind = (SPECIAL_LINKS.find(([re]) => re.test(link)) || [])[1] || "";
        const specialNote = screeningNotes || linkKind;
        const isSpecial = !!specialNote;
        const rowTimes = (safe[6]||"").split(",")
          .map(t => normaliseTime(t.trim().replace(/^\*+/, "")))
          .filter(Boolean);

        if (!film) {

          film = {
            title,
            link,
            notes: rawNotes,
            screeningNotes: specialNote,
            programmeFilms,
            details: buildDetails(safe[3], safe[7], safe[4], format),
            times:[],
            special: isSpecial,
            starred: {}
          };

          data[cinema].push(film);

        } else if (film.special && !isSpecial) {

          film.times.forEach(t => { film.starred[t] = film.screeningNotes; });
          if (link) film.link = link;
          if (!film.notes.trim() && rawNotes.trim()) film.notes = rawNotes;
          film.screeningNotes = "";
          film.special = false;

        } else if (!film.special && isSpecial) {

          rowTimes.forEach(t => { film.starred[t] = specialNote; });

        }

        rowTimes.forEach(nt => {
          if (!film.times.includes(nt)) film.times.push(nt);
        });

        film.times.sort((a,b)=>timeToMinutes(a)-timeToMinutes(b));

      });

      Object.values(data).forEach(films=>{
        films.sort((a,b)=>timeToMinutes(a.times[0]) - timeToMinutes(b.times[0]));
      });

      if (!Object.keys(data).length) {

        container.innerHTML = `<p style="text-align:center;padding:20px;">No listings for this date.</p>`;
        window.scrollTo(0,scrollY);
        return;

      }

      // Build the entire new markup in memory first — nothing touches the
      // live DOM (and therefore nothing changes page height / scroll) until
      // the single assignment below.
      const html = Object.keys(data)
        .sort((a,b)=>normaliseCinemaName(a).localeCompare(normaliseCinemaName(b)))
        .map(cinema => `
            <div class="cinema">
              <h2>${cinema}</h2>

              <div class="screenings">

                ${data[cinema].map(s=>`

                  <div class="screening">

                    ${s.notes.trim() ? `<div class="notes-tag">${linkNotes(s.notes, cinema, seasonLinks)}</div>` : ""}
                    <a href="${s.link||"#"}">${s.title}</a>

                    ${screeningNotesLine(s) ? `<div class="screening-notes">${screeningNotesLine(s)}</div>` : ""}

                    ${s.details ? `<div class="details">${s.details}</div>` : ""}

                    ${s.programmeFilms.length ? `
                      <ul class="programme-films">

                        ${s.programmeFilms.map(f=>{

                          const pfMeta = buildProgrammeMeta(
                            f.director,
                            f.year,
                            f.runtime,
                            f.format
                          );

                          return `
                          <li>

                            <div class="pf-title">${f.title}</div>

                            ${pfMeta ? `<div class="pf-meta">${pfMeta}</div>` : ""}

                          </li>
                          `;

                        }).join("")}

                      </ul>
                    ` : ""}

                    <div class="time">${s.times.map(t => s.starred[t] ? "*" + t : t).join(", ")}</div>

                  </div>

                `).join("")}

              </div>
            </div>
          `).join("");

      // Single swap: old content is replaced by new content in one paint,
      // so the page never collapses to zero height in between and the
      // scroll position never needs to jump.
      container.innerHTML = html;

    });
}

/* =======================================================
   CONTROLS
======================================================= */

filmFilter && (filmFilter.onclick = ()=>{
  FILM_ONLY = !FILM_ONLY;
  filmFilter.classList.toggle("active",FILM_ONLY);
  loadListingsFor(currentDate);
});

document.getElementById("prev-btn").onclick = ()=>{
  currentDate = atLocalMidnight(new Date(currentDate.getFullYear(),currentDate.getMonth(),currentDate.getDate()-1));
  resetFilmFilter();
  updateCalendar();
  loadListingsFor(currentDate);
};

document.getElementById("next-btn").onclick = ()=>{
  currentDate = atLocalMidnight(new Date(currentDate.getFullYear(),currentDate.getMonth(),currentDate.getDate()+1));
  resetFilmFilter();
  updateCalendar();
  loadListingsFor(currentDate);
};

document.getElementById("date-picker").onchange = e=>{
  currentDate = atLocalMidnight(new Date(e.target.value+"T00:00:00"));
  resetFilmFilter();
  updateCalendar();
  loadListingsFor(currentDate);
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
