import { lazy, Suspense, useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { Toasts } from "./components/ui";
import Landing from "./pages/Landing";
import Start from "./pages/Start";
import NotFound from "./pages/NotFound";

const Editor = lazy(() => import("./pages/Editor"));
const PublicResume = lazy(() => import("./pages/PublicResume"));

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

export default function App() {
  return (
    <>
      <ScrollTop />
      <Suspense fallback={<div className="empty" style={{ paddingTop: 120 }}><span className="spinner" /></div>}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/start" element={<Start />} />
          <Route path="/edit/:id" element={<Editor />} />
          <Route path="/r/:slug" element={<PublicResume />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      <Toasts />
    </>
  );
}
