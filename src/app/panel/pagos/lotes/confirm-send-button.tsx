"use client";

type Props = {
  count: number;
};

export function ConfirmPaymentBatchSendButton({
  count,
}: Props) {
  function handleClick(
    event: React.MouseEvent<HTMLButtonElement>,
  ) {
    const confirmed =
      window.confirm(
        `Se enviarán ${count} débito(s) a Pago TIC. Esta acción puede generar cobros reales. ¿Deseás continuar?`,
      );

    if (!confirmed) {
      event.preventDefault();
    }
  }

  return (
    <button
      type="submit"
      onClick={handleClick}
      className="rounded-lg bg-violet-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-700"
    >
      Enviar a Pago TIC
    </button>
  );
}