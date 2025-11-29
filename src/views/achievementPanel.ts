/**
 * Achievement Panel Webview Provider
 * Displays achievements and progress in a webview
 */

import * as vscode from 'vscode';
import { AchievementService } from '../services/achievement';
import {
  Achievement,
  AchievementCategory,
  UnlockedAchievement,
  ACHIEVEMENTS,
  getAchievementById,
} from '../models/achievement';
import { icon, getLucideStyles } from '../utils/lucide';

/**
 * Achievement Panel Webview Provider
 */
export class AchievementPanelProvider implements vscode.Disposable {
  public static readonly viewType = 'cmdify.achievementPanel';

  private panel: vscode.WebviewPanel | undefined;
  private disposables: vscode.Disposable[] = [];

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly achievementService: AchievementService
  ) {
    // Listen for achievement unlocks
    this.disposables.push(
      achievementService.onAchievementUnlocked(() => this.updatePanel())
    );
  }

  /**
   * Show the achievement panel
   */
  show(): void {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One);
      this.updatePanel();
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      AchievementPanelProvider.viewType,
      '🏆 Achievements',
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
      const stats = this.achievementService.getStats();
      const progress = this.achievementService.getProgress();
      const groupedAchievements = this.achievementService.getAchievementsByCategory();

      // Convert Map to serializable format
      const achievements: Record<string, { achievement: Achievement; unlocked: boolean; unlockedAt?: string }[]> = {};
      const unlockedList = this.achievementService.getUnlockedAchievements();
      const unlockedMap = new Map(unlockedList.map(u => [u.id, u]));

      for (const [category, items] of groupedAchievements) {
        achievements[category] = items.map(item => ({
          ...item,
          unlockedAt: unlockedMap.get(item.achievement.id)?.unlockedAt,
        }));
      }

      this.panel.webview.postMessage({
        type: 'update',
        stats,
        progress,
        achievements,
      });
    }
  }

  /**
   * Get the HTML content for the webview
   */
  private getHtmlContent(): string {
    const stats = this.achievementService.getStats();
    const groupedAchievements = this.achievementService.getAchievementsByCategory();
    const unlockedList = this.achievementService.getUnlockedAchievements();
    const unlockedMap = new Map(unlockedList.map(u => [u.id, u]));
    const progress = this.achievementService.getProgress();
    const progressMap = new Map(progress.map(p => [p.achievementId, p]));

    // Build initial HTML
    const categorySections = this.buildCategorySections(groupedAchievements, unlockedMap, progressMap);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Achievements</title>
  <style>
    ${getLucideStyles()}
    
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      padding: 24px;
      max-width: 700px;
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
    
    .stats-badge {
      font-size: 14px;
      font-weight: 500;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      padding: 4px 12px;
      border-radius: 12px;
    }
    
    .summary-cards {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-bottom: 24px;
    }
    
    .summary-card {
      background: var(--vscode-editor-inactiveSelectionBackground);
      border-radius: 8px;
      padding: 16px;
      text-align: center;
    }
    
    .summary-icon {
      margin-bottom: 8px;
      color: var(--vscode-textLink-foreground);
    }
    
    .summary-icon svg {
      display: inline-block;
      vertical-align: middle;
    }
    
    .summary-value {
      font-size: 28px;
      font-weight: 700;
      line-height: 1;
      margin-bottom: 4px;
    }
    
    .summary-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--vscode-descriptionForeground);
    }
    
    .category {
      margin-bottom: 24px;
    }
    
    .category-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
    }
    
    .category-title {
      font-size: 14px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .category-count {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
    }
    
    .achievement-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    
    .achievement-item {
      display: flex;
      align-items: center;
      gap: 12px;
      background: var(--vscode-editor-inactiveSelectionBackground);
      border-radius: 8px;
      padding: 12px 16px;
      transition: all 0.2s ease;
    }
    
    .achievement-item.locked {
      opacity: 0.6;
    }
    
    .achievement-item.unlocked {
      border-left: 3px solid var(--vscode-charts-green);
    }
    
    .achievement-icon {
      font-size: 24px;
      flex-shrink: 0;
      width: 36px;
      text-align: center;
    }
    
    .achievement-info {
      flex: 1;
      min-width: 0;
    }
    
    .achievement-name {
      font-weight: 600;
      font-size: 13px;
      margin-bottom: 2px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .achievement-xp {
      font-size: 10px;
      color: var(--vscode-charts-yellow);
      font-weight: 500;
    }
    
    .achievement-description {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
    }
    
    .achievement-status {
      flex-shrink: 0;
      text-align: right;
    }
    
    .status-unlocked {
      color: var(--vscode-charts-green);
      font-size: 12px;
    }
    
    .status-date {
      font-size: 10px;
      color: var(--vscode-descriptionForeground);
    }
    
    .progress-bar {
      width: 80px;
      height: 6px;
      background: var(--vscode-progressBar-background);
      border-radius: 3px;
      overflow: hidden;
      margin-bottom: 4px;
    }
    
    .progress-fill {
      height: 100%;
      background: var(--vscode-charts-blue);
      border-radius: 3px;
      transition: width 0.3s ease;
    }
    
    .progress-text {
      font-size: 10px;
      color: var(--vscode-descriptionForeground);
    }
    
    .secret-badge {
      font-size: 10px;
      background: var(--vscode-charts-purple);
      color: white;
      padding: 2px 6px;
      border-radius: 4px;
    }
    
    .empty-state {
      text-align: center;
      padding: 40px;
      color: var(--vscode-descriptionForeground);
    }
    
    .category-icon {
      font-size: 16px;
    }
    
    .recent-unlocks {
      margin-bottom: 24px;
    }
    
    .recent-title {
      font-size: 12px;
      font-weight: 600;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 8px;
    }
    
    .recent-list {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    
    .recent-chip {
      display: flex;
      align-items: center;
      gap: 4px;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${icon('trophy', 20)} Achievements</h1>
    <span class="stats-badge" id="stats-badge">${stats.unlockedCount}/${stats.totalAchievements}</span>
  </div>
  
  <div class="summary-cards">
    <div class="summary-card">
      <div class="summary-icon">${icon('award', 24)}</div>
      <div class="summary-value" id="unlocked-count">${stats.unlockedCount}</div>
      <div class="summary-label">Unlocked</div>
    </div>
    <div class="summary-card">
      <div class="summary-icon">${icon('zap', 24)}</div>
      <div class="summary-value" id="total-xp">${stats.totalXPEarned}</div>
      <div class="summary-label">XP Earned</div>
    </div>
    <div class="summary-card">
      <div class="summary-icon">${icon('circleCheck', 24)}</div>
      <div class="summary-value" id="completion-rate">${Math.round((stats.unlockedCount / stats.totalAchievements) * 100)}%</div>
      <div class="summary-label">Complete</div>
    </div>
  </div>
  
  ${stats.recentUnlocks.length > 0 ? `
  <div class="recent-unlocks">
    <div class="recent-title">Recent Unlocks</div>
    <div class="recent-list" id="recent-list">
      ${stats.recentUnlocks.map(u => {
        const achievement = getAchievementById(u.id);
        return achievement ? `<span class="recent-chip">${achievement.icon} ${achievement.name}</span>` : '';
      }).join('')}
    </div>
  </div>
  ` : ''}
  
  <div id="categories-container">
    ${categorySections}
  </div>
  
  <script>
    const vscode = acquireVsCodeApi();
    
    function formatDate(isoString) {
      const date = new Date(isoString);
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }
    
    function updateAchievements(data) {
      // Update stats
      document.getElementById('stats-badge').textContent = 
        data.stats.unlockedCount + '/' + data.stats.totalAchievements;
      document.getElementById('unlocked-count').textContent = data.stats.unlockedCount;
      document.getElementById('total-xp').textContent = data.stats.totalXPEarned;
      document.getElementById('completion-rate').textContent = 
        Math.round((data.stats.unlockedCount / data.stats.totalAchievements) * 100) + '%';
      
      // Update progress bars
      const progressMap = new Map(data.progress.map(p => [p.achievementId, p]));
      document.querySelectorAll('.progress-fill').forEach(el => {
        const id = el.dataset.achievementId;
        const prog = progressMap.get(id);
        if (prog) {
          el.style.width = prog.percentage + '%';
          const textEl = el.closest('.achievement-status').querySelector('.progress-text');
          if (textEl) {
            textEl.textContent = prog.currentValue + '/' + prog.targetValue;
          }
        }
      });
    }
    
    window.addEventListener('message', event => {
      const message = event.data;
      if (message.type === 'update') {
        updateAchievements(message);
      }
    });
  </script>
</body>
</html>`;
  }

  /**
   * Build category sections HTML
   */
  private buildCategorySections(
    grouped: Map<AchievementCategory, { achievement: Achievement; unlocked: boolean }[]>,
    unlockedMap: Map<string, UnlockedAchievement>,
    progressMap: Map<string, { currentValue: number; targetValue: number; percentage: number }>
  ): string {
    const categoryInfo: Record<AchievementCategory, { icon: string; name: string }> = {
      focus: { icon: icon('target', 16), name: 'Focus' },
      streaks: { icon: icon('flame', 16), name: 'Streaks' },
      todos: { icon: icon('listTodo', 16), name: 'Tasks' },
      commands: { icon: icon('terminal', 16), name: 'Commands' },
      special: { icon: icon('star', 16), name: 'Special' },
    };

    const categories: AchievementCategory[] = ['focus', 'streaks', 'todos', 'commands', 'special'];
    
    return categories.map(category => {
      const items = grouped.get(category) ?? [];
      if (items.length === 0) {
        return '';
      }

      const info = categoryInfo[category];
      const unlockedInCategory = items.filter(i => i.unlocked).length;

      return `
        <div class="category">
          <div class="category-header">
            <span class="category-icon">${info.icon}</span>
            <span class="category-title">${info.name}</span>
            <span class="category-count">${unlockedInCategory}/${items.length}</span>
          </div>
          <div class="achievement-list">
            ${items.map(item => this.buildAchievementItem(item, unlockedMap, progressMap)).join('')}
          </div>
        </div>
      `;
    }).join('');
  }

  /**
   * Build a single achievement item HTML
   */
  private buildAchievementItem(
    item: { achievement: Achievement; unlocked: boolean },
    unlockedMap: Map<string, UnlockedAchievement>,
    progressMap: Map<string, { currentValue: number; targetValue: number; percentage: number }>
  ): string {
    const { achievement, unlocked } = item;
    const unlockedData = unlockedMap.get(achievement.id);
    const prog = progressMap.get(achievement.id);

    // For secret achievements that aren't unlocked, show mystery
    const isHiddenSecret = achievement.secret && !unlocked;
    const achievementIcon = isHiddenSecret ? icon('alertCircle', 24) : achievement.icon;
    const name = isHiddenSecret ? '???' : achievement.name;
    const description = isHiddenSecret ? 'Secret achievement' : achievement.description;

    const statusHtml = unlocked 
      ? `
        <div class="status-unlocked">${icon('check', 14)} Unlocked</div>
        ${unlockedData ? `<div class="status-date">${this.formatDate(unlockedData.unlockedAt)}</div>` : ''}
      `
      : prog 
        ? `
          <div class="progress-bar">
            <div class="progress-fill" data-achievement-id="${achievement.id}" style="width: ${prog.percentage}%"></div>
          </div>
          <div class="progress-text">${prog.currentValue}/${prog.targetValue}</div>
        `
        : '';

    return `
      <div class="achievement-item ${unlocked ? 'unlocked' : 'locked'}">
        <div class="achievement-icon">${achievementIcon}</div>
        <div class="achievement-info">
          <div class="achievement-name">
            ${name}
            ${achievement.secret && unlocked ? '<span class="secret-badge">SECRET</span>' : ''}
            <span class="achievement-xp">+${achievement.xpReward} XP</span>
          </div>
          <div class="achievement-description">${description}</div>
        </div>
        <div class="achievement-status">
          ${statusHtml}
        </div>
      </div>
    `;
  }

  /**
   * Format date for display
   */
  private formatDate(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  dispose(): void {
    this.panel?.dispose();
    this.disposables.forEach(d => d.dispose());
  }
}
