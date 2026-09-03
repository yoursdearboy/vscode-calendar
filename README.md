# Daily Calendar for Positron

Adds a clickable **Calendar** section to the Explorer. Click a day and the extension creates or opens `yyyy-mm-dd.md` in the workspace root.

Use the arrows in the view title to change months. The calendar button returns to the current month.

Download [vsix file](https://github.com/yoursdearboy/vscode-calendar/releases/download/0.0.2/positron-daily-calendar-0.0.2.vsix) and install using Extensions pane.

## Settings

- `dailyCalendar.notesFolder` — workspace-relative destination folder (default: workspace root; leave empty)
- `dailyCalendar.noteTemplate` — content for each new note; `${date}` becomes the date

The extension needs an opened workspace folder to create notes.
