export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <h1>Layout</h1>
      <p>This is the layout page</p>
      {children}
    </div>
  )
}
