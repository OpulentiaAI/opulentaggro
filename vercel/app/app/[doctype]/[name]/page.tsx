import { Suspense } from "react";
import { notFound } from "next/navigation";
import { FrappeDeskEmbedGate } from "@/components/desk/FrappeDeskEmbedGate";
import { FormView } from "@/components/doctype/FormView";
import { StoActionBar } from "@/components/sto/StoActionBar";
import { DESK_PAGE_SLUGS, getFormFields, resolveDoctypeFromSlug } from "@/lib/doctype";
import { frappeFormUrl } from "@/lib/frappe-desk";
import { getResourceDoc } from "@/lib/erpnext/resource";
import { getStoTrace } from "@/lib/sto/handlers";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ doctype: string; name: string }>;
}) {
  const { name, doctype: slug } = await params;
  return { title: `${name} · ${resolveDoctypeFromSlug(slug)}` };
}

async function DoctypeFormContent({
  doctype,
  name,
}: {
  doctype: string;
  name: string;
}) {
  const fields = getFormFields(doctype);

  try {
    const result = await getResourceDoc<Record<string, unknown>>(doctype, decodeURIComponent(name));

    if (!result.ok) {
      return <FormView doctype={doctype} fields={fields} error={result.error} />;
    }

    const doc = result.data;
    const isInternalPo =
      doctype === "Purchase Order" && Boolean(doc.is_internal_supplier);

    let stoStage: string | undefined;
    if (isInternalPo) {
      const trace = await getStoTrace(name);
      if (!trace.error) stoStage = trace.stage;
    }

    return (
      <FormView doctype={doctype} doc={doc} fields={fields}>
        {isInternalPo && stoStage ? (
          <div className="card" style={{ marginBottom: "1rem" }}>
            <h2>STO Workflow</h2>
            <StoActionBar purchaseOrder={name} stage={stoStage} />
          </div>
        ) : null}
      </FormView>
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load document";
    return <FormView doctype={doctype} fields={fields} error={message} />;
  }
}

export default async function DoctypeFormPage({
  params,
}: {
  params: Promise<{ doctype: string; name: string }>;
}) {
  const { doctype: slug, name } = await params;

  if (DESK_PAGE_SLUGS.has(slug)) {
    notFound();
  }

  const resolvedDoctype = resolveDoctypeFromSlug(slug);

  const decoded = decodeURIComponent(name);

  return (
    <FrappeDeskEmbedGate
      src={frappeFormUrl(resolvedDoctype, decoded)}
      title={`${resolvedDoctype} ${decoded}`}
      fallback={
        <Suspense
          fallback={
            <div className="card">
              <p className="muted">Loading {decoded}…</p>
            </div>
          }
        >
          <DoctypeFormContent doctype={resolvedDoctype} name={name} />
        </Suspense>
      }
    />
  );
}
