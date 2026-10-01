import { createBrowserRouter, Navigate } from 'react-router';
import { Layout } from './Layout';
import NotFoundPage from './NotFoundPage';
import ProjectsOverviewPage from '../features/project/ProjectsOverviewPage';
import NewProjectPage from '../features/project/NewProjectPage';
import ProjectLayout from '../features/project/ProjectLayout';
import ProjectPage from '../features/project/ProjectPage';
import SearchPage from '../features/search/SearchPage';
import SourceFormPage from '../features/search/SourceFormPage';
import RunFormPage from '../features/search/RunFormPage';
import ImportPage from '../features/import/ImportPage';
import ImportWizardPage from '../features/import/ImportWizardPage';
import DuplicatesPage from '../features/import/DuplicatesPage';
import ScreeningPage from '../features/screening/ScreeningPage';
import ScreeningUnitPage from '../features/screening/ScreeningUnitPage';
import FlowPage from '../features/flow/FlowPage';
import ChecklistPage from '../features/checklist/ChecklistPage';
import ExportPage from '../features/export/ExportPage';

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { index: true, element: <ProjectsOverviewPage /> },
      { path: 'projects/new', element: <NewProjectPage /> },
      {
        path: 'projects/:projectId',
        element: <ProjectLayout />,
        children: [
          { index: true, element: <Navigate to="project" replace /> },
          { path: 'project', element: <ProjectPage /> },
          { path: 'search', element: <SearchPage /> },
          { path: 'search/sources/new', element: <SourceFormPage /> },
          { path: 'search/sources/:sourceId', element: <SourceFormPage /> },
          { path: 'search/sources/:sourceId/runs/new', element: <RunFormPage /> },
          { path: 'search/runs/:runId', element: <RunFormPage /> },
          { path: 'import', element: <ImportPage /> },
          { path: 'import/runs/:runId', element: <ImportWizardPage /> },
          { path: 'import/duplicates', element: <DuplicatesPage /> },
          { path: 'screening', element: <ScreeningPage /> },
          { path: 'screening/:stage/:recordId', element: <ScreeningUnitPage /> },
          { path: 'flow', element: <FlowPage /> },
          { path: 'checklist', element: <ChecklistPage /> },
          { path: 'export', element: <ExportPage /> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
