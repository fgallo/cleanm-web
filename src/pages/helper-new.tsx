import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";

import { createHelper, helperKeys } from "@/api/helpers.ts";
import HelperForm from "@/components/helper-form.tsx";

export default function HelperNewPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const create = useMutation({
    mutationFn: createHelper,
    onSuccess: async (helper) => {
      queryClient.setQueryData(helperKeys.detail(helper.id), helper);
      await queryClient.invalidateQueries({ queryKey: helperKeys.list() });
      void navigate("/helpers");
    },
  });

  return (
    <>
      <h1 className="mb-4 font-heading text-xl font-semibold">New helper</h1>
      <HelperForm
        submitLabel="Add helper"
        cancelTo="/helpers"
        pending={create.isPending}
        error={create.error}
        onSubmit={create.mutate}
      />
    </>
  );
}
