import { useOutletContext } from 'react-router';
import type { Project } from '../../domain/types';

/** The current project, provided by ProjectLayout to all module pages. */
export function useProject(): Project {
  return useOutletContext<Project>();
}
