"use client";

import {
  useState,
  useTransition,
} from "react";

import {
  deactivateMember,
  reactivateMember,
} from "@/app/panel/personas/actions";

type MemberStatusButtonProps = {
  memberId: string;
  memberName: string;
  active: boolean;
};

export function MemberStatusButton({
  memberId,
  memberName,
  active,
}: MemberStatusButtonProps) {
  const [error, setError] =
    useState<string | null>(null);

  const [pending, startTransition] =
    useTransition();

  function changeStatus() {
    if (active) {
      const confirmed = window.confirm(
        `¿Querés dar de baja a ${memberName}?\n\nSe conservarán sus datos, cuotas y pagos anteriores.`,
      );

      if (!confirmed) {
        return;
      }
    }

    setError(null);

    startTransition(async () => {
      const result = active
        ? await deactivateMember(memberId)
        : await reactivateMember(memberId);

      if (result.error) {
        setError(result.error);
      }
    });
  }

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={changeStatus}
        className={
          active
            ? "rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
            : "rounded-lg border border-green-200 px-4 py-2 text-sm font-semibold text-green-700 transition hover:bg-green-50 disabled:opacity-50"
        }
      >
        {pending
          ? "Procesando..."
          : active
            ? "Dar de baja"
            : "Reactivar"}
      </button>

      {error ? (
        <p className="mt-2 max-w-xs text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}