/**
 * Activity Dashboard Panel
 * Displays productivity insights in a webview
 */

import * as vscode from 'vscode';
import { ActivityService } from '../services/activity';
import { DailyActivity } from '../models/activity';
import { formatMinutes } from '../utils/dateUtils';
import { icon, getLucideStyles } from '../utils/lucide';

/**
 * Activity Panel Webview Provider
 */
export class ActivityPanelProvider implements vscode.Disposable {
  public static readonly viewType = 'cmdify.activityPanel';

  private panel: vscode.WebviewPanel | undefined;
  private disposables: vscode.Disposable[] = [];

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly activityService: ActivityService
  ) {
    // Listen for activity updates
    this.disposables.push(
      activityService.onActivityUpdate(() => this.updatePanel())
    );
  }

  /**
   * Show the activity dashboard panel
   */
  show(): void {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One);
      this.updatePanel();
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      ActivityPanelProvider.viewType,
      '📊 Activity Dashboard',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [this.extensionUri],
      }
    );

    this.panel.webview.html = this.getHtmlContent();

    this.panel.onDidDispose(
      () => {
        this.panel = undefined;
      },
      null,
      this.disposables
    );

    this.panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'refresh':
            this.updatePanel();
            break;
          case 'openSettings':
            vscode.commands.executeCommand(
              'workbench.action.openSettings',
              'cmdify.activity'
            );
            break;
        }
      },
      undefined,
      this.disposables
    );
  }

  /**
   * Update the panel content
   */
  private updatePanel(): void {
    if (this.panel) {
      const today = this.activityService.getToday();
      const stats = this.activityService.getStats();
      const topLanguages = this.activityService.getTopLanguages(5);
      const config = this.activityService.getConfig();

      this.panel.webview.postMessage({
        type: 'update',
        today,
        stats,
        topLanguages,
        dailyGoalMinutes: config.dailyGoalMinutes,
      });
    }
  }

  /**
   * Get the HTML content for the webview
   */
  private getHtmlContent(): string {
    const today = this.activityService.getToday();
    const stats = this.activityService.getStats();
    const topLanguages = this.activityService.getTopLanguages(5);
    const config = this.activityService.getConfig();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Activity Dashboard</title>
  <style>
    ${getLucideStyles()}
    
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      padding: 24px;
      max-width: 600px;
      margin: 0 auto;
    }
    
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
    }
    
    h1 {
      font-size: 20px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .header-actions {
      display: flex;
      gap: 8px;
    }
    
    .btn {
      border: none;
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      padding: 6px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .btn:hover { background: var(--vscode-button-secondaryHoverBackground); }
    
    .card {
      background: var(--vscode-editor-inactiveSelectionBackground);
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 16px;
    }
    
    .card-title {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 12px;
    }
    
    .today-time {
      font-size: 36px;
      font-weight: 700;
      line-height: 1;
      margin-bottom: 8px;
    }
    
    .progress-bar {
      height: 8px;
      background: var(--vscode-progressBar-background);
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 8px;
    }
    
    .progress-fill {
      height: 100%;
      background: var(--vscode-charts-blue);
      border-radius: 4px;
      transition: width 0.3s ease;
    }
    
    .progress-label {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
    }
    
    .sessions-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 16px;
    }
    
    .sessions-label {
      font-size: 13px;
      color: var(--vscode-descriptionForeground);
    }
    
    .tomato {
      font-size: 16px;
    }
    
    .tomato.empty {
      opacity: 0.3;
    }
    
    .divider {
      height: 1px;
      background: var(--vscode-widget-border);
      margin: 12px 0;
    }
    
    .languages-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    
    .language-item {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .language-name {
      width: 100px;
      font-size: 13px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .language-bar {
      flex: 1;
      height: 12px;
      background: var(--vscode-progressBar-background);
      border-radius: 3px;
      overflow: hidden;
    }
    
    .language-bar-fill {
      height: 100%;
      background: var(--vscode-charts-purple);
      border-radius: 3px;
    }
    
    .language-time {
      width: 60px;
      font-size: 12px;
      text-align: right;
      color: var(--vscode-descriptionForeground);
    }
    
    .week-chart {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      height: 80px;
      padding-top: 10px;
    }
    
    .day-bar {
      display: flex;
      flex-direction: column;
      align-items: center;
      flex: 1;
      gap: 4px;
    }
    
    .bar {
      width: 24px;
      background: var(--vscode-charts-blue);
      border-radius: 3px 3px 0 0;
      min-height: 4px;
      transition: height 0.3s ease;
    }
    
    .bar.today {
      background: var(--vscode-charts-green);
    }
    
    .day-label {
      font-size: 10px;
      color: var(--vscode-descriptionForeground);
      text-transform: uppercase;
    }
    
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
    }
    
    .stat-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    
    .stat-value {
      font-size: 24px;
      font-weight: 600;
      line-height: 1;
    }
    
    .stat-label {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
    }
    
    .empty-state {
      text-align: center;
      padding: 24px;
      color: var(--vscode-descriptionForeground);
    }
    
    .empty-state-icon {
      font-size: 32px;
      margin-bottom: 12px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${icon('barChart3', 20)} Today's Activity</h1>
    <div class="header-actions">
      <button class="btn" id="refreshBtn">${icon('refreshCw', 14)} Refresh</button>
      <button class="btn" id="settingsBtn">${icon('settings', 14)} Settings</button>
    </div>
  </div>

  <div class="card">
    <div class="card-title">VS Code Active Time</div>
    <div class="today-time" id="todayTime">${this.formatHoursMinutes(today.totalMinutes)}</div>
    <div class="progress-bar">
      <div class="progress-fill" id="progressFill" style="width: ${stats.todayGoalProgress}%"></div>
    </div>
    <div class="progress-label" id="progressLabel">Goal: ${formatMinutes(config.dailyGoalMinutes)} (${stats.todayGoalProgress}%)</div>
    
    <div class="sessions-row">
      <span class="sessions-label">Focus Sessions:</span>
      <span id="tomatoDisplay">${this.getTomatoDisplay(today.focusSessions, 6)}</span>
    </div>
  </div>

  <div class="card">
    <div class="card-title">Languages Today</div>
    <div class="languages-list" id="languagesList">
      ${this.getLanguagesHtml(topLanguages, today.totalMinutes)}
    </div>
  </div>

  <div class="card">
    <div class="card-title">This Week</div>
    <div class="week-chart" id="weekChart">
      ${this.getWeekChartHtml(stats.weeklyData)}
    </div>
  </div>

  <div class="card">
    <div class="card-title">Statistics</div>
    <div class="stats-grid">
      <div class="stat-item">
        <div class="stat-value" id="streakValue">${icon('flame', 24)} ${stats.currentStreak}</div>
        <div class="stat-label">Current Streak (days)</div>
      </div>
      <div class="stat-item">
        <div class="stat-value" id="longestStreakValue">${icon('trophy', 24)} ${stats.longestStreak}</div>
        <div class="stat-label">Longest Streak</div>
      </div>
      <div class="stat-item">
        <div class="stat-value" id="totalSessionsValue">${icon('target', 24)} ${stats.totalSessions}</div>
        <div class="stat-label">Total Focus Sessions</div>
      </div>
      <div class="stat-item">
        <div class="stat-value" id="filesEditedValue">${icon('code', 24)} ${today.filesEdited}</div>
        <div class="stat-label">Files Edited Today</div>
      </div>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    
    document.getElementById('refreshBtn').addEventListener('click', () => {
      vscode.postMessage({ command: 'refresh' });
    });
    
    document.getElementById('settingsBtn').addEventListener('click', () => {
      vscode.postMessage({ command: 'openSettings' });
    });
    
    window.addEventListener('message', (e) => {
      const msg = e.data;
      if (msg.type !== 'update') return;
      
      const { today, stats, topLanguages, dailyGoalMinutes } = msg;
      
      // Update today's time
      document.getElementById('todayTime').textContent = formatHoursMinutes(today.totalMinutes);
      document.getElementById('progressFill').style.width = stats.todayGoalProgress + '%';
      document.getElementById('progressLabel').textContent = 
        'Goal: ' + formatMinutes(dailyGoalMinutes) + ' (' + stats.todayGoalProgress + '%)';
      
      // Update tomatoes
      document.getElementById('tomatoDisplay').innerHTML = getTomatoDisplay(today.focusSessions, 6);
      
      // Update languages
      document.getElementById('languagesList').innerHTML = getLanguagesHtml(topLanguages, today.totalMinutes);
      
      // Update week chart
      document.getElementById('weekChart').innerHTML = getWeekChartHtml(stats.weeklyData);
      
      // Update stats - use innerHTML to preserve icons
      const flameIcon = '${icon('flame', 24).replace(/'/g, "\\'")}';
      const trophyIcon = '${icon('trophy', 24).replace(/'/g, "\\'")}';
      const targetIcon = '${icon('target', 24).replace(/'/g, "\\'")}';
      const codeIcon = '${icon('code', 24).replace(/'/g, "\\'")}';
      document.getElementById('streakValue').innerHTML = flameIcon + ' ' + stats.currentStreak;
      document.getElementById('longestStreakValue').innerHTML = trophyIcon + ' ' + stats.longestStreak;
      document.getElementById('totalSessionsValue').innerHTML = targetIcon + ' ' + stats.totalSessions;
      document.getElementById('filesEditedValue').innerHTML = codeIcon + ' ' + today.filesEdited;
    });
    
    function formatHoursMinutes(minutes) {
      const h = Math.floor(minutes / 60);
      const m = Math.round(minutes % 60);
      if (h === 0) return m + 'm';
      return h + 'h ' + m + 'm';
    }
    
    function formatMinutes(minutes) {
      if (minutes < 60) return minutes + ' min';
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      return m === 0 ? h + 'h' : h + 'h ' + m + 'm';
    }
    
    function getTomatoDisplay(sessions, max) {
      const timerIcon = '${icon('timer', 16).replace(/'/g, "\\'")}';
      let html = '';
      for (let i = 0; i < max; i++) {
        html += '<span class="tomato' + (i < sessions ? '' : ' empty') + '">' + timerIcon + '</span>';
      }
      return html;
    }
    
    function getLanguagesHtml(languages, totalMinutes) {
      if (languages.length === 0) {
        return '<div class="empty-state"><div class="empty-state-icon">${icon('code', 32)}</div>Start coding to see language breakdown</div>';
      }
      
      let html = '';
      for (const lang of languages) {
        const percent = totalMinutes > 0 ? (lang.minutes / totalMinutes * 100) : 0;
        html += '<div class="language-item">' +
          '<span class="language-name">' + lang.language + '</span>' +
          '<div class="language-bar"><div class="language-bar-fill" style="width: ' + percent + '%"></div></div>' +
          '<span class="language-time">' + formatMinutes(Math.round(lang.minutes)) + '</span>' +
        '</div>';
      }
      return html;
    }
    
    function getWeekChartHtml(weeklyData) {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const maxMinutes = Math.max(...weeklyData.map(d => d.totalMinutes), 60);
      
      let html = '';
      for (let i = weeklyData.length - 1; i >= 0; i--) {
        const day = weeklyData[i];
        const date = new Date(day.date);
        const dayName = days[date.getDay()];
        const height = Math.max((day.totalMinutes / maxMinutes) * 60, 4);
        const isToday = i === 0;
        
        html += '<div class="day-bar">' +
          '<div class="bar' + (isToday ? ' today' : '') + '" style="height: ' + height + 'px"></div>' +
          '<span class="day-label">' + dayName + '</span>' +
        '</div>';
      }
      return html;
    }
  </script>
</body>
</html>`;
  }

  /**
   * Format minutes as hours and minutes
   */
  private formatHoursMinutes(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    if (h === 0) {
      return `${m}m`;
    }
    return `${h}h ${m}m`;
  }

  /**
   * Get tomato display for focus sessions
   */
  private getTomatoDisplay(sessions: number, max: number): string {
    let html = '';
    for (let i = 0; i < max; i++) {
      const filled = i < sessions;
      html += `<span class="tomato${filled ? '' : ' empty'}">${icon('timer', 16)}</span>`;
    }
    return html;
  }

  /**
   * Get languages breakdown HTML
   */
  private getLanguagesHtml(
    languages: Array<{ language: string; minutes: number }>,
    totalMinutes: number
  ): string {
    if (languages.length === 0) {
      return `<div class="empty-state">
        <div class="empty-state-icon">${icon('code', 32)}</div>
        Start coding to see language breakdown
      </div>`;
    }

    let html = '';
    for (const lang of languages) {
      const percent = totalMinutes > 0 ? (lang.minutes / totalMinutes) * 100 : 0;
      html += `<div class="language-item">
        <span class="language-name">${lang.language}</span>
        <div class="language-bar">
          <div class="language-bar-fill" style="width: ${percent}%"></div>
        </div>
        <span class="language-time">${formatMinutes(Math.round(lang.minutes))}</span>
      </div>`;
    }
    return html;
  }

  /**
   * Get weekly chart HTML
   */
  private getWeekChartHtml(weeklyData: DailyActivity[]): string {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const maxMinutes = Math.max(...weeklyData.map((d) => d.totalMinutes), 60);

    let html = '';
    for (let i = weeklyData.length - 1; i >= 0; i--) {
      const day = weeklyData[i];
      const date = new Date(day.date);
      const dayName = days[date.getDay()];
      const height = Math.max((day.totalMinutes / maxMinutes) * 60, 4);
      const isToday = i === 0;

      html += `<div class="day-bar">
        <div class="bar${isToday ? ' today' : ''}" style="height: ${height}px"></div>
        <span class="day-label">${dayName}</span>
      </div>`;
    }
    return html;
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    if (this.panel) {
      this.panel.dispose();
    }
    this.disposables.forEach((d) => d.dispose());
  }
}
