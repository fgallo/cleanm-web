import { Button } from "@/components/ui/button";

// A button for what cannot be taken back: it asks again, in place, before
// anything is sent. The page owns the request and whether the question is
// on screen, so it can put the button back once the request is answered.
export default function AskTwice({
  label,
  question,
  confirmLabel,
  cancelLabel,
  destructive = false,
  asking,
  pending,
  onAsk,
  onConfirm,
  onCancel,
}: {
  // What the button says before it is clicked.
  label: string;
  question: string;
  confirmLabel: string;
  cancelLabel: string;
  // Whether confirming removes something.
  destructive?: boolean;
  asking: boolean;
  pending: boolean;
  onAsk: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {asking ? (
        <>
          <span className="text-sm">{question}</span>
          <Button
            variant={destructive ? "destructive" : "default"}
            size="sm"
            disabled={pending}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            {cancelLabel}
          </Button>
        </>
      ) : (
        <Button variant="outline" size="sm" onClick={onAsk}>
          {label}
        </Button>
      )}
    </div>
  );
}
