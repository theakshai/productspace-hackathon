import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

// A textarea that reliably picks up text from dictation tools like Wispr Flow.
//
// Some dictation tools insert text through the operating system's accessibility API instead
// of simulating key presses, so the browser never fires an input event and a normal React
// controlled textarea ignores (or wipes) the text. This box is uncontrolled, listens to every
// event that can carry new text, and also checks its own value a few times a second while
// focused, so dictated text is never lost.
const DictationBox = forwardRef(function DictationBox({ value, onChange, resetKey, ...props }, ref) {
  const el = useRef(null)
  const last = useRef(value)

  useImperativeHandle(ref, () => ({
    focus: () => el.current?.focus(),
    read: () => el.current?.value ?? '',
  }))

  // Push a new value into the box when the parent replaces it (e.g. "Use an example").
  useEffect(() => {
    if (el.current && el.current.value !== value) {
      el.current.value = value
      last.current = value
    }
  }, [value, resetKey])

  const sync = () => {
    const v = el.current?.value ?? ''
    if (v !== last.current) {
      last.current = v
      onChange(v)
    }
  }

  // Poll while the page is open: catches text inserted without any DOM event.
  useEffect(() => {
    const id = setInterval(sync, 400)
    return () => clearInterval(id)
  })

  return (
    <textarea
      ref={el}
      defaultValue={value}
      onInput={sync}
      onChange={sync}
      onKeyUp={sync}
      onBlur={sync}
      onFocus={sync}
      onPaste={() => setTimeout(sync, 0)}
      onCompositionEnd={sync}
      {...props}
    />
  )
})

export default DictationBox
