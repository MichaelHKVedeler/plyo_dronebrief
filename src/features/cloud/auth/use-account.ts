import { useCallback, useEffect, useRef, useState } from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { z } from 'zod'
import { organizationSchema, type Organization } from '../model/cloud'
import { callCloud, cloudError, firebase } from './firebase'

export function useAccount() {
  const [user, setUser] = useState<User | null>(null)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const generation = useRef(0)
  const refresh = useCallback(async () => {
    const uid = firebase().auth.currentUser?.uid
    if (!uid) return
    const current = ++generation.current
    setLoading(true); setError(null)
    try {
      const orgs = z.array(organizationSchema).parse(await callCloud('account'))
      if (current === generation.current && firebase().auth.currentUser?.uid === uid) setOrganizations(orgs)
    } catch (error) { if (current === generation.current) setError(cloudError(error)) }
    finally { if (current === generation.current) setLoading(false) }
  }, [])
  useEffect(() => onAuthStateChanged(firebase().auth, (next) => {
    generation.current++; setUser(next); setOrganizations([]); setError(null)
    if (next) void refresh(); else setLoading(false)
  }), [refresh])
  return { user, organizations, loading, error, refresh }
}
