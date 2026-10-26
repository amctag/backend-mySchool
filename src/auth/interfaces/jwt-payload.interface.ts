export type JwtRole = 'parent' | 'school' | 'teacher' | 'director';

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

export type TeacherJwtPayload = {
  sub: string;
  username: string;
  role: 'teacher';
  teacherId: number;
  schoolId: number;
  sid: string;
};

export type DirectorJwtPayload = {
  sub: string;
  username: string;
  role: 'director';
  directorId: number;
  personId: number;
  schoolId: number;
  sid: string;
};

export type JwtPayload = ParentJwtPayload | SchoolJwtPayload | TeacherJwtPayload | DirectorJwtPayload;

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

export interface AuthenticatedTeacher {
  id: number;
  username: string;
  role: 'teacher';
  teacherId: number;
  schoolId: number;
  sessionId: string;
}

export interface AuthenticatedDirector {
  id: number;
  username: string;
  role: 'director';
  directorId: number;
  personId: number;
  schoolId: number;
  sessionId: string;
}

export type AuthenticatedUser =
  | AuthenticatedParent
  | AuthenticatedSchool
  | AuthenticatedTeacher
  | AuthenticatedDirector;
