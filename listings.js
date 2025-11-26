document.addEventListener("DOMContentLoaded", function () {

  const API_URL = "https://sheets.googleapis.com/v4/spreadsheets/1JgcHZ2D-YOfqAgnOJmFhv7U5lgFrSYRVFfwdn3BPczY/values/Master?key=AIzaSyDwO660poWTz5En2w5Tz-Z0JmtAEXFfo0g";

  const dateSpan = document.getElementById("calendar-date");
  const datePicker = document.getElementById("date-picker");
  const prevBtn = document.getElementById("prev-btn");
  const nextBtn = document.getElementById("next-btn");
  const listingsContainer = document.getElementById("cinema-listings");

  let currentDate = new Date();
  let allRows = [];
  let headers = [];

  function cleanField(v) {
    if (!v) return "";
    return String(v)
      .replace(/^"+|"+$/g, "")
      .replace(/""/g, '"')
      .trim();
  }

  function normalizeTime(t) {
    if (!t) return "";
    t = cleanField(t);

    if (/^\d{1,2}:\d{2}$/.test(t)) return t;

    const num = parseFloat(t);
    if (!isNaN(num) && num > 0 && num < 2) {
      const total = Math.round(num * 24 * 60);
      const hh = String(Math.floor(total / 60)).padStart(2, "0");
      const mm = String(total % 60).padStart(2, "0");
      return `${hh}:${mm}`;
    }

    return t;
  }

  function normalizeRuntime(r) {
    if (!r) return "";
    r = cleanField(r);
    const num = parseFloat(r);

    if (!isNaN(num) && num > 0 && num < 2) return "";

    return r;
  }

  function getOrdinal(n) {
    if (n > 3 && n < 21) return "th";
    return ["th", "st", "nd", "rd"][Math.min(n % 10, 4)];
  }

 function fmtDate(d) {
  const day = d.getDate();
  const month = d.toLocaleString("en-US", { month: "long" });
  const weekday = d.toLocaleString("en-US", { weekday: "long" });
  const year = d.getFullYear();

  return `${weekday}, ${month} ${day}${getOrdinal(day)}, ${year}`;
}


  function iso(d) {
    return d.toISOString().split("T")[0];
  }

  function updateDate() {
    dateSpan.textContent = fmtDate(currentDate);
    renderForDay(currentDate);
  }

  dateSpan.onclick = function () {
    datePicker.value = iso(currentDate);
    datePicker.showPicker();
  };

  datePicker.onchange = function (e) {
    currentDate = new Date(e.target.value);
    updateDate();
  };

  prevBtn.onclick = function () {
    currentDate.setDate(currentDate.getDate() - 1);
    updateDate();
  };

  nextBtn.onclick = function () {
    currentDate.setDate(currentDate.getDate() + 1);
    updateDate();
  };

  async function load() {
    try {
      const res = await fetch(API_URL);
      const data = await res.json();
      headers = data.values[0];
      allRows = data.values.slice(1);
      updateDate();
    } catch (e) {
      console.error("Fetch error:", e);
      listingsContainer.textContent = "Failed to load cinema listings.";
    }
  }

  function renderForDay(date) {
    listingsContainer.innerHTML = "";
    const day = iso(date);

    const todays = allRows.filter(function (r) {
      const obj = {};
      headers.forEach((h, i) => obj[h] = cleanField(r[i] || ""));
      return (
        obj["DATE"] === day &&
        obj["VENUE"] !== "Live" &&
        obj["VENUE"] !== "Exhibitions"
      );
    });

    if (todays.length === 0) {
      listingsContainer.textContent = "No screenings on this date.";
      return;
    }

    const venues = {};

    todays.forEach(function (r) {
      const obj = {};
      headers.forEach((h, i) => obj[h] = cleanField(r[i] || ""));

      const venue = obj["Corrected VENUE"] || obj["VENUE"];
      const title = obj["Corrected TITLE"] || obj["TITLE"];
      const director = obj["Corrected DIRECTOR"] || obj["DIRECTOR"];
      const year = obj["Corrected Year"] || obj["YEAR"];
      const runtime = normalizeRuntime(obj["Corrected RUNTIME"] || obj["RUNTIME"]);
      const format = obj["Corrected FORMAT"] || obj["FORMAT"];
      const time = normalizeTime(obj["Corrected TIME"] || obj["TIME"]);
      const link = obj["Corrected LINK"] || obj["LINK"] || "#";

      if (!venues[venue]) venues[venue] = [];
      venues[venue].push({ title, director, year, runtime, format, time, link });
    });

    Object.keys(venues).forEach(function (venueName) {
      const block = document.createElement("div");
      block.className = "cinema";
      block.innerHTML = "<h2>" + venueName + "</h2>";

      const grid = document.createElement("div");
      grid.className = "screenings";

      venues[venueName].forEach(function (item) {
        const details = [
          item.director, item.year, item.runtime, item.format
        ].filter(Boolean).join(", ");

        const card = document.createElement("div");
        card.className = "screening";

        card.innerHTML =
          `<div>
            <div class="title"><a href="${item.link}" target="_blank">${item.title}</a></div>
            <div class="details">${details}</div>
          </div>
          <div class="time">${item.time}</div>`;

        grid.appendChild(card);
      });

      block.appendChild(grid);
      listingsContainer.appendChild(block);
    });
  }

  load();
});
