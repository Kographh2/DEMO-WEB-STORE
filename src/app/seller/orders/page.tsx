'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Package } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/auth-provider'
import { formatCurrency } from '@/lib/utils'
import toast from 'react-hot-toast'

export default function SellerOrdersPage() {
  const { user, profile, loading: authLoading } = useAuth()
  const router = useRouter()
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const acceptCod = async (id: string) => {
    const { error } = await (supabase as any).from('orders').update({ status: 'processing' }).eq('id', id).eq('payment_method', 'cod').eq('status', 'pending')
    if (error) return toast.error('Pesanan COD gagal diterima')
    setOrders((current) => current.map((order) => order.id === id ? { ...order, status: 'processing' } : order))
    toast.success('Pesanan COD diterima dan siap diproses')
  }
  useEffect(() => {
    if (authLoading) return
    if (!user || !profile || !['seller', 'admin', 'owner'].includes(profile.role)) { router.replace('/'); return }
    ;(async () => {
      const { data: shop } = await (supabase as any).from('shops').select('id').eq('owner_id', user.id).maybeSingle()
      if (shop) {
        const { data } = await (supabase as any).from('orders').select('*').eq('shop_id', shop.id).order('created_at', { ascending: false })
        setOrders(data || [])
      }
      setLoading(false)
    })()
  }, [authLoading, user, profile, router])
  if (loading || authLoading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>
  return <div className="min-h-screen bg-gray-50"><div className="max-w-4xl mx-auto px-4 py-6"><div className="flex items-center gap-4 mb-6"><button onClick={() => router.back()} className="p-2"><ArrowLeft /></button><h1 className="text-2xl font-bold">Pesanan Toko</h1></div><div className="space-y-3">{orders.length ? orders.map(o => <div key={o.id} className="bg-white rounded-2xl p-4 border border-gray-100 flex items-center justify-between gap-4"><div><p className="font-medium">#{o.id.slice(0, 8)}</p><p className="text-sm text-gray-500">{o.payment_method.toUpperCase()} · {o.status}</p></div><div className="text-right"><p className="font-bold">{formatCurrency(o.total_amount)}</p>{o.payment_method === 'cod' && o.status === 'pending' && <button onClick={() => acceptCod(o.id)} className="mt-2 btn-primary py-2 px-3 text-sm">Terima COD</button>}</div></div>) : <div className="bg-white rounded-2xl p-12 text-center text-gray-500"><Package className="mx-auto mb-3" />Belum ada pesanan.</div>}</div></div></div>
}
