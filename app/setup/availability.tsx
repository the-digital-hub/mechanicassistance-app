import { AvailabilityForm } from "@/components/availability/AvailabilityForm";
import {
  baseLocationFromSetupAddress,
  type AvailabilityValue,
  type BaseLocation,
} from "@/components/availability/availabilityUtils";
import { getSetupProgress, saveSetupProgress } from "@/lib/storage";
import { SetupBadge } from "@/components/setup/SetupKit";
import { SetupBaseSheet, type SetupAddressProgress } from "@/components/setup/SetupBaseSheet";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

// ── Screen ─────────────────────────────────────────────────────────────────
export default function AvailabilityScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [baseLocation, setBaseLocation] = useState<BaseLocation | null>(null);
  const [setupAddress, setSetupAddress] = useState<SetupAddressProgress | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // The mechanic's own address is the centre of the service area — the form's
  // placeholder is only for a wizard that skipped the address step.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const progress = await getSetupProgress();
      const address = progress.address;
      if (!address) return;

      if (!cancelled) setSetupAddress(address);
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

  // Picking one of the addresses of the previous step makes it the base: the choice is saved on that step's entry (its `type`).
  const pickBase = async (type: "home" | "work" | "other") => {
    if (!setupAddress) return;
    const next = { ...setupAddress, type };
    await saveSetupProgress("address", next);
    setSetupAddress(next);
    const resolved = baseLocationFromSetupAddress(next);
    if (resolved) setBaseLocation(resolved);
    setSheetOpen(false);
  };

  return (
    <>
    <AvailabilityForm
      baseLocation={baseLocation}
      onEditLocation={() => setSheetOpen(true)}
      submitLabel={t("setup.availability.saveChanges")}
      onSubmit={handleSubmit}
      header={<SetupBadge screen="availability" label={t("setup.availability.badge")} />}
      fixedFooter
      secondaryLabel={t("setup.skip")}
      onSecondary={() => router.push("/setup/legal-documents")}
    />
    <SetupBaseSheet visible={sheetOpen} address={setupAddress} onPick={pickBase} onEdit={() => router.push("/setup/address")} onClose={() => setSheetOpen(false)} />
    </>
  );
}
