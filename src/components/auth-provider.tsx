'use client'

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Profile } from '@/types'

interface AuthContextType {
  user: any | null
  profile: Profile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, fullName: string, username: string) => Promise<void>
  signOut: () => Promise<void>
  updateProfile: (data: Partial<Profile>) => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (userId: string, retries = 3) => {
    for (let i = 0; i < retries; i++) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single()
        
        if (error) {
          console.error(`Error loading profile (attempt ${i + 1}/${retries}):`, error)
          if (i === retries - 1) {
            setProfile(null)
            return
          }
          await new Promise(resolve => setTimeout(resolve, 500))
          continue
        }
        
        if (data) {
          setProfile(data as Profile)
          return
        } else {
          setProfile(null)
          return
        }
      } catch (error) {
        console.error(`Error loading profile (attempt ${i + 1}/${retries}):`, error)
        if (i === retries - 1) {
          setProfile(null)
          return
        }
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }
  }, [])

  const ensureProfile = useCallback(async (userId: string, email: string, userMetadata: any) => {
    try {
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .single()

      if (!existing) {
        const { data, error } = await (supabase as any)
          .from('profiles')
          .insert({
            id: userId,
            email: email,
            full_name: userMetadata?.full_name || email.split('@')[0],
            username: userMetadata?.username || email.split('@')[0],
          })
          .select()
          .single()

        if (data && !error) {
          setProfile(data as Profile)
          return
        }
        
        if (error) {
          console.error('Error creating profile:', error)
        }
      }
      
      await loadProfile(userId)
    } catch (error) {
      console.error('Error ensuring profile:', error)
      await loadProfile(userId)
    }
  }, [loadProfile])

  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      await loadProfile(user.id)
    }
  }, [user, loadProfile])

  useEffect(() => {
    let mounted = true

    const getSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!mounted) return
        
        setUser(session?.user ?? null)
        
        if (session?.user) {
          await ensureProfile(session.user.id, session.user.email || '', session.user.user_metadata)
        } else {
          setProfile(null)
        }
      } catch (error) {
        console.error('Error getting session:', error)
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    getSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return
        
        setUser(session?.user ?? null)
        
        if (session?.user) {
          await ensureProfile(session.user.id, session.user.email || '', session.user.user_metadata)
        } else {
          setProfile(null)
        }
        setLoading(false)
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [ensureProfile])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) throw error
  }

  const signUp = async (email: string, password: string, fullName: string, username: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          username: username,
        },
      },
    })
    if (error) throw error
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  const updateProfile = async (data: Partial<Profile>) => {
    if (!user) throw new Error('Not authenticated')
    
    const { error } = await (supabase as any)
      .from('profiles')
      .update(data)
      .eq('id', user.id)
    
    if (error) throw error
    
    setProfile(prev => prev ? { ...prev, ...data } : null)
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signUp, signOut, updateProfile, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}