import { 
  Home, 
  Settings, 
  CalendarDays,
  CalendarRange,
  Building2,
  Users2,
  Boxes,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupContent,
} from "@/components/ui/sidebar";

export function AppSidebar() {
  const location = useLocation();
  const listContainerRef = useRef<HTMLDivElement | null>(null);
  const [indicatorTop, setIndicatorTop] = useState(0);
  const [indicatorHeight, setIndicatorHeight] = useState(0);
  const [hasActive, setHasActive] = useState(false);

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const measureActive = (doNotHide?: boolean) => {
    const container = listContainerRef.current;
    if (!container) return;
    const activeEl = container.querySelector('.navLink--active, [data-active="true"]') as HTMLElement | null;
    if (!activeEl) { if (!doNotHide) setHasActive(false); return; }
    const containerRect = container.getBoundingClientRect();
    const rect = activeEl.getBoundingClientRect();
    setIndicatorTop(rect.top - containerRect.top + container.scrollTop);
    setIndicatorHeight(rect.height);
    setHasActive(true);
  };

  useLayoutEffect(() => {
    // Measure on route change, ensure layout has settled
    measureActive();
    const raf = requestAnimationFrame(() => measureActive());
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);
  useEffect(() => {
    let rafId: number | null = null;
    const onResize = () => {
      if (rafId != null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => measureActive(true));
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      if (rafId != null) cancelAnimationFrame(rafId);
    };
  }, []);

  useEffect(() => {
    const el = listContainerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      measureActive(true);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // connection status moved to global bottom-right component

  return (
    <Sidebar collapsible="none" className="sticky top-12 h-[calc(100vh-3rem)] z-40 leftnav">
      <SidebarContent className="overflow-y-auto p-0">
        <SidebarGroup className="px-2 py-1">
          <SidebarGroupContent className="p-0">
            <div ref={listContainerRef} style={{ position: 'relative' }}>
              <SidebarMenu className="space-y-0.5">
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive('/')}
                    className="px-3 py-2 rounded text-[14px] font-medium text-foreground hover:bg-sidebar-accent/10 data-[active=true]:text-sidebar-primary">
                    <NavLink to="/" className={({isActive}) => `navLink flex items-center gap-1.5${isActive ? ' navLink--active' : ''}` }>
                      <Home className="w-4 h-4" />
                      <span className="truncate">Home</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive('/inventory')}
                    className="px-3 py-2 rounded text-[14px] font-medium text-foreground hover:bg-sidebar-accent/10 data-[active=true]:text-sidebar-primary">
                    <NavLink to="/inventory" className={({isActive}) => `navLink flex items-center gap-1.5${isActive ? ' navLink--active' : ''}` }>
                      <Boxes className="w-4 h-4" />
                      <span className="truncate">Inventory</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive('/events')}
                    className="px-3 py-2 rounded text-[14px] font-medium text-foreground hover:bg-sidebar-accent/10 data-[active=true]:text-sidebar-primary">
                    <NavLink to="/events" className={({isActive}) => `navLink flex items-center gap-1.5${isActive ? ' navLink--active' : ''}` }>
                      <CalendarDays className="w-4 h-4" />
                      <span className="truncate">Events</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive('/scheduling')}
                    className="px-3 py-2 rounded text-[14px] font-medium text-foreground hover:bg-sidebar-accent/10 data-[active=true]:text-sidebar-primary">
                    <NavLink to="/scheduling" className={({isActive}) => `navLink flex items-center gap-1.5${isActive ? ' navLink--active' : ''}` }>
                      <CalendarRange className="w-4 h-4" />
                      <span className="truncate">Scheduling</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive('/departments')}
                    className="px-3 py-2 rounded text-[14px] font-medium text-foreground hover:bg-sidebar-accent/10 data-[active=true]:text-sidebar-primary">
                    <NavLink to="/departments" className={({isActive}) => `navLink flex items-center gap-1.5${isActive ? ' navLink--active' : ''}` }>
                      <Building2 className="w-4 h-4" />
                      <span className="truncate">Departments</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive('/employees')}
                    className="px-3 py-2 rounded text-[14px] font-medium text-foreground hover:bg-sidebar-accent/10 data-[active=true]:text-sidebar-primary">
                    <NavLink to="/employees" className={({isActive}) => `navLink flex items-center gap-1.5${isActive ? ' navLink--active' : ''}` }>
                      <Users2 className="w-4 h-4" />
                      <span className="truncate">Employees</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
              <div className="navActiveIndicator" style={{ transform: `translateY(${indicatorTop}px)`, height: indicatorHeight, opacity: hasActive ? 1 : 0 }} />
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="relative">
        <SidebarMenu className="space-y-0.5">
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={isActive('/settings')} className="px-3 py-2 rounded text-[14px] font-medium text-foreground hover:bg-sidebar-accent/10 data-[active=true]:text-sidebar-primary">
              <NavLink to="/settings" className={({isActive}) => `navLink flex items-center gap-1.5${isActive ? ' navLink--active' : ''}`}>
                <Settings className="w-4 h-4" />
                <span className="truncate">Settings</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}