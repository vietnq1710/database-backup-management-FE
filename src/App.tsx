import { Routes, Route } from "react-router";
import { Toaster } from "sonner";
import { useTheme } from "next-themes";
import { PageTransition } from "./components/PageTransition";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import AuthCallback from "./pages/AuthCallback";
import Dashboard from "./pages/Dashboard";
import Jobs from "./pages/Jobs";
import Projects from "./pages/Projects";
import Permissions from "./pages/Permissions";

export default function App() {
  const { resolvedTheme } = useTheme();

  return (
    <>
      <Toaster
        theme={resolvedTheme as "light" | "dark"}
        position="bottom-right"
        toastOptions={{
          style: {
            background: "var(--panel-dark)",
            border: "1px solid var(--panel-mid)",
            borderRadius: 0,
            color: "var(--foreground)",
          },
        }}
      />
      <PageTransition>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/callback" element={<AuthCallback />} />
          <Route path="/" element={<Dashboard />} />
          <Route path="/jobs" element={<Jobs />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/permissions" element={<Permissions />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </PageTransition>
    </>
  );
}
