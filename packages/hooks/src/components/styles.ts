import { CSSProperties } from 'react'

export const button = {
  padding: "0.5rem",
  border: "1px solid",
  borderRadius: "0.25rem",
} satisfies CSSProperties

export const styles = {
  errorContainer: {
    padding: "0.5rem",
    border: "1px solid",
    borderRadius: "0.25rem",
    backgroundColor: "#fee2e2",
    fontSize: "0.875rem",
  } satisfies CSSProperties,
  
  loadingButton: {
    ...button,
    backgroundColor: "#e5e7eb",
    width: "100%",
  } satisfies CSSProperties,
  
  actionButton: {
    ...button,
    cursor: "pointer",
    width: "100%",
  } satisfies CSSProperties,
} 