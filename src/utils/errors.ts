export class AppError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ValidationError extends AppError {}
export class TemplateNotFoundError extends AppError {}
export class DocxGenerationError extends AppError {}
export class PdfConversionError extends AppError {}
