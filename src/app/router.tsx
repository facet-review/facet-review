import { createBrowserRouter, Navigate } from 'react-router';
import { Layout } from './Layout';
import NotFoundPage from './NotFoundPage';
import ProjectsOverviewPage from '../features/project/ProjectsOverviewPage';
import NewProjectPage from '../features/project/NewProjectPage';
import ProjectLayout from '../features/project/ProjectLayout';
import ProjectPage from '../features/project/ProjectPage';
import SearchPage from '../features/search/SearchPage';
import ImportPage from '../features/import/ImportPage';
import ScreeningPage from '../features/screening/ScreeningPage';
import FlowPage from '../features/flow/FlowPage';
import ChecklistPage from '../features/checklist/ChecklistPage';

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
          { path: 'import', element: <ImportPage /> },
          { path: 'screening', element: <ScreeningPage /> },
          { path: 'flow', element: <FlowPage /> },
          { path: 'checklist', element: <ChecklistPage /> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
