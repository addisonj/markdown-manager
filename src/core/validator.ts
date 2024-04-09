import { DocLocation, IDocRepo } from './types'
export type ValidationErrorLevels = 'info' | 'warning' | 'error' | 'critical'
export const ValidationErrorLevels = [
  'info',
  'warning',
  'error',
  'critical',
] as const

export type ValidationError = {
  name: string
  level: ValidationErrorLevels
  message: string
  details: any
  location: DocLocation
}

/**
 * A validator is a function that checks the integrity of a doc repo
 * and returns a list of validation errors
 *
 * Example use cases:
 *  - checking the document is properly
 *  - checking spelling / grammar
 *  - checking for broken links
 *  - che
 *
 * Lifecycle: *after* the repo is built, but *before* the documents are loaded
 * Side effects: Validators should *not* modify documents, but *can* force a load, which should be indicated by the validator
 */
export type IValidator = {
  name: string
  requiresLoad: boolean
  validate(repo: IDocRepo): Promise<ValidationError[]>
}
