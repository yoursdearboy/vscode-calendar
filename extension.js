const vscode = require('vscode');

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function pad(number) { return String(number).padStart(2, '0'); }
function dateKey(date) { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`; }
function parseDate(value) {
  const parts = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return parts ? new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3])) : undefined;
}

class CalendarViewProvider {
  constructor() {
    this.currentMonth = new Date();
    this.currentMonth.setDate(1);
    this.view = undefined;
  }

  resolveWebviewView(view) {
    this.view = view;
    view.webview.options = { enableScripts: true };
    view.webview.html = this.html();
    view.webview.onDidReceiveMessage(async (message) => {
      if (message.type === 'previousMonth') this.changeMonth(-1);
      if (message.type === 'nextMonth') this.changeMonth(1);
      if (message.type === 'today') this.goToToday();
      if (message.type === 'createNote') {
        const date = parseDate(message.date);
        if (date) await createDailyNote(date);
      }
    });
  }

  changeMonth(delta) {
    this.currentMonth.setMonth(this.currentMonth.getMonth() + delta);
    this.update();
  }

  goToToday() {
    this.currentMonth = new Date();
    this.currentMonth.setDate(1);
    this.update();
  }

  update() {
    if (this.view) this.view.webview.html = this.html();
  }

  html() {
    const year = this.currentMonth.getFullYear();
    const month = this.currentMonth.getMonth();
    const today = new Date();
    const first = new Date(year, month, 1);
    const mondayOffset = (first.getDay() + 6) % 7;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let index = 0; index < mondayOffset; index += 1) cells.push('<span class="blank"></span>');
    for (let day = 1; day <= lastDay; day += 1) {
      const date = new Date(year, month, day);
      const isToday = dateKey(date) === dateKey(today);
      cells.push(`<button class="day${isToday ? ' today' : ''}" data-date="${dateKey(date)}" title="Create or open ${dateKey(date)}.md">${day}</button>`);
    }
    const title = this.currentMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>
      body { color: var(--vscode-foreground); font-family: var(--vscode-font-family); font-size: 12px; margin: 0; padding: 8px 10px 12px; }
      .toolbar { align-items: center; display: flex; gap: 4px; margin-bottom: 9px; }
      .month { flex: 1; font-weight: 600; text-align: center; }
      button { background: transparent; border: 0; color: var(--vscode-foreground); cursor: pointer; font-family: inherit; }
      .nav { border-radius: 3px; font-size: 16px; height: 24px; line-height: 20px; padding: 0; width: 24px; }
      .nav:hover, .day:hover { background: var(--vscode-list-hoverBackground); }
      .weekdays, .days { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; text-align: center; }
      .weekdays { color: var(--vscode-descriptionForeground); font-size: 10px; margin-bottom: 4px; }
      .day { aspect-ratio: 1; border-radius: 3px; font-size: 12px; min-height: 25px; padding: 0; }
      .today { background: var(--vscode-button-background); color: var(--vscode-button-foreground); font-weight: 700; }
      .today:hover { background: var(--vscode-button-hoverBackground); }
      .blank { min-height: 25px; }
      .hint { color: var(--vscode-descriptionForeground); font-size: 11px; margin: 10px 0 0; text-align: center; }
    </style></head><body>
    <div class="toolbar"><button class="nav" id="previous" title="Previous month">‹</button><span class="month">${title}</span><button class="nav" id="next" title="Next month">›</button></div>
    <div class="weekdays">${WEEKDAYS.map((day) => `<span>${day}</span>`).join('')}</div><div class="days">${cells.join('')}</div>
    <button class="hint" id="today">Today</button>
    <script>
      const vscode = acquireVsCodeApi();
      document.getElementById('previous').onclick = () => vscode.postMessage({ type: 'previousMonth' });
      document.getElementById('next').onclick = () => vscode.postMessage({ type: 'nextMonth' });
      document.getElementById('today').onclick = () => vscode.postMessage({ type: 'today' });
      document.querySelectorAll('.day').forEach((button) => button.onclick = () => vscode.postMessage({ type: 'createNote', date: button.dataset.date }));
    </script></body></html>`;
  }
}

async function createDailyNote(date) {
  const folder = vscode.workspace.getConfiguration('dailyCalendar').get('notesFolder', '').trim();
  const workspaceFolder = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0];
  if (!workspaceFolder) return vscode.window.showErrorMessage('Daily Calendar needs an opened workspace folder.');
  const directoryParts = folder.split('/').filter(Boolean);
  const noteUri = vscode.Uri.joinPath(workspaceFolder.uri, ...directoryParts, `${dateKey(date)}.md`);
  try {
    await vscode.workspace.fs.stat(noteUri);
  } catch {
    if (directoryParts.length) {
      const directory = vscode.Uri.joinPath(workspaceFolder.uri, ...directoryParts);
      await vscode.workspace.fs.createDirectory(directory);
    }
    const template = vscode.workspace.getConfiguration('dailyCalendar').get('noteTemplate', '# ${date}\n\n');
    await vscode.workspace.fs.writeFile(noteUri, Buffer.from(template.replaceAll('${date}', dateKey(date)), 'utf8'));
  }
  const document = await vscode.workspace.openTextDocument(noteUri);
  await vscode.window.showTextDocument(document);
}

function activate(context) {
  const provider = new CalendarViewProvider();
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('dailyCalendar.calendar', provider),
    vscode.commands.registerCommand('dailyCalendar.previousMonth', () => provider.changeMonth(-1)),
    vscode.commands.registerCommand('dailyCalendar.nextMonth', () => provider.changeMonth(1)),
    vscode.commands.registerCommand('dailyCalendar.goToToday', () => provider.goToToday()),
    vscode.commands.registerCommand('dailyCalendar.createDailyNote', () => createDailyNote(new Date()))
  );
}

function deactivate() {}
module.exports = { activate, deactivate };
