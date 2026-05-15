const API = window.location.hostname === 'localhost'
  ? 'http://localhost:3000/api'
  : '/api';
// ── On Load ──
window.addEventListener('load', () => {
  // Set min datetime to now
  const dt = document.getElementById('schedTime');
  if (dt) {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    dt.min = now.toISOString().slice(0, 16);
  }
  loadLogs();
  loadStats();
});

// ══════════════════════════════════════════════════════
//  TAB NAVIGATION
// ══════════════════════════════════════════════════════
const tabTitles = {
  send:     { title: 'Send Email',      sub: 'Send an email immediately via Gmail' },
  schedule: { title: 'Schedule Email',  sub: 'Schedule emails for a future date & time' },
  logs:     { title: 'Email History',   sub: 'View all sent, scheduled & failed emails' },
};

function showTab(name, el) {
  // Hide all tabs
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  // Show selected
  document.getElementById('tab-' + name).classList.add('active');
  el.classList.add('active');

  // Update topbar
  document.getElementById('pageTitle').textContent    = tabTitles[name].title;
  document.getElementById('pageSubtitle').textContent = tabTitles[name].sub;

  // Refresh logs when switching to logs tab
  if (name === 'logs')     loadLogs();
  if (name === 'schedule') loadPending();
}

// ══════════════════════════════════════════════════════
//  FEATURE 2 + SEND NOW
// ══════════════════════════════════════════════════════
async function sendNow() {
  const to      = document.getElementById('sendTo').value.trim();
  const subject = document.getElementById('sendSubject').value.trim();
  const body    = document.getElementById('sendBody').value.trim();

  if (!to || !subject || !body) {
    showToast('Please fill in all fields.', 'error');
    return;
  }

  if (!isValidEmail(to)) {
    showToast('Please enter a valid email address.', 'error');
    return;
  }

  const btn = document.getElementById('sendBtn');
  btn.disabled = true;
  btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Sending...`;

  try {
    // Feature 2: Call Gmail API via backend
    const res  = await fetch(`${API}/send`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ to, subject, body }),
    });
    const data = await res.json();

    if (!res.ok || data.error) throw new Error(data.error);

    showToast('✅ Email sent successfully!', 'success');

    // Clear fields
    document.getElementById('sendTo').value      = '';
    document.getElementById('sendSubject').value = '';
    document.getElementById('sendBody').value    = '';

    loadStats();

  } catch (err) {
    showToast('❌ ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Send Email Now`;
  }
}

// ══════════════════════════════════════════════════════
//  FEATURE 1: SCHEDULE EMAIL
// ══════════════════════════════════════════════════════
async function scheduleEmail() {
  const to            = document.getElementById('schedTo').value.trim();
  const subject       = document.getElementById('schedSubject').value.trim();
  const body          = document.getElementById('schedBody').value.trim();
  const scheduledTime = document.getElementById('schedTime').value;

  if (!to || !subject || !body || !scheduledTime) {
    showToast('Please fill in all fields including date & time.', 'error');
    return;
  }

  if (!isValidEmail(to)) {
    showToast('Please enter a valid email address.', 'error');
    return;
  }

  if (new Date(scheduledTime) <= new Date()) {
    showToast('Please select a future date & time.', 'error');
    return;
  }

  const btn = document.getElementById('schedBtn');
  btn.disabled = true;
  btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Scheduling...`;

  try {
    const res  = await fetch(`${API}/schedule`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ to, subject, body, scheduledTime }),
    });
    const data = await res.json();

    if (!res.ok || data.error) throw new Error(data.error);

    showToast(`⏰ ${data.message}`, 'info');

    // Clear fields
    document.getElementById('schedTo').value      = '';
    document.getElementById('schedSubject').value = '';
    document.getElementById('schedBody').value    = '';
    document.getElementById('schedTime').value    = '';

    loadPending();
    loadStats();

  } catch (err) {
    showToast('❌ ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Schedule Email`;
  }
}

// ── Cancel a scheduled email ──
async function cancelScheduled(jobId) {
  try {
    const res  = await fetch(`${API}/schedule/${jobId}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error);
    showToast('🗑️ Scheduled email cancelled.', 'info');
    loadPending();
    loadStats();
  } catch (err) {
    showToast('❌ ' + err.message, 'error');
  }
}

// ── Load pending scheduled emails ──
async function loadPending() {
  const list = document.getElementById('pendingList');
  try {
    const res  = await fetch(`${API}/scheduled`);
    const jobs = await res.json();

    if (!jobs.length) {
      list.innerHTML = '<p class="empty-msg">No scheduled emails pending.</p>';
      return;
    }

    list.innerHTML = jobs.map(j => `
      <div class="pending-item">
        <div class="log-icon scheduled">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
        </div>
        <div class="pending-info">
          <p>${esc(j.to)} — ${esc(j.subject)}</p>
          <span>Scheduled for: ${new Date(j.scheduledTime).toLocaleString()}</span>
        </div>
        <button class="btn-cancel" onclick="cancelScheduled('${j.jobId}')">Cancel</button>
      </div>`).join('');

  } catch {
    list.innerHTML = '<p class="empty-msg">Could not load scheduled emails.</p>';
  }
}

// ══════════════════════════════════════════════════════
//  FEATURE 3: EMAIL LOG HISTORY
// ══════════════════════════════════════════════════════
async function loadLogs() {
  const list = document.getElementById('logsList');
  list.innerHTML = '<p class="empty-msg">Loading...</p>';

  try {
    const res  = await fetch(`${API}/logs`);
    const logs = await res.json();

    if (!logs.length) {
      list.innerHTML = '<p class="empty-msg">No email history yet. Send your first email!</p>';
      updateStats(0, 0);
      return;
    }

    list.innerHTML = logs.map(log => {
      const icon  = statusIcon(log.status);
      const time  = new Date(log.timestamp).toLocaleString();
      return `
        <div class="log-item">
          <div class="log-icon ${log.status}">${icon}</div>
          <div class="log-info">
            <div class="log-to">${esc(log.to)}</div>
            <div class="log-subject">${esc(log.subject)}</div>
            <div class="log-time">${time} · ${capitalize(log.type)}</div>
          </div>
          <span class="log-badge ${log.status}">${log.status}</span>
        </div>`;
    }).join('');

    // Update stats
    const sent      = logs.filter(l => l.status === 'sent').length;
    const scheduled = logs.filter(l => l.status === 'scheduled').length;
    updateStats(sent, scheduled);

  } catch {
    list.innerHTML = '<p class="empty-msg">⚠️ Cannot connect to server. Run: node server.js</p>';
  }
}

async function loadStats() {
  try {
    const res  = await fetch(`${API}/logs`);
    const logs = await res.json();
    const sent      = logs.filter(l => l.status === 'sent').length;
    const scheduled = logs.filter(l => l.status === 'scheduled').length;
    updateStats(sent, scheduled);
  } catch {}
}

function updateStats(sent, scheduled) {
  document.getElementById('statTotal').textContent     = sent;
  document.getElementById('statScheduled').textContent = scheduled;
}

// ══════════════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════════════

function statusIcon(status) {
  if (status === 'sent') return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`;
  if (status === 'failed') return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
  if (status === 'scheduled') return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
  return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
}

function showToast(msg, type = 'info') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className   = `toast show ${type}`;
  setTimeout(() => t.classList.remove('show'), 4000);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function esc(t) {
  return String(t)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}