/**
 * Activity Dashboard Panel
 * Displays productivity insights in a webview
 */

import * as vscode from 'vscode';
import { BaseWebviewPanel } from '../ui/webview';
import { StylesProvider } from '../ui/webview/StylesProvider';
import { ActivityService } from '../services/activity';
import { DailyActivity } from '../models/activity';
import { formatMinutes } from '../utils/dateUtils';
import { icon, getLucideStyles } from '../utils/lucide';

/**
 * Activity Panel Webview Provider
 */
export class ActivityPanelProvider extends BaseWebviewPanel {
  public static readonly viewType = 'cmdify.activityPanel';

  constructor(
    context: vscode.ExtensionContext,
    private readonly activityService: ActivityService
  ) {
    super(context, {
      viewType: ActivityPanelProvider.viewType,
      title: '📊 Activity Dashboard',
      showOptions: vscode.ViewColumn.One,
    });

    // Register message handlers
    this.registerMessageHandler('refresh', () => this.refresh());
    this.registerMessageHandler('openSettings', async () => {
      await vscode.commands.executeCommand('workbench.action.openSettings', 'cmdify.activity');
    });

    // Listen for activity updates
    this.disposables.push(activityService.onActivityUpdate(() => this.updateWebview()));
  }

  /**
   * Show the activity dashboard panel
   */
  show(): void {
    this.getPanel();
    this.updateWebview();
  }

  protected onPanelCreated(): void {
    this.updateWebview();
  }

  /**
   * Update the panel content
   */
  private updateWebview(): void {
    if (!this.panel) {
      return;
    }

    const today = this.activityService.getToday();
    const stats = this.activityService.getStats();
    const topLanguages = this.activityService.getTopLanguages(5);
    const config = this.activityService.getConfig();

    this.postMessage({
      type: 'update',
      today,
      stats,
      topLanguages,
      dailyGoalMinutes: config.dailyGoalMinutes,
    });
  }

  protected getHtmlContent(): string {
    const today = this.activityService.getToday();
    const stats = this.activityService.getStats();
    const topLanguages = this.activityService.getTopLanguages(5);
    const config = this.activityService.getConfig();

    // Load external CSS
    const panelStyles = StylesProvider.getPanelStyles('activity', this.context.extensionPath);

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
    }
    
    ${panelStyles}
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
      
      document.getElementById('todayTime').textContent = formatHoursMinutes(today.totalMinutes);
      document.getElementById('progressFill').style.width = stats.todayGoalProgress + '%';
      document.getElementById('progressLabel').textContent = 
        'Goal: ' + formatMinutes(dailyGoalMinutes) + ' (' + stats.todayGoalProgress + '%)';
      
      document.getElementById('tomatoDisplay').innerHTML = getTomatoDisplay(today.focusSessions, 6);
      document.getElementById('languagesList').innerHTML = getLanguagesHtml(topLanguages, today.totalMinutes);
      document.getElementById('weekChart').innerHTML = getWeekChartHtml(stats.weeklyData);
      
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

  private formatHoursMinutes(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    if (h === 0) {
      return `${m}m`;
    }
    return `${h}h ${m}m`;
  }

  private getTomatoDisplay(sessions: number, max: number): string {
    let html = '';
    for (let i = 0; i < max; i++) {
      const filled = i < sessions;
      html += `<span class="tomato${filled ? '' : ' empty'}">${icon('timer', 16)}</span>`;
    }
    return html;
  }

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

  protected handleMessage(message: any): void {
    // All messages handled through registered handlers
  }
}
