/**
 * Onboarding Service
 * Manages first-run experience and user activation flow
 */

import * as vscode from 'vscode';
import {
  COMPANION_TYPE_EMOJIS,
  AI_PROVIDER_EMOJIS,
  FEATURE_EMOJIS,
} from '../utils/icons';

// Storage keys
const ONBOARDING_COMPLETED_KEY = 'cmdify.onboarding.completed';
const ONBOARDING_VERSION_KEY = 'cmdify.onboarding.version';

// Current onboarding version - increment to re-trigger for major updates
const CURRENT_ONBOARDING_VERSION = 1;

export interface OnboardingProgress {
  step: number;
  completed: boolean;
  companionSelected?: string;
  aiConfigured?: boolean;
}

/**
 * Onboarding Service - First-run experience management
 */
export class OnboardingService implements vscode.Disposable {
  private disposables: vscode.Disposable[] = [];

  // Event emitters
  private readonly _onOnboardingComplete = new vscode.EventEmitter<void>();
  readonly onOnboardingComplete = this._onOnboardingComplete.event;

  constructor(private readonly context: vscode.ExtensionContext) {}

  /**
   * Check if onboarding should be shown
   */
  shouldShowOnboarding(): boolean {
    const completed = this.context.globalState.get<boolean>(ONBOARDING_COMPLETED_KEY);
    const version = this.context.globalState.get<number>(ONBOARDING_VERSION_KEY);

    // Show if never completed or if version is outdated
    if (!completed) {
      return true;
    }

    // Re-trigger onboarding for major version updates
    if (version && version < CURRENT_ONBOARDING_VERSION) {
      return true;
    }

    return false;
  }

  /**
   * Mark onboarding as completed
   */
  async completeOnboarding(): Promise<void> {
    await this.context.globalState.update(ONBOARDING_COMPLETED_KEY, true);
    await this.context.globalState.update(ONBOARDING_VERSION_KEY, CURRENT_ONBOARDING_VERSION);
    this._onOnboardingComplete.fire();
  }

  /**
   * Reset onboarding (for testing or re-triggering)
   */
  async resetOnboarding(): Promise<void> {
    await this.context.globalState.update(ONBOARDING_COMPLETED_KEY, false);
    await this.context.globalState.update(ONBOARDING_VERSION_KEY, undefined);
  }

  /**
   * Get available AI providers
   */
  getAvailableAIProviders(): { id: string; name: string; description: string; icon: string }[] {
    return [
      { id: 'openai', name: 'OpenAI', description: 'GPT-4o, GPT-4o-mini', icon: AI_PROVIDER_EMOJIS['openai'] },
      { id: 'anthropic', name: 'Anthropic', description: 'Claude 3.5 Sonnet', icon: AI_PROVIDER_EMOJIS['anthropic'] },
      { id: 'ollama', name: 'Ollama', description: 'Local, free - runs on your machine', icon: AI_PROVIDER_EMOJIS['ollama'] },
      { id: 'azure', name: 'Azure OpenAI', description: 'Enterprise Azure deployment', icon: AI_PROVIDER_EMOJIS['azure'] },
    ];
  }

  /**
   * Get available companions for initial selection
   */
  getStarterCompanions(): { type: string; icon: string; name: string; unlocked: boolean }[] {
    return [
      { type: 'robot', icon: COMPANION_TYPE_EMOJIS['robot'], name: 'Robot', unlocked: true },
      { type: 'cat', icon: COMPANION_TYPE_EMOJIS['cat'], name: 'Cat', unlocked: false },
      { type: 'dog', icon: COMPANION_TYPE_EMOJIS['dog'], name: 'Dog', unlocked: false },
      { type: 'plant', icon: COMPANION_TYPE_EMOJIS['plant'], name: 'Plant', unlocked: false },
      { type: 'flame', icon: COMPANION_TYPE_EMOJIS['flame'], name: 'Flame', unlocked: false },
    ];
  }

  /**
   * Get quick tips for the final step
   */
  getQuickTips(): { icon: string; title: string; description: string }[] {
    return [
      {
        icon: FEATURE_EMOJIS['keyboard'],
        title: 'Cmd+Shift+C',
        description: 'Create or run commands instantly',
      },
      {
        icon: FEATURE_EMOJIS['companion'],
        title: 'Click your companion',
        description: 'Start a focus session',
      },
      {
        icon: FEATURE_EMOJIS['todo'],
        title: 'TODOs are scanned',
        description: 'Automatically from your codebase',
      },
      {
        icon: FEATURE_EMOJIS['achievement'],
        title: 'Earn achievements',
        description: 'Level up your companion',
      },
    ];
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
    this._onOnboardingComplete.dispose();
  }
}
