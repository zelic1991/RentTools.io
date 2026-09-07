"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div style={{ padding: "2rem", fontFamily: "system-ui, sans-serif", textAlign: "center" }}>
          <h1>Something went wrong</h1>
          <p>An unexpected error occurred. We&apos;ve been notified.</p>
          {error.digest && <p style={{ color: "#888", fontFamily: "monospace" }}>Error ID: {error.digest}</p>}
          {/* Plain anchor on purpose: global-error replaces the root layout,
              so a full reload is the only safe way back. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" style={{ color: "#ff385c" }}>Go home</a>
        </div>
      </body>
    </html>
  );
}
