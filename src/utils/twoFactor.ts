/**
 * Two-Factor Authentication (2FA) utilities using Supabase MFA
 */

import { supabase } from '@/lib/supabase';

export type TwoFactorEnrollment = {
  id: string;
  type: 'totp';
  qrCode: string;
  secret: string;
  uri: string;
};

export type TwoFactorFactor = {
  id: string;
  friendlyName: string;
  factorType: 'totp';
  status: 'verified' | 'unverified';
  createdAt: string;
  updatedAt: string;
};

/**
 * Check if user has 2FA enabled
 */
export async function isTwoFactorEnabled(): Promise<boolean> {
  try {
    const { data, error } = await supabase.auth.mfa.listFactors();

    if (error) {
      console.error('Failed to check 2FA status:', error);
      return false;
    }

    // Check if user has any verified TOTP factors
    return data?.totp?.some(factor => factor.status === 'verified') ?? false;
  } catch (error) {
    console.error('Error checking 2FA status:', error);
    return false;
  }
}

/**
 * Enroll in 2FA - generates QR code and secret
 */
export async function enrollTwoFactor(
  friendlyName: string = 'Authenticator App'
): Promise<{ success: boolean; enrollment?: TwoFactorEnrollment; error?: string }> {
  try {
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName,
    });

    if (error) {
      return {
        success: false,
        error: error.message || 'Failed to enroll in 2FA'
      };
    }

    if (!data) {
      return {
        success: false,
        error: 'No enrollment data returned'
      };
    }

    return {
      success: true,
      enrollment: {
        id: data.id,
        type: data.type as 'totp',
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
        uri: data.totp.uri,
      },
    };
  } catch (error) {
    console.error('Failed to enroll in 2FA:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Verify 2FA enrollment with a code from authenticator app
 */
export async function verifyTwoFactorEnrollment(
  factorId: string,
  code: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code,
    });

    if (error) {
      return {
        success: false,
        error: error.message || 'Invalid code. Please try again.',
      };
    }

    if (!data) {
      return {
        success: false,
        error: 'Verification failed',
      };
    }

    return { success: true };
  } catch (error) {
    console.error('Failed to verify 2FA enrollment:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Verification failed',
    };
  }
}

/**
 * Challenge 2FA - used during login to get a challenge ID
 */
export async function challengeTwoFactor(
  factorId: string
): Promise<{ success: boolean; challengeId?: string; error?: string }> {
  try {
    const { data, error } = await supabase.auth.mfa.challenge({
      factorId,
    });

    if (error) {
      return {
        success: false,
        error: error.message || 'Failed to create 2FA challenge',
      };
    }

    if (!data) {
      return {
        success: false,
        error: 'No challenge data returned',
      };
    }

    return {
      success: true,
      challengeId: data.id,
    };
  } catch (error) {
    console.error('Failed to challenge 2FA:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Challenge failed',
    };
  }
}

/**
 * Verify 2FA code during login
 */
export async function verifyTwoFactorCode(
  factorId: string,
  challengeId: string,
  code: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.auth.mfa.verify({
      factorId,
      challengeId,
      code,
    });

    if (error) {
      return {
        success: false,
        error: error.message || 'Invalid code. Please try again.',
      };
    }

    if (!data) {
      return {
        success: false,
        error: 'Verification failed',
      };
    }

    return { success: true };
  } catch (error) {
    console.error('Failed to verify 2FA code:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Verification failed',
    };
  }
}

/**
 * Unenroll from 2FA - removes 2FA from account
 */
export async function unenrollTwoFactor(
  factorId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.auth.mfa.unenroll({
      factorId,
    });

    if (error) {
      return {
        success: false,
        error: error.message || 'Failed to disable 2FA',
      };
    }

    return { success: true };
  } catch (error) {
    console.error('Failed to unenroll from 2FA:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to disable 2FA',
    };
  }
}

/**
 * Get all 2FA factors for the current user
 */
export async function getTwoFactorFactors(): Promise<{
  success: boolean;
  factors?: TwoFactorFactor[];
  error?: string;
}> {
  try {
    const { data, error } = await supabase.auth.mfa.listFactors();

    if (error) {
      return {
        success: false,
        error: error.message || 'Failed to load 2FA factors',
      };
    }

    const factors: TwoFactorFactor[] = (data?.totp || []).map(factor => ({
      id: factor.id,
      friendlyName: factor.friendly_name || 'Authenticator App',
      factorType: factor.factor_type as 'totp',
      status: factor.status as 'verified' | 'unverified',
      createdAt: factor.created_at,
      updatedAt: factor.updated_at,
    }));

    return {
      success: true,
      factors,
    };
  } catch (error) {
    console.error('Failed to get 2FA factors:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load 2FA factors',
    };
  }
}

/**
 * Get the user's assurance level (aal1 = single factor, aal2 = 2FA verified)
 */
export async function getAssuranceLevel(): Promise<{
  level: 'aal1' | 'aal2' | null;
  nextLevel: 'aal1' | 'aal2' | null;
}> {
  try {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    if (error) {
      console.error('Failed to get assurance level:', error);
      return { level: null, nextLevel: null };
    }

    return {
      level: data?.currentLevel as 'aal1' | 'aal2' | null,
      nextLevel: data?.nextLevel as 'aal1' | 'aal2' | null,
    };
  } catch (error) {
    console.error('Error getting assurance level:', error);
    return { level: null, nextLevel: null };
  }
}
