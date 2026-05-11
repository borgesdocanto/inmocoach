import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useSession, signOut } from "next-auth/react";
import PushPrompt from "./PushPrompt";
import { isSuperAdmin } from "../lib/adminGuard";

const RED = "#aa0000";

interface NavItem {
  label: string;
  icon: string;
  href?: string;
  onClick?: () => void;
  active?: boolean;
  badge?: number;
  children?: { label: string; href: string; active?: boolean }[];
}

interface AppLayoutProps {
  children: React.ReactNode;
  topbarExtra?: React.ReactNode;
  greeting?: string;
}

export default function AppLayout({ children, topbarExtra, greeting }: AppLayoutProps) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [mobileMenu, setMobileMenu] = useState(false);
  const [configOpen, setConfigOpen] = useState(
    router.pathname.startsWith("/tokko") || router.pathname.startsWith("/config") || router.pathname === "/cuenta"
  );
  const [isOwner, setIsOwner] = useState(false);
  const [agencyLogo, setAgencyLogo] = useState<string | null>(null);
  const [agencyName, setAgencyName] = useState<string | null>(null);
  const [unseenCoach, setUnseenCoach] = useState(0);
  const [firmaAlerta, setFirmaAlerta] = useState(0);
  const [impersonating, setImpersonating] = useState<string | null>(null);
  const [impersonatedUser, setImpersonatedUser] = useState<{ name: string; email: string; avatar: string | null } | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;

    const loadAll = async () => {
      // Superadmin: primero chequear impersonación activa para que el sidebar
      // muestre los datos correctos. Los endpoints del servidor ya leen la cookie
      // ic_impersonate automáticamente — no necesitamos await antes de los otros fetches.
      if (isSuperAdmin(session?.user?.email)) {
        try {
          const imp = await fetch("/api/impersonate").then(r => r.ok ? r.json() : null);
          if (imp?.impersonating) {
            setImpersonating(imp.impersonating);
            setImpersonatedUser({
              name: imp.displayName ?? imp.impersonating,
              email: imp.displayEmail ?? imp.impersonating,
              avatar: imp.displayAvatar ?? null,
            });
          }
        } catch { /* silencioso */ }
      }

      // El servidor ya usa la cookie de impersonación en estos endpoints
      fetch("/api/subscription")
        .then(r => r.json())
        .then(d => {
          const role = d.subscription?.teamRole;
          setIsOwner(role === "owner" || role === "team_leader");
          const isAdminImpersonating = isSuperAdmin(session?.user?.email);
          if (d.subscription?.isExpired && !isAdminImpersonating) {
            router.replace("/expired");
          }
        })
        .catch(() => {});

      fetch("/api/agency-info")
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (d?.logo) setAgencyLogo(d.logo);
          if (d?.agencyName) setAgencyName(d.agencyName);
        })
        .catch(() => {});

      fetch("/api/coach-seen")
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d?.unseen) setUnseenCoach(d.unseen); })
        .catch(() => {});

      // Badge firma digital: documentos pendientes > 48hs
      fetch("/api/firma/documentos")
        .then(r => r.ok ? r.json() : [])
        .then((docs: Array<{ estado: string; created_at: string }>) => {
          const alerta = docs.filter(d => {
            if (d.estado !== "pendiente") return false;
            return Date.now() - new Date(d.created_at).getTime() > 48 * 60 * 60 * 1000;
          }).length;
          setFirmaAlerta(alerta);
        })
        .catch(() => {});
    };

    loadAll();
  }, [status]);

  const path = router.pathname;

  const navItems: NavItem[] = [
    { label: "Inicio", icon: "⊞", href: "/", active: path === "/" },
    { label: "Coach IA", icon: "✧", href: "/coach", active: path === "/coach", badge: unseenCoach > 0 ? unseenCoach : undefined },
    { label: "Actividad (IAC)", icon: "◈", href: "/iac", active: path === "/iac" },
    { label: "Racha y rango", icon: "✦", href: "/racha-rango", active: path === "/racha-rango" },
    { label: "Cartera Tokko", icon: "🏠", href: "/cartera", active: path === "/cartera" },
    { label: "Posición equipo", icon: "◎", href: "/posicion", active: path === "/posicion" },
    { label: "Firma Electrónica", icon: "✍", href: "/firma-digital", active: path === "/firma-digital", badge: firmaAlerta > 0 ? firmaAlerta : undefined },
    ...(isOwner ? [{ label: "Plantillas de Firma", icon: "📋", href: "/firma-plantillas", active: path === "/firma-plantillas" } as NavItem] : []),
    ...(isOwner ? [
      {
        label: "Mi equipo",
        icon: "⊙",
        href: "/equipo",
        active: path.startsWith("/equipo"),
      } as NavItem,
    ] : []),
    {
      label: "Configuración",
      icon: "⚙",
      active: path.startsWith("/tokko") || path.startsWith("/config") || path === "/cuenta",
      children: [
        { label: "Mi cuenta", href: "/cuenta", active: path === "/cuenta" },
        { label: "Tokko Broker", href: "/tokko-setup", active: path === "/tokko-setup" },
        { label: "Ranking", href: "/config/ranking", active: path === "/config/ranking" },
        ...(isOwner ? [{ label: "Mails", href: "/config/mails", active: path === "/config/mails" }] : []),
      ],
    },
  ];

  const NavItemRow = ({ item, mobile = false }: { item: NavItem; mobile?: boolean }) => {
    const isParent = !!item.children;
    const isActive = item.active;
    const [open, setOpen] = useState(isActive || false);

    const baseStyle: React.CSSProperties = {
      display: "flex", alignItems: "center", gap: 9,
      padding: "8px 10px", borderRadius: 8, fontSize: 13,
      cursor: "pointer", marginBottom: 1,
      background: isActive && !isParent ? "#fef2f2" : "transparent",
      color: isActive ? RED : "#6b7280",
      fontWeight: isActive && !isParent ? 500 : 400,
      userSelect: "none",
    };

    return (
      <div>
        <div
          style={baseStyle}
          onClick={() => {
            if (isParent) { setOpen(o => !o); setConfigOpen(o => !o); }
            else if (item.href) { router.push(item.href); if (mobile) setMobileMenu(false); }
            else if (item.onClick) { item.onClick(); }
          }}>
          <span style={{ fontSize: 14, width: 16, textAlign: "center" }}>{item.icon}</span>
          <span style={{ flex: 1 }}>{item.label}</span>
          {item.badge && (
            <span style={{ background: RED, color: "#fff", fontSize: 10, fontWeight: 700, borderRadius: 10, padding: "1px 6px", minWidth: 16, textAlign: "center" }}>
              {item.badge}
            </span>
          )}
          {isParent && <span style={{ fontSize: 10, color: "#9ca3af" }}>{(open || configOpen) ? "▲" : "▼"}</span>}
        </div>
        {isParent && (open || configOpen) && item.children && (
          <div style={{ paddingLeft: 26, marginBottom: 4 }}>
            {item.children.map(child => (
              <div
                key={child.label}
                onClick={() => { router.push(child.href); if (mobile) setMobileMenu(false); }}
                style={{
                  padding: "7px 10px", borderRadius: 7, fontSize: 12,
                  color: child.active ? RED : "#6b7280",
                  background: child.active ? "#fef2f2" : "transparent",
                  fontWeight: child.active ? 500 : 400,
                  cursor: "pointer", marginBottom: 1,
                  borderLeft: `2px solid ${child.active ? RED : "#e5e7eb"}`,
                  paddingLeft: 12,
                }}>
                {child.label}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const SidebarContent = ({ mobile = false }: { mobile?: boolean }) => (
    <>
      {/* InmoCoach — centrado, más grande */}
      <div style={{ padding: "18px 16px 12px", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
        <div style={{ fontSize: 20, fontWeight: 500, color: "#111827", letterSpacing: "-0.5px", fontFamily: "Georgia, serif", textAlign: "center" }}>
          Inmo<span style={{ color: RED }}>Coach</span>
        </div>
        {mobile && (
          <button onClick={() => setMobileMenu(false)} style={{ position: "absolute", right: 12, background: "none", border: "none", fontSize: 22, color: "#9ca3af", cursor: "pointer" }}>×</button>
        )}
      </div>

      {/* Logo inmobiliaria — centrado, más grande */}
      <div style={{ padding: "6px 16px 16px", borderBottom: "0.5px solid #f3f4f6", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {agencyLogo
          ? <img src={agencyLogo} alt="" style={{ maxHeight: 56, maxWidth: 170, objectFit: "contain" }} />
          : <div style={{ width: 52, height: 52, background: RED, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700, color: "#fff" }}>
              G
            </div>
        }
      </div>

      {/* Nav */}
      <nav style={{ padding: "10px 8px", flex: 1, overflowY: "auto" }}>
        {navItems.map(item => (
          <NavItemRow key={item.label} item={item} mobile={mobile} />
        ))}
      </nav>

      {/* Footer */}
      <div style={{ padding: "12px 16px", borderTop: "0.5px solid #f3f4f6" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          {(() => {
            const displayImg = impersonatedUser?.avatar ?? session?.user?.image ?? null;
            const displayName = impersonatedUser?.name ?? session?.user?.name ?? "";
            const displayEmail = impersonatedUser?.email ?? session?.user?.email ?? "";
            return (
              <>
                {displayImg
                  ? <img src={displayImg} alt="" style={{ width: 28, height: 28, borderRadius: "50%", ...(impersonatedUser ? { outline: "2px solid #7c3aed", outlineOffset: 1 } : {}) }} />
                  : <div style={{ width: 28, height: 28, borderRadius: "50%", background: impersonatedUser ? "#7c3aed" : RED, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#fff", fontWeight: 500 }}>
                      {displayName?.slice(0, 2).toUpperCase() ?? "IC"}
                    </div>
                }
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: "#111827" }}>{displayName}</div>
                  <div style={{ fontSize: 11, color: "#9ca3af" }}>{displayEmail}</div>
                </div>
              </>
            );
          })()}
        </div>
        <div onClick={() => signOut({ callbackUrl: "/login" })} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 8px", borderRadius: 8, fontSize: 12, cursor: "pointer", color: "#9ca3af" }}>
          <span>↩</span> Cerrar sesión
        </div>
      </div>
    </>
  );

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f4f5f7", fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>

      {/* Sidebar desktop */}
      <aside style={{
        width: 210, background: "#fff", borderRight: "0.5px solid #e5e7eb",
        flexShrink: 0, display: "flex", flexDirection: "column",
        position: "sticky", top: 0, height: "100vh",
      }} className="ic-sidebar-desktop">
        <SidebarContent />
      </aside>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>

        {/* Topbar */}
        <header style={{ background: "#fff", borderBottom: "0.5px solid #e5e7eb", padding: "11px 20px", display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0, zIndex: 40 }}>
          {/* Hamburger mobile */}
          <button onClick={() => setMobileMenu(true)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", flexDirection: "column", gap: 4 }} className="ic-hamburger">
            <span style={{ width: 18, height: 1.5, background: "#374151", display: "block", borderRadius: 1 }} />
            <span style={{ width: 18, height: 1.5, background: "#374151", display: "block", borderRadius: 1 }} />
            <span style={{ width: 18, height: 1.5, background: "#374151", display: "block", borderRadius: 1 }} />
          </button>
          <div style={{ fontSize: 15, fontWeight: 500, color: "#111827", fontFamily: "Georgia, serif" }} className="ic-logo-mobile">
            Inmo<span style={{ color: RED }}>Coach</span>
          </div>
          <div style={{ flex: 1 }}>
            {greeting && <div style={{ fontSize: 13, color: "#374151", fontWeight: 500 }} className="ic-greeting">{greeting}</div>}
          </div>
          {topbarExtra && <div style={{ display: "flex", alignItems: "center", gap: 8 }}>{topbarExtra}</div>}
          {(() => {
            const displayImg = impersonatedUser?.avatar ?? session?.user?.image ?? null;
            const displayName = impersonatedUser?.name ?? session?.user?.name ?? "";
            const borderColor = impersonatedUser ? "#7c3aed" : RED;
            return displayImg
              ? <img src={displayImg} alt="" style={{ width: 30, height: 30, borderRadius: "50%", border: `2px solid ${borderColor}`, cursor: "pointer" }} onClick={() => signOut({ callbackUrl: "/login" })} />
              : <div style={{ width: 30, height: 30, borderRadius: "50%", background: borderColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#fff", fontWeight: 500, cursor: "pointer" }} onClick={() => signOut({ callbackUrl: "/login" })}>
                  {displayName?.slice(0, 2).toUpperCase() ?? "IC"}
                </div>;
          })()}
        </header>

        {/* Content */}
        <main style={{ flex: 1, overflow: "auto" }}>
          {impersonating && (
            <div style={{ background: "#7c3aed", padding: "10px 20px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, color: "#fff", flex: 1 }}>
                👁 Estás viendo el dashboard de <strong>{impersonating}</strong>
              </span>
              <button
                onClick={async () => {
                  await fetch("/api/impersonate", { method: "DELETE" });
                  setImpersonating(null);
                  window.location.href = "/admin";
                }}
                style={{ background: "rgba(255,255,255,0.2)", border: "0.5px solid rgba(255,255,255,0.4)", borderRadius: 7, padding: "5px 14px", fontSize: 12, fontWeight: 500, color: "#fff", cursor: "pointer", whiteSpace: "nowrap" }}>
                ✕ Salir de impersonación
              </button>
            </div>
          )}
          {children}
        </main>
      </div>

      {/* Mobile drawer */}
      {mobileMenu && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex" }} onClick={() => setMobileMenu(false)}>
          <div style={{ width: 240, background: "#fff", height: "100%", borderRight: "0.5px solid #e5e7eb", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>
            <SidebarContent mobile />
          </div>
          <div style={{ flex: 1, background: "rgba(0,0,0,0.3)" }} />
        </div>
      )}

      <style>{`
        .ic-sidebar-desktop { display: flex !important; }
        .ic-hamburger { display: none !important; }
        .ic-logo-mobile { display: none !important; }
        @media (max-width: 768px) {
          .ic-sidebar-desktop { display: none !important; }
          .ic-hamburger { display: flex !important; }
          .ic-logo-mobile { display: block !important; }
        }
      `}</style>
      <PushPrompt />
    </div>
  );
}
