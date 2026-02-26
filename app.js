// Private Period Tracker
// This app stores everything in localStorage on this device only.

const STORAGE_KEY = 'periodTrackerEntriesV1';

const form = document.getElementById('period-form');
const startDateInput = document.getElementById('start-date');
const endDateInput = document.getElementById('end-date');
const notesInput = document.getElementById('notes');
const formMessage = document.getElementById('form-message');
const dataMessage = document.getElementById('data-message');
const historyList = document.getElementById('history-list');
const avgCycle = document.getElementById('avg-cycle');
const nextPeriod = document.getElementById('next-period');
const exportBtn = document.getElementById('export-btn');
const importFileInput = document.getElementById('import-file');
const deleteBtn = document.getElementById('delete-btn');
const calendarGrid = document.getElementById('calendar-grid');
const calendarTitle = document.getElementById('calendar-title');
const prevMonthBtn = document.getElementById('prev-month');
const nextMonthBtn = document.getElementById('next-month');

let entries = loadEntries();
let currentMonthDate = new Date();
currentMonthDate.setDate(1);

renderAll();
registerServiceWorker();

form.addEventListener('submit', (event) => {
  event.preventDefault();
  clearMessage(formMessage);

  const startDate = startDateInput.value;
  const endDate = endDateInput.value;
  const notes = notesInput.value.trim();

  if (!startDate || !endDate) {
    showMessage(formMessage, 'Please select both start and end dates.', true);
    return;
  }

  if (new Date(endDate) < new Date(startDate)) {
    showMessage(formMessage, 'End date cannot be before start date.', true);
    return;
  }

  const newEntry = {
    id: crypto.randomUUID(),
    startDate,
    endDate,
    notes,
    createdAt: new Date().toISOString()
  };

  entries.push(newEntry);
  entries.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
  saveEntries();
  renderAll();

  form.reset();
  showMessage(formMessage, 'Entry saved.', false);
});

exportBtn.addEventListener('click', exportData);
importFileInput.addEventListener('change', importData);

deleteBtn.addEventListener('click', () => {
  clearMessage(dataMessage);
  const confirmed = window.confirm('Delete all period data from this device? This cannot be undone.');
  if (!confirmed) {
    return;
  }

  entries = [];
  saveEntries();
  renderAll();
  showMessage(dataMessage, 'All data deleted.', false);
});

prevMonthBtn.addEventListener('click', () => {
  currentMonthDate.setMonth(currentMonthDate.getMonth() - 1);
  renderCalendar();
});

nextMonthBtn.addEventListener('click', () => {
  currentMonthDate.setMonth(currentMonthDate.getMonth() + 1);
  renderCalendar();
});

function renderAll() {
  renderHistory();
  renderSummary();
  renderCalendar();
}

function renderHistory() {
  historyList.innerHTML = '';

  if (entries.length === 0) {
    historyList.innerHTML = '<li>No entries yet.</li>';
    return;
  }

  // Show newest first in history.
  [...entries]
    .sort((a, b) => new Date(b.startDate) - new Date(a.startDate))
    .forEach((entry) => {
      const item = document.createElement('li');
      item.className = 'history-item';
      item.innerHTML = `
        <p><strong>${formatDate(entry.startDate)}</strong> to <strong>${formatDate(entry.endDate)}</strong></p>
        <p>${entry.notes ? escapeHtml(entry.notes) : '<em>No notes</em>'}</p>
      `;
      historyList.appendChild(item);
    });
}

function renderSummary() {
  const cycleLengths = getCycleLengths();

  if (cycleLengths.length === 0) {
    avgCycle.textContent = 'Not enough data';
    nextPeriod.textContent = 'Not enough data';
    return;
  }

  const average = Math.round(cycleLengths.reduce((sum, value) => sum + value, 0) / cycleLengths.length);
  avgCycle.textContent = `${average} days`;

  const lastEntry = entries[entries.length - 1];
  const estimatedNext = new Date(lastEntry.startDate);
  estimatedNext.setDate(estimatedNext.getDate() + average);
  nextPeriod.textContent = formatDate(estimatedNext.toISOString().slice(0, 10));
}

function renderCalendar() {
  calendarGrid.innerHTML = '';
  calendarTitle.textContent = currentMonthDate.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric'
  });

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  dayNames.forEach((day) => {
    const dayHeader = document.createElement('div');
    dayHeader.className = 'day-name';
    dayHeader.textContent = day;
    calendarGrid.appendChild(dayHeader);
  });

  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let i = 0; i < firstDay.getDay(); i += 1) {
    const spacer = document.createElement('div');
    calendarGrid.appendChild(spacer);
  }

  const periodDays = new Set(getAllPeriodDays());

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day);
    const dateKey = toDateKey(date);

    const cell = document.createElement('div');
    cell.className = 'day-cell';
    cell.textContent = String(day);

    if (periodDays.has(dateKey)) {
      cell.classList.add('period-day');
    }

    if (isSameDate(date, new Date())) {
      cell.classList.add('today');
    }

    calendarGrid.appendChild(cell);
  }
}

function getAllPeriodDays() {
  const days = [];

  entries.forEach((entry) => {
    let cursor = new Date(entry.startDate);
    const end = new Date(entry.endDate);

    while (cursor <= end) {
      days.push(toDateKey(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
  });

  return days;
}

function getCycleLengths() {
  if (entries.length < 2) {
    return [];
  }

  const lengths = [];

  for (let i = 1; i < entries.length; i += 1) {
    const prevStart = new Date(entries[i - 1].startDate);
    const currentStart = new Date(entries[i].startDate);

    const diffDays = Math.round((currentStart - prevStart) / (1000 * 60 * 60 * 24));
    if (diffDays > 0) {
      lengths.push(diffDays);
    }
  }

  return lengths;
}

function exportData() {
  if (entries.length === 0) {
    showMessage(dataMessage, 'No data to export yet.', true);
    return;
  }

  const data = {
    exportedAt: new Date().toISOString(),
    entries
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'period-tracker-backup.json';
  link.click();
  URL.revokeObjectURL(url);

  showMessage(dataMessage, 'Data exported as JSON.', false);
}

function importData(event) {
  const file = event.target.files[0];
  if (!file) {
    return;
  }

  const reader = new FileReader();

  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!parsed.entries || !Array.isArray(parsed.entries)) {
        throw new Error('File format is invalid.');
      }

      const sanitized = parsed.entries.map((entry) => {
        if (!entry.startDate || !entry.endDate) {
          throw new Error('Some entries are missing dates.');
        }

        if (new Date(entry.endDate) < new Date(entry.startDate)) {
          throw new Error('Some entries have end date before start date.');
        }

        return {
          id: entry.id || crypto.randomUUID(),
          startDate: entry.startDate,
          endDate: entry.endDate,
          notes: typeof entry.notes === 'string' ? entry.notes : '',
          createdAt: entry.createdAt || new Date().toISOString()
        };
      });

      entries = sanitized.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
      saveEntries();
      renderAll();
      showMessage(dataMessage, 'Data imported successfully.', false);
    } catch (error) {
      showMessage(dataMessage, error.message || 'Could not import JSON file.', true);
    } finally {
      importFileInput.value = '';
    }
  };

  reader.readAsText(file);
}

function loadEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveEntries() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function toDateKey(date) {
  return date.toISOString().slice(0, 10);
}

function isSameDate(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function escapeHtml(text) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function showMessage(target, text, isError) {
  target.textContent = text;
  target.classList.toggle('error', isError);
  target.classList.toggle('success', !isError);
}

function clearMessage(target) {
  target.textContent = '';
  target.classList.remove('error', 'success');
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js').catch(() => {
        // Service worker errors are not fatal for app usage.
      });
    });
  }
}
