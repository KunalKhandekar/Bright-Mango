export const ROLES = {
  MENTOR: 'mentor',
  STUDENT: 'student',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ALL_ROLES: Role[] = [ROLES.MENTOR, ROLES.STUDENT];
