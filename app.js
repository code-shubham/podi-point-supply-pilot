const STORAGE_KEY = "supplyPilotDataV1";
const DAY_MS = 24 * 60 * 60 * 1000;

const state = {
  products: [],
  events: [],
};

const els = {
  productForm: document.getElementById("product-form"),
  productName: document.getElementById("product-name"),
  productExpiry: document.getElementById("product-expiry"),
  productRows: document.getElementById("product-rows"),
  eventForm: document.getElementById("event-form"),
  eventProduct: document.getElementById("event-product"),
  eventType: document.getElementById("event-type"),
  eventQty: document.getElementById("event-qty"),
  eventAt: document.getElementById("event-at"),
  eventExpiry: document.getElementById("event-expiry"),
  supplyExpiryWrap: document.getElementById("supply-expiry-wrap"),
  eventRows: document.getElementById("event-rows"),
  plannerWrap: document.getElementById("planner-wrap"),
  alerts: document.getElementById("alerts"),
  inventoryCards: document.getElementById("inventory-cards"),
  resetBtn: document.getElementById("reset-btn"),
  exportBtn: document.getElementById("export-btn"),
  importInput: document.getElementById("import-input"),
};

init();

function init() {
  loadState();
  ensureSeedData();
  setDefaultDateTime();
  bindEvents();
  renderAll();
}

function bindEvents() {
  els.productForm.addEventListener("submit", onAddProduct);
  els.eventForm.addEventListener("submit", onAddEvent);

  els.eventType.addEventListener("change", () => {
    toggleExpiryInput();
  });

  els.eventProduct.addEventListener("change", () => {
    syncEventExpiryToProductDefault();
  });

  els.productRows.addEventListener("click", onProductRowClick);
  els.eventRows.addEventListener("click", onEventRowClick);

  els.resetBtn.addEventListener("click", () => {
    const ok = confirm("Delete all products and movements?");
    if (!ok) return;
    state.products = [];
    state.events = [];
    saveState();
    renderAll();
  });

  els.exportBtn.addEventListener("click", exportData);
  els.importInput.addEventListener("change", importData);
}

function onAddProduct(e) {
  e.preventDefault();
  const name = els.productName.value.trim();
  const expiry = Number(els.productExpiry.value);

  if (!name) {
    alert("Please enter a product name.");
    return;
  }

  if (!isFinite(expiry) || expiry <= 0) {
    alert("Expiry must be greater than 0.");
    return;
  }

  state.products.push({
    id: uid(),
    name,
    defaultExpiryHours: expiry,
  });

  saveState();
  els.productForm.reset();
  renderAll();
}

function onAddEvent(e) {
  e.preventDefault();

  if (!state.products.length) {
    alert("Add at least one product first.");
    return;
  }

  const productId = els.eventProduct.value;
  const type = els.eventType.value;
  const qty = Number(els.eventQty.value);
  const atRaw = els.eventAt.value;

  if (!productId || !["supply", "demand"].includes(type)) {
    alert("Please select a valid product and type.");
    return;
  }

  if (!isFinite(qty) || qty <= 0) {
    alert("Quantity must be greater than 0.");
    return;
  }

  if (!atRaw) {
    alert("Please select date and time.");
    return;
  }

  const at = new Date(atRaw).toISOString();
  let expiryHours = null;

  if (type === "supply") {
    expiryHours = Number(els.eventExpiry.value);
    if (!isFinite(expiryHours) || expiryHours <= 0) {
      const product = state.products.find((p) => p.id === productId);
      expiryHours = product ? product.defaultExpiryHours : null;
    }
  }

  state.events.push({
    id: uid(),
    productId,
    type,
    qty,
    at,
    expiryHours,
  });

  saveState();
  els.eventForm.reset();
  setDefaultDateTime();
  toggleExpiryInput();
  syncEventExpiryToProductDefault();
  renderAll();
}

function onProductRowClick(e) {
  const btn = e.target.closest("button");
  if (!btn) return;

  const row = btn.closest("tr");
  const productId = row ? row.dataset.id : null;
  if (!productId) return;

  if (btn.dataset.action === "save") {
    const nameInput = row.querySelector(".js-name");
    const expiryInput = row.querySelector(".js-expiry");
    const name = nameInput.value.trim();
    const expiry = Number(expiryInput.value);

    if (!name) {
      alert("Product name cannot be empty.");
      return;
    }

    if (!isFinite(expiry) || expiry <= 0) {
      alert("Expiry must be greater than 0.");
      return;
    }

    const product = state.products.find((p) => p.id === productId);
    if (!product) return;

    product.name = name;
    product.defaultExpiryHours = expiry;
    saveState();
    renderAll();
    return;
  }

  if (btn.dataset.action === "delete") {
    const product = state.products.find((p) => p.id === productId);
    const label = product ? product.name : "this product";
    const ok = confirm("Delete " + label + " and all related entries?");
    if (!ok) return;

    state.products = state.products.filter((p) => p.id !== productId);
    state.events = state.events.filter((ev) => ev.productId !== productId);
    saveState();
    renderAll();
  }
}

function onEventRowClick(e) {
  const btn = e.target.closest("button");
  if (!btn || btn.dataset.action !== "delete") return;

  const row = btn.closest("tr");
  const eventId = row ? row.dataset.id : null;
  if (!eventId) return;

  const ok = confirm("Delete this movement entry?");
  if (!ok) return;

  state.events = state.events.filter((ev) => ev.id !== eventId);
  saveState();
  renderAll();
}

function renderAll() {
  renderProductSelect();
  renderProductsTable();
  renderEventsTable();
  renderInventoryCards();
  renderAlerts();
  renderPlanner();
  toggleExpiryInput();
  syncEventExpiryToProductDefault();
}

function renderProductSelect() {
  if (!state.products.length) {
    els.eventProduct.innerHTML =
      "<option value=''>Add a product first</option>";
    return;
  }

  const html = state.products
    .map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`)
    .join("");
  els.eventProduct.innerHTML = html;
}

function renderProductsTable() {
  if (!state.products.length) {
    els.productRows.innerHTML =
      "<tr><td colspan='3'>No products yet.</td></tr>";
    return;
  }

  els.productRows.innerHTML = state.products
    .map(
      (p) => `
      <tr data-id="${p.id}">
        <td><input class="inline-input js-name" value="${escapeHtml(p.name)}" /></td>
        <td><input class="inline-input js-expiry" type="number" min="0.1" step="0.1" value="${p.defaultExpiryHours}" /></td>
        <td>
          <div class="row-actions">
            <button class="btn secondary" data-action="save">Save</button>
            <button class="btn danger" data-action="delete">Delete</button>
          </div>
        </td>
      </tr>
    `,
    )
    .join("");
}

function renderEventsTable() {
  const productNameMap = new Map(state.products.map((p) => [p.id, p.name]));
  const items = [...state.events]
    .sort((a, b) => toMs(b.at) - toMs(a.at))
    .slice(0, 80);

  if (!items.length) {
    els.eventRows.innerHTML =
      "<tr><td colspan='6'>No movements logged yet.</td></tr>";
    return;
  }

  els.eventRows.innerHTML = items
    .map((ev) => {
      const tagClass = ev.type === "supply" ? "supply" : "demand";
      const expiryDisplay =
        ev.type === "supply" ? formatNum(ev.expiryHours || 0) : "-";
      return `
        <tr data-id="${ev.id}">
          <td>${formatDateTime(ev.at)}</td>
          <td>${escapeHtml(productNameMap.get(ev.productId) || "Unknown")}</td>
          <td><span class="tag ${tagClass}">${ev.type}</span></td>
          <td>${formatNum(ev.qty)}</td>
          <td>${expiryDisplay}</td>
          <td><button class="btn danger" data-action="delete">Delete</button></td>
        </tr>
      `;
    })
    .join("");
}

function renderInventoryCards() {
  if (!state.products.length) {
    els.inventoryCards.innerHTML =
      "<div class='card'>Add products to view live inventory.</div>";
    return;
  }

  const now = Date.now();

  els.inventoryCards.innerHTML = state.products
    .map((product) => {
      const snapshot = simulateUntil(product.id, now);
      const soonCount = snapshot.batches.filter(
        (b) =>
          b.remaining > 0 &&
          b.expiresAt > now &&
          b.expiresAt - now <= 6 * 60 * 60 * 1000,
      ).length;
      return `
        <article class="card">
          <h3>${escapeHtml(product.name)}</h3>
          <div class="metric">${formatNum(snapshot.totalInventory)}</div>
          <div class="helper">Current closing inventory</div>
          <div class="helper">Expiring in 6h: ${soonCount} batch(es)</div>
        </article>
      `;
    })
    .join("");
}

function renderAlerts() {
  if (!state.products.length) {
    els.alerts.innerHTML = "<div class='alert ok'>No products yet.</div>";
    return;
  }

  const now = Date.now();
  const alerts = [];

  for (const product of state.products) {
    const snapshot = simulateUntil(product.id, now);

    for (const batch of snapshot.batches) {
      if (batch.remaining <= 0 || batch.expiresAt <= now) continue;
      const hoursLeft = (batch.expiresAt - now) / (60 * 60 * 1000);

      if (hoursLeft <= 24) {
        alerts.push({
          sort: hoursLeft,
          text:
            formatNum(batch.remaining) +
            " of " +
            product.name +
            " expiring in " +
            formatNum(hoursLeft) +
            " hour(s)",
        });
      }
    }
  }

  alerts.sort((a, b) => a.sort - b.sort);

  if (!alerts.length) {
    els.alerts.innerHTML =
      "<div class='alert ok'>No inventory expiring in the next 24 hours.</div>";
    return;
  }

  els.alerts.innerHTML = alerts
    .map((a) => `<div class="alert">${escapeHtml(a.text)}</div>`)
    .join("");
}

function renderPlanner() {
  if (!state.products.length) {
    els.plannerWrap.innerHTML = "Add products to start the monthly planner.";
    return;
  }

  const start = startOfDay(Date.now());
  const days = 30;
  const rowsByProduct = new Map();

  for (const product of state.products) {
    rowsByProduct.set(product.id, computeDailyRows(product.id, start, days));
  }

  let html = "<table><thead><tr><th rowspan='2'>Date</th>";

  for (const product of state.products) {
    html += `<th class="planner-subhead" colspan="4">${escapeHtml(product.name)}</th>`;
  }

  html += "</tr><tr>";

  for (let i = 0; i < state.products.length; i += 1) {
    html += "<th>O</th><th>S</th><th>D</th><th>C</th>";
  }

  html += "</tr></thead><tbody>";

  for (let dayIdx = 0; dayIdx < days; dayIdx += 1) {
    const dayStamp = start + dayIdx * DAY_MS;
    html += `<tr><td>${formatDate(dayStamp)}</td>`;

    for (const product of state.products) {
      const row = rowsByProduct.get(product.id)[dayIdx];
      html += `<td class="center">${formatNum(row.opening)}</td>`;
      html += `<td class="center">${formatNum(row.supply)}</td>`;
      html += `<td class="center">${formatNum(row.demand)}</td>`;
      html += `<td class="center">${formatNum(row.closing)}</td>`;
    }

    html += "</tr>";
  }

  html += "</tbody></table>";
  els.plannerWrap.innerHTML = html;
}

function computeDailyRows(productId, startTs, days) {
  const rows = [];
  const events = state.events
    .filter((ev) => ev.productId === productId)
    .slice()
    .sort((a, b) => toMs(a.at) - toMs(b.at));

  let idx = 0;
  let batches = [];

  while (idx < events.length && toMs(events[idx].at) < startTs) {
    const eventTs = toMs(events[idx].at);
    batches = dropExpiredBatches(batches, eventTs).batches;
    batches = applyEventToBatches(batches, events[idx], eventTs);
    idx += 1;
  }

  for (let day = 0; day < days; day += 1) {
    const dayStart = startTs + day * DAY_MS;
    const dayEnd = dayStart + DAY_MS;

    let result = dropExpiredBatches(batches, dayStart);
    batches = result.batches;

    const opening = sumBatches(batches);
    let supply = 0;
    let demand = 0;

    while (idx < events.length) {
      const eventTs = toMs(events[idx].at);
      if (eventTs < dayStart || eventTs >= dayEnd) break;

      result = dropExpiredBatches(batches, eventTs);
      batches = result.batches;

      const ev = events[idx];
      if (ev.type === "supply") {
        supply += ev.qty;
      } else {
        demand += ev.qty;
      }

      batches = applyEventToBatches(batches, ev, eventTs);
      idx += 1;
    }

    batches = dropExpiredBatches(batches, dayEnd).batches;
    const closing = sumBatches(batches);

    rows.push({
      opening,
      supply,
      demand,
      closing,
    });
  }

  return rows;
}

function simulateUntil(productId, untilTs) {
  const events = state.events
    .filter((ev) => ev.productId === productId)
    .slice()
    .sort((a, b) => toMs(a.at) - toMs(b.at));

  let batches = [];

  for (const ev of events) {
    const eventTs = toMs(ev.at);
    if (eventTs > untilTs) break;
    batches = dropExpiredBatches(batches, eventTs).batches;
    batches = applyEventToBatches(batches, ev, eventTs);
  }

  batches = dropExpiredBatches(batches, untilTs).batches;

  return {
    batches,
    totalInventory: sumBatches(batches),
  };
}

function applyEventToBatches(batches, ev, eventTs) {
  if (ev.type === "supply") {
    const expiryHours = Number(ev.expiryHours);
    if (!isFinite(expiryHours) || expiryHours <= 0) return batches;

    return [
      ...batches,
      {
        id: ev.id,
        remaining: ev.qty,
        receivedAt: eventTs,
        expiresAt: eventTs + expiryHours * 60 * 60 * 1000,
      },
    ];
  }

  if (ev.type === "demand") {
    return consumeFifo(batches, ev.qty);
  }

  return batches;
}

function consumeFifo(batches, qty) {
  let needed = qty;
  const out = [];

  for (const batch of batches) {
    if (needed <= 0) {
      out.push(batch);
      continue;
    }

    const take = Math.min(batch.remaining, needed);
    const left = batch.remaining - take;
    needed -= take;

    if (left > 0) {
      out.push({ ...batch, remaining: left });
    }
  }

  return out;
}

function dropExpiredBatches(batches, atTs) {
  const kept = [];
  let expiredQty = 0;

  for (const batch of batches) {
    if (batch.expiresAt <= atTs) {
      expiredQty += batch.remaining;
      continue;
    }
    kept.push(batch);
  }

  return { batches: kept, expiredQty };
}

function sumBatches(batches) {
  return batches.reduce((sum, b) => sum + b.remaining, 0);
}

function toggleExpiryInput() {
  const isSupply = els.eventType.value === "supply";
  els.supplyExpiryWrap.style.display = isSupply ? "grid" : "none";
}

function syncEventExpiryToProductDefault() {
  if (els.eventType.value !== "supply") return;
  const product = state.products.find((p) => p.id === els.eventProduct.value);
  if (!product) return;
  if (!els.eventExpiry.value) {
    els.eventExpiry.value = String(product.defaultExpiryHours);
  }
}

function setDefaultDateTime() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
  els.eventAt.value = local;
}

function exportData() {
  const payload = {
    exportedAt: new Date().toISOString(),
    data: state,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "supply-pilot-data.json";
  a.click();
  URL.revokeObjectURL(url);
}

function importData(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result || "{}"));
      const incoming = parsed.data || parsed;

      if (
        !incoming ||
        !Array.isArray(incoming.products) ||
        !Array.isArray(incoming.events)
      ) {
        throw new Error("Invalid format");
      }

      state.products = incoming.products;
      state.events = incoming.events;
      saveState();
      renderAll();
      alert("Data imported.");
    } catch (_err) {
      alert("Could not import file. Please use a valid export JSON.");
    }
  };

  reader.readAsText(file);
  e.target.value = "";
}

function ensureSeedData() {
  if (state.products.length || state.events.length) return;

  const seeds = [
    { name: "Milk", defaultExpiryHours: 24 },
    { name: "Batter", defaultExpiryHours: 14 },
    { name: "Green Chutney", defaultExpiryHours: 10 },
    { name: "Red Chutney", defaultExpiryHours: 12 },
    { name: "Sambhar Masala", defaultExpiryHours: 720 },
  ];

  state.products = seeds.map((p) => ({ ...p, id: uid() }));
  saveState();
}

function uid() {
  if (window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  return (
    "id-" + Math.random().toString(16).slice(2) + "-" + Date.now().toString(16)
  );
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      Array.isArray(parsed.products) &&
      Array.isArray(parsed.events)
    ) {
      state.products = parsed.products;
      state.events = parsed.events;
    }
  } catch (_err) {
    state.products = [];
    state.events = [];
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function formatDate(isoOrTs) {
  const d = new Date(isoOrTs);
  return d.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(isoOrTs) {
  const d = new Date(isoOrTs);
  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatNum(value) {
  const n = Number(value);
  if (!isFinite(n)) return "0";
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function toMs(iso) {
  return new Date(iso).getTime();
}

function startOfDay(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
