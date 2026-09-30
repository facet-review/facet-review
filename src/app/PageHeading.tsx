import { useDocumentTitle } from './useDocumentTitle';

interface PageHeadingProps {
  title: string;
  description?: string;
}

/** The page's single h1; also sets the document title. */
export function PageHeading({ title, description }: PageHeadingProps) {
  useDocumentTitle(title);
  return (
    <header>
      <h1>{title}</h1>
      {description && <p>{description}</p>}
    </header>
  );
}
