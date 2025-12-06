document.addEventListener("DOMContentLoaded", function () {

    let currentDate = new Date();

    // -------------------------------------------------------
    // ORDINALS (1st, 2nd, 3rd…)
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
    // FULL DATE — Wednesday, November 26th, 2025
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
    // TIME NORMALISER — convert anything → "HH:MM" 24h
    // -------------------------------------------------------
    function normaliseTime(t) {
        if (!t) return "";

        // Try direct parse: handles "2:15 PM", "14:30", "8 pm"
        let d = new Date("2000-01-01 " + t);
        if (!isNaN(d.getTime())) {
            return d.toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit"
            });
        }

        // Fix formats like "8pm" → "8 pm"
        const fixed = t.replace(/(\d)(am|pm)/i, "$1 $2");

        d = new Date("2000-01-01 " + fixed);
        if (!isNaN(d.getTime())) {
            return d.toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit"
            });
        }

        // If completely unparseable, return original but trimmed
        return t.trim();
    }

    // -------------------------------------------------------
    // GUARANTEED FIX: Apply class to final row cards
    // -------------------------------------------------------
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
                    if (!row || row.length < 3) return;

                    const rowDate  = row[0];
                    const cinema   = row[1];
                    const title    = row[2];
                    const director = row[3];
                    const runtime  = row[4];
                    const format   = row[5];
                    const timeRaw  = row[6];
                    const year     = row[7];
                    const notes    = row[8];

                    if (rowDate !== formatted) return;
                    if (!cinema) return;

                    if (!data[cinema]) data[cinema] = [];

                    let film = data[cinema].find(f => f.title === title);

                    if (!film) {
                        film = {
                            title,
                            details: [
                                director || "",
                                year || "",
                                runtime ? (String(runtime).includes("min") ? runtime : runtime + " min") : "",
                                format || "",
                                notes || ""
                            ].filter(Boolean).join(", "),
                            times: timeRaw
                                ? timeRaw
                                    .split(',')
                                    .map(t => normaliseTime(t.trim()))
                                    .filter(Boolean)
                                : [],
                        };

                        data[cinema].push(film);
                    }
                });

                if (Object.keys(data).length === 0) {
                    container.innerHTML = `<p style="text-align:center;padding:20px;">No listings for this date.</p>`;
                    return;
                }

                // -------------------------------------------------------
                // RENDER
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
                                ${s.title} 
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
    // INITIAL PAGE LOAD
    // -------------------------------------------------------
    updateCalendar();
    loadListingsFor(currentDate);

});
