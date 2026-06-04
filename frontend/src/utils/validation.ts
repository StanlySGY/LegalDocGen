export interface ValidationResult {
  valid: boolean
  errors: Record<string, string>
}

export function validateRequired(value: string, fieldName: string): string | null {
  if (!value.trim()) return `${fieldName}不能为空`
  return null
}

export function validateMinLength(value: string, min: number, fieldName: string): string | null {
  if (value.trim().length < min) return `${fieldName}至少${min}个字符`
  return null
}

export function validateMaxLength(value: string, max: number, fieldName: string): string | null {
  if (value.length > max) return `${fieldName}不能超过${max}个字符`
  return null
}

export function validateUrl(value: string, fieldName: string): string | null {
  if (!value.trim()) return null
  try {
    new URL(value)
    return null
  } catch {
    return `${fieldName}格式不正确，请输入有效的URL`
  }
}

export function validateCaseForm(form: { name: string; description: string; case_type: string }): ValidationResult {
  const errors: Record<string, string> = {}

  const nameError = validateRequired(form.name, '案件名称') || validateMaxLength(form.name, 100, '案件名称')
  if (nameError) errors.name = nameError

  const descError = validateMaxLength(form.description, 500, '案件描述')
  if (descError) errors.description = descError

  return { valid: Object.keys(errors).length === 0, errors }
}

export function validateChannelForm(form: { name: string; base_url: string; api_key: string }): ValidationResult {
  const errors: Record<string, string> = {}

  const nameError = validateRequired(form.name, '渠道名称') || validateMaxLength(form.name, 50, '渠道名称')
  if (nameError) errors.name = nameError

  const urlError = validateRequired(form.base_url, 'API地址') || validateUrl(form.base_url, 'API地址')
  if (urlError) errors.base_url = urlError

  return { valid: Object.keys(errors).length === 0, errors }
}

export function validateAuthForm(form: { username: string; password: string }, mode: 'login' | 'register'): ValidationResult {
  const errors: Record<string, string> = {}

  const usernameError = validateRequired(form.username, '用户名') || validateMinLength(form.username, 3, '用户名')
  if (usernameError) errors.username = usernameError

  const passwordError = validateRequired(form.password, '密码') || validateMinLength(form.password, 6, '密码')
  if (passwordError) errors.password = passwordError

  return { valid: Object.keys(errors).length === 0, errors }
}