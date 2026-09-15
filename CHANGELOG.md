# Changelog

## 1.5.2

- Restored the portal tooltip parser for the eligible-course table's time column.
- Read timetable placement from Pooya's calendar event day and displayed time,
  including when the portal reports zero event geometry.
- Keep the source calendar off-screen instead of removing it from layout and
  size the portal iframe to prevent a blank embedded page.
- Added enrolled-count chips and overflow-capacity warnings to selected courses.
- Removed source comments from the extension files.

## 1.5.1

- Removed tooltip-based session parsing entirely.
- Read course metadata and row state directly from Pooya's eligible-course
  table; retain its non-white row colours in the redesigned list.
- Read selected-course timing exclusively from the weekly calendar table.

## 1.5.0

- Read the selected plan's day, start/end time, room and odd/even-week marker
  directly from Pooya's weekly calendar cells.
- Show the selected instructor as a chip alongside every selected course.

## 1.4.1

- Reduced table layout and paint work for smoother scrolling.
- Simplified the README to a short English overview and installation guide.

## 1.4.0

- Restyled Pooya's original delete confirmation dialog while preserving its callbacks.
- Added icons to every status filter.
- Excluded timetable conflicts from the `قابل افزودن` filter.
- Added ascending and descending sorting to every course-table column.
- Simplified the project README.

## 1.3.0

- Read selected courses from Pooya's `.wc-cal-event` calendar instead of stale
  checkbox state.
- Route removal through the matching original Pooya calendar event.
- Detect timetable overlaps and mark conflicting blocks.
- Show instructor names and remove controls inside timetable blocks.
- Highlight conflicting add buttons and show a replacement confirmation dialog.
- Centre all course-table content and schedule chips.
- Display unit and remaining capacity as numbers only.
- Bundle Vazirmatn locally and keep the extension toolbar action popup-free.

## 1.2.0

- Added the fitted Saturday-to-Wednesday weekly schedule.
- Added compact course rows, instructor chips and portal-backed actions.
- Marked Pooya's blue rows as completed and moved them to the end.
