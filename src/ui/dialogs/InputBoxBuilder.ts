/**
 * Input Box Builder
 * Fluent API for creating VS Code input boxes
 */

import * as vscode from 'vscode';

export interface InputBoxOptions {
  title?: string;
  prompt?: string;
  placeholder?: string;
  value?: string;
  password?: boolean;
  ignoreFocusOut?: boolean;
  validateInput?: (value: string) => string | undefined | Promise<string | undefined>;
}

/**
 * Fluent builder for VS Code input boxes
 */
export class InputBoxBuilder {
  private options: InputBoxOptions = {};

  /**
   * Set the title
   */
  setTitle(title: string): this {
    this.options.title = title;
    return this;
  }

  /**
   * Set the prompt
   */
  setPrompt(prompt: string): this {
    this.options.prompt = prompt;
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
   * Set the initial value
   */
  setValue(value: string): this {
    this.options.value = value;
    return this;
  }

  /**
   * Make this a password input
   */
  isPassword(enabled: boolean = true): this {
    this.options.password = enabled;
    return this;
  }

  /**
   * Keep input box open when focus is lost
   */
  ignoreFocusOut(enabled: boolean = true): this {
    this.options.ignoreFocusOut = enabled;
    return this;
  }

  /**
   * Set validation function
   */
  setValidator(
    validator: (value: string) => string | undefined | Promise<string | undefined>
  ): this {
    this.options.validateInput = validator;
    return this;
  }

  /**
   * Add required validation
   */
  required(message: string = 'This field is required'): this {
    this.options.validateInput = (value) => {
      if (!value || !value.trim()) {
        return message;
      }
      return undefined;
    };
    return this;
  }

  /**
   * Add length validation
   */
  length(min?: number, max?: number): this {
    const previousValidator = this.options.validateInput;

    this.options.validateInput = async (value) => {
      // Run previous validator first
      if (previousValidator) {
        const error = await previousValidator(value);
        if (error) {
          return error;
        }
      }

      if (min !== undefined && value.length < min) {
        return `Must be at least ${min} characters`;
      }
      if (max !== undefined && value.length > max) {
        return `Must be at most ${max} characters`;
      }
      return undefined;
    };

    return this;
  }

  /**
   * Add pattern validation
   */
  pattern(regex: RegExp, message: string): this {
    const previousValidator = this.options.validateInput;

    this.options.validateInput = async (value) => {
      // Run previous validator first
      if (previousValidator) {
        const error = await previousValidator(value);
        if (error) {
          return error;
        }
      }

      if (!regex.test(value)) {
        return message;
      }
      return undefined;
    };

    return this;
  }

  /**
   * Show the input box and return the value
   */
  async show(): Promise<string | undefined> {
    const inputBoxOptions: vscode.InputBoxOptions = {
      title: this.options.title,
      prompt: this.options.prompt,
      placeHolder: this.options.placeholder,
      value: this.options.value,
      password: this.options.password,
      ignoreFocusOut: this.options.ignoreFocusOut,
      validateInput: this.options.validateInput,
    };

    const result = await vscode.window.showInputBox(inputBoxOptions);
    return result;
  }

  /**
   * Create a new builder instance
   */
  static create(): InputBoxBuilder {
    return new InputBoxBuilder();
  }
}

/**
 * Quick helper function to show a simple input box
 */
export async function showInputBox(options: {
  title?: string;
  prompt?: string;
  placeholder?: string;
  value?: string;
  password?: boolean;
}): Promise<string | undefined> {
  const builder = InputBoxBuilder.create();

  if (options.title) {
    builder.setTitle(options.title);
  }
  if (options.prompt) {
    builder.setPrompt(options.prompt);
  }
  if (options.placeholder) {
    builder.setPlaceholder(options.placeholder);
  }
  if (options.value) {
    builder.setValue(options.value);
  }
  if (options.password) {
    builder.isPassword(options.password);
  }

  return await builder.show();
}
