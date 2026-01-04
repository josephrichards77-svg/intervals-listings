document.addEventListener("DOMContentLoaded", function () {

    let currentDate = new Date();

    // -------------------------------------------------------
    // ORDINALS
    // -------------------------------------------------------
    function getOrdinal(n) {
        if (n > 3 && n < 21) return "th";
        switch (n % 10) {
            case 1: return "st";
            case 2: return "nd";
            case 3: return "rd";
            default: return "th";
        }
    }

    // -------------------------------------------------------
    // FULL DATE
    // -------------------------------------------------------
    function formatFullDate(date) {
        const day = date.getDate();
        const suffix = getOrdinal(day);
        const weekday = date.toLocaleDateString("en-GB", { weekday: "long" });
        const month = date.toLocaleDateString("en-GB", { month: "long" });
        const year = date.getFullYear();
        return `${weekday}, ${month} ${day}${suffix}, ${year}`;
    }

    function updateCalendar() {
        document.getElementById("calendar-date").textContent = formatFullDate(currentDate);
    }

    // -------------------------------------------------------
    // FORMAT NORMALISER
    // -------------------------------------------------------
    function normaliseFormat(fmt) {
        if (!fmt || fmt.trim() === "") return "DCP";
        let f = fmt.trim().toUpperCase().replace(/\s+/g, "");

        if (["4K", "4KRESTORATION", "4"].includes(f)) return "DCP";
        if (["DIGITAL", "DIG", "HD", "DCP"].includes(f)) return "DCP";
        if (["35", "35MM"].includes(f)) return "35mm";
        if (["70", "70MM"].includes(f)) return "70mm";
        if (["16", "16MM"].includes(f)) return "16mm";

        return fmt.trim();
    }

    // -------------------------------------------------------
    // TIME NORMALISER (AM/PM → 24h)
    // -------------------------------------------------------
    function normaliseTime(t) {
        if (!t) return "";
        let clean = t.replace(/\./g, "").trim().toUpperCase();

        if (/^\d{2}:\d{2}$/.test(clean)) return clean;

        const m = clean.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
        if (!m) return clean;

        let [_, hh, mm, suffix] = m;
        hh = parseInt(hh);

        if (suffix === "PM" && hh !== 12) hh += 12;
        if (suffix === "AM" && hh === 12) hh = 0;

        return `${String(hh).padStart(2, "0")}:${mm}`;
    }

  // -------------------------------------------------------
// LAST ROW FIX (RESPONSIVE-SAFE)
// -------------------------------------------------------
function applyLastRowFix() {
    document.querySelectorAll('.screenings').forEach(screeningsContainer => {
        const cards = Array.from(screeningsContainer.children);
        if (!cards.length) return;

        // reset
        cards.forEach(card => card.classList.remove('last-row-card'));

        // detect how many cards are in the first visual row
        const firstTop = cards[0].offsetTop;
        let columns = 0;

        for (const card of cards) {
            if (card.offsetTop === firstTop) {
                columns++;
            } else {
                break;
            }
        }

        // find start of last visual row
        const remainder = cards.length % columns;
        const lastRowStart =
            remainder === 0
                ? cards.length - columns
                : cards.length - remainder;

        cards.forEach((card, index) => {
            if (index >= lastRowStart) {
                card.classList.add('last-row-card');
            }
        });
    });
}


    // -------------------------------------------------------
    // LOAD LISTINGS FROM GOOGLE SHEETS
    // -------------------------------------------------------
    function loadListingsFor(date) {

        const container = document.getElementById("cinema-listings");
        container.innerHTML = "";

        const formatted = date.toISOString().split("T")[0];

        const url =
            "https://sheets.googleapis.com/v4/spreadsheets/1JgcHZ2D-YOfqAgnOJmFhv7U5lgFrSYRVFfwdn3BPczY/values/Master?key=AIzaSyDwO660poWTz5En2w5Tz-Z0JmtAEXFfo0g";

        fetch(url)
            .then(res => res.json())
            .then(sheet => {

                if (!sheet.values || sheet.values.length < 2) {
                    container.innerHTML = `<p style="text-align:center;padding:20px;">No listings for this date.</p>`;
                    return;
                }

                const rows = sheet.values.slice(1);
                const data = {};

                rows.forEach(row => {

                    const safe = [];
                    for (let i = 0; i < 9; i++) safe[i] = row[i] || "";

                    const rowDate = safe[0];
                    const cinema  = safe[1];

                    // -------- TITLE + LINK PARSING --------
                    const rawTitle = safe[2].trim();
                    let titleText  = rawTitle;
                    let titleLink  = "";

                    const m = rawTitle.match(/<a[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/i);
                    if (m) {
                        titleLink = m[1];
                        titleText = m[2];
                    }

                    const director = safe[3];
                    const runtime  = safe[4];
                    const format   = normaliseFormat(safe[5]);
                    const timeRaw  = safe[6];
                    const year     = safe[7];
                    const notes    = safe[8];

                    if (rowDate !== formatted) return;
                    if (!cinema) return;

                    if (!data[cinema]) data[cinema] = [];

                    let film = data[cinema].find(f => f.title === titleText);

                    let times = timeRaw
                        ? String(timeRaw).split(",").map(t => normaliseTime(t.trim()))
                        : [];

                    if (!film) {
                        film = {
                            title: titleText,
                            titleLink,
                            notes,
                            details: [
                                director || "",
                                year || "",
                                runtime ? (String(runtime).includes("min") ? runtime : runtime + " min") : "",
                                format
                            ].filter(Boolean).join(", "),
                            times
                        };
                        data[cinema].push(film);
                    }
                });

                if (Object.keys(data).length === 0) {
                    container.innerHTML = `<p style="text-align:center;padding:20px;">No listings for this date.</p>`;
                    return;
                }

                // -------------------------------------------------------
                // RENDER EACH CINEMA
                // -------------------------------------------------------
                Object.entries(data).forEach(([cinemaName, screenings]) => {

                    screenings.sort((a, b) => {
                        const ta = a.times[0] ? a.times[0].replace(":", "") : "9999";
                        const tb = b.times[0] ? b.times[0].replace(":", "") : "9999";
                        return parseInt(ta) - parseInt(tb);
                    });

                    let html = `
                        <div class="cinema">
                            <h2>${cinemaName}</h2>
                            <div class="screenings">
                    `;

                    screenings.forEach(s => {
                        html += `
                            <div class="screening">
                                ${s.notes ? `<div class="notes-tag">${s.notes}</div>` : ""}
                                <a href="${s.titleLink || '#'}">${s.title}</a>
                                <div class="details">${s.details}</div>
                                <div class="time">${s.times.join(", ")}</div>
                            </div>
                        `;
                    });

                    html += `</div></div>`;

                    container.innerHTML += html;
                });

                applyLastRowFix();

            })
            .catch(err => {
                console.error("Listings fetch error:", err);
                container.innerHTML = `<p style="text-align:center;padding:20px;">Unable to load listings.</p>`;
            });
    }

    // -------------------------------------------------------
    // NAVIGATION
    // -------------------------------------------------------
    document.getElementById("prev-btn").onclick = function () {
        currentDate.setDate(currentDate.getDate() - 1);
        updateCalendar();
        loadListingsFor(currentDate);
    };

    document.getElementById("next-btn").onclick = function () {
        currentDate.setDate(currentDate.getDate() + 1);
        updateCalendar();
        loadListingsFor(currentDate);
    };

    document.getElementById("calendar-date").onclick = function () {
        document.getElementById("date-picker").showPicker();
    };

    document.getElementById("date-picker").onchange = function (e) {
        currentDate = new Date(e.target.value);
        updateCalendar();
        loadListingsFor(currentDate);
    };

    // -------------------------------------------------------
    // INITIAL LOAD
    // -------------------------------------------------------
    updateCalendar();
    loadListingsFor(currentDate);
window.addEventListener('resize', applyLastRowFix);
});
