export interface JwtPayload {
  sub: string;
  username: string;
  role: 'parent';
  parentId: number;
}

export interface AuthenticatedParent {
  id: number;
  username: string;
  role: 'parent';
  parentId: number;
}
