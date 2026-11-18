import { useRef, useState, type ComponentProps } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// A day that may be left blank, with the way back to blank next to it.
// Browsers do not agree on how a date field is emptied: the picker of one
// has a button for it, the picker of another has none, and deleting a date
// part by part on the keyboard is nothing a field says about itself.
export default function OptionalDateInput({
  value,
  onValueChange,
  clearLabel,
  ...props
}: Omit<ComponentProps<typeof Input>, "type" | "value" | "onChange"> & {
  // YYYY-MM-DD, or "" while no day is set.
  value: string;
  onValueChange: (value: string) => void;
  // What the button is called for whoever does not see the field it is
  // next to: "Clear end date".
  clearLabel: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  // Some parts of the date typed and others not: the field has no value,
  // yet it is not blank, and the browser refuses to send it.
  const [incomplete, setIncomplete] = useState(false);

  return (
    <div className="flex items-center gap-1">
      <Input
        ref={input}
        type="date"
        value={value}
        onChange={(event) => {
          setIncomplete(event.target.validity.badInput);
          onValueChange(event.target.value);
        }}
        // Parts typed into a blank field change no value, so nothing says
        // so until the field is left.
        onBlur={(event) => setIncomplete(event.target.validity.badInput)}
        {...props}
      />
      {(value !== "" || incomplete) && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={clearLabel}
          onClick={() => {
            // Emptied on the element itself: with only some parts typed
            // its value is already "", and React would have nothing to
            // change.
            if (input.current !== null) {
              input.current.value = "";
              input.current.focus();
            }
            setIncomplete(false);
            onValueChange("");
          }}
        >
          Clear
        </Button>
      )}
    </div>
  );
}
