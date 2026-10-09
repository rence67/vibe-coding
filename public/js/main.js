// Utility Functions
function formatPeso(amount) {
  const num = parseFloat(amount);
  if (isNaN(num)) return "₱0.00";
  return "₱" + num.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatDate(dateString) {
  if (!dateString) return "";
  const parts = dateString.split("-");
  if (parts.length !== 3) return dateString;
  const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
  return dateObj.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

function formatTime(timeString) {
  if (!timeString) return "";
  const [hours, minutes] = timeString.split(":");
  let h = parseInt(hours, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${minutes} ${ampm}`;
}

function showToast(message, type = "error") {
  const banner = document.getElementById("toast-banner");
  if (!banner) return;
  banner.textContent = message;
  banner.className = `toast-banner show toast-${type}`;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function hideToast() {
  const banner = document.getElementById("toast-banner");
  if (banner) {
    banner.className = "toast-banner";
    banner.textContent = "";
  }
}

function setFieldError(fieldId, errorMessage) {
  const errorEl = document.getElementById(`${fieldId}-error`);
  if (errorEl) {
    if (errorMessage) {
      errorEl.textContent = errorMessage;
      errorEl.classList.add("active");
    } else {
      errorEl.textContent = "";
      errorEl.classList.remove("active");
    }
  }
}

function clearAllErrors() {
  const errors = document.querySelectorAll(".form-error");
  errors.forEach((el) => {
    el.textContent = "";
    el.classList.remove("active");
  });
  hideToast();
}

// -------------------------------------------------------------
// Index Page Logic (Services List)
// -------------------------------------------------------------
async function initIndexPage() {
  const container = document.getElementById("services-container");
  if (!container) return;

  container.innerHTML = `<div class="loading-state">Loading active repair services...</div>`;

  try {
    const response = await fetch("/api/services");
    if (!response.ok) {
      throw new Error("Failed to fetch services.");
    }
    const services = await response.json();

    if (!services || services.length === 0) {
      container.innerHTML = `<div class="empty-state">No active services currently available.</div>`;
      return;
    }

    container.className = "services-grid";
    container.innerHTML = services.map((service) => `
      <div class="card">
        <div>
          <h3 class="card-title">${escapeHtml(service.name)}</h3>
          <p class="card-desc">${escapeHtml(service.description)}</p>
        </div>
        <div class="card-footer">
          <span class="card-price">${formatPeso(service.price)}</span>
          <a href="/book.html?service_id=${service.id}" class="btn btn-primary">Book Now</a>
        </div>
      </div>
    `).join("");
  } catch (err) {
    container.innerHTML = `<div class="empty-state">Error loading services. Please try again later.</div>`;
    showToast(err.message, "error");
  }
}

// -------------------------------------------------------------
// Book Page Logic
// -------------------------------------------------------------
function generateTimeSlots() {
  const slots = [];
  let start = 7 * 60; // 07:00 AM in minutes
  const end = 17 * 60; // 05:00 PM in minutes

  while (start <= end) {
    const hours = Math.floor(start / 60);
    const mins = start % 60;
    const timeValue = `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
    const displayLabel = formatTime(timeValue);
    slots.push({ value: timeValue, label: displayLabel });
    start += 30;
  }
  return slots;
}

async function initBookPage() {
  const form = document.getElementById("booking-form");
  if (!form) return;

  const urlParams = new URLSearchParams(window.location.search);
  const preselectedServiceId = urlParams.get("service_id");

  // Load Services Dropdown
  const serviceSelect = document.getElementById("service_id");
  try {
    const response = await fetch("/api/services");
    if (response.ok) {
      const services = await response.json();
      serviceSelect.innerHTML = `<option value="">-- Select a Service --</option>` +
        services.map((s) => `<option value="${s.id}">${escapeHtml(s.name)} (${formatPeso(s.price)})</option>`).join("");
      
      if (preselectedServiceId) {
        serviceSelect.value = preselectedServiceId;
      }
    }
  } catch (err) {
    showToast("Unable to load services into dropdown.", "error");
  }

  // Populate Time Slot Buttons
  const timeSlotContainer = document.getElementById("time-slots-container");
  const hiddenTimeInput = document.getElementById("booking_time");
  const slots = generateTimeSlots();

  timeSlotContainer.innerHTML = slots.map((slot) => `
    <button type="button" class="time-slot-btn" data-time="${slot.value}">
      ${slot.label}
    </button>
  `).join("");

  timeSlotContainer.addEventListener("click", (e) => {
    if (e.target.classList.contains("time-slot-btn")) {
      document.querySelectorAll(".time-slot-btn").forEach((btn) => btn.classList.remove("selected"));
      e.target.classList.add("selected");
      hiddenTimeInput.value = e.target.getAttribute("data-time");
      setFieldError("booking_time", "");
    }
  });

  // Set min attribute on date picker to today
  const dateInput = document.getElementById("booking_date");
  if (dateInput) {
    const today = new Date().toISOString().split("T")[0];
    dateInput.setAttribute("min", today);
  }

  // Form Submission Logic
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearAllErrors();

    const service_id = serviceSelect.value;
    const booking_date = dateInput.value;
    const booking_time = hiddenTimeInput.value;
    const guests = document.getElementById("guests").value;
    const name = document.getElementById("name").value.trim();
    const contact = document.getElementById("contact").value.trim();
    const email = document.getElementById("email").value.trim();
    const notes = document.getElementById("notes").value.trim();

    let hasError = false;

    if (!service_id) {
      setFieldError("service_id", "Please select a service.");
      hasError = true;
    }
    if (!booking_date) {
      setFieldError("booking_date", "Please select a booking date.");
      hasError = true;
    } else {
      const todayStr = new Date().toISOString().split("T")[0];
      if (booking_date < todayStr) {
        setFieldError("booking_date", "Booking date cannot be in the past.");
        hasError = true;
      }
    }
    if (!booking_time) {
      setFieldError("booking_time", "Please select a time slot.");
      hasError = true;
    }
    if (!guests || parseInt(guests, 10) < 1) {
      setFieldError("guests", "Number of guests must be at least 1.");
      hasError = true;
    }
    if (!name) {
      setFieldError("name", "Please enter your name.");
      hasError = true;
    }
    if (!contact) {
      setFieldError("contact", "Please enter your contact number.");
      hasError = true;
    }
    if (!email) {
      setFieldError("email", "Please enter your email address.");
      hasError = true;
    } else if (!email.includes("@")) {
      setFieldError("email", "Please enter a valid email address.");
      hasError = true;
    }

    if (hasError) return;

    const submitBtn = document.getElementById("submit-btn");
    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting Booking...";

    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_id,
          booking_date,
          booking_time,
          guests: parseInt(guests, 10),
          name,
          contact,
          email,
          notes
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to process booking.");
      }

      window.location.href = `/confirmation.html?ref=${data.reference}`;
    } catch (err) {
      showToast(err.message, "error");
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit Booking";
    }
  });
}

// -------------------------------------------------------------
// Confirmation Page Logic
// -------------------------------------------------------------
async function initConfirmationPage() {
  const container = document.getElementById("confirmation-container");
  if (!container) return;

  const urlParams = new URLSearchParams(window.location.search);
  const ref = urlParams.get("ref");

  if (!ref) {
    container.innerHTML = `<div class="empty-state">No reference code provided.</div>`;
    return;
  }

  try {
    const response = await fetch(`/api/bookings/${ref}`);
    if (!response.ok) {
      throw new Error("Booking not found.");
    }
    const booking = await response.json();

    container.innerHTML = `
      <div class="confirmation-card">
        <h2 class="page-title">Booking Submitted!</h2>
        <p class="page-subtitle">Save your reference number to track your appointment status.</p>
        
        <div class="reference-box">
          <div class="reference-number" id="ref-display">${escapeHtml(booking.reference)}</div>
          <button class="btn btn-secondary" id="copy-btn">Copy Reference Code</button>
        </div>

        <div class="detail-list">
          <div class="detail-item">
            <span class="detail-label">Service</span>
            <span class="detail-value">${escapeHtml(booking.service_name || "N/A")}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Date & Time</span>
            <span class="detail-value">${formatDate(booking.booking_date)} at ${formatTime(booking.booking_time)}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Name</span>
            <span class="detail-value">${escapeHtml(booking.name)}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Status</span>
            <span class="detail-value"><span class="status-badge status-${booking.status}">${booking.status}</span></span>
          </div>
        </div>

        <div style="margin-top: 1.5rem;">
          <a href="/index.html" class="btn btn-primary">Return to Homepage</a>
        </div>
      </div>
    `;

    document.getElementById("copy-btn").addEventListener("click", () => {
      navigator.clipboard.writeText(booking.reference).then(() => {
        showToast("Reference code copied to clipboard!", "success");
      }).catch(() => {
        showToast("Failed to copy code automatically.", "error");
      });
    });
  } catch (err) {
    container.innerHTML = `<div class="empty-state">Failed to retrieve booking information.</div>`;
    showToast(err.message, "error");
  }
}

// -------------------------------------------------------------
// Status Lookup Page Logic
// -------------------------------------------------------------
function initStatusPage() {
  const form = document.getElementById("status-form");
  const resultContainer = document.getElementById("status-result");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearAllErrors();
    
    const refInput = document.getElementById("reference");
    const refValue = refInput.value.trim();

    if (!refValue) {
      setFieldError("reference", "Please enter a reference code.");
      return;
    }

    const submitBtn = document.getElementById("search-btn");
    submitBtn.disabled = true;
    submitBtn.textContent = "Searching...";
    resultContainer.innerHTML = "";

    try {
      const response = await fetch(`/api/bookings/${refValue}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Booking not found.");
      }

      resultContainer.innerHTML = `
        <div class="card" style="margin-top: 1.5rem;">
          <h3 style="margin-bottom: 1rem;">Booking Details</h3>
          <div class="detail-list">
            <div class="detail-item">
              <span class="detail-label">Reference</span>
              <span class="detail-value">${escapeHtml(data.reference)}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Service</span>
              <span class="detail-value">${escapeHtml(data.service_name || "N/A")}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Status</span>
              <span class="detail-value"><span class="status-badge status-${data.status}">${data.status}</span></span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Date & Time</span>
              <span class="detail-value">${formatDate(data.booking_date)} at ${formatTime(data.booking_time)}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Name</span>
              <span class="detail-value">${escapeHtml(data.name)}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Contact</span>
              <span class="detail-value">${escapeHtml(data.contact)}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Email</span>
              <span class="detail-value">${escapeHtml(data.email)}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Guests</span>
              <span class="detail-value">${data.guests}</span>
            </div>
            ${data.notes ? `
            <div class="detail-item">
              <span class="detail-label">Notes</span>
              <span class="detail-value">${escapeHtml(data.notes)}</span>
            </div>` : ""}
          </div>
        </div>
      `;
    } catch (err) {
      showToast(err.message, "error");
      resultContainer.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Check Status";
    }
  });
}

// Utility: Escape HTML String
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Routing Execution
document.addEventListener("DOMContentLoaded", () => {
  initIndexPage();
  initBookPage();
  initConfirmationPage();
  initStatusPage();
});