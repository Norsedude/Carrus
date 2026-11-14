import type { Metadata } from "next";
import { VehicleForm } from "@/components/partner-forms";
import { PageShell, cardCls } from "@/components/ui";
import { requireVerifiedPartner } from "@/lib/auth/partner";
import { KNOWN_LOCATIONS } from "@/server/search/location";
import { VEHICLE_TYPES } from "@/server/search/types";

export const metadata: Metadata = { title: "Add a vehicle" };

export default async function NewVehiclePage() {
  await requireVerifiedPartner("/partner/vehicles/new");
  return (
    <PageShell title="Add a vehicle" intro="Describe one specific vehicle. It becomes public only after an administrator approves it.">
      <div className={`${cardCls} p-5`}>
        <VehicleForm
          initial={{ transmission: "Automatic" }}
          locations={KNOWN_LOCATIONS.map((l) => ({ value: l.id, label: l.label }))}
          types={[...VEHICLE_TYPES]}
        />
      </div>
    </PageShell>
  );
}
