import { AvailabilityForm } from "@/components/availability/AvailabilityForm";
import {
  baseLocationFromSetupAddress,
  type AvailabilityValue,
  type BaseLocation,
} from "@/components/availability/availabilityUtils";
import { getSetupProgress, saveSetupProgress } from "@/lib/storage";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

// ── Screen ─────────────────────────────────────────────────────────────────
export default function AvailabilityScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [baseLocation, setBaseLocation] = useState<BaseLocation | null>(null);

  // The mechanic's own address is the centre of the service area — the form's
  // placeholder is only for a wizard that skipped the address step.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const progress = await getSetupProgress();
      const address = progress.address;
      if (!address) return;

      const resolved = baseLocationFromSetupAddress(address);
      if (resolved && !cancelled) setBaseLocation(resolved);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (value: AvailabilityValue) => {
    await saveSetupProgress("availability", value);
    router.push("/setup/legal-documents");
  };

  return (
    <AvailabilityForm
      baseLocation={baseLocation}
      onEditLocation={() => router.push("/setup/address")}
      submitLabel={t("setup.availability.saveChanges")}
      onSubmit={handleSubmit}
    />
  );
}
