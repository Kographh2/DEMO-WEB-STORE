import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const host = process.env.SMTP_HOST
  const smtpUser = process.env.SMTP_USER
  const smtpPass = process.env.SMTP_PASS
  const from = process.env.SMTP_FROM
  if (!url || !anonKey || !host || !smtpUser || !smtpPass || !from) return NextResponse.json({ error: 'Konfigurasi email belum lengkap.' }, { status: 503 })

  const authorization = request.headers.get('authorization')
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : undefined
  const requester = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token || ''}` } } })
  const { data: auth, error: authError } = token ? await requester.auth.getUser(token) : { data: { user: null }, error: null }
  if (!auth.user) return NextResponse.json({ error: authError ? 'Sesi tidak valid. Silakan masuk ulang.' : 'Sesi tidak ditemukan. Silakan masuk ulang.' }, { status: 401 })

  const { data: role, error: roleError } = await requester.rpc('current_profile_role')
  if (roleError) return NextResponse.json({ error: 'Fungsi akses owner belum dipasang. Jalankan migrasi owner access.' }, { status: 503 })
  if (role !== 'owner') return NextResponse.json({ error: `Akses ditolak: role akun adalah ${role || 'tanpa role'}.` }, { status: 403 })

  try {
    const { subject, body } = await request.json()
    const { data: broadcastId, error: createError } = await requester.rpc('owner_create_broadcast', { p_subject: subject, p_body: body })
    if (createError || !broadcastId) return NextResponse.json({ error: createError?.message || 'Gagal membuat broadcast.' }, { status: 400 })
    const { data: recipients, error: recipientsError } = await requester.rpc('owner_broadcast_recipients')
    if (recipientsError) throw recipientsError

    const emails: string[] = [...new Set(((recipients || []) as { email: string }[]).map((item) => item.email).filter((email): email is string => typeof email === 'string' && email.length > 0))]
    const transporter = nodemailer.createTransport({ host, port: Number(process.env.SMTP_PORT || 587), secure: Number(process.env.SMTP_PORT) === 465, auth: { user: smtpUser, pass: smtpPass } })
    for (const to of emails) await transporter.sendMail({ from, to, subject, text: body, html: body.replace(/\n/g, '<br>') })
    await requester.rpc('owner_complete_broadcast', { p_broadcast_id: broadcastId, p_status: 'sent' })
    return NextResponse.json({ sent: emails.length })
  } catch (error) {
    console.error('Broadcast email error:', error)
    return NextResponse.json({ error: 'Broadcast gagal dikirim. Periksa konfigurasi SMTP.' }, { status: 500 })
  }
}
