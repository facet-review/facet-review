import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

/**
 * Navigates only after the next render, when the form no longer counts as
 * dirty – otherwise the unsaved-changes guard would block its own save.
 */
export function useNavigateAfterSave() {
  const navigate = useNavigate();
  const [target, setTarget] = useState<string>();
  useEffect(() => {
    if (target) void navigate(target);
  }, [target, navigate]);
  return { saved: target !== undefined, leaveTo: setTarget };
}
