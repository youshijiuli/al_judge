import { useRef } from 'react'
import Editor from '@monaco-editor/react'
import type { editor } from 'monaco-editor'

interface Props {
  value: string
  onChange: (value: string | undefined) => void
  language?: string
}

const DEFAULT_CODE = `class Solution:
    def solve(self, *args):
        pass
`

export default function CodeEditor({ value, onChange, language = 'python' }: Props) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)

  return (
    <div className="h-full min-h-[300px] overflow-hidden" style={{ background: '#1e1e1e' }}>
      <Editor
        height="100%"
        defaultLanguage={language}
        value={value || DEFAULT_CODE}
        onChange={onChange}
        theme="vs-dark"
        onMount={(editor) => {
          editorRef.current = editor
          editor.focus()
        }}
        options={{
          fontSize: 14,
          fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
          minimap: { enabled: false },
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          tabSize: 4,
          insertSpaces: true,
          padding: { top: 16, bottom: 16 },
          automaticLayout: true,
          renderLineHighlight: 'line',
          overviewRulerBorder: false,
          hideCursorInOverviewRuler: true,
          contextmenu: false,
          guides: { indentation: true, bracketPairs: true },
          bracketPairColorization: { enabled: true },
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
        }}
      />
    </div>
  )
}
