import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import AppLayout from '@/components/AppLayout';
import Link from 'next/link';

type AgentProfile = {
  id: string;
  email: string;
  slug: string;
  photo_url: string | null;
  bio: string;
  phone: string;
  email_contact: string;
  instagram_url: string;
  linkedin_url: string;
  whatsapp_link: string;
  is_visible: boolean;
};

export default function EditAgentCardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { email: agentEmail } = router.query;

  const [profile, setProfile] = useState<AgentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState({
    slug: '',
    bio: '',
    phone: '',
    email_contact: '',
    instagram_url: '',
    linkedin_url: '',
    whatsapp_link: '',
    is_visible: true,
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (!agentEmail || typeof agentEmail !== 'string') return;

    const fetchProfile = async () => {
      try {
        const res = await fetch(`/api/agents`);
        if (!res.ok) throw new Error('Failed to fetch agents');
        const agents: AgentProfile[] = await res.json();
        const agent = agents.find(a => a.email === agentEmail);

        if (!agent) throw new Error('Agent not found');

        setProfile(agent);
        setFormData({
          slug: agent.slug,
          bio: agent.bio,
          phone: agent.phone,
          email_contact: agent.email_contact,
          instagram_url: agent.instagram_url,
          linkedin_url: agent.linkedin_url,
          whatsapp_link: agent.whatsapp_link,
          is_visible: agent.is_visible,
        });
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [agentEmail]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target as any;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSave = async () => {
    if (!agentEmail || typeof agentEmail !== 'string') return;

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch(`/api/admin/agent-profile?agentEmail=${agentEmail}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save profile');
      }

      const { profile: updated } = await res.json();
      setProfile(updated);
      setSuccess('Perfil actualizado correctamente');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-screen">
          <p>Cargando...</p>
        </div>
      </AppLayout>
    );
  }

  if (!profile) {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto p-6">
          <p className="text-red-600">Agente no encontrado</p>
          <Link href="/equipo" className="text-blue-600 hover:underline">
            Volver al equipo
          </Link>
        </div>
      </AppLayout>
    );
  }

  const cardUrl = profile?.slug ? `${window.location.origin}/agents/${profile.slug}` : '';

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto p-6">
        <div className="mb-6">
          <Link href={`/equipo/agente/${agentEmail}`} className="text-blue-600 hover:underline">
            ← Volver al perfil
          </Link>
        </div>

        <h1 className="text-3xl font-bold mb-2">Editar Card Digital</h1>
        <p className="text-gray-600 mb-8">{profile.email}</p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-6">
            {success}
          </div>
        )}

        <div className="bg-white rounded-lg shadow-lg p-8 space-y-6">
          {/* URL pública */}
          {cardUrl && (
            <div className="bg-blue-50 border border-blue-200 p-4 rounded">
              <p className="text-sm text-gray-600 mb-2">URL pública de este agente:</p>
              <code className="block bg-white p-3 rounded border border-blue-300 text-sm font-mono break-all">
                {cardUrl}
              </code>
            </div>
          )}

          {/* Slug */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Slug (URL personalizada)
            </label>
            <input
              type="text"
              name="slug"
              value={formData.slug}
              onChange={handleInputChange}
              placeholder="hernan-dinter"
              className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Bio */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Presentación (Bio)
            </label>
            <textarea
              name="bio"
              value={formData.bio}
              onChange={handleInputChange}
              rows={4}
              placeholder="Cuéntanos sobre este agente..."
              className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Contacto */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Teléfono
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email de contacto
              </label>
              <input
                type="email"
                name="email_contact"
                value={formData.email_contact}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Redes sociales */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Redes sociales</h3>
            <div className="space-y-3">
              <input
                type="url"
                name="instagram_url"
                value={formData.instagram_url}
                onChange={handleInputChange}
                placeholder="Instagram URL"
                className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <input
                type="url"
                name="linkedin_url"
                value={formData.linkedin_url}
                onChange={handleInputChange}
                placeholder="LinkedIn URL"
                className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <input
                type="tel"
                name="whatsapp_link"
                value={formData.whatsapp_link}
                onChange={handleInputChange}
                placeholder="WhatsApp (número internacional)"
                className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          </div>

          {/* Visibilidad */}
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              name="is_visible"
              id="is_visible"
              checked={formData.is_visible}
              onChange={handleInputChange}
              className="w-4 h-4 border-gray-300 rounded"
            />
            <label htmlFor="is_visible" className="text-sm font-medium text-gray-700">
              Mostrar en directorio público
            </label>
          </div>

          {/* Botones */}
          <div className="flex justify-between pt-6 border-t">
            <Link
              href={cardUrl}
              target="_blank"
              className="text-blue-600 hover:text-blue-700 underline"
            >
              Ver landing
            </Link>
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white px-6 py-2 rounded font-medium transition"
            >
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
