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
  // GUARANTEED FIX: Manually apply class to cards in the final row (RESPONSIVE)
  // -------------------------------------------------------
  function applyLastRowFix() {
    // Select all container elements with the class 'screenings'
    document.querySelectorAll('.screenings').forEach(screeningsContainer => {

      // 1. Determine columns based on current window width (must match your CSS media queries!)
      let columns = 3; 
      if (window.innerWidth <= 1024 && window.innerWidth > 768) {
        columns = 2; // Matches tablet CSS flex setting
      } else if (window.innerWidth <= 768) {
        columns = 1; // Matches mobile CSS flex setting
      }
      
      // 2. Clear old classes (important when this runs multiple times on resize/data change)
      Array.from(screeningsContainer.children).forEach(card => {
        card.classList.remove('last-row-card');
      });

      // 3. Apply the class to the last N cards, where N is the calculated column count
      const children = Array.from(screeningsContainer.children);
      // Use slice(-columns) to target the number of cards matching the current layout
      const lastN = children.slice(-columns);
      
      lastN.forEach(card => {
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
let   timeRaw  = row[6];  // TIME column
const year     = row[7];  // YEAR column


          if (rowDate !== formatted) return;
          if (!cinema) return;

          // --- normalise time (numbers from Sheets → HH:MM) ---
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

          // find any existing film entry under this cinema
          let film = data[cinema].find(f => f.title === title);

          // if none, create new entry
          if (!film) {
            film = {
              title,
              details: [
                director || "",
                year || "",
                runtime ? (runtime.includes("min") ? runtime : runtime + " min") : "",
                format || ""
              ].filter(Boolean).join(", "),
              times: []
            };
            data[cinema].push(film);
          }

          // add time (ONLY if non-empty)
          if (time.trim() !== "") {
            film.times.push(time);
          }

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
                <a href="#">${s.title}</a>
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

  // We also run the fix on resize to handle changes between 3/2/1 columns
  window.addEventListener('resize', applyLastRowFix); 

});
