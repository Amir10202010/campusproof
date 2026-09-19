"use client";

import { ThemeProvider as NextThemeProvider } from "next-themes";
import type { ReactNode } from "react";

/**
 * Light / dark / follow-the-system. The tokens for both themes already live in app/globals.css; this
 * puts the `dark` class on <html> and remembers the choice. `disableTransitionOnChange` stops every
 * colour on the page from animating at once when the theme flips.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </NextThemeProvider>
  );
}
