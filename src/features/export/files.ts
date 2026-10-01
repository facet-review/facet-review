import { todayLocal } from '../../app/runtime';

export const exportFileName = (name: string, extension: string) =>
  `facet-review-${name}-${todayLocal()}.${extension}`;
