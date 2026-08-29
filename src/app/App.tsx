import { Navigate, Route, Routes, useLocation } from "react-router";
import { useEffect, type ReactNode } from "react";
import { trackPageView } from "./lib/analytics";
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
import { EarlyAccess } from "./routes/EarlyAccess";
import { Welcome } from "./routes/Welcome";
import { Tour } from "./routes/Tour";
import { About } from "./routes/About";

/**
 * The journal app is built but not released. While this is false the public
 * site is an early-access waitlist and /app/* plus /auth redirect home.
 * Flip VITE_APP_ENABLED=true to open the full product.
 */
const APP_ENABLED = import.meta.env.VITE_APP_ENABLED === "true";

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

/** Sends one GA page view per route change (SPA navigations are invisible to gtag). */
function usePageViews() {
  const { pathname } = useLocation();
  useEffect(() => {
    trackPageView(pathname);
  }, [pathname]);
}

export default function App() {
  usePageViews();
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
            APP_ENABLED ? (
              <AuthGate>
                <Auth />
              </AuthGate>
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="/signup"
          element={
            APP_ENABLED ? (
              <RedirectIfOnboarded>
                <SignupFlow />
              </RedirectIfOnboarded>
            ) : (
              <EarlyAccess />
            )
          }
        />
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/tour" element={<Tour />} />
        <Route path="/about" element={<About />} />
        <Route
          path="/app"
          element={
            APP_ENABLED ? (
              <RequireOnboarded>
                <AppShell />
              </RequireOnboarded>
            ) : (
              <Navigate to="/" replace />
            )
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
