import { DocLocation, IDocRepo } from './types'
export type ValidationErrorLevels = 'info' | 'warning' | 'error' | 'critical'
export const ValidationErrorLevels = [
  'info',
  'warning',
  'error',
  'critical',
] as const
export type ValidationError = {
  level: ValidationErrorLevels
  message: string
  details: any
  location: DocLocation
}
export type IValidator = {
  validate(repo: IDocRepo): Promise<ValidationError[]>
}
