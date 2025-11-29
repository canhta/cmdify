/**
 * Achievement Service
 * Manages achievement tracking, unlocking, and notifications
 */

import * as vscode from 'vscode';
import {
  Achievement,
  ACHIEVEMENTS,
  UnlockedAchievement,
  AchievementProgress,
  AchievementStats,
  AchievementCategory,
  getAchievementById,
  getVisibleAchievements,
} from '../models/achievement';
import { CompanionService } from './companion';
import { ActivityService } from './activity';

const ACHIEVEMENTS_KEY = 'cmdify.achievements';

interface AchievementData {
  unlocked: UnlockedAchievement[];
  // Tracked counters for special achievements
  aiCommandsGenerated: number;
  saturdaySession: boolean;
  sundaySession: boolean;
  dailyGoalStreak: number;
  lastDailyGoalDate: string | null;
}

const DEFAULT_DATA: AchievementData = {
  unlocked: [],
  aiCommandsGenerated: 0,
  saturdaySession: false,
  sundaySession: false,
  dailyGoalStreak: 0,
  lastDailyGoalDate: null,
};

export class AchievementService implements vscode.Disposable {
  private data: AchievementData;
  private disposables: vscode.Disposable[] = [];

  // Event emitters
  private readonly _onAchievementUnlocked = new vscode.EventEmitter<Achievement>();
  readonly onAchievementUnlocked = this._onAchievementUnlocked.event;

  private readonly _onProgressUpdate = new vscode.EventEmitter<AchievementProgress[]>();
  readonly onProgressUpdate = this._onProgressUpdate.event;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly companionService: CompanionService,
    private readonly activityService: ActivityService
  ) {
    this.data = this.loadData();

    // Subscribe to companion events
    this.disposables.push(
      companionService.onLevelUp((level) => {
        this.checkLevelAchievements(level);
      })
    );

    // Subscribe to activity events
    this.disposables.push(
      activityService.onActivityUpdate(() => {
        this.checkActivityAchievements();
      })
    );

    // Check time-based achievements
    this.checkTimeBasedAchievements();
  }

  private loadData(): AchievementData {
    const saved = this.context.globalState.get<AchievementData>(ACHIEVEMENTS_KEY);
    if (!saved) {
      return { ...DEFAULT_DATA };
    }
    return {
      ...DEFAULT_DATA,
      ...saved,
    };
  }

  private async saveData(): Promise<void> {
    await this.context.globalState.update(ACHIEVEMENTS_KEY, this.data);
  }

  /**
   * Check if an achievement is unlocked
   */
  isUnlocked(achievementId: string): boolean {
    return this.data.unlocked.some((u) => u.id === achievementId);
  }

  /**
   * Get all unlocked achievement IDs
   */
  getUnlockedIds(): Set<string> {
    return new Set(this.data.unlocked.map((u) => u.id));
  }

  /**
   * Get list of unlocked achievements
   */
  getUnlockedAchievements(): UnlockedAchievement[] {
    return [...this.data.unlocked];
  }

  /**
   * Unlock an achievement
   */
  private async unlock(achievement: Achievement): Promise<void> {
    if (this.isUnlocked(achievement.id)) {
      return;
    }

    const unlocked: UnlockedAchievement = {
      id: achievement.id,
      unlockedAt: new Date().toISOString(),
      notified: false,
    };

    this.data.unlocked.push(unlocked);
    await this.saveData();

    // Award XP to companion
    await this.companionService.awardXP(achievement.xpReward, `Achievement: ${achievement.name}`);

    // Fire event
    this._onAchievementUnlocked.fire(achievement);

    // Show notification
    this.showUnlockNotification(achievement);

    // Mark as notified
    unlocked.notified = true;
    await this.saveData();
  }

  /**
   * Show achievement unlock notification
   */
  private showUnlockNotification(achievement: Achievement): void {
    const message = achievement.secret
      ? `🏆 Secret Achievement Unlocked: ${achievement.icon} ${achievement.name}! (+${achievement.xpReward} XP)`
      : `🏆 Achievement Unlocked: ${achievement.icon} ${achievement.name}! (+${achievement.xpReward} XP)`;

    vscode.window
      .showInformationMessage(message, 'View Achievements')
      .then((selection) => {
        if (selection === 'View Achievements') {
          vscode.commands.executeCommand('cmdify.showAchievements');
        }
      });
  }

  /**
   * Check achievements based on focus session count
   */
  async checkFocusAchievements(sessionCount: number): Promise<void> {
    const focusAchievements = ACHIEVEMENTS.filter(
      (a) => a.category === 'focus' && a.condition.type === 'sessions'
    );

    for (const achievement of focusAchievements) {
      if (!this.isUnlocked(achievement.id) && sessionCount >= achievement.condition.value) {
        await this.unlock(achievement);
      }
    }
  }

  /**
   * Check achievements based on streak
   */
  async checkStreakAchievements(currentStreak: number): Promise<void> {
    const streakAchievements = ACHIEVEMENTS.filter(
      (a) => a.category === 'streaks' && a.condition.type === 'streak'
    );

    for (const achievement of streakAchievements) {
      if (!this.isUnlocked(achievement.id) && currentStreak >= achievement.condition.value) {
        await this.unlock(achievement);
      }
    }
  }

  /**
   * Check achievements based on TODO completions
   */
  async checkTodoAchievements(todoCount: number): Promise<void> {
    const todoAchievements = ACHIEVEMENTS.filter(
      (a) => a.category === 'todos' && a.condition.type === 'todos'
    );

    for (const achievement of todoAchievements) {
      if (!this.isUnlocked(achievement.id) && todoCount >= achievement.condition.value) {
        await this.unlock(achievement);
      }
    }
  }

  /**
   * Check achievements based on command count
   */
  async checkCommandAchievements(commandCount: number): Promise<void> {
    const commandAchievements = ACHIEVEMENTS.filter(
      (a) => a.category === 'commands' && a.condition.type === 'commands'
    );

    for (const achievement of commandAchievements) {
      if (!this.isUnlocked(achievement.id) && commandCount >= achievement.condition.value) {
        await this.unlock(achievement);
      }
    }
  }

  /**
   * Track AI command generation
   */
  async trackAICommandGenerated(): Promise<void> {
    this.data.aiCommandsGenerated++;
    await this.saveData();

    // Check AI Whisperer achievement
    const aiAchievement = getAchievementById('cmd_ai');
    if (aiAchievement && !this.isUnlocked('cmd_ai') && 
        this.data.aiCommandsGenerated >= aiAchievement.condition.value) {
      await this.unlock(aiAchievement);
    }
  }

  /**
   * Track cloud sync
   */
  async trackSync(): Promise<void> {
    const syncAchievement = getAchievementById('first_sync');
    if (syncAchievement && !this.isUnlocked('first_sync')) {
      await this.unlock(syncAchievement);
    }
  }

  /**
   * Check level-based achievements
   */
  private async checkLevelAchievements(level: number): Promise<void> {
    const levelAchievements = ACHIEVEMENTS.filter(
      (a) => a.condition.type === 'level'
    );

    for (const achievement of levelAchievements) {
      if (!this.isUnlocked(achievement.id) && level >= achievement.condition.value) {
        await this.unlock(achievement);
      }
    }
  }

  /**
   * Check activity-based achievements (called on activity update)
   */
  private async checkActivityAchievements(): Promise<void> {
    const stats = this.activityService.getStats();

    // Check streak achievements
    await this.checkStreakAchievements(stats.currentStreak);

    // Check focus session achievements
    await this.checkFocusAchievements(stats.totalSessions);

    // Check daily goal streak (perfectionist achievement)
    if (stats.todayGoalProgress >= 100) {
      const today = new Date().toISOString().split('T')[0];
      if (this.data.lastDailyGoalDate !== today) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        if (this.data.lastDailyGoalDate === yesterdayStr) {
          this.data.dailyGoalStreak++;
        } else {
          this.data.dailyGoalStreak = 1;
        }

        this.data.lastDailyGoalDate = today;
        await this.saveData();

        // Check perfectionist achievement
        const perfectionistAchievement = getAchievementById('perfectionist');
        if (perfectionistAchievement && !this.isUnlocked('perfectionist') &&
            this.data.dailyGoalStreak >= perfectionistAchievement.condition.value) {
          await this.unlock(perfectionistAchievement);
        }
      }
    }
  }

  /**
   * Check time-based secret achievements
   */
  private async checkTimeBasedAchievements(): Promise<void> {
    const hour = new Date().getHours();
    const day = new Date().getDay(); // 0 = Sunday, 6 = Saturday

    // Night Owl - after midnight (0-4 AM)
    if (hour >= 0 && hour < 5) {
      const nightOwlAchievement = getAchievementById('night_owl');
      if (nightOwlAchievement && !this.isUnlocked('night_owl')) {
        await this.unlock(nightOwlAchievement);
      }
    }

    // Early Bird - before 6 AM
    if (hour >= 5 && hour < 6) {
      const earlyBirdAchievement = getAchievementById('early_bird');
      if (earlyBirdAchievement && !this.isUnlocked('early_bird')) {
        await this.unlock(earlyBirdAchievement);
      }
    }

    // Weekend Warrior tracking
    if (day === 6) {
      this.data.saturdaySession = true;
      await this.saveData();
    } else if (day === 0) {
      this.data.sundaySession = true;
      await this.saveData();
    }

    // Check Weekend Warrior
    if (this.data.saturdaySession && this.data.sundaySession) {
      const weekendAchievement = getAchievementById('weekend_warrior');
      if (weekendAchievement && !this.isUnlocked('weekend_warrior')) {
        await this.unlock(weekendAchievement);
      }
    }

    // Reset weekend tracking on Monday
    if (day === 1) {
      this.data.saturdaySession = false;
      this.data.sundaySession = false;
      await this.saveData();
    }
  }

  /**
   * Track marathon achievement (5 sessions in one day)
   */
  async trackDailySessions(sessionsToday: number): Promise<void> {
    const marathonAchievement = getAchievementById('focus_marathon');
    if (marathonAchievement && !this.isUnlocked('focus_marathon') &&
        sessionsToday >= marathonAchievement.condition.value) {
      await this.unlock(marathonAchievement);
    }
  }

  /**
   * Get achievement progress for display
   */
  getProgress(): AchievementProgress[] {
    const stats = this.activityService.getStats();
    const companionState = this.companionService.getState();
    const progress: AchievementProgress[] = [];

    for (const achievement of ACHIEVEMENTS) {
      if (this.isUnlocked(achievement.id)) {
        continue;
      }

      let currentValue = 0;
      let targetValue = achievement.condition.value;

      switch (achievement.condition.type) {
        case 'sessions':
          currentValue = stats.totalSessions;
          break;
        case 'streak':
          currentValue = stats.currentStreak;
          break;
        case 'level':
          currentValue = companionState.level;
          break;
        case 'todos':
          // Would need to be provided from TODO service
          currentValue = 0;
          break;
        case 'commands':
          // Would need to be provided from storage
          currentValue = 0;
          break;
        case 'special':
          if (achievement.id === 'cmd_ai') {
            currentValue = this.data.aiCommandsGenerated;
          } else if (achievement.id === 'perfectionist') {
            currentValue = this.data.dailyGoalStreak;
          } else if (achievement.id === 'focus_marathon') {
            const today = this.activityService.getToday();
            currentValue = today?.focusSessions ?? 0;
          }
          break;
      }

      progress.push({
        achievementId: achievement.id,
        currentValue,
        targetValue,
        percentage: Math.min(100, Math.floor((currentValue / targetValue) * 100)),
      });
    }

    return progress;
  }

  /**
   * Get achievement statistics
   */
  getStats(): AchievementStats {
    const unlockedXP = this.data.unlocked.reduce((sum, u) => {
      const achievement = getAchievementById(u.id);
      return sum + (achievement?.xpReward ?? 0);
    }, 0);

    // Get 5 most recent unlocks
    const recentUnlocks = [...this.data.unlocked]
      .sort((a, b) => new Date(b.unlockedAt).getTime() - new Date(a.unlockedAt).getTime())
      .slice(0, 5);

    return {
      totalAchievements: ACHIEVEMENTS.length,
      unlockedCount: this.data.unlocked.length,
      totalXPEarned: unlockedXP,
      recentUnlocks,
    };
  }

  /**
   * Get achievements grouped by category
   */
  getAchievementsByCategory(): Map<AchievementCategory, { achievement: Achievement; unlocked: boolean }[]> {
    const unlockedIds = this.getUnlockedIds();
    const visibleAchievements = getVisibleAchievements(unlockedIds);
    
    const grouped = new Map<AchievementCategory, { achievement: Achievement; unlocked: boolean }[]>();
    
    const categories: AchievementCategory[] = ['focus', 'streaks', 'todos', 'commands', 'special'];
    for (const category of categories) {
      grouped.set(category, []);
    }

    for (const achievement of visibleAchievements) {
      const list = grouped.get(achievement.category) ?? [];
      list.push({
        achievement,
        unlocked: unlockedIds.has(achievement.id),
      });
      grouped.set(achievement.category, list);
    }

    return grouped;
  }

  /**
   * Manual trigger for checking all achievements (useful for debugging)
   */
  async checkAllAchievements(): Promise<void> {
    await this.checkActivityAchievements();
    await this.checkTimeBasedAchievements();
    
    const companionState = this.companionService.getState();
    await this.checkLevelAchievements(companionState.level);
  }

  dispose(): void {
    this._onAchievementUnlocked.dispose();
    this._onProgressUpdate.dispose();
    this.disposables.forEach((d) => d.dispose());
  }
}
