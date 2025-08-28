import {
  Home, 
  Settings, 
  CalendarDays,
  Building2,
  MapPinned,
  Users2,
  Boxes,
  ChevronRight,
  Contact2,
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
  const [hoverInventory, setHoverInventory] = useState(false);
  const [hoverEvents, setHoverEvents] = useState(false);
  const [hoverStaff, setHoverStaff] = useState(false);
  const [hoverAdmin, setHoverAdmin] = useState(false);
  const [expandInventory, setExpandInventory] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem('sc_sidebar_expand_inventory');
      return v === 'true';
    } catch { return false; }
  });
  const [expandEvents, setExpandEvents] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem('sc_sidebar_expand_events');
      return v === 'true';
    } catch { return false; }
  });
  const [expandStaff, setExpandStaff] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem('sc_sidebar_expand_staff');
      return v === 'true';
    } catch { return false; }
  });
  const [expandAdmin, setExpandAdmin] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem('sc_sidebar_expand_admin');
      return v === 'true';
    } catch { return false; }
  });

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  // Consider Scheduling active when routed via departments nested path
  const isSchedulingRoute = (
    location.pathname === '/scheduling' ||
    location.pathname.startsWith('/scheduling/') ||
    /^\/departments\/[^/]+\/scheduling(\/|$)/.test(location.pathname)
  );
  const isDepartmentsRouteActive = isActive('/departments') && !isSchedulingRoute;

  const inventoryOpen = isActive('/inventory');
  const eventsOpen = isActive('/events') || isActive('/templates');
  const staffOpen = isSchedulingRoute || isActive('/employees') || isActive('/schedules');
  const adminOpen = isDepartmentsRouteActive || isActive('/areas');
  const inventoryIsOpen = inventoryOpen || hoverInventory || expandInventory;
  const eventsIsOpen = eventsOpen || hoverEvents || expandEvents;
  const staffIsOpen = staffOpen || hoverStaff || expandStaff;
  const adminIsOpen = adminOpen || hoverAdmin || expandAdmin;

  const onToggleInventory = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExpandInventory((prev) => {
      const next = !prev;
      try { localStorage.setItem('sc_sidebar_expand_inventory', String(next)); } catch {}
      return next;
    });
  };
  const onToggleEvents = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExpandEvents((prev) => {
      const next = !prev;
      try { localStorage.setItem('sc_sidebar_expand_events', String(next)); } catch {}
      return next;
    });
  };
  const onToggleStaff = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExpandStaff((prev) => {
      const next = !prev;
      try { localStorage.setItem('sc_sidebar_expand_staff', String(next)); } catch {}
      return next;
    });
  };
  const onToggleAdmin = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExpandAdmin((prev) => {
      const next = !prev;
      try { localStorage.setItem('sc_sidebar_expand_admin', String(next)); } catch {}
      return next;
    });
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
    <Sidebar className="sticky top-12 h-[calc(100vh-3rem)] z-40 leftnav">
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
                <div className="group" onMouseEnter={() => setHoverInventory(true)} onMouseLeave={() => setHoverInventory(false)}>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isActive('/inventory')}
                      className="px-3 py-2 rounded text-[14px] font-medium text-foreground hover:bg-sidebar-accent/10 data-[active=true]:text-sidebar-primary">
                      <NavLink to="/inventory" className={({isActive}) => `navLink flex items-center gap-1.5 justify-between w-full${isActive ? ' navLink--active' : ''}` }>
                        <span className="flex items-center gap-1.5">
                          <Boxes className="w-4 h-4" />
                          <span className="truncate">Inventory</span>
                        </span>
                        <button
                          aria-label={inventoryIsOpen ? 'Collapse' : 'Expand'}
                          onClick={onToggleInventory}
                          className="shrink-0 inline-flex items-center justify-center w-5 h-5 rounded hover:bg-sidebar-accent/40 relative"
                        >
                          {expandInventory ? (
                            <span className="absolute inset-0 m-auto w-4 h-4 rounded-full bg-[currentColor]" />
                          ) : null}
                          <ChevronRight className={`relative z-10 w-3.5 h-3.5 transition-transform ${inventoryIsOpen ? 'rotate-90' : ''} ${expandInventory ? 'text-background' : ''}`} />
                        </button>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  {/* Nested/indented item under Inventory */}
                  <div className={`pl-0 pr-2 transition-all duration-200 ease-out ${inventoryIsOpen ? 'grid grid-rows-[1fr] opacity-100 translate-y-0' : 'grid grid-rows-[0fr] opacity-0 -translate-y-1'}`}>
                    <div className="overflow-hidden">
                      <div
                        className={`ml-6 rounded-b-md rounded-t-none ${inventoryOpen ? 'border' : ''}`}
                        style={{
                          background: inventoryOpen ? 'linear-gradient(90deg, var(--nav-indicator-left), var(--nav-indicator-right))' : 'transparent',
                          borderColor: inventoryOpen ? 'color-mix(in oklch, var(--primary) 25%, transparent)' : 'transparent'
                        }}
                      >
                        <div className="py-1">
                          <SidebarMenuItem>
                            <SidebarMenuButton asChild isActive={isActive('/inventory/assets')}
                              className="relative px-3 py-2 rounded text-[14px] font-medium text-foreground hover:bg-sidebar-accent/10 data-[active=true]:text-sidebar-primary">
                              <NavLink to="/inventory/assets" className={({isActive}) => `navLink flex items-center gap-1.5${isActive ? ' navLink--active' : ''}`}>
                                {isActive('/inventory/assets') ? (
                                  <span className="pointer-events-none absolute inset-0 bg-black/10" />
                                ) : null}
                                <span className="truncate">Assets Table</span>
                              </NavLink>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="group" onMouseEnter={() => setHoverEvents(true)} onMouseLeave={() => setHoverEvents(false)}>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isActive('/events')}
                      className="px-3 py-2 rounded text-[14px] font-medium text-foreground hover:bg-sidebar-accent/10 data-[active=true]:text-sidebar-primary">
                      <NavLink to="/events" className={({isActive}) => `navLink flex items-center gap-1.5 justify-between w-full${isActive ? ' navLink--active' : ''}` }>
                        <span className="flex items-center gap-1.5">
                          <CalendarDays className="w-4 h-4" />
                          <span className="truncate">Events</span>
                        </span>
                        <button
                          aria-label={eventsIsOpen ? 'Collapse' : 'Expand'}
                          onClick={onToggleEvents}
                          className="shrink-0 inline-flex items-center justify-center w-5 h-5 rounded hover:bg-sidebar-accent/40 relative"
                        >
                          {expandEvents ? (
                            <span className="absolute inset-0 m-auto w-4 h-4 rounded-full bg-[currentColor]" />
                          ) : null}
                          <ChevronRight className={`relative z-10 w-3.5 h-3.5 transition-transform ${eventsIsOpen ? 'rotate-90' : ''} ${expandEvents ? 'text-background' : ''}`} />
                        </button>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  {/* Nested/indented item under Events */}
                  <div className={`pl-0 pr-2 transition-all duration-200 ease-out ${eventsIsOpen ? 'grid grid-rows-[1fr] opacity-100 translate-y-0' : 'grid grid-rows-[0fr] opacity-0 -translate-y-1'}`}>
                    <div className="overflow-hidden">
                      <div
                        className={`ml-6 rounded-b-md rounded-t-none ${eventsOpen ? 'border' : ''}`}
                        style={{
                          background: eventsOpen ? 'linear-gradient(90deg, var(--nav-indicator-left), var(--nav-indicator-right))' : 'transparent',
                          borderColor: eventsOpen ? 'color-mix(in oklch, var(--primary) 25%, transparent)' : 'transparent'
                        }}
                      >
                        <div className="py-1">
                          <SidebarMenuItem>
                            <SidebarMenuButton asChild isActive={isActive('/events/calendar')}
                              className={`relative px-3 py-2 rounded text-[14px] font-medium text-foreground hover:bg-sidebar-accent/10 data-[active=true]:text-sidebar-primary`}>
                              <NavLink to="/events/calendar" className={({isActive}) => `navLink flex items-center gap-1.5${isActive ? ' navLink--active' : ''}`}>
                                {/* Active stripe overlay */}
                                {isActive('/events/calendar') ? (
                                  <span className="pointer-events-none absolute inset-0 bg-black/10" />
                                ) : null}
                                <span className="truncate">Calendar</span>
                              </NavLink>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                          <SidebarMenuItem>
                            <SidebarMenuButton asChild isActive={isActive('/events/recurring')}
                              className={`relative px-3 py-2 rounded text-[14px] font-medium text-foreground hover:bg-sidebar-accent/10 data-[active=true]:text-sidebar-primary`}>
                              <NavLink to="/events/recurring" className={({isActive}) => `navLink flex items-center gap-1.5${isActive ? ' navLink--active' : ''}`}>
                                {isActive('/events/recurring') ? (
                                  <span className="pointer-events-none absolute inset-0 bg-black/10" />
                                ) : null}
                                <span className="truncate">Recurring</span>
                              </NavLink>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                          <SidebarMenuItem>
                            <SidebarMenuButton asChild isActive={isActive('/events/templates') || isActive('/templates')}
                              className={`relative px-3 py-2 rounded text-[14px] font-medium text-foreground hover:bg-sidebar-accent/10 data-[active=true]:text-sidebar-primary`}>
                              <NavLink to="/events/templates" className={({isActive}) => `navLink flex items-center gap-1.5${isActive ? ' navLink--active' : ''}`}>
                                {isActive('/events/templates') || isActive('/templates') ? (
                                  <span className="pointer-events-none absolute inset-0 bg-black/10" />
                                ) : null}
                                <span className="truncate">Templates</span>
                              </NavLink>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                          {null}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="group" onMouseEnter={() => setHoverStaff(true)} onMouseLeave={() => setHoverStaff(false)}>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={staffOpen}
                      className="px-3 py-2 rounded text-[14px] font-medium text-foreground hover:bg-sidebar-accent/10 data-[active=true]:text-sidebar-primary">
                      <div className={`navLink flex items-center gap-1.5 justify-between w-full${staffOpen ? ' navLink--active' : ''}`}>
                        <span className="flex items-center gap-1.5">
                          <Users2 className="w-4 h-4" />
                          <span className="truncate">Staff</span>
                        </span>
                        <button
                          aria-label={staffIsOpen ? 'Collapse' : 'Expand'}
                          onClick={onToggleStaff}
                          className="shrink-0 inline-flex items-center justify-center w-5 h-5 rounded hover:bg-sidebar-accent/40 relative"
                        >
                          {expandStaff ? (
                            <span className="absolute inset-0 m-auto w-4 h-4 rounded-full bg-[currentColor]" />
                          ) : null}
                          <ChevronRight className={`relative z-10 w-3.5 h-3.5 transition-transform ${staffIsOpen ? 'rotate-90' : ''} ${expandStaff ? 'text-background' : ''}`} />
                        </button>
                      </div>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  {/* Nested/indented items under Staff */}
                  <div className={`pl-0 pr-2 transition-all duration-200 ease-out ${staffIsOpen ? 'grid grid-rows-[1fr] opacity-100 translate-y-0' : 'grid grid-rows-[0fr] opacity-0 -translate-y-1'}`}>
                    <div className="overflow-hidden">
                      <div
                        className={`ml-6 rounded-b-md rounded-t-none ${staffOpen ? 'border' : ''}`}
                        style={{
                          background: staffOpen ? 'linear-gradient(90deg, var(--nav-indicator-left), var(--nav-indicator-right))' : 'transparent',
                          borderColor: staffOpen ? 'color-mix(in oklch, var(--primary) 25%, transparent)' : 'transparent'
                        }}
                      >
                        <div className="py-1">
                          <SidebarMenuItem>
                            <SidebarMenuButton asChild isActive={isActive('/schedules')}
                              className="relative px-3 py-2 rounded text-[14px] font-medium text-foreground hover:bg-sidebar-accent/10 data-[active=true]:text-sidebar-primary">
                              <NavLink to="/schedules" className={({isActive}) => `navLink flex items-center gap-1.5${isActive ? ' navLink--active' : ''}`}>
                                {isActive('/schedules') ? (
                                  <span className="pointer-events-none absolute inset-0 bg-black/10" />
                                ) : null}
                                <span className="truncate">Schedules</span>
                              </NavLink>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                          <SidebarMenuItem>
                            <SidebarMenuButton asChild isActive={isSchedulingRoute}
                              className="relative px-3 py-2 rounded text-[14px] font-medium text-foreground hover:bg-sidebar-accent/10 data-[active=true]:text-sidebar-primary">
                              <NavLink to="/scheduling" className={({isActive}) => `navLink flex items-center gap-1.5${isActive ? ' navLink--active' : ''}`}>
                                {isSchedulingRoute ? (
                                  <span className="pointer-events-none absolute inset-0 bg-black/10" />
                                ) : null}
                                <span className="truncate">Shifts</span>
                              </NavLink>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                          <SidebarMenuItem>
                            <SidebarMenuButton asChild isActive={isActive('/employees')}
                              className="relative px-3 py-2 rounded text-[14px] font-medium text-foreground hover:bg-sidebar-accent/10 data-[active=true]:text-sidebar-primary">
                              <NavLink to="/employees" className={({isActive}) => `navLink flex items-center gap-1.5${isActive ? ' navLink--active' : ''}`}>
                                {isActive('/employees') ? (
                                  <span className="pointer-events-none absolute inset-0 bg-black/10" />
                                ) : null}
                                <span className="truncate">Employees</span>
                              </NavLink>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="group" onMouseEnter={() => setHoverAdmin(true)} onMouseLeave={() => setHoverAdmin(false)}>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={adminOpen}
                      className="px-3 py-2 rounded text-[14px] font-medium text-foreground hover:bg-sidebar-accent/10 data-[active=true]:text-sidebar-primary">
                      <div className={`navLink flex items-center gap-1.5 justify-between w-full${adminOpen ? ' navLink--active' : ''}`}>
                        <span className="flex items-center gap-1.5">
                          <Settings className="w-4 h-4" />
                          <span className="truncate">Admin</span>
                        </span>
                        <button
                          aria-label={adminIsOpen ? 'Collapse' : 'Expand'}
                          onClick={onToggleAdmin}
                          className="shrink-0 inline-flex items-center justify-center w-5 h-5 rounded hover:bg-sidebar-accent/40 relative"
                        >
                          {expandAdmin ? (
                            <span className="absolute inset-0 m-auto w-4 h-4 rounded-full bg-[currentColor]" />
                          ) : null}
                          <ChevronRight className={`relative z-10 w-3.5 h-3.5 transition-transform ${adminIsOpen ? 'rotate-90' : ''} ${expandAdmin ? 'text-background' : ''}`} />
                        </button>
                      </div>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  {/* Nested/indented items under Admin */}
                  <div className={`pl-0 pr-2 transition-all duration-200 ease-out ${adminIsOpen ? 'grid grid-rows-[1fr] opacity-100 translate-y-0' : 'grid grid-rows-[0fr] opacity-0 -translate-y-1'}`}>
                    <div className="overflow-hidden">
                      <div
                        className={`ml-6 rounded-b-md rounded-t-none ${adminOpen ? 'border' : ''}`}
                        style={{
                          background: adminOpen ? 'linear-gradient(90deg, var(--nav-indicator-left), var(--nav-indicator-right))' : 'transparent',
                          borderColor: adminOpen ? 'color-mix(in oklch, var(--primary) 25%, transparent)' : 'transparent'
                        }}
                      >
                        <div className="py-1">
                          <SidebarMenuItem>
                            <SidebarMenuButton asChild isActive={isDepartmentsRouteActive}
                              className="relative px-3 py-2 rounded text-[14px] font-medium text-foreground hover:bg-sidebar-accent/10 data-[active=true]:text-sidebar-primary">
                              <NavLink to="/departments" className={() => `navLink flex items-center gap-1.5${isDepartmentsRouteActive ? ' navLink--active' : ''}`}>
                                {isDepartmentsRouteActive ? (
                                  <span className="pointer-events-none absolute inset-0 bg-black/10" />
                                ) : null}
                                <Building2 className="w-4 h-4" />
                                <span className="truncate">Departments</span>
                              </NavLink>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                          <SidebarMenuItem>
                            <SidebarMenuButton asChild isActive={isActive('/areas')}
                              className="relative px-3 py-2 rounded text-[14px] font-medium text-foreground hover:bg-sidebar-accent/10 data-[active=true]:text-sidebar-primary">
                              <NavLink to="/areas" className={({isActive}) => `navLink flex items-center gap-1.5${isActive ? ' navLink--active' : ''}`}>
                                {isActive('/areas') ? (
                                  <span className="pointer-events-none absolute inset-0 bg-black/10" />
                                ) : null}
                                <MapPinned className="w-4 h-4" />
                                <span className="truncate">Areas</span>
                              </NavLink>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive('/contacts')}
                    className="px-3 py-2 rounded text-[14px] font-medium text-foreground hover:bg-sidebar-accent/10 data-[active=true]:text-sidebar-primary">
                    <NavLink to="/contacts" className={({isActive}) => `navLink flex items-center gap-1.5${isActive ? ' navLink--active' : ''}` }>
                      <Contact2 className="w-4 h-4" />
                      <span className="truncate">Contacts</span>
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