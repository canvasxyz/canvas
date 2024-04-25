import "./globals.css"

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode
}>) {
	return (
		<html lang="en">
			<link rel="icon" href="/favicon.ico" />
			<body>{children}</body>
		</html>
	)
}
