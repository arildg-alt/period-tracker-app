// Private Period Tracker
// Local-only storage, no accounts, works offline.

const STORAGE_KEY = 'periodTrackerEntriesV1';
const DEFAULT_CYCLE_LENGTH = 28;
const DEFAULT_PERIOD_LENGTH = 5;
const APP_BUILD_VERSION = '2';

const formMessage = document.getElementById('form-message');
const dataMessage = document.getElementById('data-message');
const historyList = document.getElementById('history-list');
const avgCycle = document.getElementById('avg-cycle');
const avgPeriod = document.getElementById('avg-period');
const nextPeriod = document.getElementById('next-period');
const predictionConfidence = document.getElementById('prediction-confidence');
const irregularWarning = document.getElementById('irregular-warning');
const predictionWindow = document.getElementById('prediction-window');
const ovulationDate = document.getElementById('ovulation-date');
const fertileWindow = document.getElementById('fertile-window');
const onboardingMessage = document.getElementById('onboarding-message');
const exportBtn = document.getElementById('export-btn');
const importFileInput = document.getElementById('import-file');
const deleteBtn = document.getElementById('delete-btn');
const calendarGrid = document.getElementById('calendar-grid');
const calendarTitle = document.getElementById('calendar-title');
const prevMonthBtn = document.getElementById('prev-month');
const nextMonthBtn = document.getElementById('next-month');
const selectedDateText = document.getElementById('selected-date-text');
const setStartBtn = document.getElementById('set-start-btn');
const setEndBtn = document.getElementById('set-end-btn');
const saveRangeBtn = document.getElementById('save-range-btn');
const cancelRangeBtn = document.getElementById('cancel-range-btn');
const rangePreview = document.getElementById('range-preview');

let entries = loadEntries();
let currentMonthDate = new Date();
let selectedDateKey = '';
let draftStartDate = '';
let draftEndDate = '';
currentMonthDate.setDate(1);

renderAll();
showBuildVersion();
registerServiceWorker();

exportBtn.addEventListener('click', exportData);
importFileInput.addEventListener('change', importData);

deleteBtn.addEventListener('click', () => {
  clearMessage(dataMessage);
  const confirmed = window.confirm('Delete all period data from this device? This cannot be undone.');
  if (!confirmed) {
    return;
  }

  entries = [];
  resetDraftSelection();
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

setStartBtn.addEventListener('click', () => {
  clearMessage(formMessage);
  if (!selectedDateKey) {
    showMessage(formMessage, 'Tap a date first.', true);
    return;
  }

  draftStartDate = selectedDateKey;
  if (draftEndDate && new Date(draftEndDate) < new Date(draftStartDate)) {
    draftEndDate = '';
  }

  renderDraftSelection();
});

setEndBtn.addEventListener('click', () => {
  clearMessage(formMessage);
  if (!selectedDateKey) {
    showMessage(formMessage, 'Tap a date first.', true);
    return;
  }

  if (!draftStartDate) {
    showMessage(formMessage, 'Set a period start date first.', true);
    return;
  }

  if (new Date(selectedDateKey) < new Date(draftStartDate)) {
    showMessage(formMessage, 'End date cannot be before start date.', true);
    return;
  }

  draftEndDate = selectedDateKey;
  renderDraftSelection();
});

saveRangeBtn.addEventListener('click', () => {
  clearMessage(formMessage);

  if (!draftStartDate || !draftEndDate) {
    showMessage(formMessage, 'Choose both a start and end date.', true);
    return;
  }

  const existingIndex = entries.findIndex((entry) => entry.startDate === draftStartDate);
  const entryToSave = {
    id: existingIndex >= 0 ? entries[existingIndex].id : crypto.randomUUID(),
    startDate: draftStartDate,
    endDate: draftEndDate,
    notes: '',
    createdAt: existingIndex >= 0 ? entries[existingIndex].createdAt : new Date().toISOString()
  };

  if (existingIndex >= 0) {
    entries[existingIndex] = entryToSave;
  } else {
    entries.push(entryToSave);
  }

  entries.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
  saveEntries();
  resetDraftSelection();
  renderAll();
  showMessage(formMessage, 'Period range saved.', false);
});

cancelRangeBtn.addEventListener('click', () => {
  resetDraftSelection();
  renderDraftSelection();
  renderCalendar();
  showMessage(formMessage, 'Selection cleared.', false);
});

function showBuildVersion() {
  const appVersion = document.getElementById('app-version');
  if (appVersion) {
    appVersion.textContent = `v${APP_BUILD_VERSION}`;
  }
}

function renderAll() {
  renderHistory();
  renderSummary();
  renderDraftSelection();
  renderCalendar();
}

function renderHistory() {
  historyList.innerHTML = '';

  if (entries.length === 0) {
    historyList.innerHTML = '<li>No logged periods yet.</li>';
    return;
  }

  [...entries]
    .sort((a, b) => new Date(b.startDate) - new Date(a.startDate))
    .forEach((entry) => {
      const item = document.createElement('li');
      item.className = 'history-item';
      item.innerHTML = `<p><strong>${formatDate(entry.startDate)}</strong> to <strong>${formatDate(
        entry.endDate
      )}</strong></p>`;
      historyList.appendChild(item);
    });
}

function renderSummary() {
  const metrics = calculatePredictionMetrics();

  avgCycle.textContent = `${metrics.averageCycleLength} days${metrics.usingDefaults ? ' (general estimate)' : ''}`;
  avgPeriod.textContent = `${metrics.averagePeriodLength} days${metrics.usingDefaults ? ' (general estimate)' : ''}`;
  nextPeriod.textContent = `${formatDate(metrics.predictedNextPeriod)}${metrics.usingDefaults ? ' (general estimate)' : ''}`;
  predictionConfidence.textContent = metrics.confidenceText;

  irregularWarning.textContent = metrics.irregularMessage;
  predictionWindow.textContent = `${formatDate(metrics.windowStart)} to ${formatDate(metrics.windowEnd)}`;
  ovulationDate.textContent = formatDate(metrics.ovulation);
  fertileWindow.textContent = `${formatDate(metrics.fertileStart)} to ${formatDate(metrics.fertileEnd)}`;

  if (entries.length === 0) {
    onboardingMessage.textContent =
      'Welcome. Tap a date in the calendar, set a period start and end, then save. Until then, we show general estimates: 28-day cycle and 5-day period.';
  } else if (entries.length === 1) {
    onboardingMessage.textContent =
      'You have one period logged. Predictions are using general estimates (28-day cycle, 5-day period) until more history is available.';
  } else if (metrics.usingDefaults) {
    onboardingMessage.textContent =
      'Using a blend of your data and general estimates. Add more period entries to improve prediction quality.';
  } else {
    onboardingMessage.textContent = 'Predictions now use your own cycle history.';
  }
}

function renderDraftSelection() {
  selectedDateText.textContent = selectedDateKey
    ? `Selected date: ${formatDate(selectedDateKey)}`
    : 'No date selected yet.';

  if (!draftStartDate && !draftEndDate) {
    rangePreview.textContent = 'No range selected.';
    rangePreview.classList.remove('error', 'success');
    return;
  }

  if (draftStartDate && !draftEndDate) {
    rangePreview.textContent = `Start selected: ${formatDate(draftStartDate)}. Now set the end date.`;
    rangePreview.classList.remove('error');
    rangePreview.classList.add('success');
    return;
  }

  rangePreview.textContent = `Ready to save: ${formatDate(draftStartDate)} to ${formatDate(draftEndDate)}.`;
  rangePreview.classList.remove('error');
  rangePreview.classList.add('success');
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

  const metrics = calculatePredictionMetrics();
  const periodDays = new Set(getAllPeriodDays());
  const predictedPeriodDays = getDateRangeSet(metrics.predictedNextPeriod, addDays(metrics.predictedNextPeriod, metrics.averagePeriodLength - 1));
  const fertileDays = getDateRangeSet(metrics.fertileStart, metrics.fertileEnd);
  const ovulationDayKey = metrics.ovulation;

  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let i = 0; i < firstDay.getDay(); i += 1) {
    const spacer = document.createElement('div');
    calendarGrid.appendChild(spacer);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day);
    const dateKey = toDateKey(date);

    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'day-cell';
    cell.textContent = String(day);
    cell.setAttribute('aria-label', formatDate(dateKey));

    if (periodDays.has(dateKey)) {
      cell.classList.add('period-day');
    }

    if (predictedPeriodDays.has(dateKey)) {
      cell.classList.add('predicted-day');
    }

    if (fertileDays.has(dateKey)) {
      cell.classList.add('fertile-day');
    }

    if (dateKey === ovulationDayKey) {
      cell.classList.add('ovulation-day');
    }

    if (isSameDate(date, new Date())) {
      cell.classList.add('today');
    }

    if (dateKey === selectedDateKey) {
      cell.classList.add('selected-day');
    }

    if (isDateWithinDraft(dateKey)) {
      cell.classList.add('draft-day');
    }

    cell.addEventListener('click', () => {
      selectedDateKey = dateKey;
      clearMessage(formMessage);
      renderDraftSelection();
      renderCalendar();
    });

    calendarGrid.appendChild(cell);
  }
}

function calculatePredictionMetrics() {
  const cycleLengths = getCycleLengths();
  const periodLengths = getPeriodLengths();
  const todayKey = toDateKey(new Date());

  const hasNoData = entries.length === 0;
  const oneEntry = entries.length === 1;

  const averageCycleLength =
    cycleLengths.length > 0 ? Math.round(cycleLengths.reduce((sum, value) => sum + value, 0) / cycleLengths.length) : DEFAULT_CYCLE_LENGTH;
  const averagePeriodLength =
    periodLengths.length > 0 ? Math.round(periodLengths.reduce((sum, value) => sum + value, 0) / periodLengths.length) : DEFAULT_PERIOD_LENGTH;

  const lastStart = entries.length > 0 ? entries[entries.length - 1].startDate : todayKey;
  const predictedNextPeriod = addDays(lastStart, averageCycleLength);

  const variance = getStandardDeviation(cycleLengths);
  const usingDefaults = hasNoData || oneEntry || cycleLengths.length === 0 || periodLengths.length === 0;

  let confidenceText = 'High';
  if (usingDefaults || cycleLengths.length < 2) {
    confidenceText = 'Low';
  } else if (variance > 3 || cycleLengths.length < 4) {
    confidenceText = 'Medium';
  }

  const irregular = cycleLengths.length >= 2 && variance >= 4;
  const windowRadius = usingDefaults ? 4 : irregular ? 5 : 2;

  return {
    averageCycleLength,
    averagePeriodLength,
    predictedNextPeriod,
    windowStart: addDays(predictedNextPeriod, -windowRadius),
    windowEnd: addDays(predictedNextPeriod, windowRadius),
    ovulation: addDays(predictedNextPeriod, -14),
    fertileStart: addDays(predictedNextPeriod, -19),
    fertileEnd: addDays(predictedNextPeriod, -13),
    irregularMessage:
      cycleLengths.length < 2
        ? 'Need at least 2 cycle gaps to assess regularity.'
        : irregular
          ? 'Your cycle looks irregular. Prediction window is wider than usual.'
          : 'Your cycle pattern looks fairly regular.',
    confidenceText,
    usingDefaults
  };
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

function getPeriodLengths() {
  return entries
    .map((entry) => {
      const start = new Date(entry.startDate);
      const end = new Date(entry.endDate);
      const diff = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
      return diff > 0 ? diff : null;
    })
    .filter((value) => value !== null);
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
      resetDraftSelection();
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
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((entry) => entry.startDate && entry.endDate)
      .map((entry) => ({
        id: entry.id || crypto.randomUUID(),
        startDate: entry.startDate,
        endDate: entry.endDate,
        notes: typeof entry.notes === 'string' ? entry.notes : '',
        createdAt: entry.createdAt || new Date().toISOString()
      }))
      .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
  } catch {
    return [];
  }
}

function saveEntries() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function resetDraftSelection() {
  selectedDateKey = '';
  draftStartDate = '';
  draftEndDate = '';
}

function isDateWithinDraft(dateKey) {
  if (!draftStartDate || !draftEndDate) {
    return false;
  }

  return new Date(dateKey) >= new Date(draftStartDate) && new Date(dateKey) <= new Date(draftEndDate);
}

function addDays(dateKey, dayCount) {
  const date = new Date(dateKey);
  date.setDate(date.getDate() + dayCount);
  return toDateKey(date);
}

function getDateRangeSet(startDateKey, endDateKey) {
  const dates = new Set();
  let cursor = new Date(startDateKey);
  const end = new Date(endDateKey);

  while (cursor <= end) {
    dates.add(toDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

function getStandardDeviation(values) {
  if (values.length === 0) {
    return 0;
  }

  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const squareDiffs = values.map((value) => (value - average) ** 2);
  const variance = squareDiffs.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.sqrt(variance);
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
