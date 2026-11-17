import { Navigate, createFileRoute } from "@tanstack/react-router";
import { Authenticated } from "convex/react";
import { LandingPage } from "#/features/landing/landing-page.tsx";
import { REPO_URL, SITE_DESCRIPTION, SITE_NAME, SITE_URL, pageHead } from "#/lib/seo.ts";

const Landing = () => {
  return (
    <>
      <Authenticated>
        <Navigate to="/home" replace />
      </Authenticated>
      <LandingPage />
    </>
  );
};

const page = pageHead({
  title: "Meetings · Open-source meetings app built with Convex",
  description: SITE_DESCRIPTION,
  canonicalPath: "/",
});

export const Route = createFileRoute("/")({
  ssr: true,
  head: () => ({
    ...page,
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: SITE_NAME,
          url: SITE_URL,
          description: SITE_DESCRIPTION,
          applicationCategory: "BusinessApplication",
          operatingSystem: "Any",
          browserRequirements: "A current browser with camera and microphone access for calls",
          isAccessibleForFree: true,
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          sameAs: [REPO_URL],
        }),
      },
    ],
  }),
  component: Landing,
});
