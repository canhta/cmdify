/**
 * Companion Service - Enhanced with Evolution 2.0
 * Manages companion state, progression, unlocks, and accessories
 */

import * as vscode from 'vscode';
import {
  CompanionState,
  CompanionType,
  AccessoryId,
  DEFAULT_COMPANION_STATE,
  COMPANION_ICONS,
  COMPANION_UNLOCKS,
  ACCESSORIES,
  XP_REWARDS,
  xpForLevel,
  UnlockCondition,
  COMPANION_NAMES,
  CompanionMessageCategory,
  getCompanionMessage,
  MOOD_EMOJIS,
} from '../models/companion';
import { FocusService } from './focus';

const COMPANION_STATE_KEY = 'cmdify.companion.state';

/**
 * Companion Service - Enhanced with progression system
 */
export class CompanionService implements vscode.Disposable {
  private state: CompanionState;
  private disposables: vscode.Disposable[] = [];

  // Message system
  private currentMessage: string = '';
  private messageTimeout: ReturnType<typeof setTimeout> | null = null;

  // Event emitters
  private readonly _onStateChange = new vscode.EventEmitter<CompanionState>();
  readonly onStateChange = this._onStateChange.event;

  private readonly _onLevelUp = new vscode.EventEmitter<number>();
  readonly onLevelUp = this._onLevelUp.event;

  private readonly _onXPGain = new vscode.EventEmitter<{ amount: number; source: string }>();
  readonly onXPGain = this._onXPGain.event;

  private readonly _onUnlock = new vscode.EventEmitter<{
    type: 'companion' | 'accessory';
    item: string;
  }>();
  readonly onUnlock = this._onUnlock.event;

  private readonly _onMessageChange = new vscode.EventEmitter<string>();
  readonly onMessageChange = this._onMessageChange.event;

  // Track TODO completion count for unlocks
  private todoCompletedCount: number = 0;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly focusService: FocusService
  ) {
    this.state = this.loadState();

    // Listen for focus service events to update mood
    this.disposables.push(
      focusService.onStateChange((focusState) => {
        this.updateMood(focusState.status);
      }),
      focusService.onSessionComplete(() => {
        this.state.mood = 'celebrating';
        this.saveState();
        // Reset to happy after celebration
        setTimeout(() => {
          if (this.state.mood === 'celebrating') {
            this.state.mood = 'happy';
            this.saveState();
          }
        }, 3000);
      })
    );

    // Listen for companion type changes in settings
    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('cmdify.focus.companionType')) {
          this.updateCompanionType();
        }
      })
    );
  }

  /**
   * Load companion state with migration for existing users
   */
  private loadState(): CompanionState {
    const saved = this.context.globalState.get<CompanionState>(COMPANION_STATE_KEY);

    if (!saved) {
      return { ...DEFAULT_COMPANION_STATE };
    }

    // Migrate old state to new format (backward compatibility)
    const migrated: CompanionState = {
      ...DEFAULT_COMPANION_STATE,
      ...saved,
      // Ensure new fields exist
      level: saved.level ?? 1,
      experience: saved.experience ?? 0,
      totalXP: saved.totalXP ?? 0,
      unlockedCompanions: saved.unlockedCompanions ?? ['robot'],
      unlockedAccessories: saved.unlockedAccessories ?? [],
      equippedAccessory: saved.equippedAccessory,
      joinedDate: saved.joinedDate ?? new Date().toISOString(),
      nightOwlCount: saved.nightOwlCount ?? 0,
    };

    // If user had a different companion before, unlock it
    if (saved.type && !migrated.unlockedCompanions.includes(saved.type)) {
      migrated.unlockedCompanions.push(saved.type);
    }

    return migrated;
  }

  private async saveState(): Promise<void> {
    await this.context.globalState.update(COMPANION_STATE_KEY, this.state);
    this._onStateChange.fire(this.state);
  }

  getState(): CompanionState {
    return { ...this.state };
  }

  /**
   * Update mood based on focus status
   */
  private async updateMood(status: string): Promise<void> {
    switch (status) {
      case 'focusing':
        this.state.mood = 'focused';
        break;
      case 'break':
        this.state.mood = 'happy';
        break;
      case 'paused':
        this.state.mood = 'tired';
        break;
      case 'idle':
        this.state.mood = 'happy';
        break;
    }
    await this.saveState();
  }

  /**
   * Update companion type from settings
   */
  private async updateCompanionType(): Promise<void> {
    const config = vscode.workspace.getConfiguration('cmdify.focus');
    const type = config.get<CompanionType>('companionType', 'cat');
    this.state.type = type;
    await this.saveState();
  }

  /**
   * Set companion type
   */
  async setCompanionType(type: CompanionType): Promise<void> {
    this.state.type = type;
    await this.saveState();
    await vscode.workspace
      .getConfiguration('cmdify.focus')
      .update('companionType', type, vscode.ConfigurationTarget.Global);
  }

  // =============================================================================
  // Companion Naming (Phase 4)
  // =============================================================================

  /**
   * Set companion name (max 20 characters)
   */
  async setCompanionName(name: string): Promise<void> {
    this.state.name = name.trim().substring(0, 20);
    await this.saveState();
  }

  /**
   * Get companion display name (custom name or default type name)
   */
  getCompanionName(): string {
    return this.state.name || COMPANION_NAMES[this.state.type];
  }

  // =============================================================================
  // Companion Messages (Phase 4)
  // =============================================================================

  /**
   * Show a contextual message from the companion
   */
  showMessage(
    category: CompanionMessageCategory,
    variables?: Record<string, string | number>
  ): void {
    const message = getCompanionMessage(category, {
      name: this.getCompanionName(),
      ...variables,
    });

    this.currentMessage = message;
    this._onMessageChange.fire(message);

    // Clear message after 5 seconds
    if (this.messageTimeout) {
      clearTimeout(this.messageTimeout);
    }
    this.messageTimeout = setTimeout(() => {
      this.currentMessage = '';
      this._onMessageChange.fire('');
    }, 5000);
  }

  /**
   * Get current companion message
   */
  getCurrentMessage(): string {
    return this.currentMessage;
  }

  /**
   * Get mood emoji for status bar
   */
  getMoodEmoji(): string {
    return MOOD_EMOJIS[this.state.mood];
  }

  /**
   * Get companion icon for status bar (codicon format)
   */
  getCompanionIcon(status?: string): string {
    const focusState = this.focusService.getState();
    const currentStatus = status || focusState.status;
    const icons = COMPANION_ICONS[this.state.type];
    return icons[currentStatus] || icons.idle;
  }

  /**
   * Get the SVG state name for current status
   */
  getSvgState(): 'idle' | 'focus' | 'break' | 'celebrate' {
    const focusState = this.focusService.getState();

    if (this.state.mood === 'celebrating') {
      return 'celebrate';
    }

    switch (focusState.status) {
      case 'focusing':
        return 'focus';
      case 'break':
        return 'break';
      default:
        return 'idle';
    }
  }

  /**
   * Award XP to the companion
   */
  async awardXP(amount: number, source: string): Promise<void> {
    this.state.experience += amount;
    this.state.totalXP += amount;

    this._onXPGain.fire({ amount, source });

    // Check for level up
    await this.checkLevelUp();

    // Check for unlocks
    await this.checkUnlocks();

    await this.saveState();
  }

  /**
   * Check if companion should level up
   */
  private async checkLevelUp(): Promise<boolean> {
    const xpNeeded = xpForLevel(this.state.level);

    if (this.state.experience >= xpNeeded) {
      this.state.level++;
      this.state.experience -= xpNeeded;

      this._onLevelUp.fire(this.state.level);

      // Check for new unlocks at this level
      await this.checkUnlocks();

      return true;
    }

    return false;
  }

  /**
   * Check for newly unlocked companions and accessories
   */
  private async checkUnlocks(): Promise<void> {
    const stats = this.getUnlockStats();

    // Check companion unlocks
    for (const unlock of COMPANION_UNLOCKS) {
      if (unlock.isDefault) {
        continue;
      }
      if (this.state.unlockedCompanions.includes(unlock.type)) {
        continue;
      }

      if (this.canUnlock(unlock.unlockedBy, stats)) {
        await this.unlockCompanion(unlock.type);
      }
    }

    // Check accessory unlocks
    for (const accessory of ACCESSORIES) {
      if (this.state.unlockedAccessories.includes(accessory.id)) {
        continue;
      }

      if (this.canUnlock(accessory.unlockedBy, stats)) {
        await this.unlockAccessory(accessory.id);
      }
    }
  }

  /**
   * Get current stats for unlock checking
   */
  private getUnlockStats(): Record<string, number> {
    const focusStats = this.focusService.getStats();

    return {
      level: this.state.level,
      sessions: focusStats.totalSessions,
      streak: focusStats.currentStreak,
      todos: this.todoCompletedCount,
      special: this.state.nightOwlCount ?? 0,
    };
  }

  /**
   * Check if an unlock condition is met
   */
  canUnlock(condition: UnlockCondition, stats?: Record<string, number>): boolean {
    const currentStats = stats || this.getUnlockStats();
    const value = currentStats[condition.type] ?? 0;
    return value >= condition.value;
  }

  /**
   * Unlock a new companion
   */
  private async unlockCompanion(type: CompanionType): Promise<void> {
    if (this.state.unlockedCompanions.includes(type)) {
      return;
    }

    this.state.unlockedCompanions.push(type);
    this._onUnlock.fire({ type: 'companion', item: type });

    await this.saveState();
  }

  /**
   * Unlock a new accessory
   */
  private async unlockAccessory(id: AccessoryId): Promise<void> {
    if (this.state.unlockedAccessories.includes(id)) {
      return;
    }

    this.state.unlockedAccessories.push(id);
    this._onUnlock.fire({ type: 'accessory', item: id });

    await this.saveState();
  }

  /**
   * Equip an accessory
   */
  async equipAccessory(id: AccessoryId | undefined): Promise<void> {
    if (id && !this.state.unlockedAccessories.includes(id)) {
      throw new Error('Accessory not unlocked');
    }

    this.state.equippedAccessory = id;
    await this.saveState();
  }

  /**
   * Get list of unlocked companions
   */
  getUnlockedCompanions(): CompanionType[] {
    return [...this.state.unlockedCompanions];
  }

  /**
   * Get list of locked companions with unlock conditions
   */
  getLockedCompanions(): Array<{ type: CompanionType; name: string; condition: string }> {
    return COMPANION_UNLOCKS.filter(
      (unlock) => !this.state.unlockedCompanions.includes(unlock.type)
    ).map((unlock) => ({
      type: unlock.type,
      name: unlock.name,
      condition: unlock.unlockedBy.description || 'Unknown',
    }));
  }

  /**
   * Get list of unlocked accessories
   */
  getUnlockedAccessories(): AccessoryId[] {
    return [...this.state.unlockedAccessories];
  }

  /**
   * Get list of locked accessories with unlock conditions
   */
  getLockedAccessories(): Array<{ id: AccessoryId; name: string; condition: string }> {
    return ACCESSORIES.filter((acc) => !this.state.unlockedAccessories.includes(acc.id)).map(
      (acc) => ({
        id: acc.id,
        name: acc.name,
        condition: acc.unlockedBy.description || 'Unknown',
      })
    );
  }

  /**
   * Track night owl usage (after midnight)
   */
  async trackNightOwlUsage(): Promise<void> {
    const hour = new Date().getHours();

    // Between midnight (0) and 5 AM
    if (hour >= 0 && hour < 5) {
      this.state.nightOwlCount = (this.state.nightOwlCount ?? 0) + 1;
      await this.saveState();

      // Check if this unlocks the owl
      await this.checkUnlocks();
    }
  }

  /**
   * Get XP progress to next level
   */
  getXPProgress(): { current: number; needed: number; percentage: number } {
    const needed = xpForLevel(this.state.level);
    const percentage = Math.round((this.state.experience / needed) * 100);

    return {
      current: this.state.experience,
      needed,
      percentage,
    };
  }

  /**
   * Update TODO completed count for unlock checking
   */
  updateTodoCount(count: number): void {
    this.todoCompletedCount = count;
  }

  // =============================================================================
  // Reset (Phase 4)
  // =============================================================================

  /**
   * Reset companion progress (keeps type, resets XP/level/unlocks)
   */
  async reset(): Promise<void> {
    this.state = {
      ...DEFAULT_COMPANION_STATE,
      type: this.state.type,
      joinedDate: new Date().toISOString(),
    };
    await this.saveState();
  }

  dispose(): void {
    this._onStateChange.dispose();
    this._onLevelUp.dispose();
    this._onXPGain.dispose();
    this._onUnlock.dispose();
    this._onMessageChange.dispose();
    if (this.messageTimeout) {
      clearTimeout(this.messageTimeout);
    }
    this.disposables.forEach((d) => d.dispose());
  }
}
