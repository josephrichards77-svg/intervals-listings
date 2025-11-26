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
          // Expected columns:
          // [0]=date, [1]=cinema, [2]=title, [3]=details, [4]=format, [5]=time
          const [rowDate, cinema, title, details, format, time] = row;

          if (rowDate !== formatted) return; // only show selected day

          if (!data[cinema]) data[cinema] = [];

          // find existing film entry
          let film = data[cinema].find(f => f.title === title);

          if (!film) {
            film = {
              title,
              details: `${details}${format ? " • " + format : ""}`,
              times: []
            };
            data[cinema].push(film);
          }

          if (time) {
            film.times.push(time);
          }
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
