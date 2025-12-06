document.addEventListener("DOMContentLoaded", function () {

    let currentDate = new Date();

    //-------------------------------------------------------
    // ORDINALS (1st, 2nd, 3rd…)
    //-------------------------------------------------------
    function getOrdinal(n) {
        if (n > 3 && n < 21) return "th";
        switch (n % 10) {
            case 1: return "st";
            case 2: return "nd";
            case 3: return "rd";
            default: return "th";
        }
    }

    //-------------------------------------------------------
    // FULL DATE — Wednesday, November 26th, 2025
    //-------------------------------------------------------
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

    //-------------------------------------------------------
    // FORMAT NORMALISER
    //-------------------------------------------------------
    function normaliseFormat(fmt) {
        // Blank, null, undefined, or whitespace → DCP
        if (!fmt || fmt.trim() === "") return "DCP";

        let f = fmt.trim().toUpperCase().replace(/\s+/g, "");

        // 4K → DCP
        if (["4K", "4KRESTORATION", "4"].includes(f)) return "DCP";

        // digital variants → DCP
        if (["DIGITAL", "DIG", "HD", "DCP"].includes(f)) return "DCP";

        // 35mm
        if (f === "35MM" || f === "35") return "35mm";

        // 70mm
        if (f === "70MM" || f === "70") return "70mm";

        // 16mm
        if (f === "16MM" || f === "16") return "16mm";

        // fallback
        return fmt.trim();
    }

    //-------------------------------------------------------
    // TIME NORMALISER → ALWAYS 24h format
    //-------------------------------------------------------
    function normaliseTime(t) {
        if (!t) return "";

        let clean = t.replace(/\./g, "").trim().toUpperCase();

        // Already 24h
        if (/^\d{2}:\d{2}$/.test(clean)) return clean;

        // Match 11:30 AM
        const m = clean.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
        if (!m) return clean;

        let [_, hh, mm, suffix] = m;
        hh = parseInt(hh);

        if (suffix === "PM" && hh !== 12) hh += 12;
        if (suffix === "AM" && hh === 12) hh = 0;

        return `${String(hh).padStart(2, "0")}:${mm}`;
    }

    //-------------------------------------------------------
    // Apply CSS class to last row cards
    //-------------------------------------------------------
    function applyLastRowFix() {
        document.querySelectorAll('.screenings').forEach(screeningsContainer => {

            Array.from(screeningsContainer.children).forEach(card => {
                card.classList.remove('last-row-card');
            });

            const children = Array.from(screeningsContainer.children);
            const lastThree = children.slice(-3);

            lastThree.forEach(card => {
                card.classList.add('last-row-card');
            });
        });
    }

    //-------------------------------------------------------
    // LOAD LISTINGS FROM GOOGLE SHEETS
    //-------------------------------------------------------
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

                    // Guarantee 9 safe fields
                    const safe = [];
                    for (let i = 0; i < 9; i++) {
                        safe[i] = row[i] || "";
                    }

                    const rowDate  = safe[0];
                    const cinema   = safe[1];
                    const title    = safe[2];
                    const director = safe[3];
                    const runtime  = safe[4];
                    const format   = normaliseFormat(safe[5]);
                    const timeRaw  = safe[6];
                    const year     = safe[7];
                    const notes    = safe[8];

                    if (rowDate !== formatted) return;
                    if (!cinema) return;

                    if (!data[cinema]) data[cinema] = [];

                    let film = data[cinema].find(f => f.title === title);

                    // Times
                    let times = timeRaw
                        ? String(timeRaw).split(",").map(t => normaliseTime(t.trim()))
                        : [];

                    if (!film) {
                        film = {
                            title,
                            details: [
                                director || "",
                                year || "",
                                runtime ? (String(runtime).includes("min") ? runtime : runtime + " min") : "",
                                format,
                                notes || ""
                            ].filter(Boolean).join(", "),
                            times: times
                        };
                        data[cinema].push(film);
                    }
                });

                if (Object.keys(data).length === 0) {
                    container.innerHTML = `<p style="text-align:center;padding:20px;">No listings for this date.</p>`;
                    return;
                }

                //-------------------------------------------------------
                // RENDER
                //-------------------------------------------------------
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

    //-------------------------------------------------------
    // NAVIGATION
    //-------------------------------------------------------
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

    //-------------------------------------------------------
    // INITIAL LOAD
    //-------------------------------------------------------
    updateCalendar();
    loadListingsFor(currentDate);

});
