// =========================================
//  APPS SCRIPT CODE (shown to user)
// =========================================
const APPS_SCRIPT_CODE = `// TASKBOARD — Google Apps Script
// Paste this in Extensions > Apps Script, then deploy as Web App (Anyone access)

const SHEET_NAME = "Tasks";
const HEADERS = ["id", "title", "references", "due_date", "status", "created_at", "calendar_added"];

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
  }
  return sheet;
}

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  const result = { ok: false, data: null, error: null };
  try {
    const params = e.parameter || {};
    const action = params.action || (e.postData ? JSON.parse(e.postData.contents || '{}').action : '');
    const body = e.postData ? JSON.parse(e.postData.contents || '{}') : {};
    const p = Object.assign({}, params, body);

    if (p.action === 'list') {
      result.data = listTasks();
      result.ok = true;
    } else if (p.action === 'create') {
      result.data = createTask(p);
      result.ok = true;
    } else if (p.action === 'update') {
      result.data = updateTask(p);
      result.ok = true;
    } else if (p.action === 'delete') {
      deleteTask(p.id);
      result.ok = true;
    } else {
      result.error = 'Unknown action';
    }
  } catch (err) {
    result.error = err.message;
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function listTasks() {
  const sheet = getSheet();
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return [];
  return rows.slice(1).map(r => ({
    id: r[0], title: r[1], references: r[2],
    due_date: r[3], status: r[4], created_at: r[5], calendar_added: r[6] === true || r[6] === 'true'
  }));
}

function createTask(p) {
  const sheet = getSheet();
  const id = Date.now().toString();
  const row = [id, p.title || '', p.references || '', p.due_date || '', p.status || 'Backlog', new Date().toISOString(), p.calendar_added || false];
  sheet.appendRow(row);
  return { id, title: p.title, references: p.references, due_date: p.due_date, status: p.status, calendar_added: p.calendar_added || false };
}

function updateTask(p) {
  const sheet = getSheet();
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(p.id)) {
      if (p.title !== undefined) sheet.getRange(i+1, 2).setValue(p.title);
      if (p.references !== undefined) sheet.getRange(i+1, 3).setValue(p.references);
      if (p.due_date !== undefined) sheet.getRange(i+1, 4).setValue(p.due_date);
      if (p.status !== undefined) sheet.getRange(i+1, 5).setValue(p.status);
      if (p.calendar_added !== undefined) sheet.getRange(i+1, 7).setValue(p.calendar_added);
      return { ok: true };
    }
  }
  throw new Error('Task not found: ' + p.id);
}

function deleteTask(id) {
  const sheet = getSheet();
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(id)) {
      sheet.deleteRow(i + 1);
      return;
    }
  }
  throw new Error('Task not found: ' + id);
}`;

// =========================================
//  STATE
// =========================================
let API_URL = '';
let tasks = [];
let editingId = null;

// =========================================
//  INIT
// =========================================
window.onload = function() {
  document.getElementById('script-code').value = APPS_SCRIPT_CODE;
  const stored = localStorage.getItem('taskboard_api_url');
  if (stored) {
    API_URL = stored;
    launchApp();
  }
};

function launchApp() {
  document.getElementById('setup-screen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  fetchTasks();
}

function saveSetup() {
  const url = document.getElementById('api-url-input').value.trim();
  if (!url || !/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec/.test(url)) {
    showToast('Please enter a valid Apps Script Web App URL', 'error');
    return;
  }
  API_URL = url;
  localStorage.setItem('taskboard_api_url', url);
  launchApp();
}

function resetSetup() {
  if (!confirm('Reset configuration? This will only clear your API URL from this browser.')) return;
  localStorage.removeItem('taskboard_api_url');
  location.reload();
}

function showScriptModal() {
  document.getElementById('script-modal').style.display = 'flex';
}

function copyScript() {
  navigator.clipboard.writeText(APPS_SCRIPT_CODE)
    .then(() => showToast('Script copied to clipboard!'))
    .catch(() => showToast('Could not copy — please select all and copy manually', 'error'));
}

// =========================================
//  API
// =========================================
function setLoading(on) {
  document.getElementById('loading-indicator').style.display = on ? 'flex' : 'none';
}

async function api(params) {
  setLoading(true);
  try {
    const isWrite = params.action !== 'list';
    let url, opts;

    if (!isWrite) {
      url = API_URL + '?action=list&t=' + Date.now();
      opts = { method: 'GET' };
    } else {
      url = API_URL;
      opts = {
        method: 'POST',
        body: JSON.stringify(params),
        headers: { 'Content-Type': 'text/plain' }
      };
    }

    const res = await fetch(url, opts);
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'API error');
    return json.data;
  } finally {
    setLoading(false);
  }
}

async function fetchTasks() {
  try {
    tasks = await api({ action: 'list' }) || [];
    renderBoard();
  } catch (e) {
    showToast('Failed to load tasks: ' + e.message, 'error');
  }
}

// =========================================
//  RENDER
// =========================================
function renderBoard() {
  const statuses = ['Backlog', 'On Going', 'Done'];
  const keys = ['backlog', 'ongoing', 'done'];
  const statusMap = { 'Backlog': 'backlog', 'On Going': 'ongoing', 'Done': 'done' };

  statuses.forEach((status, i) => {
    const col = keys[i];
    const filtered = tasks.filter(t => t.status === status);
    document.getElementById('count-' + col).textContent = filtered.length;
    const container = document.getElementById('cards-' + col);
    container.innerHTML = '';

    if (filtered.length === 0) {
      container.innerHTML = '<div class="empty-col">NO TASKS</div>';
      return;
    }

    filtered.forEach(task => {
      container.appendChild(makeCard(task));
    });
  });

  document.getElementById('task-count').textContent = tasks.length + ' task' + (tasks.length !== 1 ? 's' : '');

  // Set up drag/drop on columns
  setupDragDrop();
}

// =========================================
//  DRAG & DROP
// =========================================
const COL_STATUS_MAP = { 'col-backlog': 'Backlog', 'col-ongoing': 'On Going', 'col-done': 'Done' };

function setupDragDrop() {
  document.querySelectorAll('.column').forEach(col => {
    col.ondragover = function(e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      col.classList.add('drag-over');
    };
    col.ondragenter = function(e) {
      e.preventDefault();
      col.classList.add('drag-over');
    };
    col.ondragleave = function(e) {
      if (!col.contains(e.relatedTarget)) {
        col.classList.remove('drag-over');
      }
    };
    col.ondrop = function(e) {
      e.preventDefault();
      col.classList.remove('drag-over');
      const taskId = e.dataTransfer.getData('text/plain');
      const newStatus = COL_STATUS_MAP[col.id];
      if (!taskId || !newStatus) return;
      const task = tasks.find(t => String(t.id) === taskId);
      if (!task || task.status === newStatus) return;
      moveTask(e, taskId, newStatus);
    };
  });
}

// =========================================
//  ADD TO CALENDAR
// =========================================
function addToCalendar(task) {
  const dueLocal = parseLocalDate(task.due_date);
  if (!dueLocal) return;

  // Format as YYYYMMDD for Google Calendar
  const y = dueLocal.getFullYear();
  const m = String(dueLocal.getMonth() + 1).padStart(2, '0');
  const d = String(dueLocal.getDate()).padStart(2, '0');
  const dateStr = y + m + d;
  // All-day event: dates only (no time component)
  const nextDay = new Date(dueLocal);
  nextDay.setDate(nextDay.getDate() + 1);
  const ny = nextDay.getFullYear();
  const nm = String(nextDay.getMonth() + 1).padStart(2, '0');
  const nd = String(nextDay.getDate()).padStart(2, '0');
  const endStr = ny + nm + nd;

  const title = encodeURIComponent(task.title || 'Taskboard item');
  const details = encodeURIComponent(task.references || '');

  const url = 'https://calendar.google.com/calendar/r/eventedit'
    + '?text=' + title
    + '&dates=' + dateStr + '/' + endStr
    + '&details=' + details;

  window.open(url, '_blank');
  showToast('Opening Google Calendar...');
}

function makeCard(task) {
  const div = document.createElement('div');
  div.className = 'card';
  div.setAttribute('data-id', task.id);

  // Drag & drop
  div.draggable = true;
  div.ondragstart = function(e) {
    e.dataTransfer.setData('text/plain', String(task.id));
    e.dataTransfer.effectAllowed = 'move';
    div.classList.add('dragging');
  };
  div.ondragend = function() {
    div.classList.remove('dragging');
  };

  const dueLocal = parseLocalDate(task.due_date);
  const isOverdue = dueLocal && dueLocal < new Date() && task.status !== 'Done';
  const dateStr = task.due_date ? formatDate(task.due_date) : '';

  const statuses = ['Backlog', 'On Going', 'Done'];

  // Build card content using DOM methods for safety
  // Actions bar
  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'card-actions';

  const editBtn = document.createElement('button');
  editBtn.className = 'card-btn';
  editBtn.textContent = 'edit';
  editBtn.onclick = function(e) { editTask(e, task.id); };
  actionsDiv.appendChild(editBtn);

  const delBtn = document.createElement('button');
  delBtn.className = 'card-btn delete';
  delBtn.textContent = 'del';
  delBtn.onclick = function(e) { deleteTaskAction(e, task.id); };
  actionsDiv.appendChild(delBtn);

  div.appendChild(actionsDiv);

  // Title
  const titleDiv = document.createElement('div');
  titleDiv.className = 'card-title';
  titleDiv.textContent = task.title || '';
  div.appendChild(titleDiv);

  // Meta
  const metaDiv = document.createElement('div');
  metaDiv.className = 'card-meta';

  if (dateStr) {
    const dateSpan = document.createElement('span');
    dateSpan.className = 'card-date' + (isOverdue ? ' overdue' : '');
    dateSpan.textContent = (isOverdue ? '\u26A0 ' : '\u25F7 ') + dateStr;
    metaDiv.appendChild(dateSpan);
  }

  if (task.references) {
    const refSpan = document.createElement('span');
    refSpan.className = 'card-ref-badge';
    refSpan.textContent = 'REF';
    metaDiv.appendChild(refSpan);
  }

  // Add to calendar button (only if task has a date)
  if (dueLocal) {
    const calBtn = document.createElement('button');
    const isAdded = task.calendar_added;
    calBtn.className = 'card-cal-btn' + (isAdded ? ' added' : '');
    calBtn.textContent = isAdded ? '\u2713 In Calendar' : '\u002B Calendar';
    calBtn.onclick = function(e) {
      e.stopPropagation();
      if (task.calendar_added) return;
      addToCalendar(task);
      task.calendar_added = true;
      calBtn.className = 'card-cal-btn added';
      calBtn.textContent = '\u2713 In Calendar';
      api({ action: 'update', id: task.id, calendar_added: true }).catch(function(err) {
        showToast('Failed to save calendar state: ' + err.message, 'error');
      });
    };
    metaDiv.appendChild(calBtn);
  }

  div.appendChild(metaDiv);

  // Move buttons
  const moveBtnsDiv = document.createElement('div');
  moveBtnsDiv.className = 'move-btns';

  statuses
    .filter(s => s !== task.status)
    .forEach(s => {
      const btn = document.createElement('button');
      btn.className = 'move-btn';
      btn.textContent = '\u2192 ' + s;
      btn.onclick = function(e) { moveTask(e, task.id, s); };
      moveBtnsDiv.appendChild(btn);
    });

  div.appendChild(moveBtnsDiv);

  return div;
}

function parseLocalDate(d) {
  if (!d) return null;
  const s = String(d);
  // Bare date "2026-03-15" → local midnight
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(s + 'T00:00:00');
  // Full ISO "2026-03-14T17:00:00.000Z" → parse and extract local date at midnight
  const parsed = new Date(s);
  if (isNaN(parsed)) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function formatDate(d) {
  const date = parseLocalDate(d);
  if (!date) return '';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// =========================================
//  TASK ACTIONS
// =========================================
async function moveTask(e, id, newStatus) {
  e.stopPropagation();
  const task = tasks.find(t => String(t.id) === String(id));
  if (!task) return;
  task.status = newStatus;
  renderBoard();
  try {
    await api({ action: 'update', id, status: newStatus });
    showToast('Moved to ' + newStatus);
  } catch (err) {
    showToast('Failed to update: ' + err.message, 'error');
    fetchTasks();
  }
}

async function deleteTaskAction(e, id) {
  e.stopPropagation();
  if (!confirm('Delete this task?')) return;
  tasks = tasks.filter(t => String(t.id) !== String(id));
  renderBoard();
  try {
    await api({ action: 'delete', id });
    showToast('Task deleted');
  } catch (err) {
    showToast('Delete failed: ' + err.message, 'error');
    fetchTasks();
  }
}

function editTask(e, id) {
  e.stopPropagation();
  const task = tasks.find(t => String(t.id) === String(id));
  if (!task) return;
  editingId = id;
  document.getElementById('modal-title').textContent = 'Edit Task';
  document.getElementById('f-title').value = task.title || '';
  document.getElementById('f-refs').value = task.references || '';
  document.getElementById('f-date').value = task.due_date || '';
  document.getElementById('f-status').value = task.status || 'Backlog';
  document.getElementById('task-modal').style.display = 'flex';
}

// =========================================
//  MODAL
// =========================================
function openModal() {
  editingId = null;
  document.getElementById('modal-title').textContent = 'New Task';
  document.getElementById('f-title').value = '';
  document.getElementById('f-refs').value = '';
  document.getElementById('f-date').value = '';
  document.getElementById('f-status').value = 'Backlog';
  document.getElementById('task-modal').style.display = 'flex';
  setTimeout(() => document.getElementById('f-title').focus(), 50);
}

function closeModal() {
  document.getElementById('task-modal').style.display = 'none';
  editingId = null;
}

function overlayClose(e) {
  if (e.target === document.getElementById('task-modal')) closeModal();
}

let saving = false;

async function saveTask() {
  if (saving) return;
  const title = document.getElementById('f-title').value.trim();
  if (!title) { showToast('Title is required', 'error'); return; }

  const data = {
    title,
    references: document.getElementById('f-refs').value.trim(),
    due_date: document.getElementById('f-date').value,
    status: document.getElementById('f-status').value
  };

  const currentEditingId = editingId;
  saving = true;
  closeModal();

  try {
    if (currentEditingId) {
      const task = tasks.find(t => String(t.id) === String(currentEditingId));
      if (task) Object.assign(task, data);
      renderBoard();
      try {
        await api({ action: 'update', id: currentEditingId, ...data });
        showToast('Task updated');
      } catch (err) {
        showToast('Update failed: ' + err.message, 'error');
        fetchTasks();
      }
    } else {
      const tempId = 'temp_' + Date.now();
      const newTask = { id: tempId, ...data, created_at: new Date().toISOString() };
      tasks.unshift(newTask);
      renderBoard();
      try {
        const created = await api({ action: 'create', ...data });
        const idx = tasks.findIndex(t => t.id === tempId);
        if (idx >= 0) tasks[idx].id = created.id;
        showToast('Task created');
      } catch (err) {
        tasks = tasks.filter(t => t.id !== tempId);
        renderBoard();
        showToast('Create failed: ' + err.message, 'error');
      }
    }
  } finally {
    saving = false;
  }
}

// =========================================
//  TOAST
// =========================================
let toastTimer;
function showToast(msg, type) {
  clearTimeout(toastTimer);
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    document.body.appendChild(el);
  }
  el.className = 'toast' + (type === 'error' ? ' error' : '');
  el.textContent = msg;
  el.style.display = 'block';
  toastTimer = setTimeout(() => { el.style.display = 'none'; }, 3000);
}
