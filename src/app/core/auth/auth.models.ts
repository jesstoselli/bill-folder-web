export interface UserDto {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
}

export interface LoginRequest {
  readonly email: string;
  readonly password: string;
}

export interface SignupRequest extends LoginRequest {
  readonly displayName: string;
}

export interface ForgotPasswordRequest {
  readonly email: string;
}

export interface ForgotPasswordResponse {
  readonly devCode: string | null;
}

export interface ResetPasswordRequest {
  readonly email: string;
  readonly code: string;
  readonly newPassword: string;
}

export interface WebAuthResponse {
  readonly accessToken: string;
  readonly accessTokenExpiresAt: string;
  readonly user: UserDto;
}

export type AuthState =
  | { readonly kind: 'restoring' }
  | { readonly kind: 'anonymous' }
  | {
      readonly kind: 'authenticated';
      readonly user: UserDto;
      readonly accessToken: string;
      readonly expiresAt: string;
    };
