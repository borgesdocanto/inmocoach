import { useState } from 'react';
import Image from 'next/image';
import Head from 'next/head';
import Link from 'next/link';
import { GetStaticProps } from 'next';
import * as cheerio from 'cheerio';

type Agent = {
  id: string;
  email: string;
  name: string;
  slug: string;
  photo_url: string | null;
  bio: string;
  phone: string;
  email_contact: string;
  instagram_url: string;
  linkedin_url: string;
  whatsapp_link: string;
  team_id: string;
  branch_id: number | null;
  team_role: 'owner' | 'team_leader' | 'member';
};

type PageProps = {
  agents: Agent[];
  branches: { id: string; name: string }[];
  navigationHtml: string;
  navigationStyles: string;
};

export const getStaticProps: GetStaticProps<PageProps> = async () => {
  try {
    // 1. Fetch de agentes desde la API interna
    const agentsRes = await fetch('https://www.inmocoach.com.ar/api/agents');
    if (!agentsRes.ok) throw new Error('Failed to fetch agents');
    const agents: Agent[] = await agentsRes.json();

    // 2. Extraer branches únicos
    const branchNames: Record<number, string> = {
      60: 'Padua',
      61: 'Castelar',
      62: 'Ituzaingó',
    };

    const uniqueBranchIds = new Set<number>();
    agents.forEach((agent: Agent) => {
      if (agent.branch_id && branchNames[agent.branch_id]) {
        uniqueBranchIds.add(agent.branch_id);
      }
    });

    const branches = Array.from(uniqueBranchIds)
      .sort()
      .map((id: number) => ({ 
        id: String(id),
        name: branchNames[id] 
      }));

    // 3. Fetch del menú de galas.com.ar
    let navigationHtml = '';
    let navigationStyles = '';
    try {
      const galasRes = await fetch('https://www.galas.com.ar/', {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(5000)
      });
      if (!galasRes.ok) throw new Error(`HTTP ${galasRes.status}`);
      const html = await galasRes.text();
      const $ = cheerio.load(html);

      // Extraer el nav (intenta múltiples selectores)
      let navElement = $('nav').first();
      if (!navElement.html()) {
        navElement = $('header nav').first(); // Fallback
      }
      navigationHtml = navElement.html() || '';

      // Extraer estilos del <head> que se apliquen al nav
      const styleElements = $('head style');
      navigationStyles = styleElements.map((_: number, el: any) => $(el).html()).get().join('\n');
      
      console.log(`[agents] menú fetched: ${navigationHtml ? navigationHtml.length : 0} bytes`);
    } catch (err: any) {
      console.error('Error fetching GALAS menu:', err?.message || err);
      // Si falla, devolvemos empty - la página se muestra sin menú pero sin error
    }

    return {
      props: {
        agents,
        branches,
        navigationHtml,
        navigationStyles,
      },
      revalidate: 3600, // Revalidar cada 1 hora (3600 segundos)
    };
  } catch (err) {
    console.error('getStaticProps error:', err);
    return {
      props: {
        agents: [],
        branches: [],
        navigationHtml: '',
        navigationStyles: '',
      },
      revalidate: 300, // Si falla, reintentar en 5 minutos
    };
  }
};

type PageState = {
  selectedBranch: string;
};

export default function AgentsDirectoryPage({ 
  agents, 
  branches, 
  navigationHtml,
  navigationStyles
}: PageProps) {
  const [selectedBranch, setSelectedBranch] = useState<string>('all');

  // Filtrar agentes
  const filteredAgents = agents.filter(agent => {
    if (selectedBranch === 'all') return true;
    const selectedBranchId = parseInt(selectedBranch, 10);
    return agent.branch_id === selectedBranchId;
  });

  return (
    <>
      <Head>
        <title>Directorio del Equipo - GALAS Inmobiliaria</title>
        <meta
          name="description"
          content="Conocé a nuestro equipo de asesores inmobiliarios"
        />
        <meta property="og:title" content="Directorio del Equipo - GALAS" />
        {/* Inyectar estilos del menú de GALAS */}
        {navigationStyles && (
          <style dangerouslySetInnerHTML={{ __html: navigationStyles }} />
        )}
        <meta
          property="og:description"
          content="Equipo de profesionales inmobiliarios"
        />
      </Head>

      <div className="min-h-screen bg-white">
        {/* Menú dinámico de GALAS (sincronizado cada hora) */}
        {navigationHtml && (
          <nav className="border-b border-gray-200">
            <div dangerouslySetInnerHTML={{ __html: navigationHtml }} />
          </nav>
        )}

        {/* Header */}
        <div className="bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-6xl mx-auto px-4 py-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Nuestro Equipo
            </h1>
            <p className="text-lg text-gray-600">
              Equipo de profesionales inmobiliarios dedicados a tu éxito
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-6xl mx-auto px-4 py-12">
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
                      ? 'bg-galas-red text-white'
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
                        ? 'bg-galas-red text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {branch.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Agents Grid - Separar broker/team_leader al inicio */}
          {filteredAgents.length === 0 ? (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-12 text-center">
              <p className="text-gray-600 text-lg">
                No hay agentes disponibles en este momento
              </p>
            </div>
          ) : (
            <>
              {/* Nuestro Equipo - Lista única sin distinciones */}
              <div className="mb-12">
                <div className="mb-8">
                  <h2 className="text-3xl font-bold text-gray-900 mb-2">
                    Nuestro Equipo
                  </h2>
                  <p className="text-gray-600">Profesionales inmobiliarios comprometidos con tu éxito</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {filteredAgents
                    .sort((a, b) => {
                      // Líderes (owners + team_leaders) primero
                      const aIsLeader = a.team_role === 'owner' || a.team_role === 'team_leader';
                      const bIsLeader = b.team_role === 'owner' || b.team_role === 'team_leader';
                      if (aIsLeader !== bIsLeader) {
                        return aIsLeader ? -1 : 1;
                      }
                      // Si ambos son líderes o ambos no, ordenar alfabéticamente
                      return a.name.localeCompare(b.name);
                    })
                    .map(agent => (
                      <Link
                        key={agent.id}
                        href={`/agents/${agent.slug}`}
                        className="group"
                      >
                        <div className="bg-white rounded-lg shadow-md hover:shadow-xl transition border border-gray-200 overflow-hidden cursor-pointer h-full flex flex-col">
                        {/* Foto */}
                        <div className="relative h-48 bg-white overflow-hidden">
                          {agent.photo_url ? (
                            <Image
                              src={agent.photo_url}
                              alt={agent.name}
                              fill
                              className="object-contain object-center group-hover:scale-105 transition duration-300"
                              sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                            />
                          ) : (
                            <div className="flex items-center justify-center h-full bg-white text-galas-red text-6xl font-bold">
                              {agent.name[0].toUpperCase()}
                            </div>
                          )}
                          
                          {/* Badge discreto solo para líderes */}
                          {(agent.team_role === 'owner' || agent.team_role === 'team_leader') && (
                            <div className="absolute top-3 right-3 bg-galas-red text-white px-2 py-1 rounded-full text-sm font-bold">
                              ⭐
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="p-4 flex-1 flex flex-col">
                          <h3 className="text-lg font-bold text-gray-900 group-hover:text-galas-red transition">
                            {agent.name}
                          </h3>

                          {agent.bio && (
                            <p className="text-gray-600 text-xs mt-2 line-clamp-2">
                              {agent.bio}
                            </p>
                          )}

                          {/* Ver más información */}
                          <div className="mt-auto pt-4 border-t border-gray-200">
                            <button className="w-full bg-galas-red hover:bg-galas-dark text-white font-medium py-2 rounded transition">
                              Ver más información
                            </button>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* CTA */}
        <div className="bg-galas-dark text-white py-12 mt-16">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <h2 className="text-3xl font-bold mb-4">¿Buscás una propiedad?</h2>
            <p className="text-lg mb-6 text-red-100">
              Contáctate con cualquiera de nuestro equipo para encontrar tu
              próximo hogar
            </p>
            <a
              href="https://propiedades.galas.com.ar/Propiedades"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-white text-galas-red px-8 py-3 rounded-lg font-bold hover:bg-galas-light transition"
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
