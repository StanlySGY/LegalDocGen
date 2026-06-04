import { useEffect, useCallback } from 'react'

interface ShortcutConfig {
  key: string
  ctrlKey?: boolean
  metaKey?: boolean
  altKey?: boolean
  shiftKey?: boolean
}

export function useKeyboardShortcut(
  config: ShortcutConfig,
  callback: (e: KeyboardEvent) => void,
  deps: any[] = []
) {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const keyMatched = event.key.toLowerCase() === config.key.toLowerCase()
    const ctrlMatched = config.ctrlKey ? (event.ctrlKey || event.metaKey) : !(event.ctrlKey || event.metaKey)
    const altMatched = config.altKey ? event.altKey : !event.altKey
    const shiftMatched = config.shiftKey ? event.shiftKey : !event.shiftKey

    if (keyMatched && ctrlMatched && altMatched && shiftMatched) {
      event.preventDefault()
      callback(event)
    }
  }, [config, callback])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown, ...deps])
}