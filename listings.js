document.addEventListener("DOMContentLoaded", function () {

  const API_URL = "https://intervalslondon.com/wp-json/intervals/v1/listings";

  let currentDate = new Date();

  function getOrdinal(n) {
    if (n > 3 && n < 21) return "th";
    return ["th", "st", "nd", "rd"][Math.min(n % 10, 4)];
  }

  function formatFullDate(date) {
    const weekday = date.toLocaleString("en-GB", { weekday: "long" });
    const day = date.getDate();
    const month = date.toLocaleString("en-GB", { month: "long" });
    const year = date.getFullYear();
    return `${weekday}, ${day}${getOrdinal(day)} ${month} ${year}`;
  }

  function updateCalendar() {
    document.getElementById("calendar-date").textContent = formatFullDate(currentDate);
  }

  function parseTimeString(t) {
    if (!t) return null;
    const [h, m] = t.split(":").map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  }

  function getEarliestTime(times) {
    if (!times || times.length === 0) return null;
    const parsed = times.map(parseTimeString);
    parsed.sort((a, b) => a - b);
    return parsed[0];
  }

  async function loadListingsFor(date) {
    const iso = date.toISOString().split("T")[0];
    const res = await fetch(`${API_URL}?date=${iso}`);
    const data = await res.json();
    renderListings(data);
  }

  function renderListings(cinemaData) {
    const container = document.getElementById("cinema-listings");
    container.innerHTML = "";

    Object.entries(cinemaData).forEach(([cinemaName, screenings]) => {

      screenings.sort((a, b) => {
        const ta = getEarliestTime(a.times);
        const tb = getEarliestTime(b.times);
        if (!ta) return 1;
        if (!tb) return -1;
        return ta - tb;
      });

      let html = `<div class="cinema">
                    <h2>${cinemaName}</h2>
                    <div class="screenings">`;

      screenings.forEach(s => {
        html += `
          <div class="screening">
            <a href="#">${s.title}</a>
            <div class="details">${s.details}</div>
            <div class="time">${s.times.join(", ")}</div>
          </div>`;
      });

      html += `</div></div>`;
      container.innerHTML += html;
    });
  }

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

  updateCalendar();
  loadListingsFor(currentDate);

});
