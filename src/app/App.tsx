import { useEffect } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './Layout';
import { DashboardPage } from '../pages/Dashboard';
import { DiagnosticPage } from '../pages/Diagnostic';
import { RoadmapPage } from '../pages/Roadmap';
import { LessonsPage } from '../pages/Lessons';
import { QuizPage } from '../pages/Quiz';
import { TutorPage } from '../pages/Tutor';
import { AbilitiesPage } from '../pages/Abilities';
import { SettingsPage } from '../pages/Settings';
import { ComingSoon } from '../pages/ComingSoon';
import { requestPersistentStorage } from '../db/backup';
import { initSync } from '../sync/manager';

export function App() {
  useEffect(() => {
    requestPersistentStorage();
    initSync();
  }, []);
  return (
    <HashRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/diagnostic" element={<DiagnosticPage />} />
          <Route path="/roadmap" element={<RoadmapPage />} />
          <Route path="/lessons" element={<LessonsPage />} />
          <Route path="/sql" element={<ComingSoon id="sql" />} />
          <Route path="/python" element={<ComingSoon id="python" />} />
          <Route path="/powerbi" element={<ComingSoon id="powerbi" />} />
          <Route path="/quiz" element={<QuizPage />} />
          <Route path="/projects" element={<ComingSoon id="projects" />} />
          <Route path="/tutor" element={<TutorPage />} />
          <Route path="/portfolio" element={<ComingSoon id="portfolio" />} />
          <Route path="/interview" element={<ComingSoon id="interview" />} />
          <Route path="/abilities" element={<AbilitiesPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<ComingSoon id="notfound" />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
}
