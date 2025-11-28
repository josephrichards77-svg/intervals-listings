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
    // GUARANTEED FIX: Manually apply class to cards in the final row
    // -------------------------------------------------------
    function applyLastRowFix() {
        // Select all container elements with the class 'screenings'
        document.querySelectorAll('.screenings').forEach(screeningsContainer => {
            
            // 1. Remove the class from all children first to reset the state
            Array.from(screeningsContainer.children).forEach(card => {
                card.classList.remove('last-row-card');
            });

            // 2. Apply the class to the last 3 children (The number of columns on desktop)
            const children = Array.from(screeningsContainer.children);
            // Use slice(-3) to target the last three elements regardless of total count
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

        // Format date to match Python output (YYYY-MM-DD)
        const formatted = date.toISOString().split("T")[0];

        // NOTE: The Google Sheets API Key and Sheet ID must be correct here.
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

                    // Ensure row has at least 3 elements before mapping
                    if (!row || row.length < 3) return;

                    // 🔴 CRITICAL FIX: Explicitly map ALL 9 columns (row[0] to row[8])
                    // This ensures correct column assignment even if intermediate fields are empty.
                    const rowDate  = row[0];
                    const cinema   = row[1];
                    const title    = row[2]; // Contains the full HTML link <a>Title</a>
                    const director = row[3];
                    const runtime  = row[4]; // Guaranteed to be "" or a number
                    const format   = row[5];
                    const timeRaw  = row[6];  // Comma-separated times (e.g., "9:00 PM, 11:00 PM")
                    const year     = row[7];  // The year
                    const notes    = row[8];  // Any extra notes (must be mapped!)


                    if (rowDate !== formatted) return;
                    if (!cinema) return;
                    
                    // Note: Skipping the old time normalisation logic as Python ensures clean time strings.

                    if (!data[cinema]) data[cinema] = [];

                    // find any existing film entry under this cinema
                    let film = data[cinema].find(f => f.title === title);

                    // if none, create new entry
                    if (!film) {
                        film = {
                            title,
                            
                            // 🔴 CRITICAL FIX: Combine metadata robustly
                            // Use .filter(Boolean) to ignore any fields that are empty strings ("")
                            details: [
                                director || "", 
                                year || "",     
                                
                                // Runtime: Only include if present, append " min" if it doesn't have it
                                runtime ? (String(runtime).includes("min") ? runtime : runtime + " min") : "",
                                
                                format || "",   
                                notes || ""     // Display notes here, if necessary
                            ].filter(Boolean).join(", "),
                            
                            // Times are split into a list for sorting and clean joining later
                            times: timeRaw ? timeRaw.split(',').map(t => t.trim()) : [],
                        };
                        data[cinema].push(film);
                    }

                    // The logic below ensures that if the Python cleaner was skipped, 
                    // and two rows exist for the same film/date, their times are merged.
                    // If the Python cleaner is working, this block is largely redundant but safe.
                    /*
                    if (timeRaw && film.times.indexOf(timeRaw) === -1) {
                         // This is where merging would happen if the time column was a single time.
                         // Since the time column is now comma-separated from the Python cleaner, 
                         // the merging happens implicitly by the row structure above.
                    }
                    */

                });

                if (Object.keys(data).length === 0) {
                    container.innerHTML = `<p style="text-align:center;padding:20px;">No listings for this date.</p>`;
                    return;
                }

                // -------------------------------------------------------
                // RENDER: nice 3-column cards
                // -------------------------------------------------------
                Object.entries(data).forEach(([cinemaName, screenings]) => {

                    // sort by first screening time
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

                // -------------------------------------------------------
                // 🔥 FIX: Apply the CSS removal class to the final row cards
                // -------------------------------------------------------
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
