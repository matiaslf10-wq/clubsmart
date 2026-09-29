"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  approveMemberLinkRequest,
  rejectMemberLinkRequest,
} from "@/app/panel/personas/solicitudes/actions";

type RequestActionsProps = {
  requestId: string;
  canApprove: boolean;
  approveLabel: string;
  confirmMessage: string;
};

export function RequestActions({
  requestId,
  canApprove,
  approveLabel,
  confirmMessage,
}: RequestActionsProps) {
  const router = useRouter();

  const [pending, startTransition] =
    useTransition();

  const [error, setError] =
    useState<string | null>(null);

  function approve() {
    if (!canApprove) {
      return;
    }

    const confirmed = window.confirm(
      confirmMessage,
    );

    if (!confirmed) {
      return;
    }

    setError(null);

    startTransition(async () => {
      const result =
        await approveMemberLinkRequest(
          requestId,
        );

      if (result.error) {
        setError(result.error);
        return;
      }

      router.refresh();
    });
  }

  function reject() {
    const confirmed = window.confirm(
      "\u00BFConfirm\u00E1s rechazar esta solicitud de v\u00EDnculo?",
    );

    if (!confirmed) {
      return;
    }

    setError(null);

    startTransition(async () => {
      const result =
        await rejectMemberLinkRequest(
          requestId,
        );

      if (result.error) {
        setError(result.error);
        return;
      }

      router.refresh();
    });
  }

  return (
    <div className="mt-5">
      <div className="flex flex-wrap gap-3">
        {canApprove ? (
          <button
            type="button"
            disabled={pending}
            onClick={approve}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending
              ? "Procesando..."
              : approveLabel}
          </button>
        ) : null}

        <button
          type="button"
          disabled={pending}
          onClick={reject}
          className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending
            ? "Procesando..."
            : "Rechazar"}
        </button>
      </div>

      {error ? (
        <p className="mt-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
