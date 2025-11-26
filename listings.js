document.addEventListener("DOMContentLoaded", function () {

  let currentDate = new Date();

  // ------------------------------
  // ORDINAL SUFFIXES (st, nd, rd, th)
  // ------------------------------
  function getOrdinal(n) {
    if (n > 3 && n < 21) return "th"; // handles 11–13th
    switch (n % 10) {
      case 1: return "st";
      case 2: return "nd";
      case 3: return "rd";
      default: return "th";
    }
  }

  // ------------------------------
  // FORMATTED CALENDAR DATE
  // Produces: Wednesday, November 26th, 2025
  // ------------------------------
  function formatFullDate(date) {
    const day = date.getDate();
    const suffix = getOrdinal(day);

    const weekday = date.toLocaleDateString("en-GB", { weekday: "long" });
    const month = date.toLocaleDateString("en-GB", { month: "long" });
    const year = date.getFullYear();

    return `${weekday}, ${month} ${day}${suffix}, ${year}`;
  }

  // ------------------------------
  // UPDATE CALENDAR HEADER
  // ------------------------------
  function updateCalendar() {
    const calendarDate = document.getElementById("calendar-date");
    calendarDate.textContent = formatFullDate(currentDate);
  }

  // ------------------------------
  // LOAD LISTINGS FOR A DATE
  // ------------------------------
  function loadListingsFor(date) {

    const container = document.getElementById("cinema-listings");
    container.innerHTML = ""; // clear previous day

    const formatted = date.toISOString().split("T")[0];

    fetch(`https://intervalslondon.com/wp-json/intervals/v1/screenings?date=${formatted}`)
      .then(res => res.json())
      .then(data => {

        if (!data || Object.keys(data).length === 0) {
          container.innerHTML = `<p style="text-align:center; padding:20px;">No listings for this date.</p>`;
          return;
        }

        Object.entries(data).forEach(([cinemaName, screenings]) => {

          // sort times
          screenings.sort((a, b) => {
            const ta = a.times[0]?.replace(":", "") || "0";
            const tb = b.times[0]?.replace(":", "") || "0";
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
        console.error("Listings fetch error", err);
        container.innerHTML = `<p style="text-align:center; padding:20px;">Unable to load listings.</p>`;
      });
  }

  // ------------------------------
  // NAVIGATION BUTTONS
  // ------------------------------
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

  // ------------------------------
  // CALENDAR CLICK → SHOW PICKER
  // ------------------------------
  document.getElementById("calendar-date").onclick = function () {
    document.getElementById("date-picker").showPicker();
  };

  // ------------------------------
  // DATE PICKER → UPDATE DATE
  // ------------------------------
  document.getElementById("date-picker").onchange = function (e) {
    currentDate = new Date(e.target.value);
    updateCalendar();
    loadListingsFor(currentDate);
  };

  // ------------------------------
  // INITIALISE PAGE
  // ------------------------------
  updateCalendar();
  loadListingsFor(currentDate);

});
