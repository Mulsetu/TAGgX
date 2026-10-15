export interface SignInState {
  error: string | null;
  redirectPath?: string;
}

export interface ForgotPasswordState {
  submitted: boolean;
  error: string | null;
}

export interface ResetPasswordState {
  success: boolean;
  error: string | null;
}

export interface InviteDetails {
  id: string;
  companyId: string;
  companyName: string;
  companySlug: string;
  roleId: string;
  email: string;
  vendorId: string | null;
  isExpired: boolean;
  isAccepted: boolean;
}

export interface AcceptInviteState {
  error: string | null;
  redirectPath?: string;
}

export interface CurrentUser {
  id: string;
  email: string;
  fullName: string | null;
  companyId: string | null;
  vendorId: string | null;
  isCompanyAdmin: boolean;
  role: { id: string; name: string } | null;
}

export interface CompanyUserSummary {
  id: string;
  email: string;
  fullName: string | null;
  isActive: boolean;
  isCompanyAdmin: boolean;
  roleId: string;
  roleName: string;
  createdAt: string;
}

export interface PendingInviteSummary {
  id: string;
  email: string;
  roleName: string;
  expiresAt: string;
  isExpired: boolean;
}

export interface InviteUserFormState {
  error: string | null;
  inviteUrl?: string;
}

export interface UserActionState {
  error: string | null;
}

export interface ConfirmSignupEmailState {
  error: string | null;
  /** The link can't be used any more; the page offers to send a new one. */
  expired?: boolean;
}

export interface AccountSignupState {
  error: string | null;
  checkEmail?: boolean;
  redirectPath?: string;
  /** The email already has a verified account and the password didn't match. */
  existingAccount?: boolean;
}

export interface ResendVerificationState {
  error: string | null;
  submitted?: boolean;
}

export interface SignupResumeProfile {
  hasProfile: boolean;
  companyId: string | null;
  companySlug: string | null;
  isActive: boolean;
}
