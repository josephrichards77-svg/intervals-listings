console.log("✅ NEW listings.js LOADED", new Date().toISOString());

document.addEventListener("DOMContentLoaded", function () {

    // -------------------------------------------------------
    // DATE SAFETY — FORCE LOCAL MIDNIGHT
    // -------------------------------------------------------
    function atLocalMidnight(d) {
        return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }

    // -------------------------------------------------------
    // CURRENT DATE (LOCKED)
    // -------------------------------------------------------
    let currentDate = atLocalMidnight(new Date());

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
        document.getElementById("calendar-date").textContent =
            formatFullDate(currentDate);
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
    // TIME NORMALISER
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
    // CINEMA SORT NORMALISER
    // -------------------------------------------------------
    function normaliseCinemaName(name) {
        return name.replace(/^(the|a|an)\s+/i, "").trim().toLowerCase();
    }

    // -------------------------------------------------------
    // LAST ROW FIX
    // -------------------------------------------------------
    function applyLastRowFix() {
        document.querySelectorAll('.screenings').forEach(container => {
            const cards = Array.from(container.children);
            if (!cards.length) return;

            cards.forEach(c => c.classList.remove('last-row-card'));

            const firstTop = cards[0].offsetTop;
            let columns = 0;

            for (const c of cards) {
                if (c.offsetTop === firstTop) columns++;
                else break;
            }

            const remainder = cards.length % columns;
            const start =
                remainder === 0
                    ? cards.length - columns
                    : cards.length - remainder;

            cards.forEach((c, i) => {
                if (i >= start) c.classList.add('last-row-card');
            });
        });
    }

    // -------------------------------------------------------
    // LOAD LISTINGS
    // -------------------------------------------------------
    function loadListingsFor(date) {

        const container = document.getElementById("cinema-listings");
        container.innerHTML = "";

        const formatted = [
            date.getFullYear(),
            String(date.getMonth() + 1).padStart(2, "0"),
            String(date.getDate()).padStart(2, "0")
        ].join("-");

        const url =
            "https://sheets.googleapis.com/v4/spreadsheets/1JgcHZ2D-YOfqAgnOJmFhv7U5lgFrSYRVFfwdn3BPczY/values/Master?key=AIzaSyDwO660poWTz5En2w5Tz-Z0JmtAEXFfo0g";

        fetch(url)
            .then(r => r.json())
            .then(sheet => {

                if (!sheet.values || sheet.values.length < 2) {
                    container.innerHTML =
                        `<p style="text-align:center;padding:20px;">No listings for this date.</p>`;
                    return;
                }

                const data = {};

                sheet.values.slice(1).forEach(row => {

                    const safe = Array.from({ length: 12 }, (_, i) => row[i] || "");

                    const rowDate = safe[0];
                    const cinema  = safe[1];
                    if (rowDate !== formatted || !cinema) return;

                    const rawTitle = safe[2].trim();
                    let titleText = rawTitle;
                    let titleLink = "";

                    const m = rawTitle.match(/<a[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/i);
                    if (m) {
                        titleLink = m[1];
                        titleText = m[2];
                    }

                    const director           = safe[3];
                    const runtime            = safe[4];
                    const format             = normaliseFormat(safe[5]);
                    const times              = safe[6]
                        ? String(safe[6]).split(",").map(t => normaliseTime(t.trim())).filter(Boolean)
                        : [];
                    const year               = safe[7];
                    const notes              = safe[8];
                    const blurb              = safe[9];
                    const programmeTitle     = safe[10];
                    const programmeFilmsRaw  = safe[11];

                    let programmeFilms = [];
                    if (programmeFilmsRaw && programmeFilmsRaw.trim()) {
                        programmeFilms = programmeFilmsRaw
                            .split("||")
                            .map(f => f.trim())
                            .filter(Boolean)
                            .map(title => ({ title }));
                    }

                    if (!data[cinema]) data[cinema] = [];

                    let film = data[cinema].find(f => f.rawTitle === titleText);

                    if (!film) {
                        film = {
                            title: programmeTitle || titleText,
                            rawTitle: titleText,
                            titleLink,
                            notes,
                            blurb,
                            programmeFilms,
                            details: [
                                director || "",
                                year || "",
                                runtime
                                    ? (String(runtime).includes("min") ? runtime : runtime + " min")
                                    : "",
                                format
                            ].filter(Boolean).join(", "),
                            times: [...times]
                        };
                        data[cinema].push(film);
                    } else {
                        times.forEach(t => {
                            if (!film.times.includes(t)) film.times.push(t);
                        });
                    }
                });

                if (!Object.keys(data).length) {
                    container.innerHTML =
                        `<p style="text-align:center;padding:20px;">No listings for this date.</p>`;
                    return;
                }

                Object.keys(data)
                    .sort((a, b) =>
                        normaliseCinemaName(a).localeCompare(
                            normaliseCinemaName(b), "en", { sensitivity: "base" }
                        )
                    )
                    .forEach(cinema => {

                        const screenings = data[cinema];
                        screenings.sort((a, b) =>
                            parseInt((a.times[0] || "9999").replace(":", "")) -
                            parseInt((b.times[0] || "9999").replace(":", ""))
                        );

                        container.innerHTML += `
                            <div class="cinema">
                                <h2>${cinema}</h2>
                                <div class="screenings">
                                    ${screenings.map(s => `
                                        <div class="screening">
                                            ${s.notes ? `<div class="notes-tag">${s.notes}</div>` : ""}
                                            <a href="${s.titleLink || '#'}">${s.title}</a>
                                            ${s.blurb ? `<div class="screening-blurb">${s.blurb}</div>` : ""}
                                            ${s.programmeFilms?.length ? `
                                                <ul class="programme-films">
                                                    ${s.programmeFilms.map(f => `<li>${f.title}</li>`).join("")}
                                                </ul>
                                            ` : ""}
                                            <div class="details">${s.details}</div>
                                            <div class="time">${s.times.join(", ")}</div>
                                        </div>
                                    `).join("")}
                                </div>
                            </div>
                        `;
                    });

                applyLastRowFix();
            })
            .catch(err => {
                console.error("Listings fetch error:", err);
                container.innerHTML =
                    `<p style="text-align:center;padding:20px;">Unable to load listings.</p>`;
            });
    }

    // -------------------------------------------------------
    // NAVIGATION
    // -------------------------------------------------------
    document.getElementById("prev-btn").onclick = () => {
        currentDate = atLocalMidnight(
            new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() - 1)
        );
        updateCalendar();
        loadListingsFor(currentDate);
    };

    document.getElementById("next-btn").onclick = () => {
        currentDate = atLocalMidnight(
            new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 1)
        );
        updateCalendar();
        loadListingsFor(currentDate);
    };

    document.getElementById("calendar-date").onclick = () => {
        document.getElementById("date-picker").showPicker();
    };

    document.getElementById("date-picker").onchange = e => {
        currentDate = atLocalMidnight(new Date(e.target.value + "T00:00:00"));
        updateCalendar();
        loadListingsFor(currentDate);
    };

    // -------------------------------------------------------
    // INIT
    // -------------------------------------------------------
    updateCalendar();
    loadListingsFor(currentDate);
    window.addEventListener("resize", applyLastRowFix);

});
