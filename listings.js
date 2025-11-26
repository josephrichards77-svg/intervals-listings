document.addEventListener("DOMContentLoaded", function () {

  let currentDate = new Date();

  // -------------------------------------------------------
  // ORDINAL SUFFIXES (1st, 2nd, 3rd, 4th…)
  // -------------------------------------------------------
  function getOrdinal(n) {
    if (n > 3 && n < 21) return "th"; // 11th–13th
    switch (n % 10) {
      case 1: return "st";
      case 2: return "nd";
      case 3: return "rd";
      default: return "th";
    }
  }

  // -------------------------------------------------------
  // FULL HUMAN-READABLE DATE
  // → Wednesday, November 26th, 2025
  // -------------------------------------------------------
  function formatFullDate(date) {
    const day = date.getDate();
    const suffix = getOrdinal(day);

    const weekday = date.toLocaleDateString("en-GB", { weekday: "long" });
    const month = date.toLocaleDateString("en-GB", { month: "long" });
    const year = date.getFullYear();

    return `${weekday}, ${month} ${day}${suffix}, ${year}`;
  }

  // -------------------------------------------------------
  // UPDATE DATE HEADER IN UI
  // -------------------------------------------------------
  function updateCalendar() {
    const el = document.getElementById("calendar-date");
    el.textContent = formatFullDate(currentDate);
  }

  // -------------------------------------------------------
  // LOAD LISTINGS FOR GIVEN DATE (FROM GOOGLE SHEETS API)
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
          container.innerHTML = `<p style="text-align:center; padding:20px;">No listings for this date.</p>`;
          return;
        }

        const rows = sheet.values.slice(1); // skip header

        // Convert rows into the SAME structure your display code expects
        const data = {};

rows.forEach(row => {

  const rowDate  = row[0];
  const cinema   = row[1];
  const title    = row[2];
  const director = row[3];
  const runtime  = row[4];
  const format   = row[5];
  const year     = row[6];
  let timeRaw    = row[7];

  if (rowDate !== formatted) return;

  // --- normalise time ---
  let time = "";
  if (typeof timeRaw === "number") {
    const totalMinutes = Math.round(timeRaw * 24 * 60);
    const hh = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
    const mm = String(totalMinutes % 60).padStart(2, "0");
    time = `${hh}:${mm}`;
  } else {
    time = timeRaw || "";
  }

  if (!data[cinema]) data[cinema] = [];

  // ✓ find existing film
  let film = data[cinema].find(f => f.title === title);

  // ✓ if new, create film object
  if (!film) {
    film = {
      title,
      details: [
        director || "",
        year || "",
        runtime ? (runtime.includes("min") ? runtime : runtime + " min") : "",
        format || ""
      ]
        .filter(Boolean)
        .join(", "),
      times: []
    };
    data[cinema].push(film);
  }

  // ✓ add time
  if (time) film.times.push(time);

});


    data[cinema].push(film);
  }

  // Add time
  if (time) film.times.push(time);

});



        if (Object.keys(data).length === 0) {
          container.innerHTML = `<p style="text-align:center; padding:20px;">No listings for this date.</p>`;
          return;
        }

        // -------------------------------------------------------
        // RENDER RESULTS USING YOUR EXISTING HTML OUTPUT LOGIC
        // -------------------------------------------------------
        Object.entries(data).forEach(([cinemaName, screenings]) => {

          // Sort films by first time (safe)
          screenings.sort((a, b) => {
            const ta = a?.times?.[0]?.replace(":", "") || 0;
            const tb = b?.times?.[0]?.replace(":", "") || 0;
            return ta - tb;
          });

          let html = `
            <div class="cinema">
              <h2>${cinemaName}</h2>
              <div class="screenings">
          `;

          screenings.forEach(s => {
            html += `
              <div class="screening">
                <a href="#">${s.title}</a>
                <div class="details">${s.details}</div>
                <div class="time">${s.times.join(", ")}</div>
              </div>
            `;
          });

          html += `
              </div>
            </div>
          `;

          container.innerHTML += html;
        });

      })
      .catch(err => {
        console.error("Listings fetch error:", err);
        container.innerHTML =
          `<p style="text-align:center; padding:20px;">Unable to load listings.</p>`;
      });
  }

  // -------------------------------------------------------
  // NAVIGATION BUTTONS
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

  // -------------------------------------------------------
  // CLICK ON DATE → SHOW PICKER
  // -------------------------------------------------------
  document.getElementById("calendar-date").onclick = function () {
    document.getElementById("date-picker").showPicker();
  };

  // -------------------------------------------------------
  // DATE PICKER → UPDATE DATE
  // -------------------------------------------------------
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
