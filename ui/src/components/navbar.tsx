import { Button } from "@/components/ui/button";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { Menu } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth-context";
import { ModeToggle } from "@/components/mode-toggle";

export function Navbar() {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-50 flex items-center h-12 px-2 border-b shrink-0 bg-background topbar">
      <div className="flex items-center">
        <SidebarTrigger className="size-8">
          <Menu className="w-5 h-5" />
        </SidebarTrigger>
        <img
          src="/header_day.png"
          alt="Showcall"
          className="ml-3 h-[43px] w-auto dark:hidden select-none pointer-events-none"
        />
        <img
          src="/header_night.png"
          alt="Showcall"
          className="ml-3 h-[43px] w-auto hidden dark:block select-none pointer-events-none"
        />
      </div>
      <div className="flex items-center gap-2 ml-auto controlGroup">
        {user && (
          <span className="text-sm">
            Welcome, {user.displayName || user.email}
          </span>
        )}
        <ModeToggle />
        {user && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => signOut(auth)}
          >
            Sign Out
          </Button>
        )}
      </div>
    </header>
  );
} 