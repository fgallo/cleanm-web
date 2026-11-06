import { describeFailure } from "@/api/client.ts";
import { Button } from "@/components/ui/button";

// What a page shows in place of data it could not load.
export default function RequestFailed({
  error,
  onRetry,
}: {
  error: Error;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-start gap-3">
      <p role="alert">{describeFailure(error)}</p>
      <Button variant="outline" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}
