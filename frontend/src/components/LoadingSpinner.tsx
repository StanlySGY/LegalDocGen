interface LoadingSpinnerProps {
  text?: string
  size?: 'sm' | 'md' | 'lg'
}

export default function LoadingSpinner({ text = '加载中...', size = 'md' }: LoadingSpinnerProps) {
  const sizeClass = size === 'sm' ? 'spinner-sm' : size === 'lg' ? 'spinner-lg' : 'spinner-md'

  return (
    <div className="loading-spinner-container">
      <div className={`loading-spinner ${sizeClass}`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        </svg>
      </div>
      {text && <span className="loading-spinner-text">{text}</span>}
    </div>
  )
}