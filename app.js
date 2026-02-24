/* ================================================================
   BuJo — Bullet Journal  ·  app.js
   All data is persisted automatically in localStorage.
   ================================================================ */

(function () {
  'use strict';

  // ─── Helpers ────────────────────────────────────────────────
  var $ = function (sel) { return document.querySelector(sel); };
  var $$ = function (sel) { return document.querySelectorAll(sel); };

  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  function load(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_e) {
      return fallback;
    }
  }

  function save(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  }

  var DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  var _uid = Date.now();
  function uid() { return '_' + (++_uid).toString(36); }

  // ─── State ──────────────────────────────────────────────────
  var state = {
    entries: load('bujo_entries', []),
    moods: load('bujo_moods', {}),
    monthlyNotes: load('bujo_monthly', {}),
    habits: load('bujo_habits', []),
    habitChecks: load('bujo_habitChecks', {}),
    collections: load('bujo_collections', []),
    viewMonth: new Date().getMonth(),
    viewYear: new Date().getFullYear()
  };

  function persist() {
    save('bujo_entries', state.entries);
    save('bujo_moods', state.moods);
    save('bujo_monthly', state.monthlyNotes);
    save('bujo_habits', state.habits);
    save('bujo_habitChecks', state.habitChecks);
    save('bujo_collections', state.collections);
  }

  // ─── Tabs ───────────────────────────────────────────────────
  $$('.tab').forEach(function (btn) {
    btn.addEventListener('click', function () {
      $$('.tab').forEach(function (t) { t.classList.remove('active'); });
      $$('.page').forEach(function (p) { p.classList.remove('active'); });
      btn.classList.add('active');
      var target = document.getElementById(btn.dataset.tab);
      if (target) target.classList.add('active');
    });
  });

  // ═══════════════════════════════════════════════════════════
  //  DAILY LOG
  // ═══════════════════════════════════════════════════════════
  var BULLETS = { task: '•', event: '○', note: '—' };

  function formatDate(d) {
    return d.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }

  $('#daily-date').textContent = formatDate(new Date());

  // ── Render entries ──
  function renderEntries(filter) {
    var list = $('#entry-list');
    list.innerHTML = '';
    var keyword = (filter || '').toLowerCase();
    state.entries.forEach(function (e, i) {
      if (keyword && e.text.toLowerCase().indexOf(keyword) === -1) return;
      var li = document.createElement('li');
      li.className = 'entry-item' + (e.status === 'done' ? ' done' : '') + (e.status === 'cancelled' ? ' cancelled' : '');
      li.innerHTML =
        '<span class="entry-bullet">' + BULLETS[e.type] + '</span>' +
        '<span class="entry-text">' + escapeHtml(e.text) + '</span>' +
        '<span class="entry-status">' + (e.status || '') + '</span>' +
        '<button class="entry-delete" data-idx="' + i + '" aria-label="Delete entry">✕</button>';

      li.addEventListener('click', function (ev) {
        if (ev.target.classList.contains('entry-delete')) return;
        toggleEntry(i);
      });

      li.querySelector('.entry-delete').addEventListener('click', function () {
        state.entries.splice(i, 1);
        persist();
        renderEntries($('#search-input').value);
      });

      list.appendChild(li);
    });
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function toggleEntry(i) {
    var e = state.entries[i];
    if (!e.status) e.status = 'done';
    else if (e.status === 'done') e.status = 'cancelled';
    else e.status = '';
    persist();
    renderEntries($('#search-input').value);
  }

  $('#add-entry').addEventListener('click', addEntry);
  $('#entry-text').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') addEntry();
  });

  function addEntry() {
    var text = $('#entry-text').value.trim();
    if (!text) return;
    state.entries.push({ id: uid(), type: $('#entry-type').value, text: text, status: '', date: todayStr() });
    $('#entry-text').value = '';
    persist();
    renderEntries($('#search-input').value);
  }

  // ── Search ──
  $('#search-input').addEventListener('input', function () {
    renderEntries(this.value);
  });

  // ── Mood ──
  $$('.mood-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      $$('.mood-btn').forEach(function (b) { b.classList.remove('selected'); });
      btn.classList.add('selected');
      state.moods[todayStr()] = btn.dataset.mood;
      $('#current-mood').textContent = btn.dataset.mood;
      persist();
    });
  });

  function loadMood() {
    var m = state.moods[todayStr()];
    if (m) {
      $('#current-mood').textContent = m;
      $$('.mood-btn').forEach(function (b) {
        b.classList.toggle('selected', b.dataset.mood === m);
      });
    }
  }

  // ── Export ──
  $('#export-btn').addEventListener('click', function () {
    var lines = ['BuJo — Daily Log', ''];
    state.entries.forEach(function (e) {
      var bullet = BULLETS[e.type];
      var status = e.status ? ' [' + e.status + ']' : '';
      lines.push(bullet + ' ' + e.text + status + '  (' + (e.date || '') + ')');
    });
    lines.push('');
    lines.push('Moods:');
    Object.keys(state.moods).forEach(function (d) {
      lines.push(d + ' ' + state.moods[d]);
    });

    var blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'bujo-daily-log.txt';
    a.click();
    URL.revokeObjectURL(a.href);
  });

  // init daily
  renderEntries();
  loadMood();

  // ═══════════════════════════════════════════════════════════
  //  MONTHLY LOG
  // ═══════════════════════════════════════════════════════════
  function renderMonthly() {
    var y = state.viewYear;
    var m = state.viewMonth;
    var daysInMonth = new Date(y, m + 1, 0).getDate();
    var title = new Date(y, m).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    $('#monthly-title').textContent = title;

    var today = new Date();
    var todayDate = today.getDate();
    var todayMonth = today.getMonth();
    var todayYear = today.getFullYear();

    var tbody = $('#monthly-body');
    tbody.innerHTML = '';

    for (var d = 1; d <= daysInMonth; d++) {
      var dt = new Date(y, m, d);
      var key = y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      var isToday = (d === todayDate && m === todayMonth && y === todayYear);
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td' + (isToday ? ' class="today"' : '') + '>' + d + '</td>' +
        '<td' + (isToday ? ' class="today"' : '') + '>' + DAY_NAMES[dt.getDay()] + '</td>' +
        '<td' + (isToday ? ' class="today"' : '') + '><input type="text" value="' + escapeAttr(state.monthlyNotes[key] || '') + '" data-key="' + key + '"></td>';
      tbody.appendChild(tr);
    }

    tbody.querySelectorAll('input').forEach(function (inp) {
      inp.addEventListener('input', function () {
        state.monthlyNotes[inp.dataset.key] = inp.value;
        persist();
      });
    });
  }

  function escapeAttr(s) {
    return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  $('#prev-month').addEventListener('click', function () {
    state.viewMonth--;
    if (state.viewMonth < 0) { state.viewMonth = 11; state.viewYear--; }
    renderMonthly();
  });
  $('#next-month').addEventListener('click', function () {
    state.viewMonth++;
    if (state.viewMonth > 11) { state.viewMonth = 0; state.viewYear++; }
    renderMonthly();
  });

  renderMonthly();

  // ═══════════════════════════════════════════════════════════
  //  HABIT TRACKER
  // ═══════════════════════════════════════════════════════════
  function renderHabits() {
    var y = state.viewYear;
    var m = state.viewMonth;
    var days = new Date(y, m + 1, 0).getDate();
    var title = new Date(y, m).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    $('#habit-month-title').textContent = title;

    // Header row
    var thead = $('#habit-thead');
    thead.innerHTML = '';
    var headRow = '<tr><th>Habit</th>';
    for (var d = 1; d <= days; d++) headRow += '<th>' + d + '</th>';
    headRow += '<th>🔥</th><th></th></tr>';
    thead.innerHTML = headRow;

    // Body
    var tbody = $('#habit-tbody');
    tbody.innerHTML = '';
    state.habits.forEach(function (habit, hi) {
      var hid = habit.id;
      var tr = document.createElement('tr');
      var cells = '<td class="habit-name">' + escapeHtml(habit.name) + '</td>';
      var streak = 0;
      var maxStreak = 0;
      for (var d2 = 1; d2 <= days; d2++) {
        var key = hid + '_' + y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d2).padStart(2, '0');
        var checked = state.habitChecks[key];
        cells += '<td class="habit-check" data-key="' + key + '">' + (checked ? '✓' : '') + '</td>';
        if (checked) { streak++; if (streak > maxStreak) maxStreak = streak; }
        else { streak = 0; }
      }
      cells += '<td class="streak">' + maxStreak + '</td>';
      cells += '<td><button class="habit-delete" aria-label="Delete habit">✕</button></td>';
      tr.innerHTML = cells;
      tbody.appendChild(tr);

      // toggle checks
      tr.querySelectorAll('.habit-check').forEach(function (td) {
        td.addEventListener('click', function () {
          var k = td.dataset.key;
          state.habitChecks[k] = !state.habitChecks[k];
          persist();
          renderHabits();
        });
      });

      tr.querySelector('.habit-delete').addEventListener('click', function () {
        state.habits.splice(hi, 1);
        persist();
        renderHabits();
      });
    });
  }

  $('#add-habit').addEventListener('click', addHabit);
  $('#habit-input').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') addHabit();
  });

  function addHabit() {
    var name = $('#habit-input').value.trim();
    if (!name) return;
    state.habits.push({ id: uid(), name: name });
    $('#habit-input').value = '';
    persist();
    renderHabits();
  }

  renderHabits();

  // ═══════════════════════════════════════════════════════════
  //  COLLECTIONS
  // ═══════════════════════════════════════════════════════════
  function renderCollections() {
    var grid = $('#collections-grid');
    grid.innerHTML = '';
    state.collections.forEach(function (col, ci) {
      var card = document.createElement('div');
      card.className = 'collection-card';
      card.innerHTML =
        '<h3>' + escapeHtml(col.title) +
        ' <button class="collection-delete" data-ci="' + ci + '" aria-label="Delete collection">✕</button></h3>' +
        '<textarea data-ci="' + ci + '">' + escapeHtml(col.body || '') + '</textarea>';
      grid.appendChild(card);

      card.querySelector('textarea').addEventListener('input', function () {
        state.collections[ci].body = this.value;
        persist();
      });
      card.querySelector('.collection-delete').addEventListener('click', function () {
        state.collections.splice(ci, 1);
        persist();
        renderCollections();
      });
    });
  }

  $('#add-collection').addEventListener('click', addCollection);
  $('#collection-title-input').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') addCollection();
  });

  function addCollection() {
    var t = $('#collection-title-input').value.trim();
    if (!t) return;
    state.collections.push({ id: uid(), title: t, body: '' });
    $('#collection-title-input').value = '';
    persist();
    renderCollections();
  }

  renderCollections();
})();
