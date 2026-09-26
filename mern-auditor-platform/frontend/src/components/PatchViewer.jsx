/**
 * PatchViewer — decodes a Base64 unified diff and renders it with syntax
 * highlighting using react-syntax-highlighter in "diff" language mode.
 *
 * Props:
 *   patchContent  {string}  — Base64-encoded unified diff string
 */
import { Light as SyntaxHighlighter } from "react-syntax-highlighter";
import diff from "react-syntax-highlighter/dist/esm/languages/hljs/diff";
import { atomOneDark } from "react-syntax-highlighter/dist/esm/styles/hljs";

SyntaxHighlighter.registerLanguage("diff", diff);

export default function PatchViewer({ patchContent }) {
  if (!patchContent) return null;

  let decoded;
  try {
    decoded = atob(patchContent);
  } catch {
    return <pre className="patch-viewer patch-viewer--error">Invalid patch encoding.</pre>;
  }

  return (
    <div className="patch-viewer">
      <p className="patch-viewer__label">Auto-remediation patch</p>
      <SyntaxHighlighter
        language="diff"
        style={atomOneDark}
        customStyle={{ fontSize: "0.78rem", borderRadius: "4px", margin: 0 }}
        showLineNumbers={false}
      >
        {decoded}
      </SyntaxHighlighter>
    </div>
  );
}
