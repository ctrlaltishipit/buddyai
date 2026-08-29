import { Navigate, Route, Routes, useLocation } from "react-router";
import type { ReactNode } from "react";
import { BuddyBlob } from "./components/BuddyBlob";
import { CrisisModal } from "./components/CrisisModal";
import { useStore } from "./lib/store";
import { AppShell } from "./routes/AppShell";
import { Auth } from "./routes/Auth";
import { EmotionMap } from "./routes/EmotionMap";
import { Home } from "./routes/Home";
import { Journal } from "./routes/Journal";
import { Landing } from "./routes/Landing";
import { Reflector } from "./routes/Reflector";
import { Settings } from "./routes/Settings";
import { SignupFlow } from "./routes/SignupFlow";

/** Full-screen splash while the session hydrates. */
function Splash() {
  return (
    <div className="surface-dark grid place-items-center">
      <div className="anim-fade-up flex flex-col items-center gap-5">
        <BuddyBlob size={120} colors={["#FFD23F", "#FF7A1A", "#F24E1E"]} />
        <span className="font-display text-[19px] font-bold tracking-[-0.5px]">
          buddy<span className="text-gradient">.ai</span>
        </span>
      </div>
    </div>
  );
}

/**
 * Gate for /app/*: must be signed in AND finished onboarding.
 * Unfinished onboarding resumes the signup wizard at the saved step.
 */
function RequireOnboarded({ children }: { children: ReactNode }) {
  const { state } = useStore();
  const location = useLocation();
  if (state.status === "loading") return <Splash />;
  if (state.status === "anon") return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  if (state.settings && !state.settings.onboarding_complete) return <Navigate to="/signup" replace />;
  return <>{children}</>;
}

/** Signed-in + onboarded users skip the marketing/auth screens. */
function RedirectIfOnboarded({ children }: { children: ReactNode }) {
  const { state } = useStore();
  if (state.status === "loading") return <Splash />;
  if (state.status === "authed" && state.settings?.onboarding_complete) {
    return <Navigate to="/app/home" replace />;
  }
  return <>{children}</>;
}

/** /auth: signed-in users go to the app (or back into onboarding). */
function AuthGate({ children }: { children: ReactNode }) {
  const { state } = useStore();
  if (state.status === "loading") return <Splash />;
  if (state.status === "authed") {
    return <Navigate to={state.settings?.onboarding_complete ? "/app/home" : "/signup"} replace />;
  }
  return <>{children}</>;
}

function ToastHost() {
  const { state } = useStore();
  if (!state.toast) return null;
  return (
    <div className="toast" role="status" aria-live="polite">
      {state.toast.message}
    </div>
  );
}

export default function App() {
  return (
    <>
      <Routes>
        <Route
          path="/"
          element={
            <RedirectIfOnboarded>
              <Landing />
            </RedirectIfOnboarded>
          }
        />
        <Route
          path="/auth"
          element={
            <AuthGate>
              <Auth />
            </AuthGate>
          }
        />
        <Route
          path="/signup"
          element={
            <RedirectIfOnboarded>
              <SignupFlow />
            </RedirectIfOnboarded>
          }
        />
        <Route
          path="/app"
          element={
            <RequireOnboarded>
              <AppShell />
            </RequireOnboarded>
          }
        >
          <Route index element={<Navigate to="home" replace />} />
          <Route path="home" element={<Home />} />
          <Route path="journal" element={<Journal />} />
          <Route path="map" element={<EmotionMap />} />
          <Route path="reflector" element={<Reflector />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <CrisisModal />
      <ToastHost />
    </>
  );
}
