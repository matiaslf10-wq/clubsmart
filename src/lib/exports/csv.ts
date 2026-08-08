type CsvValue =
  | string
  | number
  | boolean
  | null
  | undefined;

export type CsvRow = Record<
  string,
  CsvValue
>;

function escapeCsvValue(
  value: CsvValue,
) {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  const stringValue =
    String(value);

  /*
   * Usamos ; como separador porque
   * suele abrir correctamente en
   * Excel con configuración regional
   * argentina.
   */
  if (
    stringValue.includes(";") ||
    stringValue.includes('"') ||
    stringValue.includes("\n") ||
    stringValue.includes("\r")
  ) {
    return `"${stringValue.replace(
      /"/g,
      '""',
    )}"`;
  }

  return stringValue;
}

export function createCsv(
  rows: CsvRow[],
) {
  if (rows.length === 0) {
    return "\uFEFF";
  }

  const headers =
    Object.keys(rows[0]);

  const lines = [
    headers
      .map(escapeCsvValue)
      .join(";"),

    ...rows.map((row) =>
      headers
        .map((header) =>
          escapeCsvValue(
            row[header],
          ),
        )
        .join(";"),
    ),
  ];

  /*
   * BOM UTF-8 para que Excel
   * reconozca correctamente tildes,
   * ñ, etc.
   */
  return (
    "\uFEFF" +
    lines.join("\r\n")
  );
}

export function csvResponse(
  filename: string,
  rows: CsvRow[],
) {
  const csv =
    createCsv(rows);

  return new Response(csv, {
    status: 200,

    headers: {
      "Content-Type":
        "text/csv; charset=utf-8",

      "Content-Disposition":
        `attachment; filename="${filename}"`,

      "Cache-Control":
        "no-store",
    },
  });
}