import { Metadata } from 'next'
import ProfilePage from '@/components/profile-page'

export const metadata: Metadata = {
  title: 'Profil - Kograph Store',
}

export default function Profile() {
  return <ProfilePage />
}
