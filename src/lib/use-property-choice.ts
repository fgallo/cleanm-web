import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { clientPropertiesQueryOptions } from "@/api/properties.ts";

// Where a new job or a new series is: a property, found through its client.
// The state behind `PropertyChoiceFields`, kept by the page because the page
// is what sends the property chosen.
export function usePropertyChoice() {
  const [clientId, setClientId] = useState("");
  const [pickedPropertyId, setPickedPropertyId] = useState("");
  const properties = useQuery({
    ...clientPropertiesQueryOptions(clientId),
    enabled: clientId !== "",
  });
  // Most clients have one property, and that one needs no picking. Derived
  // on every render, so there is no state to keep in step with the list.
  const onlyProperty =
    properties.data?.length === 1 ? properties.data[0] : undefined;
  const propertyId =
    pickedPropertyId !== "" ? pickedPropertyId : (onlyProperty?.id ?? "");

  return {
    clientId,
    // Empty until a property is chosen or the client turns out to have one.
    propertyId,
    properties,
    chooseClient(id: string) {
      setClientId(id);
      // The property picked belonged to the previous client.
      setPickedPropertyId("");
    },
    chooseProperty: setPickedPropertyId,
  };
}

export type PropertyChoice = ReturnType<typeof usePropertyChoice>;
