"use client";

import { ContactActions } from "@/components/app/contact-actions";
import { RowActions } from "@/components/app/row-actions";
import type { FormAction } from "@/components/app/form";
import type { Option } from "@/features/common/lookups";
import { deleteLead } from "../actions";
import { LeadFields } from "./lead-form";
import type { LeadRow } from "../queries";

export function LeadRowActions({ lead, staff, update, canDelete }: { lead: LeadRow; staff: Option[]; update: FormAction; canDelete: boolean }) {
  return (
    <RowActions
      editTitle={`Edit ${lead.code}`}
      edit={update}
      editForm={<LeadFields staff={staff} lead={lead} />}
      deleteTitle={`Delete ${lead.company_name}?`}
      deleteDescription="The lead and its follow-up history will be permanently removed. This cannot be undone."
      onDelete={canDelete ? () => deleteLead(lead.id) : undefined}
    >
      <ContactActions phone={lead.phone} email={lead.email} name={lead.contact_person ?? lead.company_name} className="lg:hidden" />
    </RowActions>
  );
}
