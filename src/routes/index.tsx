import { createFileRoute } from "@tanstack/react-router";

import { FlodoBoard } from "../components/FlodoBoard";

export const Route = createFileRoute("/")({
  component: FlodoPage,
});

function FlodoPage() {
  return <FlodoBoard />;
}
