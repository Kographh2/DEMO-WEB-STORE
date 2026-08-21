'use client'

import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { 
  ArrowLeft, Save, User, Shield, Store, 
  ShoppingBag, DollarSign, Settings, Camera, Loader2
} from 'lucide-react'
import { useAuth } from '@/components/auth-provider'
import { supabase } from '@/lib/supabase'
import { uploadAvatar } from '@/lib/utils'
import toast from 'react-hot-toast'

export default function SettingsPage() {
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [language, setLanguage] = useState('id')
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [loading, setLoading] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const { user, profile, updateProfile, loading: authLoading } = useAuth()

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name)
      setUsername(profile.username)
    }
  }, [profile])

  useEffect(() => {
    if (!authLoading && !user) router.replace('/')
  }, [authLoading, user, router])

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Ukuran file maksimal 2MB')
      return
    }
    if (!file.type.startsWith('image/')) {
      toast.error('File harus berupa gambar (JPG/PNG)')
      return
    }

    setUploadingAvatar(true)
    try {
      const avatarUrl = await uploadAvatar(file, user.id)
      await updateProfile({ avatar_url: avatarUrl })
      toast.success('Foto profil berhasil diperbarui')
    } catch (error) {
      console.error('Error uploading avatar:', error)
      toast.error('Gagal mengunggah foto profil')
    } finally {
      setUploadingAvatar(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      await updateProfile({ full_name: fullName, username })
      toast.success('Pengaturan berhasil disimpan')
    } catch (error) {
      console.error('Error saving settings:', error)
      toast.error('Gagal menyimpan pengaturan')
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Pengaturan</h1>
        </div>

        <div className="space-y-6">
          {/* Profile Photo */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-900 mb-4">Foto Profil</h3>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 text-2xl font-bold relative">
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt="Profile"
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  fullName?.[0]?.toUpperCase() || 'U'
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="absolute bottom-0 right-0 w-7 h-7 bg-primary-600 rounded-full flex items-center justify-center border-2 border-white"
                  aria-label="Ganti foto profil"
                >
                  {uploadingAvatar ? (
                    <Loader2 size={12} className="text-white animate-spin" />
                  ) : (
                    <Camera size={12} className="text-white" />
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="font-medium text-primary-600 text-sm hover:underline"
                >
                  {uploadingAvatar ? 'Mengunggah...' : 'Ganti Foto'}
                </button>
                <p className="text-sm text-gray-500">JPG, PNG. Maks 2MB</p>
              </div>
            </div>
          </div>

          {/* Personal Info */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-900 mb-4">Informasi Pribadi</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="input-field"
                />
              </div>
            </div>
          </div>

          {/* Language */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-900 mb-4">Bahasa</h3>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                  <Store size={20} className="text-primary-600" />
                </div>
                <span className="font-medium">Bahasa Aplikasi</span>
              </div>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="input-field w-auto"
              >
                <option value="id">Indonesia</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>

          {/* Notifications */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-900 mb-4">Notifikasi</h3>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                  <DollarSign size={20} className="text-primary-600" />
                </div>
                <div>
                  <p className="font-medium">Notifikasi Push</p>
                  <p className="text-sm text-gray-500">Terima notifikasi real-time</p>
                </div>
              </div>
              <button
                onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                className={`w-12 h-6 rounded-full transition-colors ${
                  notificationsEnabled ? 'bg-primary-600' : 'bg-gray-300'
                }`}
              >
                <div className={`w-4 h-4 bg-white rounded-full transition-transform ${
                  notificationsEnabled ? 'translate-x-7' : 'translate-x-1'
                }`} />
              </button>
            </div>
          </div>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={loading}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            <Save size={18} />
            {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </div>
      </div>
    </div>
  )
}
