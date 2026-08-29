import { useState, useEffect } from 'react';
import Image from 'next/image';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Link from 'next/link';

type Agent = {
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
  team_id: string;
};

export default function AgentsDirectoryPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    const fetchAgents = async () => {
      try {
        // TODO: Obtener branches del usuario actual si está autenticado
        // Por ahora mostramos todos los agentes
        const res = await fetch('/api/agents');
        if (!res.ok) throw new Error('Failed to fetch agents');
        const data = await res.json();
        setAgents(data);

        // Extraer branches únicos (pendiente: esto se hace mejor en el backend)
        const uniqueBranches = [
          ...new Map(
            data.map((agent: Agent) => [agent.team_id, agent.team_id])
          ).values(),
        ];
        setBranches(
          uniqueBranches.map((id: string) => ({ id, name: `Sucursal ${id}` }))
        );
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchAgents();
  }, []);

  const filteredAgents = agents;
  // .filter(
  //   agent =>
  //     selectedBranch === 'all' || agent.team_id === selectedBranch
  // );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <p className="text-gray-600">Cargando directorio...</p>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Directorio de Agentes - GALAS Inmobiliaria</title>
        <meta
          name="description"
          content="Conocé a nuestros agentes inmobiliarios especialistas"
        />
        <meta property="og:title" content="Directorio de Agentes - GALAS" />
        <meta
          property="og:description"
          content="Equipo de profesionales inmobiliarios"
        />
      </Head>

      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-6xl mx-auto px-4 py-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Nuestros Agentes
            </h1>
            <p className="text-lg text-gray-600">
              Equipo de profesionales inmobiliarios dedicados a tu éxito
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-6xl mx-auto px-4 py-12">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
              Error: {error}
            </div>
          )}

          {/* Filtros */}
          {branches.length > 1 && (
            <div className="mb-8">
              <h2 className="text-sm font-medium text-gray-700 mb-3">
                Filtrar por sucursal:
              </h2>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedBranch('all')}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    selectedBranch === 'all'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Todas las sucursales
                </button>
                {branches.map(branch => (
                  <button
                    key={branch.id}
                    onClick={() => setSelectedBranch(branch.id)}
                    className={`px-4 py-2 rounded-lg font-medium transition ${
                      selectedBranch === branch.id
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {branch.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Agents Grid */}
          {filteredAgents.length === 0 ? (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-12 text-center">
              <p className="text-gray-600 text-lg">
                No hay agentes disponibles en este momento
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredAgents.map(agent => (
                <Link
                  key={agent.id}
                  href={`/agents/${agent.slug}`}
                  className="group"
                >
                  <div className="bg-white rounded-lg shadow-md hover:shadow-xl transition border border-gray-200 overflow-hidden cursor-pointer h-full flex flex-col">
                    {/* Foto */}
                    <div className="relative h-64 bg-gradient-to-br from-blue-100 to-blue-50 overflow-hidden">
                      {agent.photo_url ? (
                        <Image
                          src={agent.photo_url}
                          alt={agent.email}
                          fill
                          className="object-cover group-hover:scale-110 transition duration-300"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full bg-gradient-to-br from-blue-300 to-blue-500 text-white text-6xl font-bold">
                          {agent.email[0].toUpperCase()}
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-6 flex-1 flex flex-col">
                      <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition">
                        {agent.email.split('@')[0]}
                      </h3>

                      {agent.bio && (
                        <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                          {agent.bio}
                        </p>
                      )}

                      {/* Contacto rápido */}
                      <div className="mt-auto pt-4 border-t border-gray-200 flex items-center space-x-3">
                        {agent.phone && (
                          <a
                            href={`tel:${agent.phone}`}
                            onClick={e => e.preventDefault()}
                            className="text-gray-600 hover:text-blue-600 transition text-lg"
                            title="Llamar"
                          >
                            📱
                          </a>
                        )}
                        {agent.email_contact && (
                          <a
                            href={`mailto:${agent.email_contact}`}
                            onClick={e => e.preventDefault()}
                            className="text-gray-600 hover:text-blue-600 transition text-lg"
                            title="Email"
                          >
                            ✉️
                          </a>
                        )}
                        {agent.whatsapp_link && (
                          <a
                            href={`https://wa.me/${agent.whatsapp_link}`}
                            onClick={e => e.preventDefault()}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-600 hover:text-green-600 transition text-lg"
                            title="WhatsApp"
                          >
                            💬
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* CTA */}
        <div className="bg-blue-600 text-white py-12 mt-16">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <h2 className="text-3xl font-bold mb-4">¿Buscás una propiedad?</h2>
            <p className="text-lg mb-6 text-blue-100">
              Contáctate con cualquiera de nuestros agentes para encontrar tu
              próximo hogar
            </p>
            <a
              href="https://propiedades.galas.com.ar"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-white text-blue-600 px-8 py-3 rounded-lg font-bold hover:bg-blue-50 transition"
            >
              Ver todas las propiedades
            </a>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-900 text-white text-center py-8">
          <p className="text-gray-400">
            © 2026 GALAS Inmobiliaria. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </>
  );
}
