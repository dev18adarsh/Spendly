import { z } from 'zod'

import { MAX_PASSWORD_LENGTH } from '../services/password.service.js'

/**
 * Input rules for the authentication endpoints.
 *
 * The messages are written for the person filling in the form — they say
 * what to fix, not what went wrong internally.
 */

/** A trimmed, lower-cased email address. */
export const emailSchema = z
  .string({ error: 'Enter your email address.' })
  .trim()
  .min(1, 'Enter your email address.')
  .max(254, 'Email addresses cannot exceed 254 characters.')
  .toLowerCase()
  .pipe(z.email('Enter a valid email address.'))

/**
 * A password with a minimum length and a mix of letters and digits.
 *
 * The maximum matches bcrypt's own limit — bcrypt silently truncates
 * anything longer, so longer passwords are rejected instead of ignored.
 */
export const passwordSchema = z
  .string({ error: 'Choose a password.' })
  .min(8, 'Passwords must be at least 8 characters long.')
  .max(MAX_PASSWORD_LENGTH, `Passwords cannot exceed ${MAX_PASSWORD_LENGTH} characters.`)
  .refine((value) => /[A-Za-z]/.test(value), {
    message: 'Passwords must contain at least one letter.',
  })
  .refine((value) => /[0-9]/.test(value), {
    message: 'Passwords must contain at least one number.',
  })

/** The password field on the sign-in form only checks that something was typed. */
export const loginPasswordSchema = z
  .string({ error: 'Enter your password.' })
  .min(1, 'Enter your password.')
  .max(MAX_PASSWORD_LENGTH, 'Enter your password.')

export const registerSchema = z
  .object({
    name: z
      .string({ error: 'Enter your name.' })
      .trim()
      .min(1, 'Enter your name.')
      .max(80, 'Names cannot exceed 80 characters.'),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().optional(),
  })
  .refine(
    (value) =>
      value.confirmPassword === undefined ||
      value.confirmPassword.length === 0 ||
      value.confirmPassword === value.password,
    {
      message: 'The two passwords do not match.',
      path: ['confirmPassword'],
    },
  )

export const loginSchema = z.object({
  email: emailSchema,
  password: loginPasswordSchema,
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
