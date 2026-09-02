import type { ReactNode, JSX } from "react";
import { HelpPanel } from "./HelpPanel";
import { SessionHistoryPanel } from "../features/history/SessionHistoryPanel";

/** Root layout and header for COMP-APPSHELL. */
export function AppShell({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="app-shell">
      <header className="app-header">
        <h1 className="app-title">SpecPilot</h1>
        <SessionHistoryPanel />
        <HelpPanel />
      </header>
      <main className="app-main">{children}</main>
    </div>
  );
}
