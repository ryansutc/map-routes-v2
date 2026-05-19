import { useUnits } from "@/hooks/useUnits";
import { useState } from "react";
import {
  Box,
  Step,
  StepLabel,
  Stepper,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import RouteMetadataStep from "./RouteMetadataStep";
import PhotoUploadStep from "./PhotoUploadStep";
import type { ParseGpxResponse } from "@/types/api";

export type ActivityType =
  | "Hiking"
  | "Running"
  | "Cycling"
  | "Backpacking"
  | "Skiing"
  | "Other";

export type WizardState = {
  parsed: ParseGpxResponse | null;
  title: string;
  activityType: ActivityType | "";
  isPublic: boolean;
  notes: string;
};

const STEPS = ["Route Details", "Photos & Publish"];

export default function CreateRouteWizard() {
  const { units, setUnits } = useUnits();
  const [step, setStep] = useState<0 | 1>(0);
  const [wizardState, setWizardState] = useState<WizardState>({
    parsed: null,
    title: "",
    activityType: "",
    isPublic: true,
    notes: "",
  });

  const handleNext = (updates: Partial<WizardState>) => {
    setWizardState((prev) => ({ ...prev, ...updates }));
    setStep(1);
  };

  const handleBack = () => setStep(0);

  const maxWidth = step === 1 ? 1100 : 800;

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth, mx: "auto" }}>
      <Box sx={{ display: "flex", alignItems: "center", mb: 3, gap: 2 }}>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          Create Route
        </Typography>
        <ToggleButtonGroup
          value={units}
          exclusive
          onChange={(_, v) => { if (v) setUnits(v); }}
          size="small"
        >
          <ToggleButton value="metric">km</ToggleButton>
          <ToggleButton value="imperial">mi</ToggleButton>
        </ToggleButtonGroup>
      </Box>
      <Stepper activeStep={step} sx={{ mb: 4 }}>
        {STEPS.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {step === 0 && (
        <RouteMetadataStep
          wizardState={wizardState}
          onNext={handleNext}
        />
      )}
      {step === 1 && (
        <PhotoUploadStep wizardState={wizardState} onBack={handleBack} />
      )}
    </Box>
  );
}
