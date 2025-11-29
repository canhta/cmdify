/**
 * Input Validation Utilities
 * Centralized validation logic for forms and inputs
 */

/**
 * Validate non-empty string
 */
export function validateRequired(value: string, field: string = 'This field'): string | undefined {
  if (!value || !value.trim()) {
    return `${field} is required`;
  }
  return undefined;
}

/**
 * Validate string length
 */
export function validateLength(value: string, min?: number, max?: number): string | undefined {
  if (min !== undefined && value.length < min) {
    return `Must be at least ${min} characters`;
  }
  if (max !== undefined && value.length > max) {
    return `Must be at most ${max} characters`;
  }
  return undefined;
}

/**
 * Validate email format
 */
export function validateEmail(value: string): string | undefined {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(value)) {
    return 'Invalid email format';
  }
  return undefined;
}

/**
 * Validate URL format
 */
export function validateUrl(value: string): string | undefined {
  try {
    new URL(value);
    return undefined;
  } catch {
    return 'Invalid URL format';
  }
}

/**
 * Validate YYYY-MM-DD date format
 */
export function validateISODate(value: string): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return 'Please use YYYY-MM-DD format';
  }
  return undefined;
}

/**
 * Validate number within range
 */
export function validateNumber(value: number, min?: number, max?: number): string | undefined {
  if (min !== undefined && value < min) {
    return `Must be at least ${min}`;
  }
  if (max !== undefined && value > max) {
    return `Must be at most ${max}`;
  }
  return undefined;
}

/**
 * Validate regex pattern
 */
export function validatePattern(
  value: string,
  pattern: RegExp,
  message: string
): string | undefined {
  if (!pattern.test(value)) {
    return message;
  }
  return undefined;
}

/**
 * Validate file path exists
 */
export function validateFilePath(value: string): string | undefined {
  if (!value || !value.trim()) {
    return 'File path is required';
  }
  // Basic validation - can be enhanced with actual file system checks
  if (value.includes('..')) {
    return 'Invalid file path (contains ..)';
  }
  return undefined;
}

/**
 * Compose multiple validators
 */
export function composeValidators(
  ...validators: Array<(value: string) => string | undefined>
): (value: string) => string | undefined {
  return (value: string) => {
    for (const validator of validators) {
      const error = validator(value);
      if (error) {
        return error;
      }
    }
    return undefined;
  };
}

/**
 * Create a required validator with custom message
 */
export function required(message?: string) {
  return (value: string) => {
    if (!value || !value.trim()) {
      return message || 'This field is required';
    }
    return undefined;
  };
}

/**
 * Create a length validator
 */
export function length(min?: number, max?: number) {
  return (value: string) => validateLength(value, min, max);
}

/**
 * Create a pattern validator
 */
export function pattern(regex: RegExp, message: string) {
  return (value: string) => validatePattern(value, regex, message);
}
