/**
 * Companion Service
 * Manages the animated companion's state and type selection
 */

import * as vscode from 'vscode';
import {
  CompanionState,
  CompanionType,
  DEFAULT_COMPANION_STATE,
  COMPANION_EMOJIS,
} from '../models/companion';
import { FocusService } from './focus';

const COMPANION_STATE_KEY = 'cmdify.companion.state';

/**
 * Companion Service - Simplified without achievements
 */
export class CompanionService implements vscode.Disposable {
  private state: CompanionState;
  private disposables: vscode.Disposable[] = [];

  private readonly _onStateChange = new vscode.EventEmitter<CompanionState>();
  readonly onStateChange = this._onStateChange.event;

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

  private loadState(): CompanionState {
    const saved = this.context.globalState.get<CompanionState>(COMPANION_STATE_KEY);
    return saved ? { ...DEFAULT_COMPANION_STATE, ...saved } : { ...DEFAULT_COMPANION_STATE };
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
    await vscode.workspace.getConfiguration('cmdify.focus').update(
      'companionType',
      type,
      vscode.ConfigurationTarget.Global
    );
  }

  /**
   * Get companion emoji for status bar
   */
  getCompanionEmoji(status?: string): string {
    const focusState = this.focusService.getState();
    const currentStatus = status || focusState.status;
    const emojis = COMPANION_EMOJIS[this.state.type];
    return emojis[currentStatus] || emojis.idle;
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

  dispose(): void {
    this._onStateChange.dispose();
    this.disposables.forEach(d => d.dispose());
  }
}
