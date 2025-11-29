/**
 * Onboarding Panel Webview Provider
 * Multi-step onboarding flow for new users
 */

import * as vscode from 'vscode';
import { OnboardingService } from '../services/onboarding';
import { CompanionService } from '../services/companion';
import { LUCIDE_ICONS, icon, getLucideStyles } from '../utils/lucide';

/**
 * Onboarding Panel - Multi-step welcome flow
 */
export class OnboardingPanelProvider {
  private panel?: vscode.WebviewPanel;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly onboardingService: OnboardingService,
    private readonly companionService: CompanionService,
    private readonly context: vscode.ExtensionContext
  ) {}

  /**
   * Show the onboarding panel
   */
  async show(): Promise<void> {
    if (this.panel) {
      this.panel.reveal();
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      'cmdifyOnboarding',
      'Welcome to Cmdify',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [this.extensionUri],
      }
    );

    this.panel.webview.html = this.getHtmlContent();

    this.panel.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'selectCompanion':
          await this.companionService.setCompanionType(message.type);
          break;
        case 'configureAI':
          await vscode.commands.executeCommand('cmdify.configureAI');
          break;
        case 'skipAI':
          // User chose to skip AI configuration
          break;
        case 'complete':
          await this.onboardingService.completeOnboarding();
          this.panel?.dispose();
          vscode.window.showInformationMessage(
            'Welcome to Cmdify! Start coding and your companion will be with you.'
          );
          break;
        case 'openSettings':
          await vscode.commands.executeCommand('workbench.action.openSettings', 'cmdify');
          break;
        case 'showCompanion':
          await vscode.commands.executeCommand('cmdify.focus.showPanel');
          break;
      }
    });

    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });
  }

  /**
   * Generate HTML content for the onboarding webview
   */
  private getHtmlContent(): string {
    const companions = this.onboardingService.getStarterCompanions();
    const aiProviders = this.onboardingService.getAvailableAIProviders();
    const tips = this.onboardingService.getQuickTips();

    return /* html */ `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Cmdify</title>
        <style>
          :root {
            --primary-color: #6366f1;
            --primary-hover: #4f46e5;
            --bg-color: var(--vscode-editor-background);
            --text-color: var(--vscode-editor-foreground);
            --border-color: var(--vscode-input-border);
            --card-bg: var(--vscode-input-background);
            --button-bg: var(--vscode-button-background);
            --button-fg: var(--vscode-button-foreground);
            --button-hover: var(--vscode-button-hoverBackground);
            --secondary-text: var(--vscode-descriptionForeground);
          }

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

          body {
            font-family: var(--vscode-font-family);
            background-color: var(--bg-color);
            color: var(--text-color);
            padding: 40px;
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: flex-start;
          }

          .onboarding-container {
            max-width: 600px;
            width: 100%;
          }

          .step {
            display: none;
            animation: fadeIn 0.3s ease-in-out;
          }

          .step.active {
            display: block;
          }

          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }

          .header {
            text-align: center;
            margin-bottom: 32px;
          }

          .header h1 {
            font-size: 28px;
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
          }

          .header p {
            color: var(--secondary-text);
            font-size: 16px;
            line-height: 1.6;
          }

          .feature-list {
            list-style: none;
            margin: 24px 0;
          }

          .feature-list li {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 0;
            font-size: 16px;
          }

          .feature-list .icon {
            font-size: 24px;
          }

          .companions-grid {
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 16px;
            margin: 32px 0;
          }

          .companion-option {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 16px 8px;
            border: 2px solid var(--border-color);
            border-radius: 12px;
            cursor: pointer;
            transition: all 0.2s;
            background: var(--card-bg);
          }

          .companion-option:hover {
            border-color: var(--primary-color);
            transform: translateY(-2px);
          }

          .companion-option.selected {
            border-color: var(--primary-color);
            background: rgba(99, 102, 241, 0.1);
          }

          .companion-option.locked {
            opacity: 0.5;
            cursor: not-allowed;
          }

          .companion-option.locked:hover {
            transform: none;
            border-color: var(--border-color);
          }

          .companion-option .emoji {
            font-size: 40px;
            margin-bottom: 8px;
          }

          .companion-option .name {
            font-size: 12px;
            color: var(--secondary-text);
          }

          .companion-option .lock-icon {
            font-size: 10px;
            color: var(--secondary-text);
          }

          .unlock-hint {
            text-align: center;
            color: var(--secondary-text);
            font-size: 13px;
            margin-top: -16px;
            margin-bottom: 24px;
          }

          .ai-providers {
            display: flex;
            flex-direction: column;
            gap: 12px;
            margin: 24px 0;
          }

          .ai-provider {
            display: flex;
            align-items: center;
            gap: 16px;
            padding: 16px;
            border: 2px solid var(--border-color);
            border-radius: 12px;
            cursor: pointer;
            transition: all 0.2s;
            background: var(--card-bg);
          }

          .ai-provider:hover {
            border-color: var(--primary-color);
          }

          .ai-provider .icon {
            font-size: 28px;
          }

          .ai-provider .info {
            flex: 1;
          }

          .ai-provider .info .name {
            font-weight: 600;
            margin-bottom: 4px;
          }

          .ai-provider .info .description {
            font-size: 13px;
            color: var(--secondary-text);
          }

          .tips-list {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 16px;
            margin: 24px 0;
          }

          .tip-card {
            padding: 20px;
            border: 1px solid var(--border-color);
            border-radius: 12px;
            background: var(--card-bg);
          }

          .tip-card .icon {
            font-size: 28px;
            margin-bottom: 12px;
          }

          .tip-card .title {
            font-weight: 600;
            margin-bottom: 6px;
            font-size: 14px;
          }

          .tip-card .description {
            font-size: 13px;
            color: var(--secondary-text);
          }

          .actions {
            display: flex;
            justify-content: center;
            gap: 12px;
            margin-top: 32px;
          }

          .btn {
            padding: 12px 28px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
            border: none;
          }

          .btn-primary {
            background: var(--button-bg);
            color: var(--button-fg);
          }

          .btn-primary:hover {
            background: var(--button-hover);
          }

          .btn-secondary {
            background: transparent;
            color: var(--text-color);
            border: 1px solid var(--border-color);
          }

          .btn-secondary:hover {
            background: var(--card-bg);
          }

          .progress-dots {
            display: flex;
            justify-content: center;
            gap: 8px;
            margin-bottom: 32px;
          }

          .dot {
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: var(--border-color);
            transition: all 0.2s;
          }

          .dot.active {
            background: var(--primary-color);
            width: 24px;
            border-radius: 5px;
          }

          .dot.completed {
            background: var(--primary-color);
          }

          .celebration {
            text-align: center;
            margin: 24px 0;
          }

          .celebration .emoji {
            font-size: 64px;
            animation: bounce 1s ease infinite;
          }

          @keyframes bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
          }
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

  /**
   * Dispose the panel
   */
  dispose(): void {
    this.panel?.dispose();
  }
}
