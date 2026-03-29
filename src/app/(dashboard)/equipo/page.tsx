'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { PageSkeleton } from '@/components/ui'
import { useTenant } from '@/contexts/TenantContext'
import { UpgradeGate } from '@/components/UpgradeGate'
import { C } from '@/lib/colors'
import { useToast } from '@/components/NotificationToast'
import NotifBell from '@/components/NotifBell'

interface TeamMember {
  id: string
  name: string
  email: string
  role: 'admin' | 'manager' | 'staff'
  last_sign_in: string | null
  created_at: string
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  manager: 'Manager',
  staff: 'Staff',
}

const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  admin:   { bg: `rgba(240,168,78,0.12)`,  color: 'var(--rz-amber)' },
  manager: { bg: `rgba(96,165,250,0.12)`,  color: 'var(--rz-blue)' },
  staff:   { bg: `rgba(45,212,191,0.12)`,  color: 'var(--rz-teal)' },
}

function formatDate(iso: string | null): string {
  if (!iso) return 'Nunca'
  const d = new Date(iso)
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function EquipoPage() {
  return (
    <UpgradeGate feature="multi_user">
      <EquipoContent />
    </UpgradeGate>
  )
}

function EquipoContent() {
  const { tenant, tx } = useTenant()
  const toast = useToast()

  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteName, setInviteName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'manager' | 'staff'>('staff')
  const [submitting, setSubmitting] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const loadMembers = useCallback(async () => {
    const sess = await supabase.auth.getSession()
    if (!sess.data.session) return
    setCurrentUserId(sess.data.session.user.id)

    try {
      const res = await fetch('/api/team/list', {
        headers: { Authorization: `Bearer ${sess.data.session.access_token}` },
      })
      const data = await res.json()
      if (res.ok && data.members) {
        setMembers(data.members)
      }
    } catch {
      toast.push({ title: 'Error al cargar el equipo', type: 'error', priority: 'warning', icon: '!' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { loadMembers() }, [loadMembers])

  async function handleInvite() {
    if (!inviteEmail || !inviteName) return
    setSubmitting(true)
    try {
      const sess = await supabase.auth.getSession()
      if (!sess.data.session) return

      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sess.data.session.access_token}`,
        },
        body: JSON.stringify({ email: inviteEmail, name: inviteName, role: inviteRole }),
      })
      const data = await res.json()

      if (res.ok && data.success) {
        toast.push({ title: 'Invitacion enviada', type: 'success', priority: 'info', icon: '>' })
        setShowInvite(false)
        setInviteName('')
        setInviteEmail('')
        setInviteRole('staff')
        await loadMembers()
      } else {
        toast.push({ title: data.error || 'Error al invitar', type: 'error', priority: 'warning', icon: '!' })
      }
    } catch {
      toast.push({ title: 'Error de conexion', type: 'error', priority: 'warning', icon: '!' })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRemove(userId: string, name: string) {
    if (!confirm(`Eliminar a ${name} del equipo? El usuario conservara su cuenta pero perdera acceso a este negocio.`)) return
    setRemovingId(userId)
    try {
      const sess = await supabase.auth.getSession()
      if (!sess.data.session) return

      const res = await fetch('/api/team/remove', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sess.data.session.access_token}`,
        },
        body: JSON.stringify({ user_id: userId }),
      })
      const data = await res.json()

      if (res.ok && data.success) {
        toast.push({ title: 'Miembro eliminado', type: 'success', priority: 'info', icon: '>' })
        await loadMembers()
      } else {
        toast.push({ title: data.error || 'Error al eliminar', type: 'error', priority: 'warning', icon: '!' })
      }
    } catch {
      toast.push({ title: 'Error de conexion', type: 'error', priority: 'warning', icon: '!' })
    } finally {
      setRemovingId(null)
    }
  }

  if (loading) return <PageSkeleton />

  return (
    <div style={{ padding: '24px 28px', maxWidth: 960 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: C.text, margin: 0 }}>
            Equipo
          </h1>
          <p style={{ fontSize: 13, color: C.text2, margin: '4px 0 0' }}>
            {members.length} miembro{members.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            onClick={() => setShowInvite(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '10px 20px', borderRadius: 10,
              background: `linear-gradient(135deg, ${C.amber}, #E8923A)`,
              color: '#0C1018', fontSize: 13, fontWeight: 700,
              border: 'none', cursor: 'pointer',
              boxShadow: '0 2px 12px rgba(240,168,78,0.25)',
            }}
          >
            + Invitar miembro
          </button>
          <NotifBell />
        </div>
      </div>

      {/* Invite modal */}
      {showInvite && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        }}
        onClick={(e) => { if (e.target === e.currentTarget) setShowInvite(false) }}
        >
          <div style={{
            background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16,
            padding: 28, width: 400, maxWidth: '90vw',
          }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: C.text, margin: '0 0 20px' }}>
              Invitar miembro
            </h2>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.text2, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Nombre
              </label>
              <input
                value={inviteName}
                onChange={e => setInviteName(e.target.value)}
                placeholder="Nombre completo"
                style={{
                  width: '100%', fontSize: 14, color: C.text,
                  background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`,
                  borderRadius: 9, padding: '10px 14px', outline: 'none',
                  fontFamily: 'inherit', boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.text2, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Email
              </label>
              <input
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="email@ejemplo.com"
                style={{
                  width: '100%', fontSize: 14, color: C.text,
                  background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`,
                  borderRadius: 9, padding: '10px 14px', outline: 'none',
                  fontFamily: 'inherit', boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: 22 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.text2, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Rol
              </label>
              <select
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value as 'admin' | 'manager' | 'staff')}
                style={{
                  width: '100%', fontSize: 14, color: C.text,
                  background: C.surface2, border: `1px solid ${C.border}`,
                  borderRadius: 9, padding: '10px 14px', outline: 'none',
                  fontFamily: 'inherit', boxSizing: 'border-box',
                }}
              >
                <option value="staff">Staff</option>
                <option value="manager">Manager</option>
                <option value="admin">Administrador</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowInvite(false)}
                style={{
                  padding: '9px 18px', borderRadius: 9, fontSize: 13, fontWeight: 600,
                  background: C.surface2, color: C.text2, border: `1px solid ${C.border}`,
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleInvite}
                disabled={submitting || !inviteEmail || !inviteName}
                style={{
                  padding: '9px 18px', borderRadius: 9, fontSize: 13, fontWeight: 700,
                  background: `linear-gradient(135deg, ${C.amber}, #E8923A)`,
                  color: '#0C1018', border: 'none', cursor: submitting ? 'not-allowed' : 'pointer',
                  opacity: (submitting || !inviteEmail || !inviteName) ? 0.55 : 1,
                }}
              >
                {submitting ? 'Enviando...' : 'Enviar invitacion'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Members list */}
      {members.length === 0 ? (
        <div style={{
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14,
          padding: '40px 24px', textAlign: 'center',
        }}>
          <p style={{ fontSize: 14, color: C.text2 }}>No hay miembros en el equipo</p>
        </div>
      ) : (
        <div style={{
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14,
          overflow: 'hidden',
        }}>
          {/* Table header */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 120px 160px 80px',
            gap: 12, padding: '12px 20px',
            borderBottom: `1px solid ${C.border}`,
            background: C.surface2,
          }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Nombre
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Email
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Rol
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Ultimo acceso
            </span>
            <span />
          </div>

          {/* Member rows */}
          {members.map((m) => {
            const rc = ROLE_COLORS[m.role] || ROLE_COLORS.staff
            const isCurrentUser = m.id === currentUserId
            return (
              <div
                key={m.id}
                style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr 120px 160px 80px',
                  gap: 12, padding: '14px 20px', alignItems: 'center',
                  borderBottom: `1px solid ${C.border}`,
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                {/* Name */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: rc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 700, color: rc.color, flexShrink: 0,
                  }}>
                    {(m.name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
                      {m.name || 'Sin nombre'}
                      {isCurrentUser && (
                        <span style={{ fontSize: 11, color: C.text3, fontWeight: 400, marginLeft: 6 }}>(tu)</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Email */}
                <span style={{ fontSize: 13, color: C.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {m.email}
                </span>

                {/* Role badge */}
                <span style={{
                  display: 'inline-block', padding: '3px 10px', borderRadius: 6,
                  fontSize: 12, fontWeight: 600, background: rc.bg, color: rc.color,
                  textAlign: 'center', width: 'fit-content',
                }}>
                  {ROLE_LABELS[m.role] || m.role}
                </span>

                {/* Last sign in */}
                <span style={{ fontSize: 12, color: C.text3 }}>
                  {formatDate(m.last_sign_in)}
                </span>

                {/* Actions */}
                <div style={{ textAlign: 'right' }}>
                  {!isCurrentUser && (
                    <button
                      onClick={() => handleRemove(m.id, m.name)}
                      disabled={removingId === m.id}
                      style={{
                        padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                        background: 'rgba(248,113,113,0.08)', color: C.red,
                        border: `1px solid rgba(248,113,113,0.2)`,
                        cursor: removingId === m.id ? 'not-allowed' : 'pointer',
                        opacity: removingId === m.id ? 0.5 : 1,
                      }}
                    >
                      {removingId === m.id ? '...' : 'Eliminar'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Role description */}
      <div style={{
        marginTop: 24, padding: '16px 20px',
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12,
      }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: C.text2, margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Roles
        </h3>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.amber }}>Administrador</span>
            <span style={{ fontSize: 12, color: C.text3, marginLeft: 8 }}>Acceso completo, puede invitar y eliminar miembros</span>
          </div>
          <div>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.blue }}>Manager</span>
            <span style={{ fontSize: 12, color: C.text3, marginLeft: 8 }}>Gestiona reservas, clientes y configuracion</span>
          </div>
          <div>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.teal }}>Staff</span>
            <span style={{ fontSize: 12, color: C.text3, marginLeft: 8 }}>Acceso de solo lectura al panel y reservas</span>
          </div>
        </div>
      </div>
    </div>
  )
}
