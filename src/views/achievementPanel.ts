/**
 * Achievement Panel Webview Provider
 * Displays achievements and progress in a webview
 */

import * as vscode from 'vscode';
import { BaseWebviewPanel } from '../ui/webview';
import { StylesProvider } from '../ui/webview/StylesProvider';
import { AchievementService } from '../services/achievement';
import {
  Achievement,
  AchievementCategory,
  UnlockedAchievement,
  getAchievementById,
} from '../models/achievement';
import { icon, getLucideStyles } from '../utils/lucide';

/**
 * Achievement Panel Webview Provider
 */
export class AchievementPanelProvider extends BaseWebviewPanel {
  public static readonly viewType = 'cmdify.achievementPanel';

  constructor(
    context: vscode.ExtensionContext,
    private readonly achievementService: AchievementService
  ) {
    super(context, {
      viewType: AchievementPanelProvider.viewType,
      title: '🏆 Achievements',
      showOptions: vscode.ViewColumn.One,
    });

    // Register message handler
    this.registerMessageHandler('refresh', () => this.refresh());

    // Listen for achievement unlocks
    this.disposables.push(achievementService.onAchievementUnlocked(() => this.updateWebview()));
  }

  /**
   * Show the achievement panel
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

    const stats = this.achievementService.getStats();
    const progress = this.achievementService.getProgress();
    const groupedAchievements = this.achievementService.getAchievementsByCategory();

    // Convert Map to serializable format
    const achievements: Record<
      string,
      { achievement: Achievement; unlocked: boolean; unlockedAt?: string }[]
    > = {};
    const unlockedList = this.achievementService.getUnlockedAchievements();
    const unlockedMap = new Map(unlockedList.map((u) => [u.id, u]));

    for (const [category, items] of groupedAchievements) {
      achievements[category] = items.map((item) => ({
        ...item,
        unlockedAt: unlockedMap.get(item.achievement.id)?.unlockedAt,
      }));
    }

    this.postMessage({
      type: 'update',
      stats,
      progress,
      achievements,
    });
  }

  protected getHtmlContent(): string {
    const stats = this.achievementService.getStats();
    const groupedAchievements = this.achievementService.getAchievementsByCategory();
    const unlockedList = this.achievementService.getUnlockedAchievements();
    const unlockedMap = new Map(unlockedList.map((u) => [u.id, u]));
    const progress = this.achievementService.getProgress();
    const progressMap = new Map(progress.map((p) => [p.achievementId, p]));

    const categorySections = this.buildCategorySections(
      groupedAchievements,
      unlockedMap,
      progressMap
    );

    // Load external CSS
    const panelStyles = StylesProvider.getPanelStyles('achievement', this.context.extensionPath);

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
    }
    
    ${panelStyles}
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
  
  ${
    stats.recentUnlocks.length > 0
      ? `
  <div class="recent-unlocks">
    <div class="recent-title">Recent Unlocks</div>
    <div class="recent-list" id="recent-list">
      ${stats.recentUnlocks
        .map((u) => {
          const achievement = getAchievementById(u.id);
          return achievement
            ? `<span class="recent-chip">${achievement.icon} ${achievement.name}</span>`
            : '';
        })
        .join('')}
    </div>
  </div>
  `
      : ''
  }
  
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
      document.getElementById('stats-badge').textContent = 
        data.stats.unlockedCount + '/' + data.stats.totalAchievements;
      document.getElementById('unlocked-count').textContent = data.stats.unlockedCount;
      document.getElementById('total-xp').textContent = data.stats.totalXPEarned;
      document.getElementById('completion-rate').textContent = 
        Math.round((data.stats.unlockedCount / data.stats.totalAchievements) * 100) + '%';
      
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

    return categories
      .map((category) => {
        const items = grouped.get(category) ?? [];
        if (items.length === 0) {
          return '';
        }

        const info = categoryInfo[category];
        const unlockedInCategory = items.filter((i) => i.unlocked).length;

        return `
        <div class="category">
          <div class="category-header">
            <span class="category-icon">${info.icon}</span>
            <span class="category-title">${info.name}</span>
            <span class="category-count">${unlockedInCategory}/${items.length}</span>
          </div>
          <div class="achievement-list">
            ${items.map((item) => this.buildAchievementItem(item, unlockedMap, progressMap)).join('')}
          </div>
        </div>
      `;
      })
      .join('');
  }

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

  private formatDate(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  protected handleMessage(message: any): void {
    // All messages handled through registered handlers
  }
}
