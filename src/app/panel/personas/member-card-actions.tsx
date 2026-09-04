"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
    reissueMemberCardCredential,
    revokeMemberCardCredential,
} from "@/app/panel/personas/actions";

type MemberCardActionsProps = {
  memberId: string;
  hasActiveCredential: boolean;
};

export function MemberCardActions({
  memberId,
  hasActiveCredential,
}: MemberCardActionsProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function runAction(
    action: () => Promise<{
      error: string | null;
      success: string | null;
    }>,
    confirmationMessage: string,
  ) {
    if (!window.confirm(confirmationMessage)) {
      return;
    }

    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const result = await action();

      if (result.error) {
        setError(result.error);
        return;
      }

      setSuccess(result.success);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          runAction(
            () => reissueMemberCardCredential(memberId),
            hasActiveCredential
              ? "¿Reemitir este carnet? El QR actual dejará de funcionar y se generará uno nuevo."
              : "¿Emitir un nuevo carnet digital para este socio?",
          )
        }
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending
          ? "Procesando..."
          : hasActiveCredential
            ? "Reemitir carnet"
            : "Emitir nuevo carnet"}
      </button>

      {hasActiveCredential ? (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            runAction(
              () => revokeMemberCardCredential(memberId),
              "¿Revocar este carnet? El QR actual dejará de funcionar.",
            )
          }
          className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Revocar carnet
        </button>
      ) : null}

      {success ? (
        <p className="basis-full text-sm font-medium text-green-700">
          {success}
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="basis-full text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
