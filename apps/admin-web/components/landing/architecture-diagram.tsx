import { Database, Server, Radio, Smartphone, LayoutDashboard, Bell, ListChecks } from 'lucide-react';

// A layered view of the system, mirroring the mermaid diagram in
// docs/01-system-architecture.md. Built from grid + borders rather than a fixed
// SVG so it reflows on a phone instead of forcing a horizontal scroll.

interface NodeProps {
  icon: React.ReactNode;
  name: string;
  detail: string;
}

function Node({ icon, name, detail }: NodeProps) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-md border border-border bg-background px-3 py-3 text-center">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-sm font-medium leading-tight">{name}</span>
      <span className="text-xs leading-tight text-muted-foreground">{detail}</span>
    </div>
  );
}

function Layer({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/30 p-3">
      <p className="mb-2.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}

// The connector between layers, carrying the protocol label.
function Connector({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-2" aria-hidden="true">
      <span className="h-4 w-px bg-border" />
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      <span className="h-4 w-px bg-border" />
    </div>
  );
}

export function ArchitectureDiagram() {
  const iconClass = 'h-4 w-4';

  return (
    <div>
      <Layer label="Client apps">
        <div className="grid grid-cols-2 gap-2.5">
          <Node
            icon={<Smartphone className={iconClass} />}
            name="Flutter app"
            detail="Android — the family surface"
          />
          <Node
            icon={<LayoutDashboard className={iconClass} />}
            name="Next.js admin"
            detail="Moderation dashboard"
          />
        </div>
      </Layer>

      <Connector label="HTTPS for requests · WSS for everything live" />

      <Layer label="Backend — one Fastify process">
        <div className="grid gap-2.5 sm:grid-cols-3">
          <Node
            icon={<Server className={iconClass} />}
            name="REST API"
            detail="43 routes, 9 modules"
          />
          <Node
            icon={<Radio className={iconClass} />}
            name="WebSocket gateway"
            detail="Location, chat, SOS"
          />
          <Node
            icon={<ListChecks className={iconClass} />}
            name="BullMQ worker"
            detail="SOS delivery, retried"
          />
        </div>
      </Layer>

      <Connector label="Writes and reads · Pub/Sub fan-out · Job queue" />

      <Layer label="Data">
        <div className="grid grid-cols-2 gap-2.5">
          <Node
            icon={<Database className={iconClass} />}
            name="PostgreSQL + PostGIS"
            detail="Source of truth, spatial queries"
          />
          <Node
            icon={<Database className={iconClass} />}
            name="Redis"
            detail="Pub/Sub backplane + queue"
          />
        </div>
      </Layer>

      <Connector label="Outbound only" />

      <Layer label="External">
        <div className="grid grid-cols-2 gap-2.5">
          <Node
            icon={<Bell className={iconClass} />}
            name="Firebase Cloud Messaging"
            detail="Push to emergency contacts"
          />
          <Node
            icon={<Bell className={iconClass} />}
            name="Sentry"
            detail="Errors from all three apps"
          />
        </div>
      </Layer>
    </div>
  );
}
