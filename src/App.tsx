import { Routes, Route } from "react-router";
import { Toaster } from "sonner";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import AuthCallback from "./pages/AuthCallback";
import Dashboard from "./pages/Dashboard";
import Jobs from "./pages/Jobs";
import History from "./pages/History";
import Servers from "./pages/Servers";
import Permissions from "./pages/Permissions";

export default function App() {
  return (
    <>
      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{
          style: {
            background: "var(--panel-dark)",
            border: "1px solid var(--panel-mid)",
            borderRadius: 0,
            color: "#fff",
          },
        }}
      />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/callback" element={<AuthCallback />} />
        <Route path="/" element={<Dashboard />} />
        <Route path="/jobs" element={<Jobs />} />
        <Route path="/history" element={<History />} />
        <Route path="/servers" element={<Servers />} />
        <Route path="/permissions" element={<Permissions />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}
