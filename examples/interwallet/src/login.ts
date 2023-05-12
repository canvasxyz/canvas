export const buildMagicString = (pin: string) => {
	return `[Password: ${pin}]

  Generate a new messaging key?

  Signing this message will allow the application to read & write messages from your address.

  Only do this when setting up your messaging client or mobile application.
  `
}
