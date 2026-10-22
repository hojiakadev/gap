import { inlineTokens } from '../../lib/textFormatting';
export function RichText({ text, depth = 0 }: { text: string; depth?: number }) {
  return (
    <>
      {inlineTokens(text).map((token, index) => {
        switch (token.kind) {
          case 'bold':
            return (
              <strong key={index}>
                {depth < 4 ? <RichText text={token.text} depth={depth + 1} /> : token.text}
              </strong>
            );
          case 'italic':
            return (
              <em key={index}>
                {depth < 4 ? <RichText text={token.text} depth={depth + 1} /> : token.text}
              </em>
            );
          case 'code':
            return (
              <code className="inline-code" key={index}>
                {token.text}
              </code>
            );
          case 'link':
            return (
              <a
                key={index}
                href={token.text}
                target="_blank"
                rel="noopener noreferrer"
                referrerPolicy="no-referrer"
              >
                {token.text}
              </a>
            );
          default:
            return token.text;
        }
      })}
    </>
  );
}
