import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import { ToastContainer } from './components/Toast';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import AigcPage from './pages/AigcPage';
import ReviewPage from './pages/ReviewPage';
import RevisionPage from './pages/RevisionPage';
import CreditsPage from './pages/CreditsPage';
import AuxPage from './pages/AuxPage';
import Editor from './pages/Editor';
import AdvisorRevisionPage from './pages/AdvisorRevisionPage';
import ReviewerRevisionPage from './pages/ReviewerRevisionPage';

export default function App() {
  return (
    <Layout>
      <ToastContainer />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<Dashboard />} />
        {/* 三大核心功能板块 */}
        <Route path="/aigc" element={<AigcPage />} />
        <Route path="/review" element={<ReviewPage />} />
        <Route path="/revision" element={<RevisionPage />} />
        {/* 多角色场景入口 */}
        <Route path="/advisor-revision" element={<AdvisorRevisionPage />} />
        <Route path="/reviewer-revision" element={<ReviewerRevisionPage />} />
        {/* 资产与商业化 */}
        <Route path="/credits" element={<CreditsPage />} />
        {/* 辅助功能 */}
        <Route path="/aux/defense-simulation" element={<AuxPage configKey="defense-simulation" />} />
        <Route path="/aux/format-check" element={<AuxPage configKey="format-check" />} />
        <Route path="/aux/revision-review" element={<AuxPage configKey="revision-review" />} />
        <Route path="/aux/literature-review" element={<AuxPage configKey="literature-review" />} />
        <Route path="/aux/cn-to-en" element={<AuxPage configKey="cn-to-en" />} />
        <Route path="/editor/:id" element={<Editor />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Layout>
  );
}
