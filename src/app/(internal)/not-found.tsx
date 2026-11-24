import { NotFoundView } from "@/components/app/not-found-view";

export default function InternalNotFound() {
  return <NotFoundView homeHref="/dashboard" homeLabel="Back to dashboard" />;
}
