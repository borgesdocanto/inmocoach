import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useSession, signOut } from "next-auth/react";

const RED = "#aa0000";

interface NavItem {
  label: string;
  icon: string;
  href?: string;
  onClick?: () => void;
  active?: boolean;
  children?: { label: string; href: string; active?: boolean }[];
}

interface AppLayoutProps {
  children: React.ReactNode;
  agencyLogo?: string | null;
  topbarExtra?: React.ReactNode;
  greeting?: string;
}

export default function AppLayout({ children, agencyLogo, topbarExtra, greeting }: AppLayoutProps) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [mobileMenu, setMobileMenu] = useState(false);
  const [configOpen, setConfigOpen] = useState(router.pathname.startsWith("/tokko") || router.pathname.startsWith("/config"));
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/subscription")
        .then(r => r.json())
        .then(d => {
          const role = d.subscription?.teamRole;
          setIsOwner(role === "owner" || role === "team_leader");
        })
        .catch(() => {});
    }
  }, [status]);

  const path = router.pathname;

  const navItems: NavItem[] = [
    { label: "Inicio", icon: "⊞", href: "/", active: path === "/" },
    { label: "Actividad (IAC)", icon: "◈", href: "/iac", active: path === "/iac" },
    ...(isOwner ? [{ label: "Mi equipo", icon: "⊙", href: "/equipo", active: path.startsWith("/equipo") }] : []),
    {
      label: "Configuración",
      icon: "⚙",
      active: path.startsWith("/tokko") || path.startsWith("/config"),
      children: [
        { label: "Tokko Broker", href: "/tokko-setup", active: path === "/tokko-setup" },
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
      {/* Logo */}
      <div style={{ padding: "18px 16px", borderBottom: "0.5px solid #f3f4f6", display: "flex", alignItems: "center", gap: 10 }}>
        {agencyLogo
          ? <img src={agencyLogo} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: "contain" }} />
          : <div style={{ width: 36, height: 36, background: RED, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0 }}>G</div>
        }
        <div style={{ fontSize: 15, fontWeight: 500, color: "#111827", letterSpacing: "-0.3px", fontFamily: "Georgia, serif" }}>
          Inmo<span style={{ color: RED }}>Coach</span>
        </div>
        {mobile && (
          <button onClick={() => setMobileMenu(false)} style={{ marginLeft: "auto", background: "none", border: "none", fontSize: 20, color: "#9ca3af", cursor: "pointer" }}>×</button>
        )}
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
          {session?.user?.image
            ? <img src={session.user.image} alt="" style={{ width: 28, height: 28, borderRadius: "50%" }} />
            : <div style={{ width: 28, height: 28, borderRadius: "50%", background: RED, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#fff", fontWeight: 500 }}>
                {session?.user?.name?.slice(0, 2).toUpperCase() ?? "IC"}
              </div>
          }
          <div>
            <div style={{ fontSize: 12, fontWeight: 500, color: "#111827" }}>{session?.user?.name ?? ""}</div>
            <div style={{ fontSize: 11, color: "#9ca3af" }}>{session?.user?.email ?? ""}</div>
          </div>
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
          {session?.user?.image
            ? <img src={session.user.image} alt="" style={{ width: 30, height: 30, borderRadius: "50%", border: `2px solid ${RED}`, cursor: "pointer" }} onClick={() => signOut({ callbackUrl: "/login" })} />
            : <div style={{ width: 30, height: 30, borderRadius: "50%", background: RED, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#fff", fontWeight: 500, cursor: "pointer" }} onClick={() => signOut({ callbackUrl: "/login" })}>
                {session?.user?.name?.slice(0, 2).toUpperCase() ?? "IC"}
              </div>
          }
        </header>

        {/* Content */}
        <main style={{ flex: 1, overflow: "auto" }}>
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
    </div>
  );
}
