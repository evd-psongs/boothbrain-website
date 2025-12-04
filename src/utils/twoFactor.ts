/**
 * Two-Factor Authentication (2FA) utilities using Supabase MFA
 */

import { supabase } from '@/lib/supabase';
import * as Crypto from 'expo-crypto';

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

export type RecoveryCode = {
  code: string;
  hash: string;
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

// ============================================================================
// Recovery Codes
// ============================================================================

/**
 * Simple hash function for recovery codes
 * Uses SHA-256 with salt for security
 */
async function hashRecoveryCode(code: string): Promise<string> {
  // Use expo-crypto for React Native compatibility
  const dataToHash = code + 'boothbrain-2fa-salt';
  const hashHex = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    dataToHash
  );

  return hashHex;
}

/**
 * Generate a random recovery code (8 characters: XXXX-XXXX)
 */
function generateRecoveryCodeString(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude ambiguous characters (0, O, 1, I)
  let code = '';

  for (let i = 0; i < 8; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    code += chars[randomIndex];

    // Add hyphen in the middle for readability
    if (i === 3) {
      code += '-';
    }
  }

  return code;
}

/**
 * Generate recovery codes for a user
 * @param userId User ID to generate codes for
 * @param count Number of codes to generate (default: 10)
 * @returns Array of recovery codes (plaintext) - MUST be shown to user immediately
 */
export async function generateRecoveryCodes(
  userId: string,
  count: number = 10
): Promise<{ success: boolean; codes?: string[]; error?: string }> {
  try {
    // Delete existing recovery codes for user
    const { error: deleteError } = await supabase
      .from('recovery_codes')
      .delete()
      .eq('user_id', userId);

    if (deleteError) {
      console.error('Failed to delete old recovery codes:', deleteError);
      return {
        success: false,
        error: 'Failed to delete old recovery codes',
      };
    }

    // Generate new codes
    const codes: string[] = [];
    const codeHashes: { user_id: string; code_hash: string }[] = [];

    for (let i = 0; i < count; i++) {
      const code = generateRecoveryCodeString();
      const hash = await hashRecoveryCode(code);

      codes.push(code);
      codeHashes.push({
        user_id: userId,
        code_hash: hash,
      });
    }

    // Store hashed codes in database
    const { error: insertError } = await supabase
      .from('recovery_codes')
      .insert(codeHashes);

    if (insertError) {
      console.error('Failed to store recovery codes:', insertError);
      return {
        success: false,
        error: 'Failed to store recovery codes',
      };
    }

    return {
      success: true,
      codes, // Return plaintext codes - ONLY shown once!
    };
  } catch (error) {
    console.error('Failed to generate recovery codes:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate recovery codes',
    };
  }
}

/**
 * Verify a recovery code during login
 * @param userId User ID attempting to use recovery code
 * @param code Recovery code entered by user
 * @returns True if code is valid and unused, false otherwise
 */
export async function verifyRecoveryCode(
  userId: string,
  code: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Hash the provided code
    const codeHash = await hashRecoveryCode(code.trim().toUpperCase());

    // Check if code exists and is unused
    const { data: recoveryCode, error: fetchError } = await supabase
      .from('recovery_codes')
      .select('id, used_at')
      .eq('user_id', userId)
      .eq('code_hash', codeHash)
      .maybeSingle();

    if (fetchError) {
      console.error('Failed to verify recovery code:', fetchError);
      return {
        success: false,
        error: 'Failed to verify recovery code',
      };
    }

    if (!recoveryCode) {
      return {
        success: false,
        error: 'Invalid recovery code',
      };
    }

    if (recoveryCode.used_at) {
      return {
        success: false,
        error: 'Recovery code already used',
      };
    }

    // Mark code as used
    const { error: updateError } = await supabase
      .from('recovery_codes')
      .update({ used_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('code_hash', codeHash);

    if (updateError) {
      console.error('Failed to mark recovery code as used:', updateError);
      return {
        success: false,
        error: 'Failed to mark recovery code as used',
      };
    }

    return { success: true };
  } catch (error) {
    console.error('Failed to verify recovery code:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Verification failed',
    };
  }
}

/**
 * Get count of unused recovery codes for a user
 * @param userId User ID
 * @returns Count of unused codes
 */
export async function getUnusedRecoveryCodeCount(
  userId: string
): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('recovery_codes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('used_at', null);

    if (error) {
      console.error('Failed to get recovery code count:', error);
      return 0;
    }

    return count || 0;
  } catch (error) {
    console.error('Error getting recovery code count:', error);
    return 0;
  }
}
