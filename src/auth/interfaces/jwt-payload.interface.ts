export interface JwtPayload {
  sub: string;
  username: string;
  role: 'parent';
  parentId: number;
  sid: string;
}

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
