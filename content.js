(() => {
  'use strict';

  const PASSED_COLOUR = '#d2eaf7';
  const MAX_WAIT_MS = 20_000;
  const WEEK_DAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه شنبه', 'چهارشنبه'];
  const COURSE_COLOURS = [
    ['#2563eb', '#1d4ed8'],
    ['#059669', '#047857'],
    ['#d97706', '#b45309'],
    ['#7c3aed', '#6d28d9'],
    ['#0891b2', '#0e7490'],
    ['#e11d48', '#be123c']
  ];

  const faDigits = '۰۱۲۳۴۵۶۷۸۹';
  const arDigits = '٠١٢٣٤٥٦٧٨٩';

  function normalize(value) {
    return String(value ?? '')
      .replace(/[يﻱﻲ]/g, 'ی')
      .replace(/[كﻙﻚ]/g, 'ک')
      .replace(/[ۀة]/g, 'ه')
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/[ً-ٰٟ‌‏]/g, '')
      .replace(/[۰-۹]/g, digit => String(faDigits.indexOf(digit)))
      .replace(/[٠-٩]/g, digit => String(arDigits.indexOf(digit)))
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function text(cell) {
    return (cell?.textContent ?? '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function asInt(value) {
    const parsed = Number.parseInt(normalize(value).replace(/[^\d]/g, ''), 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function clock(total) {
    return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  }

  function parseSession(raw) {
    const clean = raw.replace(/\s+/g, ' ').trim();
    const match = /^روز\s+(.+?)\s+ساعت\s+(\d{1,2})(?::(\d{2}))?\s*\((.+?)\s+به مدت\s+(\d+)\s+دقیقه\s+در\s+(.*?)\s*\)\s*(?:شروع\s+(\S+))?/.exec(clean);
    if (!match) return { raw: clean, label: clean, room: '', day: '', start: null, end: null, alternating: false, parity: '' };

    const [, day, hour, minute = '0', frequency, duration, place, parity = ''] = match;
    const start = Number(hour) * 60 + Number(minute);
    const end = start + Number(duration);
    const alternating = frequency.includes('در میان');
    const room = place.replace(/^\s*کلاس\s*/, '').trim();
    return {
      raw: clean,
      label: `${day} ${clock(start)}–${clock(end)}${alternating ? ` (${parity || 'یک‌هفته‌درمیان'})` : ''}`,
      room: room === '0' ? '' : room,
      day,
      start,
      end,
      alternating,
      parity
    };
  }

  function injectFont() {
    const style = document.createElement('style');
    const url = chrome.runtime.getURL('fonts/Vazirmatn.woff2');
    style.dataset.fseFont = 'true';
    style.textContent = `
      @font-face {
        font-family: "FSE Vazirmatn";
        src: url("${url}") format("woff2");
        font-style: normal;
        font-weight: 100 900;
        font-display: swap;
      }
    `;
    (document.head ?? document.documentElement).append(style);
  }

  function parseDetails(title) {
    const body = /\bbody=\[([\s\S]*?)\]\s*$/.exec(title.trim())?.[1] ?? '';
    if (!body) return { sessions: [], details: '' };

    const holder = document.createElement('div');
    holder.innerHTML = body.replace(/<br\s*\/?>/gi, '\n');
    const lines = (holder.textContent ?? '')
      .split('\n')
      .map(line => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    return {
      sessions: lines
        .filter(line => line.startsWith('جلسه'))
        .map(line => parseSession(line.replace(/^جلسه\s+\S+:\s*/, ''))),
      details: lines.join(' • ')
    };
  }

  function isCourseTable(table) {
    const heading = normalize(table.querySelector('tr')?.textContent ?? '');
    return heading.includes('شماره درس') && heading.includes('نام درس') && heading.includes('ظرفیت');
  }

  function findCourseTable() {
    return [...document.querySelectorAll('table')]
      .filter(isCourseTable)
      .sort((a, b) => b.querySelectorAll('tr').length - a.querySelectorAll('tr').length)[0] ?? null;
  }

  function parseCourses(table) {
    return [...table.querySelectorAll('tr')].flatMap(row => {
      const cells = [...row.querySelectorAll(':scope > td')];
      if (cells.length < 10) return [];
      const code = text(cells[1]);
      const group = text(cells[2]);
      if (!/^\d+$/.test(normalize(code)) || !group) return [];

      const { sessions, details } = parseDetails(cells[9]?.querySelector('img')?.getAttribute('title') ?? '');
      const enrolled = asInt(text(cells[5]));
      const capacity = asInt(text(cells[6]));
      const sourceControl = row.querySelector('input[type="checkbox"]');
      return [{
        id: `${code}/${group}`,
        code,
        group,
        name: text(cells[3]),
        units: Number.parseFloat(normalize(text(cells[4]))) || 0,
        enrolled,
        capacity,
        faculty: text(cells[7]),
        professor: text(cells[8]),
        sessions,
        details,
        passed: (row.getAttribute('bgcolor') ?? '').trim().toLowerCase() === PASSED_COLOUR,
        sourceControl
      }];
    });
  }

  function el(tag, className, content) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (content !== undefined) node.textContent = content;
    return node;
  }

  function icon(name) {
    const paths = {
      search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
      refresh: '<path d="M20 12a8 8 0 1 1-2.34-5.66L20 8"/><path d="M20 3v5h-5"/>',
      plus: '<path d="M12 5v14M5 12h14"/>',
      trash: '<path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13"/>',
      check: '<path d="m5 12 4 4L19 6"/>',
      warning: '<path d="M12 3 2.8 19h18.4L12 3Z"/><path d="M12 9v4M12 16.5h.01"/>',
      book: '<path d="M4 5a3 3 0 0 1 3-3h13v17H7a3 3 0 0 0-3 3V5Z"/><path d="M4 19h16"/>'
    };
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.classList.add('fse-icon');
    svg.innerHTML = paths[name] ?? '';
    return svg;
  }

  function button(label, kind, iconName, onClick) {
    const node = el('button', `fse-button fse-button--${kind}`);
    node.type = 'button';
    if (iconName) node.append(icon(iconName));
    node.append(document.createTextNode(label));
    node.addEventListener('click', onClick);
    return node;
  }

  function chip(label, kind = 'neutral', title = '') {
    const node = el('span', `fse-chip fse-chip--${kind}`, label);
    if (title) node.title = title;
    return node;
  }

  function courseNameKey(value) {
    return normalize(value).replace(/[^a-z0-9\u0600-\u06ff]/g, '');
  }

  function calendarEventIdentity(node) {
    const title = text(node.querySelector('.wc-title') ?? node);
    const normalized = normalize(title);
    const match = /^(.*?)\s*\(\s*\d+\s*نفر\s*\)\s*,?\s*گروه\s*(\d+)/.exec(normalized);
    if (!match) return null;
    return { name: courseNameKey(match[1]), group: match[2] };
  }

  function mount(table) {
    if (document.documentElement.dataset.fumSelectorMounted === '1') return;
    document.documentElement.dataset.fumSelectorMounted = '1';

    const courses = parseCourses(table);
    const demoMode = document.documentElement.dataset.fseDemo === '1';
    if (courses.length === 0) return;

    // Pooya's checkboxes are only transient controls and may be unchecked even
    // while a course is already present in the calendar. The calendar events
    // are therefore the single source of truth for selected courses.
    let plan = [];
    let query = '';
    let professor = '';
    let status = 'all';

    document.title = 'گروه‌های درسی مجاز | FumSelector';
    injectFont();
    const source = el('div', 'fse-source');
    source.append(...document.body.childNodes);
    document.body.replaceChildren();
    document.body.className = 'fse-page';

    const app = el('main', 'fse-app');
    const planCard = el('section', 'fse-card fse-plan');
    const planHeader = el('div', 'fse-section-head');
    const planTitle = el('div');
    planTitle.append(el('h2', '', 'برنامه هفتگی من'), el('p', '', 'انتخاب‌ها از تقویم اصلی پایین پویا خوانده و با همان رویدادها همگام می‌شوند.'));
    const planActions = el('div', 'fse-plan-actions');
    planHeader.append(planTitle, planActions);
    const planChips = el('div', 'fse-plan-chips');
    const timetable = el('div', 'fse-timetable');
    planCard.append(planHeader, timetable, planChips);

    const filters = el('section', 'fse-card fse-filters');
    const searchWrap = el('label', 'fse-search');
    searchWrap.append(icon('search'));
    const search = document.createElement('input');
    search.type = 'search';
    search.placeholder = 'نام درس، شماره، گروه یا استاد…';
    search.autocomplete = 'off';
    search.setAttribute('aria-label', 'جستجوی درس');
    searchWrap.append(search);

    const professorSelect = document.createElement('select');
    professorSelect.className = 'fse-select';
    professorSelect.setAttribute('aria-label', 'فیلتر استاد');
    const allProfessors = el('option', '', 'همه استادها');
    allProfessors.value = '';
    professorSelect.append(allProfessors);
    [...new Set(courses.map(course => course.professor).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'fa'))
      .forEach(name => {
        const option = el('option', '', name);
        option.value = name;
        professorSelect.append(option);
      });

    const statuses = [
      ['all', 'همه'],
      ['available', 'قابل افزودن'],
      ['selected', 'افزوده‌شده'],
      ['open', 'ظرفیت خالی'],
      ['passed', 'گذرانده‌شده']
    ];
    const statusGroup = el('div', 'fse-segments');
    const statusButtons = new Map();
    for (const [value, label] of statuses) {
      const control = el('button', 'fse-segment', label);
      control.type = 'button';
      control.dataset.value = value;
      control.addEventListener('click', () => {
        status = value;
        render();
      });
      statusButtons.set(value, control);
      statusGroup.append(control);
    }
    filters.append(searchWrap, professorSelect, statusGroup);

    const listCard = el('section', 'fse-card fse-list-card');
    const listHead = el('div', 'fse-list-head');
    const resultCount = el('p', 'fse-result-count');
    listHead.append(el('h2', '', 'لیست درس‌ها'), resultCount);
    const tableWrap = el('div', 'fse-table-wrap');
    const resultTable = el('table', 'fse-table');
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    ['درس', 'استاد', 'واحد', 'زمان برگزاری', 'ظرفیت', ''].forEach(label => {
      headerRow.append(el('th', '', label));
    });
    thead.append(headerRow);
    const tbody = document.createElement('tbody');
    resultTable.append(thead, tbody);
    tableWrap.append(resultTable);
    const empty = el('div', 'fse-empty');
    empty.append(icon('search'), el('h3', '', 'درسی پیدا نشد'), el('p', '', 'عبارت جستجو یا فیلترها را تغییر دهید.'));
    listCard.append(listHead, tableWrap, empty);

    app.append(planCard, filters, listCard);
    document.body.append(source, app);

    search.addEventListener('input', () => {
      query = search.value;
      renderRows();
    });
    professorSelect.addEventListener('change', () => {
      professor = professorSelect.value;
      renderRows();
    });

    function courseCalendarKey(course) {
      return `${courseNameKey(course.name)}/${normalize(course.group)}`;
    }

    function calendarEventsFor(course) {
      const expected = courseCalendarKey(course);
      return [...source.querySelectorAll('.wc-cal-event')].filter(node => {
        const identity = calendarEventIdentity(node);
        return identity && `${identity.name}/${identity.group}` === expected;
      });
    }

    function readPlanFromCalendar() {
      const selectedKeys = new Set(
        [...source.querySelectorAll('.wc-cal-event')]
          .map(calendarEventIdentity)
          .filter(Boolean)
          .map(identity => `${identity.name}/${identity.group}`)
      );
      return courses.filter(course => !course.passed && selectedKeys.has(courseCalendarKey(course)));
    }

    function isSelected(course) {
      return plan.some(selected => selected.id === course.id);
    }

    function syncFromPortal() {
      plan = readPlanFromCalendar();
      render();
    }

    function setCourseSelected(course, selected) {
      const control = course.sourceControl;
      if (course.passed || isSelected(course) === selected) return;

      if (selected) {
        if (!control || control.disabled) return;
        // A real checkbox click runs Pooya's NewEvent(...) add handler. Its
        // checked state is deliberately ignored when reading the current plan.
        if (control.checked) control.checked = false;
        control.click();
      } else {
        // Pooya attaches its real delete behavior to the rendered calendar
        // event. Clicking that event preserves its own request and UI flow.
        const calendarEvent = calendarEventsFor(course)[0];
        if (!calendarEvent) return;
        calendarEvent.click();
      }

      window.setTimeout(syncFromPortal, 80);
      window.setTimeout(syncFromPortal, 600);
      window.setTimeout(syncFromPortal, 1400);
    }

    function sessionsClash(first, second) {
      const firstDay = normalize(first.day).replace(/\s/g, '');
      const secondDay = normalize(second.day).replace(/\s/g, '');
      if (!firstDay || firstDay !== secondDay) return false;
      if (![first.start, first.end, second.start, second.end].every(Number.isFinite)) return false;
      if (first.start >= second.end || second.start >= first.end) return false;

      const oppositeAlternatingWeeks =
        first.alternating &&
        second.alternating &&
        first.parity &&
        second.parity &&
        normalize(first.parity) !== normalize(second.parity);
      return !oppositeAlternatingWeeks;
    }

    function coursesClash(first, second) {
      if (first.id === second.id) return false;
      return (first.sessions ?? []).some(a =>
        (second.sessions ?? []).some(b => sessionsClash(a, b))
      );
    }

    function conflictsFor(course) {
      return plan.filter(selected => coursesClash(course, selected));
    }

    function closeDialog(backdrop) {
      backdrop.remove();
      document.removeEventListener('keydown', backdrop._escapeHandler);
    }

    function showReplacementDialog(course, conflicts) {
      const backdrop = el('div', 'fse-dialog-backdrop');
      const dialog = el('section', 'fse-dialog');
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-modal', 'true');
      dialog.setAttribute('aria-labelledby', 'fse-dialog-title');

      const sign = el('div', 'fse-dialog-sign');
      sign.append(icon('warning'));
      const copy = el('div', 'fse-dialog-copy');
      const title = el('h3', '', `افزودن «${course.name}»؟`);
      title.id = 'fse-dialog-title';
      copy.append(
        title,
        el('p', '', 'این درس با برنامه فعلی تداخل دارد. با اضافه‌کردن آن، درس‌های زیر از انتخاب‌های پویا حذف می‌شوند:')
      );

      const conflictList = el('div', 'fse-dialog-conflicts');
      conflicts.forEach(conflict => {
        const item = el('div', 'fse-dialog-conflict');
        item.append(
          el('strong', '', conflict.name),
          el('span', '', `${conflict.professor || 'استاد اعلام نشده'} · ${conflict.sessions.map(session => session.label).join('، ')}`)
        );
        conflictList.append(item);
      });

      const actions = el('div', 'fse-dialog-actions');
      const cancel = button('انصراف', 'secondary', '', () => closeDialog(backdrop));
      const confirm = button('حذف قبلی و افزودن این درس', 'warning', 'warning', async () => {
        closeDialog(backdrop);
        for (const conflict of conflicts) {
          if (isSelected(conflict)) {
            setCourseSelected(conflict, false);
            await new Promise(resolve => window.setTimeout(resolve, 250));
          }
        }
        setCourseSelected(course, true);
        window.setTimeout(syncFromPortal, 900);
      });
      actions.append(cancel, confirm);
      dialog.append(sign, copy, conflictList, actions);
      backdrop.append(dialog);
      backdrop.addEventListener('click', event => {
        if (event.target === backdrop) closeDialog(backdrop);
      });
      backdrop._escapeHandler = event => {
        if (event.key === 'Escape') closeDialog(backdrop);
      };
      document.addEventListener('keydown', backdrop._escapeHandler);
      document.body.append(backdrop);
      cancel.focus();
    }

    let calendarSyncTimer = 0;
    const calendarObserver = new MutationObserver(() => {
      window.clearTimeout(calendarSyncTimer);
      calendarSyncTimer = window.setTimeout(syncFromPortal, 60);
    });
    calendarObserver.observe(source, { childList: true, subtree: true, characterData: true });

    function filteredCourses() {
      const terms = normalize(query).split(' ').filter(Boolean);
      const selectedIds = new Set(plan.map(item => item.id));
      const selectedCodes = new Set(plan.map(item => item.code));

      return courses
        .filter(course => {
          const haystack = normalize(`${course.name} ${course.code} ${course.group} ${course.professor} ${course.faculty}`);
          if (!terms.every(term => haystack.includes(term))) return false;
          if (professor && normalize(course.professor) !== normalize(professor)) return false;

          const selected = selectedIds.has(course.id);
          if (!course.passed && selectedCodes.has(course.code) && !selected) return false;
          if (status === 'passed') return course.passed;
          if (status === 'selected') return selected;
          if (status === 'available') return !course.passed && !selected;
          if (status === 'open') return !course.passed && (!course.capacity || course.enrolled < course.capacity);
          return true;
        })
        .sort((a, b) => Number(a.passed) - Number(b.passed));
    }

    function renderPlan() {
      timetable.replaceChildren();
      planChips.replaceChildren();
      planActions.replaceChildren();

      renderTimetable();
      if (demoMode) planActions.append(chip('داده‌های نمایشی', 'amber'));

      for (const course of plan) {
        const item = el('span', 'fse-plan-chip');
        item.append(el('strong', '', course.name), el('small', '', `${course.code} · گروه ${course.group}`));
        const remove = el('button', '', '×');
        remove.type = 'button';
        remove.title = `حذف ${course.name}`;
        remove.setAttribute('aria-label', `حذف ${course.name}`);
        remove.addEventListener('click', () => setCourseSelected(course, false));
        item.append(remove);
        planChips.append(item);
      }

      if (plan.length === 0) {
        planChips.append(el('p', 'fse-plan-empty', 'هنوز درسی اضافه نشده؛ از لیست پایین شروع کنید.'));
        return;
      }

      const units = plan.reduce((sum, course) => sum + (Number(course.units) || 0), 0);
      planActions.append(chip(`${plan.length} درس · ${units} واحد`, 'blue'));
    }

    function renderTimetable() {
      const blocks = [];
      plan.forEach((course, courseIndex) => {
        for (const session of course.sessions ?? []) {
          const dayKey = normalize(session.day).replace(/\s/g, '');
          const dayIndex = WEEK_DAYS.findIndex(day => normalize(day).replace(/\s/g, '') === dayKey);
          if (dayIndex === -1 || !Number.isFinite(session.start) || !Number.isFinite(session.end) || session.end <= session.start) continue;
          blocks.push({ course, session, courseIndex, dayIndex, lane: 0 });
        }
      });

      const fromHour = blocks.length ? Math.floor(Math.min(...blocks.map(block => block.session.start)) / 60) : 8;
      const toHour = blocks.length ? Math.ceil(Math.max(...blocks.map(block => block.session.end)) / 60) : 18;
      const spanMinutes = Math.max(60, (toHour - fromHour) * 60);
      const hours = Array.from({ length: toHour - fromHour }, (_, index) => fromHour + index);

      const head = el('div', 'fse-time-head');
      head.append(el('div', 'fse-day-label'));
      const scale = el('div', 'fse-time-scale');
      hours.forEach(hour => scale.append(el('span', '', `${String(hour).padStart(2, '0')}:00`)));
      head.append(scale);
      timetable.append(head);

      blocks.forEach(block => {
        block.conflicting = blocks.some(other =>
          other.course.id !== block.course.id && sessionsClash(block.session, other.session)
        );
      });

      for (let dayIndex = 0; dayIndex < WEEK_DAYS.length; dayIndex += 1) {
        const dayBlocks = blocks
          .filter(block => block.dayIndex === dayIndex)
          .sort((a, b) => a.session.start - b.session.start);
        const laneEnds = [];
        for (const block of dayBlocks) {
          let lane = laneEnds.findIndex(end => end <= block.session.start);
          if (lane === -1) {
            lane = laneEnds.length;
            laneEnds.push(block.session.end);
          } else {
            laneEnds[lane] = block.session.end;
          }
          block.lane = lane;
        }

        const row = el('div', 'fse-time-row');
        row.append(el('div', 'fse-day-label', WEEK_DAYS[dayIndex]));
        const track = el('div', 'fse-time-track');
        track.style.height = `${Math.max(1, laneEnds.length) * 50 + 6}px`;
        hours.forEach((_hour, index) => {
          const line = el('i', 'fse-grid-line');
          line.style.right = `${(index / hours.length) * 100}%`;
          track.append(line);
        });

        for (const block of dayBlocks) {
          const startOffset = block.session.start - fromHour * 60;
          const duration = block.session.end - block.session.start;
          const courseBlock = el('div', 'fse-course-block');
          const [background, border] = COURSE_COLOURS[block.courseIndex % COURSE_COLOURS.length];
          courseBlock.style.right = `calc(${(startOffset / spanMinutes) * 100}% + 2px)`;
          courseBlock.style.width = `calc(${(duration / spanMinutes) * 100}% - 4px)`;
          courseBlock.style.top = `${block.lane * 50 + 4}px`;
          courseBlock.style.setProperty('--fse-block', background);
          courseBlock.style.setProperty('--fse-block-border', border);
          if (block.conflicting) courseBlock.classList.add('fse-course-block--conflict');
          courseBlock.title = `${block.course.name} — ${block.session.label}${block.session.room ? ` — کلاس ${block.session.room}` : ''}`;
          const remove = el('button', 'fse-block-remove', '×');
          remove.type = 'button';
          remove.title = `حذف ${block.course.name}`;
          remove.setAttribute('aria-label', `حذف ${block.course.name}`);
          remove.addEventListener('click', event => {
            event.stopPropagation();
            setCourseSelected(block.course, false);
          });
          courseBlock.append(
            remove,
            el('strong', '', block.course.name),
            el('em', '', block.course.professor || 'استاد اعلام نشده'),
            el('span', '', `${clock(block.session.start)}–${clock(block.session.end)}${block.session.alternating ? ` · ${block.session.parity || 'یک‌هفته‌درمیان'}` : ''}${block.session.room ? ` · ${block.session.room}` : ''}`)
          );
          if (block.conflicting) {
            const warning = el('b', 'fse-block-warning');
            warning.append(icon('warning'), document.createTextNode('تداخل'));
            courseBlock.append(warning);
          }
          track.append(courseBlock);
        }
        row.append(track);
        timetable.append(row);
      }
    }

    function renderRows() {
      const visible = filteredCourses();
      tbody.replaceChildren();
      resultCount.textContent = `${visible.length} درس از ${courses.length} درس`;
      tableWrap.hidden = visible.length === 0;
      empty.hidden = visible.length !== 0;

      for (const course of visible) {
        const selected = isSelected(course);
        const conflicts = selected || course.passed ? [] : conflictsFor(course);
        const row = document.createElement('tr');
        if (course.passed) row.className = 'fse-row--passed';
        else if (selected) row.className = 'fse-row--selected';

        const courseCell = el('td', 'fse-course-cell');
        const courseTitle = el('div', 'fse-course-title', course.name || 'بدون نام');
        const metadata = el('div', 'fse-metadata');
        metadata.append(
          chip(course.code, 'blue'),
          chip(`گروه ${course.group}`, 'blue-soft'),
          chip(course.faculty || 'دانشکده نامشخص', 'neutral')
        );
        courseCell.append(courseTitle, metadata);

        const professorCell = el('td', 'fse-professor');
        professorCell.append(
          course.professor
            ? chip(course.professor, 'professor')
            : el('span', 'fse-muted', 'اعلام نشده')
        );

        const unitsCell = document.createElement('td');
        unitsCell.append(chip(String(course.units), 'amber'));

        const timeCell = el('td', 'fse-times');
        if (course.sessions.length === 0) {
          timeCell.append(el('span', 'fse-muted', 'زمان ثبت نشده'));
        } else {
          course.sessions.forEach(session => timeCell.append(chip(session.label, 'purple', session.room ? `کلاس ${session.room}` : session.raw)));
        }
        if (conflicts.length > 0) {
          const note = el('span', 'fse-conflict-note');
          note.append(
            icon('warning'),
            document.createTextNode(`تداخل با ${conflicts.map(conflict => `«${conflict.name}»`).join(' و ')}`)
          );
          timeCell.append(note);
        }

        const capacityCell = document.createElement('td');
        const left = course.capacity ? Math.max(0, course.capacity - course.enrolled) : null;
        if (left === null) capacityCell.append(chip('—', 'neutral', 'ظرفیت نامشخص'));
        else capacityCell.append(chip(String(left), left === 0 ? 'red' : 'green', left === 0 ? 'ظرفیت تکمیل است' : `${left} جای خالی`));

        const actionCell = el('td', 'fse-action');
        if (course.passed) {
          const passed = el('span', 'fse-passed-label');
          passed.append(icon('check'), document.createTextNode('گذرانده‌شده'));
          actionCell.append(passed);
        } else if (selected) {
          actionCell.append(button('حذف', 'danger', 'trash', () => setCourseSelected(course, false)));
        } else {
          const addButton = button(
            'افزودن',
            conflicts.length > 0 ? 'warning' : 'primary',
            conflicts.length > 0 ? 'warning' : 'plus',
            () => conflicts.length > 0
              ? showReplacementDialog(course, conflicts)
              : setCourseSelected(course, true)
          );
          if (!course.sourceControl) {
            addButton.disabled = true;
            addButton.title = 'این ردیف در پویا کنترل انتخاب ندارد';
          }
          actionCell.append(addButton);
        }

        row.append(courseCell, professorCell, unitsCell, timeCell, capacityCell, actionCell);
        tbody.append(row);
      }
    }

    function render() {
      for (const [value, control] of statusButtons) {
        control.classList.toggle('is-active', value === status);
        control.setAttribute('aria-pressed', String(value === status));
      }
      renderPlan();
      renderRows();
    }

    plan = readPlanFromCalendar();
    render();
  }

  function boot() {
    // The extension is injected into every Pooya frame so it can reach
    // `LeftScr`, but only this document should be redesigned.
    const isDemo = document.documentElement.dataset.fseDemo === '1';
    if (!isDemo && !/\/ShowCoursesWithPreSelect\.php$/i.test(location.pathname)) return;

    const started = Date.now();
    const tryMount = () => {
      const table = findCourseTable();
      if (table) {
        mount(table);
        return true;
      }
      return false;
    };

    if (tryMount()) return;
    const observer = new MutationObserver(() => {
      if (tryMount() || Date.now() - started > MAX_WAIT_MS) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.setTimeout(() => observer.disconnect(), MAX_WAIT_MS);
  }

  boot();
})();
