import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router";

import { isNotFound } from "@/api/client.ts";
import {
  helperKeys,
  helperQueryOptions,
  updateHelper,
  type Helper,
  type HelperInput,
} from "@/api/helpers.ts";
import { jobKeys } from "@/api/jobs.ts";
import HelperForm from "@/components/helper-form.tsx";
import RequestFailed from "@/components/request-failed.tsx";

export default function HelperEditPage() {
  const { helperId } = useParams();
  if (helperId === undefined) {
    throw new Error("HelperEditPage is rendered without a :helperId parameter");
  }
  return <HelperEdit helperId={helperId} />;
}

function HelperEdit({ helperId }: { helperId: string }) {
  const helper = useQuery(helperQueryOptions(helperId));

  return (
    <>
      <h1 className="mb-4 font-heading text-xl font-semibold">Edit helper</h1>
      {helper.isPending && <p className="text-muted-foreground">Loading…</p>}
      {helper.isError &&
        (isNotFound(helper.error) ? (
          <>
            <p role="alert">Helper not found.</p>
            <p className="mt-4 text-sm">
              <Link
                to="/helpers"
                className="text-muted-foreground hover:text-foreground"
              >
                Back to helpers
              </Link>
            </p>
          </>
        ) : (
          <RequestFailed
            error={helper.error}
            onRetry={() => void helper.refetch()}
          />
        ))}
      {/* Mounted once the helper is known: the form copies it into its
          state, and a background refetch must not overwrite what is typed. */}
      {helper.isSuccess && <EditForm helper={helper.data} />}
    </>
  );
}

function EditForm({ helper }: { helper: Helper }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const update = useMutation({
    mutationFn: (input: HelperInput) => updateHelper(helper.id, input),
    onSuccess: async (updated) => {
      queryClient.setQueryData(helperKeys.detail(updated.id), updated);
      // Jobs carry the name of their helper, so what is cached of them is
      // stale as well.
      void queryClient.invalidateQueries({ queryKey: jobKeys.all });
      await queryClient.invalidateQueries({ queryKey: helperKeys.list() });
      void navigate("/helpers");
    },
  });

  return (
    <HelperForm
      helper={helper}
      submitLabel="Save changes"
      cancelTo="/helpers"
      pending={update.isPending}
      error={update.error}
      onSubmit={update.mutate}
    />
  );
}
