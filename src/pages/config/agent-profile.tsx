import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import AppLayout from '@/components/AppLayout';
import Image from 'next/image';

type Profile = {
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
  team_id: string;
};

export default function AgentProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
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
    if (status === 'authenticated' && session?.user?.email) {
      fetchProfile();
    }
  }, [status, session]);

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/agent-profile');
      if (!res.ok) throw new Error('Failed to fetch profile');
      const data = await res.json();
      setProfile(data);
      setFormData({
        slug: data.slug,
        bio: data.bio,
        phone: data.phone,
        email_contact: data.email_contact,
        instagram_url: data.instagram_url,
        linkedin_url: data.linkedin_url,
        whatsapp_link: data.whatsapp_link,
        is_visible: data.is_visible,
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target as any;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPhoto(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('photo', file);

      const res = await fetch('/api/agent-profile/upload-photo', {
        method: 'POST',
        body: formDataUpload,
      });

      if (!res.ok) throw new Error('Failed to upload photo');
      const { photo_url } = await res.json();

      setProfile(prev => prev ? { ...prev, photo_url } : null);
      setSuccess('Foto actualizada');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/agent-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) throw new Error('Failed to save profile');
      const updated = await res.json();
      setProfile(updated);
      setSuccess('Perfil actualizado');
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

  const cardUrl = profile?.slug
    ? `${window.location.origin}/agents/${profile.slug}`
    : '';

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto p-6">
        <h1 className="text-3xl font-bold mb-8">Mi Card Digital</h1>

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
          {/* Foto de perfil */}
          <div className="flex items-center space-x-6">
            <div className="relative w-32 h-32 bg-gray-200 rounded-full overflow-hidden">
              {profile?.photo_url ? (
                <Image
                  src={profile.photo_url}
                  alt="Foto de perfil"
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="flex items-center justify-center h-full bg-gray-300 text-gray-600">
                  Sin foto
                </div>
              )}
            </div>
            <div>
              <label className="block">
                <span className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded cursor-pointer inline-block">
                  {uploadingPhoto ? 'Subiendo...' : 'Cambiar foto'}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  disabled={uploadingPhoto}
                  className="hidden"
                />
              </label>
              <p className="text-sm text-gray-500 mt-2">
                JPG, PNG. Máx 5MB
              </p>
            </div>
          </div>

          <hr />

          {/* URL pública */}
          {cardUrl && (
            <div className="bg-blue-50 border border-blue-200 p-4 rounded">
              <p className="text-sm text-gray-600 mb-2">Tu URL pública:</p>
              <code className="block bg-white p-3 rounded border border-blue-300 text-sm font-mono break-all">
                {cardUrl}
              </code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(cardUrl);
                  setSuccess('URL copiada');
                  setTimeout(() => setSuccess(''), 2000);
                }}
                className="mt-2 text-sm text-blue-600 hover:text-blue-700 underline"
              >
                Copiar URL
              </button>
            </div>
          )}

          {/* Slug personalizado */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              URL personalizada (slug)
            </label>
            <input
              type="text"
              name="slug"
              value={formData.slug}
              onChange={handleInputChange}
              placeholder="hernan-dinter"
              className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Solo letras, números y guiones. Se normalizará automáticamente.
            </p>
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
              placeholder="Cuéntanos sobre ti, tu experiencia, especialidades..."
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
                placeholder="+54 911 2345678"
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
                placeholder="hernan@ejemplo.com"
                className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Redes sociales */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Redes sociales</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  Instagram (URL completa)
                </label>
                <input
                  type="url"
                  name="instagram_url"
                  value={formData.instagram_url}
                  onChange={handleInputChange}
                  placeholder="https://instagram.com/tuusuario"
                  className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  LinkedIn (URL completa)
                </label>
                <input
                  type="url"
                  name="linkedin_url"
                  value={formData.linkedin_url}
                  onChange={handleInputChange}
                  placeholder="https://linkedin.com/in/tuusuario"
                  className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  WhatsApp (número internacional)
                </label>
                <input
                  type="tel"
                  name="whatsapp_link"
                  value={formData.whatsapp_link}
                  onChange={handleInputChange}
                  placeholder="549112345678"
                  className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Solo números, sin espacios ni símbolos
                </p>
              </div>
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
              Mostrar mi card en el directorio público
            </label>
          </div>

          {/* Botón guardar */}
          <div className="flex justify-end space-x-3 pt-6 border-t">
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
