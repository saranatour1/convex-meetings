import schema from "../convex/schema";

type FieldType = { type: string; tableName?: string; value?: unknown };

type Field = { fieldType: FieldType; optional: boolean };

type ExportedTable = {
  tableName: string;
  indexes: { indexDescriptor: string; fields: string[] }[];
  documentType: { type: "object"; value: Record<string, Field> };
};

const referencedTables = (fieldType: FieldType): string[] => {
  if (fieldType.type === "id" && fieldType.tableName) return [fieldType.tableName];
  if (fieldType.type === "union") return (fieldType.value as FieldType[]).flatMap(referencedTables);
  return [];
};

const typeName = (fieldType: FieldType) => {
  if (fieldType.type === "id") return "id";
  if (fieldType.type === "union") {
    const options = fieldType.value as FieldType[];
    return options.every((option) => option.type === "literal") ? "enum" : "union";
  }
  return fieldType.type;
};

const attribute = (name: string, { fieldType, optional }: Field) => {
  const references = referencedTables(fieldType);
  const key = references.length > 0 ? " FK" : "";
  const notes = [...references, ...(optional ? ["optional"] : [])].join(", ");
  return `    ${typeName(fieldType)} ${name}${key}${notes ? ` "${notes}"` : ""}`;
};

const relationships = ({ tableName, documentType }: ExportedTable) =>
  Object.entries(documentType.value).flatMap(([name, field]) =>
    referencedTables(field.fieldType).map(
      (target) => `  ${tableName} }o--${field.optional ? "o|" : "||"} ${target} : ${name}`,
    ),
  );

export const renderSchemaDiagram = () => {
  const exported = (schema as unknown as { export: () => string }).export();
  const tables = (JSON.parse(exported) as { tables: ExportedTable[] }).tables;
  const entities = tables.map(({ tableName, documentType }) =>
    [
      `  ${tableName} {`,
      `    id _id PK`,
      ...Object.entries(documentType.value).map(([name, field]) => attribute(name, field)),
      `  }`,
    ].join("\n"),
  );
  const indexRows = tables.flatMap(({ tableName, indexes }) =>
    indexes.map(
      ({ indexDescriptor, fields }) =>
        `| ${tableName} | ${indexDescriptor} | ${fields.join(", ")} |`,
    ),
  );
  return [
    "# Schema",
    "",
    "Generated from `packages/backend/convex/schema.ts` by `tools/schema-diagram.ts`. Update it with `pnpm --filter @meetings/backend test -u`.",
    "",
    "```mermaid",
    "erDiagram",
    ...entities,
    ...tables.flatMap(relationships),
    "```",
    "",
    "## Indexes",
    "",
    "| Table | Index | Fields |",
    "| --- | --- | --- |",
    ...indexRows,
    "",
  ].join("\n");
};
