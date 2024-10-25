import { ArtifactCodeV3 } from "@/types";
import { Dispatch, MutableRefObject, SetStateAction, useEffect } from "react";
import CodeMirror, { EditorView } from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { cpp } from "@codemirror/lang-cpp";
import { java } from "@codemirror/lang-java";
import { php } from "@codemirror/lang-php";
import { python } from "@codemirror/lang-python";
import { html } from "@codemirror/lang-html";
import { sql } from "@codemirror/lang-sql";
import { json } from "@codemirror/lang-json";
import { rust } from "@codemirror/lang-rust";
import { xml } from "@codemirror/lang-xml";
import { clojure } from "@nextjournal/lang-clojure";
import { csharp } from "@replit/codemirror-lang-csharp";
import styles from "./CodeRenderer.module.css";
import { cleanContent } from "@/lib/normalize_string";
import { cn } from "@/lib/utils";

export interface CodeRendererProps {
  artifactContent: ArtifactCodeV3;
  setArtifactContent: (index: number, content: string) => void;
  editorRef: MutableRefObject<EditorView | null>;
  firstTokenReceived: boolean;
  isStreaming: boolean;
  updateRenderedArtifactRequired: boolean;
  setUpdateRenderedArtifactRequired: Dispatch<SetStateAction<boolean>>;
}

const getLanguageExtension = (language: string) => {
  switch (language) {
    case "javascript":
      return javascript({ jsx: true, typescript: false });
    case "typescript":
      return javascript({ jsx: true, typescript: true });
    case "cpp":
      return cpp();
    case "java":
      return java();
    case "php":
      return php();
    case "python":
      return python();
    case "html":
      return html();
    case "sql":
      return sql();
    case "json":
      return json();
    case "rust":
      return rust();
    case "xml":
      return xml();
    case "clojure":
      return clojure();
    case "csharp":
      return csharp();
    default:
      return [];
  }
};

export function CodeRenderer(props: Readonly<CodeRendererProps>) {
  const extensions = [getLanguageExtension(props.artifactContent.language)];

  useEffect(() => {
    if (props.updateRenderedArtifactRequired) {
      props.setUpdateRenderedArtifactRequired(false);
    }
  }, [props.updateRenderedArtifactRequired]);

  if (!props.artifactContent.code) {
    return null;
  }

  const isEditable = !props.isStreaming;

  return (
    <>
      <style jsx global>{`
        .pulse-code .cm-content {
          animation: codePulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }

        @keyframes codePulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.3;
          }
        }
      `}</style>
      <CodeMirror
        editable={isEditable}
        className={cn(
          "w-full min-h-full",
          styles.codeMirrorCustom,
          props.isStreaming && !props.firstTokenReceived ? "pulse-code" : ""
        )}
        value={cleanContent(props.artifactContent.code)}
        height="800px"
        extensions={extensions}
        onChange={(c) =>
          props.setArtifactContent(props.artifactContent.index, c)
        }
        onCreateEditor={(view) => {
          props.editorRef.current = view;
        }}
      />
    </>
  );
}
