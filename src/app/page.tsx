"use client";

import dynamic from "next/dynamic";

// https://nextjs.org/docs/app/building-your-application/optimizing/lazy-loading#nextdynamic
const ClientApp = dynamic(() => import("./app"), {
  ssr: false,
});

export default function App() {
  return <ClientApp />;
}
