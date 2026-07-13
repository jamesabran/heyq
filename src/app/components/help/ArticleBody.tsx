import { Fragment } from 'react';

// Minimal, dependency-free renderer for the KB body convention:
//   `## heading`  -> subheading
//   `- item`      -> list item (consecutive lines group into one list)
//   blank line    -> paragraph break
// Enough structure for readable articles without pulling in a markdown parser.
export function ArticleBody({ body }: { body: string }) {
  const blocks = body.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);

  return (
    <div className="flex flex-col gap-4 text-sm leading-relaxed text-foreground">
      {blocks.map((block, i) => {
        if (block.startsWith('## ')) {
          return (
            <h2 key={i} className="mt-2 text-lg font-semibold">
              {block.slice(3).trim()}
            </h2>
          );
        }
        const lines = block.split('\n');
        if (lines.every((l) => l.trim().startsWith('- '))) {
          return (
            <ul key={i} className="list-disc space-y-1.5 pl-5">
              {lines.map((l, j) => (
                <li key={j}>{renderInline(l.trim().slice(2))}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="text-muted-foreground">
            {renderInline(block)}
          </p>
        );
      })}
    </div>
  );
}

// Render **bold** spans; everything else is plain text.
function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={i} className="font-semibold text-foreground">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}
