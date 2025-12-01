/**
 * Companion Panel Webview Provider
 * Simplified focus timer UI with animated SVG companions
 */

import * as vscode from 'vscode';
import { BaseWebviewViewProvider } from '../ui/webview';
import { StylesProvider } from '../ui/webview/StylesProvider';
import { FocusService } from '../services/focus';
import { CompanionService } from '../services/companion';
import { formatTime } from '../utils/dateUtils';
import { FocusState } from '../models/focus';
import { CompanionType, ALL_COMPANIONS, COMPANION_NAMES } from '../models/companion';
import { icon } from '../utils/lucide';

/**
 * Companion Panel WebviewViewProvider
 */
export class CompanionPanelProvider extends BaseWebviewViewProvider {
  public static readonly viewType = 'cmdify.focus';

  constructor(
    context: vscode.ExtensionContext,
    private readonly focusService: FocusService,
    private readonly companionService: CompanionService
  ) {
    super(context, { viewType: CompanionPanelProvider.viewType });

    // Register service event listeners
    this.disposables.push(
      focusService.onTick(() => this.updateWebview()),
      focusService.onStateChange(() => this.updateWebview()),
      companionService.onStateChange(() => this.updateWebview()),
      companionService.onXPGain(() => this.updateWebview()),
      companionService.onLevelUp(() => this.updateWebview()),
      companionService.onMessageChange(() => this.updateWebview())
    );

    // Register message handlers
    this.registerMessageHandler('start', async () => await this.focusService.start());
    this.registerMessageHandler('pause', async () => await this.focusService.pause());
    this.registerMessageHandler('resume', async () => await this.focusService.resume());
    this.registerMessageHandler('stop', async () => await this.focusService.stop());
    this.registerMessageHandler('skip', async () => await this.focusService.skip());
    this.registerMessageHandler('changeCompanion', async () => await this.showCompanionPicker());
  }

  protected onViewCreated(): void {
    this.updateWebview();
  }

  private updateWebview(): void {
    if (!this.view) {
      return;
    }

    const focusState = this.focusService.getState();
    const companionState = this.companionService.getState();
    const stats = this.focusService.getStats();
    const svgState = this.companionService.getSvgState();
    const xpProgress = this.companionService.getXPProgress();
    const companionName = this.companionService.getCompanionName();
    const currentMessage = this.companionService.getCurrentMessage();

    this.postMessage({
      type: 'update',
      focusState,
      companionType: companionState.type,
      svgState,
      streak: stats.currentStreak,
      timeFormatted: formatTime(focusState.timeRemaining),
      level: companionState.level,
      experience: companionState.experience,
      xpProgress,
      companionName,
      currentMessage,
    });
  }

  private async showCompanionPicker(): Promise<void> {
    const currentState = this.companionService.getState();
    const unlocked = this.companionService.getUnlockedCompanions();
    const locked = this.companionService.getLockedCompanions();

    const items = [
      ...unlocked.map((type) => ({
        label: `${type === currentState.type ? '$(check) ' : ''}${COMPANION_NAMES[type]}`,
        description: type === currentState.type ? 'Current' : 'Unlocked',
        value: type,
        picked: type === currentState.type,
      })),
      ...locked.map((item) => ({
        label: `$(lock) ${item.name}`,
        description: item.condition,
        value: item.type,
        picked: false,
      })),
    ];

    const selected = await vscode.window.showQuickPick(items, {
      title: 'Choose Companion',
      placeHolder: 'Select your focus companion',
      ignoreFocusOut: true,
    });

    if (selected) {
      if (!unlocked.includes(selected.value)) {
        vscode.window.showWarningMessage(
          `${COMPANION_NAMES[selected.value]} is locked. ${locked.find((l) => l.type === selected.value)?.condition}`
        );
        return;
      }

      await this.companionService.setCompanionType(selected.value);
    }
  }

  private getSvgUris(webview: vscode.Webview): Record<string, Record<string, string>> {
    const svgUris: Record<string, Record<string, string>> = {};
    for (const type of ALL_COMPANIONS) {
      svgUris[type] = {
        idle: this.getSvgUri(webview, type, 'idle'),
        focus: this.getSvgUri(webview, type, 'focus'),
        break: this.getSvgUri(webview, type, 'break'),
        celebrate: this.getSvgUri(webview, type, 'celebrate'),
      };
    }
    return svgUris;
  }

  private getSvgUri(webview: vscode.Webview, type: CompanionType, state: string): string {
    return webview
      .asWebviewUri(
        vscode.Uri.joinPath(
          this.context.extensionUri,
          'media',
          'companions',
          `${type}-${state}.svg`
        )
      )
      .toString();
  }

  protected getHtmlContent(webview: vscode.Webview): string {
    const focusState = this.focusService.getState();
    const companionState = this.companionService.getState();
    const stats = this.focusService.getStats();
    const svgState = this.companionService.getSvgState();
    const svgUris = this.getSvgUris(webview);

    // Load external CSS
    const panelStyles = StylesProvider.getPanelStyles('companion', this.context.extensionPath);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Focus</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      padding: 12px;
    }
    ${panelStyles}
  </style>
</head>
<body>
  <div class="header">
    <span class="companion-name" id="companionName">${this.companionService.getCompanionName()}</span>
    <span class="level-badge" id="levelBadge">Level ${companionState.level}</span>
  </div>
  
  <div class="message-bubble" id="messageBubble"></div>
  
  <div class="xp-bar">
    <div class="xp-fill" id="xpFill" style="width: 0%"></div>
  </div>
  <div class="xp-label" id="xpLabel">0 / 100 XP</div>
  
  <div class="timer-row">
    <img class="companion" id="companion" 
         src="${svgUris[companionState.type][svgState]}" 
         title="Click to change"/>
    
    <div class="timer-info">
      <div class="timer-display ${focusState.status}" id="timer">
        ${focusState.status === 'idle' ? '--:--' : formatTime(focusState.timeRemaining)}
      </div>
      <div class="status ${focusState.status}" id="status">
        ${this.getStatusText(focusState.status)}
      </div>
    </div>
    
    <div class="controls" id="controls">
      ${this.getControlButtons(focusState.status)}
    </div>
  </div>
  
  <div class="divider"></div>
  
  <div class="stats-row">
    <span class="stats-label">Sessions</span>
    <div class="dots" id="dots">${this.getSessionDots(focusState)}</div>
  </div>
  
  <div class="stats-row" style="margin-top: 8px;">
    <span class="stats-label">${icon('flame', 14)} Streak</span>
    <span class="stats-value" id="streak">${stats.currentStreak} days</span>
  </div>
  
  <script>
    const vscode = acquireVsCodeApi();
    const svgUris = ${JSON.stringify(svgUris)};
    
    document.getElementById('controls').addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (btn?.dataset.action) vscode.postMessage({ command: btn.dataset.action });
    });
    
    document.getElementById('companion').addEventListener('click', () => {
      vscode.postMessage({ command: 'changeCompanion' });
    });
    
    window.addEventListener('message', (e) => {
      const msg = e.data;
      if (msg.type !== 'update') return;
      
      const { focusState, companionType, svgState, streak, timeFormatted, level, experience, xpProgress, companionName, currentMessage } = msg;
      
      document.getElementById('companionName').textContent = companionName || companionType.charAt(0).toUpperCase() + companionType.slice(1);
      document.getElementById('levelBadge').textContent = 'Level ' + level;
      document.getElementById('xpFill').style.width = xpProgress.percentage + '%';
      document.getElementById('xpLabel').textContent = xpProgress.current + ' / ' + xpProgress.needed + ' XP';
      
      const messageBubble = document.getElementById('messageBubble');
      if (currentMessage) {
        messageBubble.textContent = currentMessage;
        messageBubble.classList.add('visible');
      } else {
        messageBubble.classList.remove('visible');
      }
      
      document.getElementById('timer').textContent = focusState.status === 'idle' ? '--:--' : timeFormatted;
      document.getElementById('timer').className = 'timer-display ' + focusState.status;
      document.getElementById('status').textContent = getStatus(focusState.status);
      document.getElementById('status').className = 'status ' + focusState.status;
      document.getElementById('companion').src = svgUris[companionType][svgState];
      document.getElementById('controls').innerHTML = getButtons(focusState.status);
      document.getElementById('dots').innerHTML = getDots(focusState);
      document.getElementById('streak').textContent = streak + ' days';
    });
    
    function getStatus(s) {
      return { focusing: 'Focusing', break: 'Break', paused: 'Paused', idle: 'Ready' }[s] || 'Ready';
    }
    
    function getButtons(s) {
      const icons = {
        play: '${icon('play', 14).replace(/'/g, "\\'")}',
        pause: '${icon('pause', 14).replace(/'/g, "\\'")}',
        skip: '${icon('skipForward', 14).replace(/'/g, "\\'")}',
        stop: '${icon('stop', 14).replace(/'/g, "\\'")}',
      };
      if (s === 'idle') return '<button class="btn primary" data-action="start">' + icons.play + ' Start</button>';
      if (s === 'focusing' || s === 'break') return \`
        <button class="btn" data-action="pause" title="Pause">\${icons.pause}</button>
        <button class="btn" data-action="skip" title="Skip">\${icons.skip}</button>
        <button class="btn" data-action="stop" title="Stop">\${icons.stop}</button>\`;
      if (s === 'paused') return \`
        <button class="btn primary" data-action="resume">\${icons.play} Resume</button>
        <button class="btn" data-action="stop" title="Stop">\${icons.stop}</button>\`;
      return '';
    }
    
    function getDots(state) {
      let h = '';
      for (let i = 1; i <= 4; i++) {
        let c = 'dot';
        if (i < state.currentSession || (i === state.currentSession && state.status === 'break')) c += ' done';
        else if (i === state.currentSession && state.status === 'focusing') c += ' active';
        h += '<div class="' + c + '"></div>';
      }
      return h;
    }
  </script>
</body>
</html>`;
  }

  private getStatusText(status: string): string {
    return (
      { focusing: 'Focusing', break: 'Break', paused: 'Paused', idle: 'Ready' }[status] || 'Ready'
    );
  }

  private getControlButtons(status: string): string {
    const icons = {
      play: icon('play', 14),
      pause: icon('pause', 14),
      skip: icon('skipForward', 14),
      stop: icon('stop', 14),
    };
    if (status === 'idle') {
      return `<button class="btn primary" data-action="start">${icons.play} Start</button>`;
    }
    if (status === 'focusing' || status === 'break') {
      return `<button class="btn" data-action="pause" title="Pause">${icons.pause}</button>
              <button class="btn" data-action="skip" title="Skip">${icons.skip}</button>
              <button class="btn" data-action="stop" title="Stop">${icons.stop}</button>`;
    }
    if (status === 'paused') {
      return `<button class="btn primary" data-action="resume">${icons.play} Resume</button>
              <button class="btn" data-action="stop" title="Stop">${icons.stop}</button>`;
    }
    return '';
  }

  private getSessionDots(focusState: FocusState): string {
    let html = '';
    for (let i = 1; i <= 4; i++) {
      let cls = 'dot';
      if (
        i < focusState.currentSession ||
        (i === focusState.currentSession && focusState.status === 'break')
      ) {
        cls += ' done';
      } else if (i === focusState.currentSession && focusState.status === 'focusing') {
        cls += ' active';
      }
      html += `<div class="${cls}"></div>`;
    }
    return html;
  }

  protected handleMessage(message: any): void {
    // All message handling is done through registered handlers
    // This is left for potential future custom messages
  }
}
