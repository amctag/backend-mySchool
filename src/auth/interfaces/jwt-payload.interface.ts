export type JwtRole = 'parent' | 'school';

export type ParentJwtPayload = {
  sub: string;
  username: string;
  role: 'parent';
  parentId: number;
  sid: string;
};

export type SchoolJwtPayload = {
  sub: string;
  username: string;
  role: 'school';
  schoolId: number;
  sid: string;
};

export type JwtPayload = ParentJwtPayload | SchoolJwtPayload;

export interface PasswordResetJwtPayload {
  sub: string;
  purpose: 'password-reset';
}

export interface AuthenticatedParent {
  id: number;
  username: string;
  role: 'parent';
  parentId: number;
  sessionId: string;
}

export interface AuthenticatedSchool {
  id: number;
  username: string;
  role: 'school';
  schoolId: number;
  sessionId: string;
}

export type AuthenticatedUser = AuthenticatedParent | AuthenticatedSchool;
