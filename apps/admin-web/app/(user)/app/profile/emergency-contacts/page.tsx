import { ShieldAlert } from 'lucide-react';
import type { EmergencyContact } from '@findfam/shared-types';
import { Card, CardContent } from '@/components/ui/card';
import { InlineEmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { userApiGet } from '@/lib/api-client';
import { AddContactForm, RemoveContactButton } from './EmergencyContactActions';

export const metadata = { title: 'Emergency contacts — FindFam' };

/**
 * Contacts must already be FindFam users you mutually follow — the backend
 * enforces that, this page just surfaces it (see docs/00-master-project-
 * reference.md: SMS to non-app contacts is out of scope for the free-tier
 * MVP, so there's no freeform name/phone entry here by design).
 */
export default async function EmergencyContactsPage() {
  const contactsResult = await userApiGet<EmergencyContact[]>('/api/v1/emergency-contacts');

  if (!contactsResult.ok) {
    return (
      <Card variant="glass">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          {contactsResult.reason === 'unauthenticated'
            ? 'Your session has expired. Please sign in again.'
            : 'Unable to load your emergency contacts — the request failed.'}
        </CardContent>
      </Card>
    );
  }

  const contacts = [...contactsResult.data].sort((a, b) => a.priority - b.priority);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Emergency contacts"
        description="Who gets notified when you trigger an SOS, in priority order. They must already be a FindFam user you follow each other with."
      />

      <AddContactForm />

      <Card variant="glass">
        <CardContent className="p-5">
          <h2 className="mb-3 font-medium">
            {contacts.length === 0
              ? 'No contacts yet'
              : contacts.length === 1
                ? '1 contact'
                : `${contacts.length} contacts`}
          </h2>
          {contacts.length === 0 ? (
            <InlineEmptyState
              icon={ShieldAlert}
              body="Add someone above. You need their exact username, and you must already follow each other."
            />
          ) : (
            <ul className="divide-y divide-border">
              {contacts.map((contact) => (
                <li key={contact.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{contact.username}</p>
                    <p className="text-xs text-muted-foreground">
                      Priority {contact.priority}
                      {contact.phone ? ` · ${contact.phone}` : ''}
                    </p>
                  </div>
                  <RemoveContactButton contactId={contact.id} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
