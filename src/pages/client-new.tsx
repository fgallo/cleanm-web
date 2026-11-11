import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";

import { clientKeys, createClient } from "@/api/clients.ts";
import ClientForm from "@/components/client-form.tsx";

export default function ClientNewPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const create = useMutation({
    mutationFn: createClient,
    onSuccess: (client) => {
      // The response is the client as GET /clients/:id returns it, so its
      // page opens without waiting; the list is fetched again when shown.
      queryClient.setQueryData(clientKeys.detail(client.id), client);
      void queryClient.invalidateQueries({ queryKey: clientKeys.list() });
      void navigate(`/clients/${client.id}`);
    },
  });

  return (
    <>
      <h1 className="mb-4 font-heading text-xl font-semibold">New client</h1>
      <ClientForm
        submitLabel="Create client"
        cancelTo="/clients"
        pending={create.isPending}
        error={create.error}
        onSubmit={create.mutate}
      />
    </>
  );
}
