/**
 * Quick Pick Builder
 * Fluent API for creating VS Code quick picks
 */

import * as vscode from 'vscode';

export interface QuickPickOptions<T> {
  title?: string;
  placeholder?: string;
  matchOnDescription?: boolean;
  matchOnDetail?: boolean;
  canPickMany?: boolean;
  ignoreFocusOut?: boolean;
}

export interface QuickPickItemWithData<T> extends vscode.QuickPickItem {
  data?: T;
}

/**
 * Fluent builder for VS Code quick picks
 */
export class QuickPickBuilder<T = any> {
  private items: QuickPickItemWithData<T>[] = [];
  private options: QuickPickOptions<T> = {};
  private onAcceptCallback?: (selected: QuickPickItemWithData<T>[]) => void;
  private onChangeCallback?: (value: string) => void;

  /**
   * Set the title
   */
  setTitle(title: string): this {
    this.options.title = title;
    return this;
  }

  /**
   * Set the placeholder
   */
  setPlaceholder(placeholder: string): this {
    this.options.placeholder = placeholder;
    return this;
  }

  /**
   * Enable matching on description
   */
  matchOnDescription(enabled: boolean = true): this {
    this.options.matchOnDescription = enabled;
    return this;
  }

  /**
   * Enable matching on detail
   */
  matchOnDetail(enabled: boolean = true): this {
    this.options.matchOnDetail = enabled;
    return this;
  }

  /**
   * Allow picking multiple items
   */
  canPickMany(enabled: boolean = true): this {
    this.options.canPickMany = enabled;
    return this;
  }

  /**
   * Keep quick pick open when focus is lost
   */
  ignoreFocusOut(enabled: boolean = true): this {
    this.options.ignoreFocusOut = enabled;
    return this;
  }

  /**
   * Add a single item
   */
  addItem(
    label: string,
    options?: {
      description?: string;
      detail?: string;
      data?: T;
      picked?: boolean;
      alwaysShow?: boolean;
    }
  ): this {
    this.items.push({
      label,
      description: options?.description,
      detail: options?.detail,
      data: options?.data,
      picked: options?.picked,
      alwaysShow: options?.alwaysShow,
    });
    return this;
  }

  /**
   * Add multiple items
   */
  addItems(items: Array<QuickPickItemWithData<T> | string>): this {
    for (const item of items) {
      if (typeof item === 'string') {
        this.items.push({ label: item });
      } else {
        this.items.push(item);
      }
    }
    return this;
  }

  /**
   * Add a separator
   */
  addSeparator(label: string): this {
    this.items.push({
      label,
      kind: vscode.QuickPickItemKind.Separator,
    });
    return this;
  }

  /**
   * Add items from a data array with a mapper
   */
  addFromData<U>(data: U[], mapper: (item: U, index: number) => QuickPickItemWithData<T>): this {
    for (const [index, item] of data.entries()) {
      this.items.push(mapper(item, index));
    }
    return this;
  }

  /**
   * Set callback for when items are accepted
   */
  onAccept(callback: (selected: QuickPickItemWithData<T>[]) => void): this {
    this.onAcceptCallback = callback;
    return this;
  }

  /**
   * Set callback for when input value changes
   */
  onChange(callback: (value: string) => void): this {
    this.onChangeCallback = callback;
    return this;
  }

  /**
   * Show the quick pick and return selected item(s)
   */
  async show(): Promise<QuickPickItemWithData<T> | QuickPickItemWithData<T>[] | undefined> {
    if (this.options.canPickMany) {
      return await this.showMulti();
    }
    return await this.showSingle();
  }

  /**
   * Show quick pick for single selection
   */
  private async showSingle(): Promise<QuickPickItemWithData<T> | undefined> {
    if (this.onAcceptCallback || this.onChangeCallback) {
      return await this.showWithCallbacks();
    }

    const selected = await vscode.window.showQuickPick(this.items, {
      title: this.options.title,
      placeHolder: this.options.placeholder,
      matchOnDescription: this.options.matchOnDescription,
      matchOnDetail: this.options.matchOnDetail,
      ignoreFocusOut: this.options.ignoreFocusOut,
    });

    return selected;
  }

  /**
   * Show quick pick for multiple selection
   */
  private async showMulti(): Promise<QuickPickItemWithData<T>[]> {
    const selected = await vscode.window.showQuickPick(this.items, {
      title: this.options.title,
      placeHolder: this.options.placeholder,
      matchOnDescription: this.options.matchOnDescription,
      matchOnDetail: this.options.matchOnDetail,
      canPickMany: true,
      ignoreFocusOut: this.options.ignoreFocusOut,
    });

    return selected || [];
  }

  /**
   * Show with custom callbacks (for dynamic updates)
   */
  private async showWithCallbacks(): Promise<QuickPickItemWithData<T> | undefined> {
    const quickPick = vscode.window.createQuickPick<QuickPickItemWithData<T>>();
    quickPick.title = this.options.title;
    quickPick.placeholder = this.options.placeholder;
    quickPick.matchOnDescription = this.options.matchOnDescription ?? false;
    quickPick.matchOnDetail = this.options.matchOnDetail ?? false;
    quickPick.ignoreFocusOut = this.options.ignoreFocusOut ?? false;
    quickPick.items = this.items;

    return new Promise((resolve) => {
      if (this.onAcceptCallback) {
        quickPick.onDidAccept(() => {
          const selected = [...quickPick.selectedItems];
          this.onAcceptCallback!(selected);
          quickPick.hide();
          resolve(selected[0]);
        });
      } else {
        quickPick.onDidAccept(() => {
          const selected = quickPick.selectedItems[0];
          quickPick.hide();
          resolve(selected);
        });
      }

      if (this.onChangeCallback) {
        quickPick.onDidChangeValue((value) => {
          this.onChangeCallback!(value);
        });
      }

      quickPick.onDidHide(() => {
        quickPick.dispose();
        resolve(undefined);
      });

      quickPick.show();
    });
  }

  /**
   * Create a new builder instance
   */
  static create<T = any>(): QuickPickBuilder<T> {
    return new QuickPickBuilder<T>();
  }
}

/**
 * Quick helper function to show a simple quick pick
 */
export async function showQuickPick<T = any>(
  items: Array<QuickPickItemWithData<T> | string>,
  options?: {
    title?: string;
    placeholder?: string;
  }
): Promise<QuickPickItemWithData<T> | undefined> {
  const builder = QuickPickBuilder.create<T>();

  if (options?.title) {
    builder.setTitle(options.title);
  }
  if (options?.placeholder) {
    builder.setPlaceholder(options.placeholder);
  }

  builder.addItems(items);

  return (await builder.show()) as QuickPickItemWithData<T> | undefined;
}
