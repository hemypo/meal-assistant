import { BottomBar, SettingsLink, Sidebar } from "@/components/AdaptiveNav";
import { ToastProvider } from "@/components/ui/Toast";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ToastProvider>
      <Sidebar />
      {/* Main padding per MASTER.md §3.3; bottom clearance for the mobile nav. */}
      <main className="flex-1 px-4 pb-24 pt-6 lg:ml-60 lg:px-10 lg:pb-18 lg:pt-11">
        {/* Settings is reachable on mobile without a sixth nav item (§4). */}
        <div className="mx-auto mb-1 flex w-full max-w-[1280px] justify-end lg:hidden">
          <SettingsLink variant="header" />
        </div>
        <div className="animate-screen-enter mx-auto w-full max-w-[1280px]">
          {children}
        </div>
      </main>
      <BottomBar />
    </ToastProvider>
  );
}
