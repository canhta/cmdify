/**
 * Onboarding Panel Webview Provider
 * Multi-step onboarding flow for new users
 */

import * as vscode from 'vscode';
import { BaseWebviewPanel } from '../ui/webview';
import { StylesProvider } from '../ui/webview/StylesProvider';
import { OnboardingService } from '../services/onboarding';
import { CompanionService } from '../services/companion';
import { icon, getLucideStyles } from '../utils/lucide';

/**
 * Onboarding Panel - Multi-step welcome flow
 */
export class OnboardingPanelProvider extends BaseWebviewPanel {
  public static readonly viewType = 'cmdify.onboarding';

  constructor(
    context: vscode.ExtensionContext,
    private readonly onboardingService: OnboardingService,
    private readonly companionService: CompanionService
  ) {
    super(context, {
      viewType: OnboardingPanelProvider.viewType,
      title: 'Welcome to Cmdify',
      showOptions: vscode.ViewColumn.One,
    });

    // Register message handlers
    this.registerMessageHandler('selectCompanion', async (message) => {
      await this.companionService.setCompanionType(message.type);
    });

    this.registerMessageHandler('configureAI', async () => {
      await vscode.commands.executeCommand('cmdify.configureAI');
    });

    this.registerMessageHandler('skipAI', async () => {
      // User chose to skip AI configuration
    });

    this.registerMessageHandler('complete', async () => {
      await this.onboardingService.completeOnboarding();
      this.panel?.dispose();
      vscode.window.showInformationMessage(
        'Welcome to Cmdify! Start coding and your companion will be with you.'
      );
    });

    this.registerMessageHandler('openSettings', async () => {
      await vscode.commands.executeCommand('workbench.action.openSettings', 'cmdify');
    });

    this.registerMessageHandler('showCompanion', async () => {
      await vscode.commands.executeCommand('cmdify.focus.showPanel');
    });
  }

  /**
   * Show the onboarding panel
   */
  show(): void {
    this.getPanel();
  }

  protected onPanelCreated(): void {
    // Panel is ready, HTML content will be generated via getHtmlContent
  }

  /**
   * Generate HTML content for the onboarding webview
   */
  protected getHtmlContent(): string {
    const companions = this.onboardingService.getStarterCompanions();
    const aiProviders = this.onboardingService.getAvailableAIProviders();
    const tips = this.onboardingService.getQuickTips();

    // Load external CSS
    const panelStyles = StylesProvider.getPanelStyles('onboarding', this.context.extensionPath);

    return /* html */ `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Cmdify</title>
        <style>
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }

          /* Lucide icon styles */
          ${getLucideStyles()}
          
          svg {
            display: inline-block;
            vertical-align: middle;
          }

          ${panelStyles}
        </style>
      </head>
      <body>
        <div class="onboarding-container">
          <!-- Progress Dots -->
          <div class="progress-dots">
            <div class="dot active" data-step="1"></div>
            <div class="dot" data-step="2"></div>
            <div class="dot" data-step="3"></div>
            <div class="dot" data-step="4"></div>
          </div>

          <!-- Step 1: Welcome -->
          <div class="step active" data-step="1">
            <div class="header">
              <h1>👋 Welcome to Cmdify!</h1>
              <p>Your AI-powered productivity companion for VS Code.</p>
            </div>

            <ul class="feature-list">
              <li>
                <span class="icon">${icon('sparkles', 20)}</span>
                <span>Generate CLI commands with AI - just describe what you want</span>
              </li>
              <li>
                <span class="icon">${icon('timer', 20)}</span>
                <span>Stay focused with Pomodoro timer and animated companions</span>
              </li>
              <li>
                <span class="icon">${icon('listTodo', 20)}</span>
                <span>Track TODOs in your codebase automatically</span>
              </li>
              <li>
                <span class="icon">${icon('trophy', 20)}</span>
                <span>Earn achievements and level up your companion</span>
              </li>
            </ul>

            <div class="actions">
              <button class="btn btn-primary" onclick="nextStep()">Get Started ${icon('arrowRight', 16)}</button>
            </div>
          </div>

          <!-- Step 2: Choose Companion -->
          <div class="step" data-step="2">
            <div class="header">
              <h1>${icon('bot', 28)} Choose Your Companion</h1>
              <p>Pick a buddy to join you on your coding journey.</p>
            </div>

            <div class="companions-grid">
              ${companions
                .map(
                  (c, i) => `
                <div class="companion-option ${!c.unlocked ? 'locked' : ''} ${i === 0 ? 'selected' : ''}" 
                     data-type="${c.type}" 
                     onclick="selectCompanion(this, '${c.type}', ${c.unlocked})">
                  <span class="emoji">${c.icon}</span>
                  <span class="name">${c.name}</span>
                  ${!c.unlocked ? `<span class="lock-icon">${icon('lock', 14)}</span>` : ''}
                </div>
              `
                )
                .join('')}
            </div>

            <p class="unlock-hint">${icon('unlock', 14)} Unlock more companions by using Cmdify!</p>

            <div class="actions">
              <button class="btn btn-secondary" onclick="prevStep()">${icon('arrowLeft', 16)} Back</button>
              <button class="btn btn-primary" onclick="nextStep()">Continue ${icon('arrowRight', 16)}</button>
            </div>
          </div>

          <!-- Step 3: AI Setup -->
          <div class="step" data-step="3">
            <div class="header">
              <h1>${icon('brain', 28)} Set Up AI Command Generation</h1>
              <p>Describe what you want, get the command. <em>(Optional)</em></p>
            </div>

            <div class="ai-providers">
              ${aiProviders
                .map(
                  (p) => `
                <div class="ai-provider" onclick="configureAI('${p.id}')">
                  <span class="icon">${p.id === 'openai' ? icon('brain', 24) : p.id === 'anthropic' ? icon('bot', 24) : p.id === 'ollama' ? icon('terminal', 24) : icon('cloud', 24)}</span>
                  <div class="info">
                    <div class="name">${p.name}</div>
                    <div class="description">${p.description}</div>
                  </div>
                  <span>${icon('chevronRight', 20)}</span>
                </div>
              `
                )
                .join('')}
            </div>

            <div class="actions">
              <button class="btn btn-secondary" onclick="prevStep()">${icon('arrowLeft', 16)} Back</button>
              <button class="btn btn-secondary" onclick="skipAI()">Skip for Later</button>
            </div>
          </div>

          <!-- Step 4: Complete -->
          <div class="step" data-step="4">
            <div class="header">
              <h1>${icon('checkCircle', 28)} You're All Set!</h1>
              <p>Here are some quick tips to get started.</p>
            </div>

            <div class="tips-list">
              ${tips
                .map(
                  (t, i) => `
                <div class="tip-card">
                  <div class="icon">${i === 0 ? icon('keyboard', 24) : i === 1 ? icon('bot', 24) : i === 2 ? icon('listTodo', 24) : icon('trophy', 24)}</div>
                  <div class="title">${t.title}</div>
                  <div class="description">${t.description}</div>
                </div>
              `
                )
                .join('')}
            </div>

            <div class="celebration">
              <div class="emoji">${icon('rocket', 48)}</div>
            </div>

            <div class="actions">
              <button class="btn btn-primary" onclick="complete()">Start Coding!</button>
            </div>
          </div>
        </div>

        <script>
          const vscode = acquireVsCodeApi();
          let currentStep = 1;
          let selectedCompanion = 'robot';

          function updateProgress() {
            document.querySelectorAll('.dot').forEach((dot, i) => {
              const step = i + 1;
              dot.classList.remove('active', 'completed');
              if (step === currentStep) {
                dot.classList.add('active');
              } else if (step < currentStep) {
                dot.classList.add('completed');
              }
            });

            document.querySelectorAll('.step').forEach((stepEl) => {
              stepEl.classList.remove('active');
              if (parseInt(stepEl.dataset.step) === currentStep) {
                stepEl.classList.add('active');
              }
            });
          }

          function nextStep() {
            if (currentStep < 4) {
              currentStep++;
              updateProgress();
            }
          }

          function prevStep() {
            if (currentStep > 1) {
              currentStep--;
              updateProgress();
            }
          }

          function selectCompanion(element, type, unlocked) {
            if (!unlocked) return;
            
            document.querySelectorAll('.companion-option').forEach(el => {
              el.classList.remove('selected');
            });
            element.classList.add('selected');
            selectedCompanion = type;
            
            vscode.postMessage({ command: 'selectCompanion', type });
          }

          function configureAI(provider) {
            vscode.postMessage({ command: 'configureAI', provider });
            // Move to next step after user clicks configure
            setTimeout(() => {
              nextStep();
            }, 300);
          }

          function skipAI() {
            vscode.postMessage({ command: 'skipAI' });
            nextStep();
          }

          function complete() {
            vscode.postMessage({ command: 'complete' });
          }
        </script>
      </body>
      </html>
    `;
  }

  protected handleMessage(message: any): void {
    // All messages handled through registered handlers
  }
}
