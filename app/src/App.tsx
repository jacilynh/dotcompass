import { Route, Routes } from "react-router-dom";

import { Layout } from "./components/Layout";
import { IndexProvider } from "./lib/indexContext";
import { About } from "./routes/About";
import { Browse } from "./routes/Browse";
import { Home } from "./routes/Home";
import { HowBuilt } from "./routes/HowBuilt";
import { NotFound } from "./routes/NotFound";
import { Scan } from "./routes/Scan";
import { SectionPage } from "./routes/SectionPage";

export function App() {
  return (
    <IndexProvider>
      {() => (
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/browse" element={<Browse />} />
            <Route path="/scan" element={<Scan />} />
            <Route path="/section/:num" element={<SectionPage />} />
            <Route path="/how-it-was-built" element={<HowBuilt />} />
            <Route path="/about" element={<About />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Layout>
      )}
    </IndexProvider>
  );
}
