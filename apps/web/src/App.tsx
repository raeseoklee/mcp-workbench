import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout.js";
import OverviewPage from "./pages/OverviewPage.js";
import InspectPage from "./pages/InspectPage.js";
import ToolsPage from "./pages/ToolsPage.js";
import ResourcesPage from "./pages/ResourcesPage.js";
import PromptsPage from "./pages/PromptsPage.js";
import TimelinePage from "./pages/TimelinePage.js";
import TestResultsPage from "./pages/TestResultsPage.js";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/overview" replace />} />
        <Route path="overview" element={<OverviewPage />} />
        <Route path="inspect" element={<InspectPage />} />
        <Route path="tools" element={<ToolsPage />} />
        <Route path="resources" element={<ResourcesPage />} />
        <Route path="prompts" element={<PromptsPage />} />
        <Route path="timeline" element={<TimelinePage />} />
        <Route path="tests" element={<TestResultsPage />} />
      </Route>
    </Routes>
  );
}
