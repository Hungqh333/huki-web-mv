'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';

export type AuthFormState = {
  error?: string;
  notice?: string;
};

const PASSWORD_MIN_LENGTH = 8;

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? 'http://localhost:3000';
}

export async function signUpAction(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const t = await getTranslations('auth.errors');

  const email = readString(formData, 'email');
  const password = readString(formData, 'password');
  const confirmPassword = readString(formData, 'confirmPassword');
  const name = readString(formData, 'name');
  const company = readString(formData, 'company');

  if (!email || !password) return { error: t('missingFields') };
  if (password.length < PASSWORD_MIN_LENGTH) return { error: t('passwordTooShort') };
  if (password !== confirmPassword) return { error: t('passwordMismatch') };

  const supabase = await createClient();

  // Chỉ gửi name/company vào metadata. Role KHÔNG bao giờ đến từ client —
  // trigger handle_new_user trong database luôn gán 'registered'.
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name: name || null, company: company || null },
      emailRedirectTo: `${siteUrl()}/auth/callback`,
    },
  });

  if (error) return { error: error.message };

  // Nếu project bật xác nhận email thì chưa có session ngay.
  if (!data.session) {
    const tPage = await getTranslations('auth.signUp');
    return { notice: tPage('checkEmail') };
  }

  revalidatePath('/', 'layout');
  redirect('/tai-khoan');
}

export async function signInAction(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const t = await getTranslations('auth.errors');

  const email = readString(formData, 'email');
  const password = readString(formData, 'password');

  if (!email || !password) return { error: t('missingFields') };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return { error: t('invalidCredentials') };

  revalidatePath('/', 'layout');
  redirect('/tai-khoan');
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();

  revalidatePath('/', 'layout');
  redirect('/');
}

export async function updateProfileAction(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const t = await getTranslations('auth');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: t('errors.notSignedIn') };

  // Cố tình chỉ gửi name/company. Kể cả nếu ai đó thêm field role vào form,
  // trigger enforce_profile_role_change trong database vẫn chặn.
  const { error } = await supabase
    .from('profiles')
    .update({
      name: readString(formData, 'name') || null,
      company: readString(formData, 'company') || null,
    })
    .eq('id', user.id);

  if (error) return { error: error.message };

  revalidatePath('/tai-khoan');
  return { notice: t('account.saved') };
}
