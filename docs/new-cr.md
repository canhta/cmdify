# Cmdify New Features - Change Request

This document defines new features for Cmdify VS Code extension. All features are scoped to what a VS Code extension can realistically implement.

---

## 🎯 Scope & Limitations

### What VS Code Extensions CAN Do
- ✅ Track editor activity (file opens, saves, edits)
- ✅ Track language/file types being edited
- ✅ Detect window focus/blur (VS Code only)
- ✅ Run timers and show notifications
- ✅ Scan workspace files for patterns
- ✅ Modify code files (with user permission)
- ✅ Show webviews, sidebars, status bar items
- ✅ Access git information via VS Code API

### What VS Code Extensions CANNOT Do
- ❌ Track other applications (browser, Slack, etc.)
- ❌ Monitor system-wide activity
- ❌ Track outside of VS Code window
- ❌ Access calendar/email without external OAuth
- ❌ Run when VS Code is closed

---

## Feature 1: 🧠 Focus Timer with Animated Companion

### Problem
Developers need help staying focused. Traditional Pomodoro timers are boring and don't encourage consistent use.

### Solution
A fun, gamified focus timer with an animated companion that lives in VS Code.

### Implementation

#### 1.1 Timer Service

```typescript
// src/services/focus.ts

interface FocusConfig {
  focusDuration: number;        // minutes, default 25
  shortBreakDuration: number;   // minutes, default 5
  longBreakDuration: number;    // minutes, default 15
  sessionsBeforeLongBreak: number; // default 4
  soundEnabled: boolean;
  autoStartBreak: boolean;
}

interface FocusState {
  status: "idle" | "focusing" | "break" | "paused";
  timeRemaining: number;        // seconds
  currentSession: number;       // 1-4
  todaySessions: number;
  todayFocusMinutes: number;
}

interface FocusStats {
  // Stored in globalState
  totalSessions: number;
  totalFocusMinutes: number;
  currentStreak: number;        // consecutive days with 1+ session
  longestStreak: number;
  lastSessionDate: string;      // YYYY-MM-DD
}

class FocusService {
  private timer: NodeJS.Timer | null = null;
  private state: FocusState;
  private config: FocusConfig;
  
  start(): void;
  pause(): void;
  resume(): void;
  stop(): void;
  skip(): void;  // skip to next phase
  
  // Events
  onTick: Event<number>;        // remaining seconds
  onSessionComplete: Event<void>;
  onBreakStart: Event<void>;
  onBreakComplete: Event<void>;
}
```

#### 1.2 Animated Companion

The companion is displayed in a sidebar webview using CSS animations or Lottie.

```typescript
// src/services/companion.ts

type CompanionType = "cat" | "robot" | "plant" | "flame";

interface CompanionState {
  type: CompanionType;
  level: number;              // 1-100
  experience: number;
  mood: "happy" | "focused" | "tired" | "excited";
  unlockedCompanions: CompanionType[];
  unlockedAccessories: string[];
}

// XP rewards
const XP_REWARDS = {
  completedSession: 100,
  tookBreak: 50,
  dailyGoal: 200,         // completing 4 sessions
  weekStreak: 500,
};

// Level thresholds
const LEVEL_XP = [0, 100, 300, 600, 1000, 1500, ...]; // exponential

// Companion animations (CSS keyframes or Lottie JSON)
type Animation = "idle" | "working" | "celebrating" | "sleeping" | "break";
```

**Webview HTML Structure:**
```html
<!-- src/views/companion.html -->
<div class="companion-container">
  <div class="companion" data-type="cat" data-animation="idle">
    <!-- SVG or animated sprite -->
  </div>
  <div class="timer-display">25:00</div>
  <div class="controls">
    <button id="start">Start Focus</button>
    <button id="pause">Pause</button>
    <button id="skip">Skip</button>
  </div>
  <div class="stats">
    <span class="level">Level 5</span>
    <span class="xp">450/600 XP</span>
    <span class="streak">🔥 7 day streak</span>
  </div>
</div>
```

#### 1.3 Status Bar Integration

```typescript
// src/extension.ts - Status bar setup

const statusBarItem = vscode.window.createStatusBarItem(
  vscode.StatusBarAlignment.Right, 
  100
);

// Display format: "🐱 25:00 🔥3"
function updateStatusBar(state: FocusState, companion: CompanionState) {
  const emoji = getCompanionEmoji(companion.type, state.status);
  const time = formatTime(state.timeRemaining);
  const streak = companion.currentStreak > 0 ? `🔥${companion.currentStreak}` : "";
  
  statusBarItem.text = `${emoji} ${time} ${streak}`;
  statusBarItem.tooltip = `Focus Timer - Click to open panel`;
  statusBarItem.command = "cmdify.focus.showPanel";
}
```

#### 1.4 Achievements System

```typescript
// src/models/achievements.ts

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  condition: (stats: FocusStats) => boolean;
}

const ACHIEVEMENTS: Achievement[] = [
  {
    id: "first_focus",
    name: "First Focus",
    description: "Complete your first focus session",
    icon: "🎯",
    condition: (s) => s.totalSessions >= 1,
  },
  {
    id: "streak_7",
    name: "Week Warrior", 
    description: "Maintain a 7-day streak",
    icon: "🔥",
    condition: (s) => s.currentStreak >= 7,
  },
  {
    id: "centurion",
    name: "Centurion",
    description: "Complete 100 focus sessions",
    icon: "💯",
    condition: (s) => s.totalSessions >= 100,
  },
  {
    id: "deep_diver",
    name: "Deep Diver",
    description: "Complete a 60-minute session",
    icon: "🏊",
    condition: (s) => s.longestSessionMinutes >= 60,
  },
];
```

### Commands

| Command | Description |
|---------|-------------|
| `cmdify.focus.start` | Start a focus session |
| `cmdify.focus.pause` | Pause current session |
| `cmdify.focus.stop` | Stop and reset timer |
| `cmdify.focus.skip` | Skip to break/next session |
| `cmdify.focus.showPanel` | Open companion panel |

### Settings

```json
{
  "cmdify.focus.focusDuration": 25,
  "cmdify.focus.shortBreakDuration": 5,
  "cmdify.focus.longBreakDuration": 15,
  "cmdify.focus.sessionsBeforeLongBreak": 4,
  "cmdify.focus.soundEnabled": true,
  "cmdify.focus.companionType": "cat"
}
```
```

---

## Feature 2: 🔔 TODO Scanner & Reminder System

### Problem
TODO comments accumulate in codebases and are forgotten. Developers need visibility and reminders.

### Solution
Scan workspace for TODOs, display in sidebar, allow setting reminders that sync back to code comments.

### Implementation

#### 2.1 TODO Scanner Service

```typescript
// src/services/todoScanner.ts

interface TodoPattern {
  regex: RegExp;
  type: string;
}

const DEFAULT_PATTERNS: TodoPattern[] = [
  { regex: /\/\/\s*TODO[:\s](.+)/gi, type: "TODO" },
  { regex: /\/\/\s*FIXME[:\s](.+)/gi, type: "FIXME" },
  { regex: /\/\/\s*HACK[:\s](.+)/gi, type: "HACK" },
  { regex: /\/\/\s*XXX[:\s](.+)/gi, type: "XXX" },
  { regex: /#\s*TODO[:\s](.+)/gi, type: "TODO" },  // Python
];

// Date pattern: @2024-12-01 or @tomorrow or @next-week
const DATE_PATTERN = /@(\d{4}-\d{2}-\d{2}|tomorrow|next-week|next-month)/i;

interface DetectedTodo {
  id: string;                   // hash(filePath + lineNumber)
  filePath: string;
  lineNumber: number;
  type: string;                 // TODO, FIXME, etc.
  text: string;                 // full comment text
  description: string;          // extracted description
  dueDate?: Date;               // parsed from @date
  priority?: "low" | "medium" | "high";
}

class TodoScannerService {
  private todos: Map<string, DetectedTodo> = new Map();
  
  // Scan entire workspace
  async scanWorkspace(): Promise<DetectedTodo[]>;
  
  // Scan single file (on save)
  async scanFile(uri: vscode.Uri): Promise<DetectedTodo[]>;
  
  // Get all todos
  getTodos(): DetectedTodo[];
  
  // Get todos due today/overdue
  getDueTodos(): DetectedTodo[];
}
```

#### 2.2 Two-Way Sync

When user adds a reminder, rewrite the TODO comment:

```typescript
// src/services/todoSync.ts

class TodoSyncService {
  // Add date to TODO comment
  async addReminder(todo: DetectedTodo, dueDate: Date): Promise<void> {
    const document = await vscode.workspace.openTextDocument(todo.filePath);
    const line = document.lineAt(todo.lineNumber);
    const dateStr = formatDate(dueDate); // YYYY-MM-DD
    
    // Transform: // TODO: fix bug
    // Into:      // TODO(@2024-12-01): fix bug
    const newText = line.text.replace(
      /(\/\/\s*TODO)(\s*:?\s*)/i,
      `$1(@${dateStr}): `
    );
    
    const edit = new vscode.WorkspaceEdit();
    edit.replace(document.uri, line.range, newText);
    await vscode.workspace.applyEdit(edit);
  }
  
  // Remove date when completed
  async markComplete(todo: DetectedTodo): Promise<void> {
    // Option 1: Remove the date tag
    // Option 2: Change TODO to DONE
    // Option 3: Delete the line (with confirmation)
  }
}
```

**Example transformations:**
```typescript
// Before adding reminder:
// TODO: Fix the authentication bug

// After adding reminder for Dec 1:  
// TODO(@2024-12-01): Fix the authentication bug

// After marking complete (option 2):
// DONE(@2024-12-01): Fix the authentication bug
```

#### 2.3 Reminder Notifications

```typescript
// src/services/reminder.ts

class ReminderService {
  private checkInterval: NodeJS.Timer;
  
  constructor(private todoScanner: TodoScannerService) {
    // Check every minute
    this.checkInterval = setInterval(() => this.checkDueTodos(), 60000);
  }
  
  private async checkDueTodos() {
    const now = new Date();
    const todos = this.todoScanner.getTodos();
    
    for (const todo of todos) {
      if (todo.dueDate && this.isDueNow(todo.dueDate, now)) {
        this.showNotification(todo);
      }
    }
  }
  
  private showNotification(todo: DetectedTodo) {
    vscode.window.showInformationMessage(
      `📌 Reminder: ${todo.description}`,
      "Go to Code",
      "Snooze 1h",
      "Complete"
    ).then(action => {
      if (action === "Go to Code") {
        this.openTodo(todo);
      } else if (action === "Snooze 1h") {
        this.snoozeTodo(todo, 60);
      } else if (action === "Complete") {
        this.completeTodo(todo);
      }
    });
  }
}
```

#### 2.4 Sidebar Tree View

```typescript
// src/views/todoTreeProvider.ts

class TodoTreeProvider implements vscode.TreeDataProvider<TodoItem> {
  getChildren(element?: TodoItem): TodoItem[] {
    if (!element) {
      // Root level - show categories
      return [
        new TodoItem("Overdue", "category", this.getOverdue()),
        new TodoItem("Today", "category", this.getToday()),
        new TodoItem("This Week", "category", this.getThisWeek()),
        new TodoItem("No Date", "category", this.getNoDate()),
      ];
    }
    return element.children;
  }
}

// Tree item with context menu
class TodoItem extends vscode.TreeItem {
  contextValue = "todo"; // enables right-click menu
}
```

**package.json contribution:**
```json
{
  "contributes": {
    "views": {
      "cmdify": [
        {
          "id": "cmdify.todos",
          "name": "TODOs & Reminders"
        }
      ]
    },
    "menus": {
      "view/item/context": [
        {
          "command": "cmdify.todo.goToCode",
          "when": "view == cmdify.todos && viewItem == todo"
        },
        {
          "command": "cmdify.todo.setReminder",
          "when": "view == cmdify.todos && viewItem == todo"
        },
        {
          "command": "cmdify.todo.complete",
          "when": "view == cmdify.todos && viewItem == todo"
        }
      ]
    }
  }
}
```

#### 2.5 Global Reminders

For reminders not tied to code:

```typescript
interface GlobalReminder {
  id: string;
  title: string;
  description?: string;
  dueAt: Date;
  recurring?: "daily" | "weekly" | "monthly";
  workspace?: string;  // optional workspace association
  status: "pending" | "completed" | "snoozed";
}

// Stored in globalState
// Can be synced via Gist with commands
```

### Commands

| Command | Description |
|---------|-------------|
| `cmdify.todos.scan` | Manually scan workspace |
| `cmdify.todos.showPanel` | Open TODO sidebar |
| `cmdify.todo.setReminder` | Set reminder for TODO |
| `cmdify.todo.complete` | Mark TODO as complete |
| `cmdify.todo.goToCode` | Navigate to TODO in code |
| `cmdify.reminder.addGlobal` | Add global reminder |

### Settings

```json
{
  "cmdify.todos.includePatterns": ["**/*.ts", "**/*.js", "**/*.py"],
  "cmdify.todos.excludePatterns": ["**/node_modules/**", "**/dist/**"],
  "cmdify.todos.scanOnSave": true,
  "cmdify.todos.customPatterns": [],
  "cmdify.reminder.notificationSound": true
}
```

---

## Feature 3: 📊 Coding Activity Dashboard

### Problem
Developers want to understand their coding habits but most tools require external tracking.

### Solution
Track only what VS Code can observe: languages used, files edited, time active in editor.

### What We CAN Track (VS Code API)

| Metric | How to Track | API |
|--------|--------------|-----|
| Active file language | `vscode.window.activeTextEditor?.document.languageId` | ✅ |
| File opens/saves | `vscode.workspace.onDidOpenTextDocument`, `onDidSaveTextDocument` | ✅ |
| Text changes | `vscode.workspace.onDidChangeTextDocument` | ✅ |
| Window focus | `vscode.window.onDidChangeWindowState` | ✅ |
| Time in editor | Calculate from focus events | ✅ |
| Git branch | `vscode.extensions.getExtension('vscode.git')` | ✅ |
| Workspace info | `vscode.workspace.workspaceFolders` | ✅ |

### What We CANNOT Track

| Metric | Why Not |
|--------|---------|
| Browser usage | No OS access |
| Other apps | No OS access |
| System idle | No OS access |
| Outside VS Code | Extension not running |

### Implementation

#### 3.1 Activity Tracker Service

```typescript
// src/services/activityTracker.ts

interface ActivityEvent {
  timestamp: Date;
  type: "file_open" | "file_save" | "text_change" | "focus" | "blur";
  language?: string;
  filePath?: string;
  linesChanged?: number;
}

interface DailyStats {
  date: string;  // YYYY-MM-DD
  
  // Time tracking (only when VS Code focused)
  activeMinutes: number;
  
  // Language breakdown
  languageMinutes: Record<string, number>;
  
  // File activity
  filesOpened: number;
  filesSaved: number;
  linesAdded: number;
  linesRemoved: number;
  
  // Commands (Cmdify commands only)
  commandsRun: number;
  
  // Focus sessions (from Focus Timer feature)
  focusSessions: number;
  focusMinutes: number;
  
  // Detected tech stack
  detectedTech: string[];
}

class ActivityTrackerService {
  private currentSession: {
    startTime: Date;
    language: string | null;
    isActive: boolean;
  };
  
  private todayStats: DailyStats;
  
  constructor() {
    this.setupListeners();
    this.loadTodayStats();
  }
  
  private setupListeners() {
    // Track window focus
    vscode.window.onDidChangeWindowState((e) => {
      if (e.focused) {
        this.onFocus();
      } else {
        this.onBlur();
      }
    });
    
    // Track active editor changes
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        this.onLanguageChange(editor.document.languageId);
      }
    });
    
    // Track file saves
    vscode.workspace.onDidSaveTextDocument((doc) => {
      this.todayStats.filesSaved++;
    });
    
    // Track text changes (debounced)
    vscode.workspace.onDidChangeTextDocument((e) => {
      this.onTextChange(e);
    });
  }
  
  private onFocus() {
    this.currentSession.startTime = new Date();
    this.currentSession.isActive = true;
  }
  
  private onBlur() {
    if (this.currentSession.isActive) {
      const minutes = this.calculateMinutes(this.currentSession.startTime);
      this.todayStats.activeMinutes += minutes;
      
      if (this.currentSession.language) {
        this.todayStats.languageMinutes[this.currentSession.language] = 
          (this.todayStats.languageMinutes[this.currentSession.language] || 0) + minutes;
      }
    }
    this.currentSession.isActive = false;
  }
  
  // Save stats periodically and on deactivate
  async saveStats(): Promise<void>;
  
  // Get historical data
  getStats(days: number): DailyStats[];
}
```

#### 3.2 Tech Stack Detection

```typescript
// src/services/techDetector.ts

interface DetectedStack {
  languages: string[];
  frameworks: string[];
  tools: string[];
}

class TechDetectorService {
  async detectStack(workspaceFolder: vscode.Uri): Promise<DetectedStack> {
    const stack: DetectedStack = {
      languages: [],
      frameworks: [],
      tools: [],
    };
    
    // Check package.json
    const packageJson = await this.readPackageJson(workspaceFolder);
    if (packageJson) {
      stack.frameworks.push(...this.detectNodeFrameworks(packageJson));
    }
    
    // Check for config files
    const files = await vscode.workspace.findFiles("*", "**/node_modules/**");
    for (const file of files) {
      const name = path.basename(file.fsPath);
      if (name === "Dockerfile") stack.tools.push("Docker");
      if (name === "docker-compose.yml") stack.tools.push("Docker Compose");
      if (name.match(/\.github\/workflows/)) stack.tools.push("GitHub Actions");
      if (name === "Cargo.toml") stack.languages.push("Rust");
      if (name === "go.mod") stack.languages.push("Go");
      if (name === "requirements.txt") stack.languages.push("Python");
    }
    
    return stack;
  }
  
  private detectNodeFrameworks(pkg: any): string[] {
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    const frameworks: string[] = [];
    
    if (deps.react) frameworks.push("React");
    if (deps.vue) frameworks.push("Vue");
    if (deps.angular) frameworks.push("Angular");
    if (deps.next) frameworks.push("Next.js");
    if (deps.express) frameworks.push("Express");
    if (deps.nestjs) frameworks.push("NestJS");
    
    return frameworks;
  }
}
```

#### 3.3 Dashboard Webview

```typescript
// src/views/dashboard.ts

class DashboardPanel {
  private panel: vscode.WebviewPanel;
  
  async show(stats: DailyStats[]) {
    this.panel = vscode.window.createWebviewPanel(
      "cmdify.dashboard",
      "Coding Activity",
      vscode.ViewColumn.One,
      { enableScripts: true }
    );
    
    this.panel.webview.html = this.getHtml(stats);
  }
  
  private getHtml(stats: DailyStats[]): string {
    // Use a simple charting library like Chart.js
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
      </head>
      <body>
        <h1>Your Coding Activity</h1>
        
        <div class="summary">
          <div class="stat">
            <span class="value">${stats[0].activeMinutes}</span>
            <span class="label">Minutes Today</span>
          </div>
          <div class="stat">
            <span class="value">${stats[0].filesSaved}</span>
            <span class="label">Files Saved</span>
          </div>
        </div>
        
        <canvas id="languageChart"></canvas>
        <canvas id="weeklyChart"></canvas>
        
        <script>
          const langData = ${JSON.stringify(stats[0].languageMinutes)};
          const weeklyData = ${JSON.stringify(stats.map(s => s.activeMinutes))};
          // Chart.js initialization
        </script>
      </body>
      </html>
    `;
  }
}
```

#### 3.4 Data Storage

```typescript
// Storage schema

// globalState keys:
// "analytics.daily" - array of last 90 days of DailyStats
// "analytics.allTime" - aggregated all-time stats

interface AllTimeStats {
  totalActiveHours: number;
  totalFilesModified: number;
  totalLinesWritten: number;
  languageHours: Record<string, number>;
  longestStreak: number;
  currentStreak: number;
  firstTrackedDate: string;
}

// Data retention: keep 90 days of daily stats
// Older data is aggregated into allTime stats
```

### Commands

| Command | Description |
|---------|-------------|
| `cmdify.analytics.showDashboard` | Open activity dashboard |
| `cmdify.analytics.showToday` | Quick today summary notification |
| `cmdify.analytics.exportData` | Export stats as JSON |

### Settings

```json
{
  "cmdify.analytics.enabled": true,
  "cmdify.analytics.trackLanguages": true,
  "cmdify.analytics.retentionDays": 90
}
```

---

## Implementation Roadmap

### Phase 1: Focus Timer (Week 1-2)

| Task | Files | Priority |
|------|-------|----------|
| FocusService with timer logic | `src/services/focus.ts` | P0 |
| Status bar item | `src/extension.ts` | P0 |
| Basic companion webview | `src/views/companion.ts` | P1 |
| CSS animations for companion | `media/companion.css` | P1 |
| XP/Level system | `src/services/companion.ts` | P2 |
| Achievements | `src/models/achievements.ts` | P2 |
| Stats persistence | `src/services/storage.ts` | P1 |

### Phase 2: TODO Scanner & Reminders (Week 3-4)

| Task | Files | Priority |
|------|-------|----------|
| TODO scanner service | `src/services/todoScanner.ts` | P0 |
| Sidebar tree view | `src/views/todoTreeProvider.ts` | P0 |
| Two-way sync (date in code) | `src/services/todoSync.ts` | P1 |
| Reminder notifications | `src/services/reminder.ts` | P1 |
| Context menu integration | `package.json` | P1 |
| Global reminders | `src/services/reminder.ts` | P2 |

### Phase 3: Activity Dashboard (Week 5-6)

| Task | Files | Priority |
|------|-------|----------|
| Activity tracker service | `src/services/activityTracker.ts` | P0 |
| Language time tracking | `src/services/activityTracker.ts` | P0 |
| Tech stack detection | `src/services/techDetector.ts` | P2 |
| Dashboard webview | `src/views/dashboard.ts` | P1 |
| Charts with Chart.js | `media/dashboard.js` | P1 |

---

## File Structure

```
src/
├── extension.ts              # Main entry, register commands
├── services/
│   ├── focus.ts              # Focus timer logic
│   ├── companion.ts          # Companion state & XP
│   ├── todoScanner.ts        # Scan workspace for TODOs
│   ├── todoSync.ts           # Two-way TODO/code sync
│   ├── reminder.ts           # Reminder notifications
│   ├── activityTracker.ts    # Track VS Code usage
│   └── techDetector.ts       # Detect project tech stack
├── views/
│   ├── companionPanel.ts     # Companion webview
│   ├── todoTreeProvider.ts   # TODO sidebar tree
│   └── dashboardPanel.ts     # Analytics dashboard webview
├── models/
│   ├── focus.ts              # Focus types/interfaces
│   ├── todo.ts               # TODO types/interfaces
│   ├── analytics.ts          # Analytics types/interfaces
│   └── achievements.ts       # Achievement definitions
└── utils/
    └── dateUtils.ts          # Date formatting helpers

media/
├── companion/                # Companion SVGs/animations
├── icons/                    # Tree view icons
├── companion.css             # Companion animations
└── dashboard.js              # Chart.js dashboard logic
```

---

## Package.json Additions

```json
{
  "contributes": {
    "commands": [
      { "command": "cmdify.focus.start", "title": "Start Focus Session" },
      { "command": "cmdify.focus.pause", "title": "Pause Focus Session" },
      { "command": "cmdify.focus.stop", "title": "Stop Focus Session" },
      { "command": "cmdify.focus.showPanel", "title": "Show Focus Companion" },
      { "command": "cmdify.todos.scan", "title": "Scan TODOs" },
      { "command": "cmdify.todos.showPanel", "title": "Show TODOs" },
      { "command": "cmdify.todo.setReminder", "title": "Set Reminder" },
      { "command": "cmdify.analytics.showDashboard", "title": "Show Activity Dashboard" }
    ],
    "views": {
      "cmdify": [
        { "id": "cmdify.focus", "name": "Focus", "type": "webview" },
        { "id": "cmdify.todos", "name": "TODOs & Reminders" }
      ]
    },
    "configuration": {
      "title": "Cmdify",
      "properties": {
        "cmdify.focus.focusDuration": {
          "type": "number",
          "default": 25,
          "description": "Focus session duration in minutes"
        },
        "cmdify.focus.shortBreakDuration": {
          "type": "number",
          "default": 5,
          "description": "Short break duration in minutes"
        },
        "cmdify.focus.companionType": {
          "type": "string",
          "enum": ["cat", "robot", "plant", "flame"],
          "default": "cat",
          "description": "Focus companion character"
        },
        "cmdify.todos.scanOnSave": {
          "type": "boolean",
          "default": true,
          "description": "Scan for TODOs when files are saved"
        },
        "cmdify.analytics.enabled": {
          "type": "boolean",
          "default": true,
          "description": "Track coding activity"
        }
      }
    }
  }
}
```

---

## Summary

| Feature | Description | Backend Required |
|---------|-------------|------------------|
| 🧠 Focus Timer | Pomodoro with animated companion, XP, achievements | ❌ No |
| 🔔 TODO Reminders | Scan TODOs, set reminders, sync to code comments | ❌ No |
| 📊 Activity Dashboard | Track languages, time, files (VS Code only) | ❌ No |

All features:
- Work completely offline
- Store data in VS Code's globalState/workspaceState
- Can optionally sync via existing Gist integration
- Only track what VS Code can observe
