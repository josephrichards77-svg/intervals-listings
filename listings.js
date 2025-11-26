document.addEventListener("DOMContentLoaded", function () {

  let currentDate = new Date();

  // -------------------------------------------------------
  // ORDINAL SUFFIXES (1st, 2nd, 3rd, 4th…)
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
  // FULL HUMAN-READABLE DATE
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
          container.innerHTML = `<p style="text-align:center; padding:20px;">No listings for this date.</p>`;
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
          const year     = row[6];
          let   timeRaw  = row[7];

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

          if (!cinema) return;
          if (!data[cinema]) data[cinema] = [];

          // find existing film
          let film = data[cinema].find(f => f.title === title);

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

          if (time) film.times.push(time);

        });

        if (Object.keys(data).length === 0) {
          container.innerHTML = `<p style="text-align:center; padding:20px;">No listings for this date.</p>`;
          return;
        }

        // -------------------------------------------------------
        // RENDER
        // -------------------------------------------------------
        Object.entries(data).forEach(([cinemaName, screenings]) => {

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

  // FIRST LOAD
  updateCalendar();
  loadListingsFor(currentDate);

});
