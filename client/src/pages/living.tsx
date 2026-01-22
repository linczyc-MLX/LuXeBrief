import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { livingSteps, type Session, type LivingResponse, type LivingStepData } from "@shared/schema";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Loader2,
  Briefcase,
  Palette,
  Users,
  Heart,
  Home,
  Trees,
  Settings,
} from "lucide-react";

// Map step icon names to components
const iconMap: Record<string, React.ElementType> = {
  Briefcase,
  Palette,
  Users,
  Heart,
  Home,
  Trees,
  Settings,
};

interface SessionWithLivingResponses extends Session {
  livingResponses?: LivingResponse[];
}

// ===== STEP COMPONENTS =====

interface StepProps {
  data: Record<string, any>;
  onChange: (field: string, value: any) => void;
}

// Step 1: Work & Productivity
function WorkStep({ data, onChange }: StepProps) {
  const wfhOptions = [
    { value: "never", label: "Never" },
    { value: "sometimes", label: "Sometimes (1-2 days/week)" },
    { value: "often", label: "Often (3-4 days/week)" },
    { value: "always", label: "Always (Full Remote)" },
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <label className="block text-sm font-semibold text-gray-700">
          Work From Home Frequency
        </label>
        <div className="grid grid-cols-2 gap-3">
          {wfhOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onChange("workFromHome", opt.value)}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                data.workFromHome === opt.value
                  ? "border-[#1a365d] bg-blue-50 text-[#1a365d]"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {data.workFromHome && data.workFromHome !== "never" && (
        <>
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-gray-700">
              Number of People Working From Home
            </label>
            <input
              type="number"
              min={1}
              max={10}
              value={data.wfhPeopleCount || ""}
              onChange={(e) => onChange("wfhPeopleCount", parseInt(e.target.value) || null)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:border-[#1a365d] focus:ring-1 focus:ring-[#1a365d] outline-none"
              placeholder="How many people need home office space?"
            />
          </div>

          {data.wfhPeopleCount >= 2 && (
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-gray-700">
                Separate Offices Required?
              </label>
              <p className="text-sm text-gray-500">
                Do you need separate, private office spaces for each person?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => onChange("separateOfficesRequired", true)}
                  className={`flex-1 p-3 rounded-lg border-2 transition-all ${
                    data.separateOfficesRequired === true
                      ? "border-[#1a365d] bg-blue-50 text-[#1a365d]"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  Yes, separate offices
                </button>
                <button
                  onClick={() => onChange("separateOfficesRequired", false)}
                  className={`flex-1 p-3 rounded-lg border-2 transition-all ${
                    data.separateOfficesRequired === false
                      ? "border-[#1a365d] bg-blue-50 text-[#1a365d]"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  No, can share space
                </button>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <label className="block text-sm font-semibold text-gray-700">
              Office Requirements
            </label>
            <textarea
              value={data.officeRequirements || ""}
              onChange={(e) => onChange("officeRequirements", e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:border-[#1a365d] focus:ring-1 focus:ring-[#1a365d] outline-none resize-none"
              rows={3}
              placeholder="Any specific requirements? Video calls, client meetings, specialized equipment..."
            />
          </div>
        </>
      )}
    </div>
  );
}

// Step 2: Hobbies & Activities
function HobbiesStep({ data, onChange }: StepProps) {
  const hobbyOptions = [
    { value: "art", label: "Art/Painting" },
    { value: "music", label: "Music/Instruments" },
    { value: "fitness", label: "Fitness/Home Gym" },
    { value: "yoga", label: "Yoga/Meditation" },
    { value: "cooking", label: "Cooking/Culinary" },
    { value: "wine", label: "Wine Collection" },
    { value: "cars", label: "Car Collection" },
    { value: "gardening", label: "Gardening" },
    { value: "reading", label: "Reading/Library" },
    { value: "gaming", label: "Gaming/Media" },
    { value: "spa", label: "Spa/Wellness" },
    { value: "crafts", label: "Crafts/Making" },
  ];

  const toggleHobby = (value: string) => {
    const current = data.hobbies || [];
    const updated = current.includes(value)
      ? current.filter((h: string) => h !== value)
      : [...current, value];
    onChange("hobbies", updated);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <label className="block text-sm font-semibold text-gray-700">
          Space-Requiring Hobbies
        </label>
        <p className="text-sm text-gray-500">
          Select hobbies that need dedicated space in your home
        </p>
        <div className="flex flex-wrap gap-2">
          {hobbyOptions.map((hobby) => (
            <button
              key={hobby.value}
              onClick={() => toggleHobby(hobby.value)}
              className={`px-4 py-2 rounded-lg border transition-all ${
                (data.hobbies || []).includes(hobby.value)
                  ? "border-[#1a365d] bg-blue-50 text-[#1a365d]"
                  : "border-gray-300 hover:border-gray-400"
              }`}
            >
              {hobby.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <label className="block text-sm font-semibold text-gray-700">
          Hobby Details
        </label>
        <textarea
          value={data.hobbyDetails || ""}
          onChange={(e) => onChange("hobbyDetails", e.target.value)}
          className="w-full p-3 border border-gray-300 rounded-lg focus:border-[#1a365d] focus:ring-1 focus:ring-[#1a365d] outline-none resize-none"
          rows={3}
          placeholder="Specific equipment needs, space requirements, or details about your hobbies..."
        />
      </div>

      <div className="space-y-3">
        <label className="block text-sm font-semibold text-gray-700">
          Late Night Media Use?
        </label>
        <p className="text-sm text-gray-500">
          Do you watch movies or game late at night when others are sleeping? (Affects acoustic planning)
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => onChange("lateNightMediaUse", true)}
            className={`flex-1 p-3 rounded-lg border-2 transition-all ${
              data.lateNightMediaUse === true
                ? "border-[#1a365d] bg-blue-50 text-[#1a365d]"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            Yes
          </button>
          <button
            onClick={() => onChange("lateNightMediaUse", false)}
            className={`flex-1 p-3 rounded-lg border-2 transition-all ${
              data.lateNightMediaUse === false
                ? "border-[#1a365d] bg-blue-50 text-[#1a365d]"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            No
          </button>
        </div>
      </div>
    </div>
  );
}

// Step 3: Entertaining
function EntertainingStep({ data, onChange }: StepProps) {
  const frequencyOptions = [
    { value: "rarely", label: "Rarely (Few times/year)" },
    { value: "monthly", label: "Monthly" },
    { value: "weekly", label: "Weekly" },
    { value: "daily", label: "Daily/Constantly" },
  ];

  const styleOptions = [
    { value: "formal", label: "Formal (Seated dinners)" },
    { value: "casual", label: "Casual (Relaxed gatherings)" },
    { value: "both", label: "Both Formal & Casual" },
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <label className="block text-sm font-semibold text-gray-700">
          Entertaining Frequency
        </label>
        <div className="grid grid-cols-2 gap-3">
          {frequencyOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onChange("entertainingFrequency", opt.value)}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                data.entertainingFrequency === opt.value
                  ? "border-[#1a365d] bg-blue-50 text-[#1a365d]"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <label className="block text-sm font-semibold text-gray-700">
          Entertaining Style
        </label>
        <div className="grid grid-cols-3 gap-3">
          {styleOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onChange("entertainingStyle", opt.value)}
              className={`p-4 rounded-lg border-2 text-center transition-all ${
                data.entertainingStyle === opt.value
                  ? "border-[#1a365d] bg-blue-50 text-[#1a365d]"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <label className="block text-sm font-semibold text-gray-700">
          Typical Guest Count
        </label>
        <input
          type="text"
          value={data.typicalGuestCount || ""}
          onChange={(e) => onChange("typicalGuestCount", e.target.value)}
          className="w-full p-3 border border-gray-300 rounded-lg focus:border-[#1a365d] focus:ring-1 focus:ring-[#1a365d] outline-none"
          placeholder="e.g., 8-12 for dinners, 50-100 for parties"
        />
      </div>
    </div>
  );
}

// Step 4: Wellness & Privacy
function WellnessStep({ data, onChange }: StepProps) {
  const wellnessOptions = [
    { value: "gym", label: "Home Gym" },
    { value: "pool", label: "Pool" },
    { value: "spa", label: "Spa/Sauna" },
    { value: "yoga", label: "Yoga Studio" },
    { value: "massage", label: "Massage Room" },
    { value: "meditation", label: "Meditation Space" },
    { value: "cold-plunge", label: "Cold Plunge" },
  ];

  const toggleWellness = (value: string) => {
    const current = data.wellnessPriorities || [];
    const updated = current.includes(value)
      ? current.filter((w: string) => w !== value)
      : [...current, value];
    onChange("wellnessPriorities", updated);
  };

  const SliderField = ({
    label,
    field,
    leftLabel,
    rightLabel,
  }: {
    label: string;
    field: string;
    leftLabel: string;
    rightLabel: string;
  }) => (
    <div className="space-y-3">
      <label className="block text-sm font-semibold text-gray-700">{label}</label>
      <div className="flex items-center gap-4">
        <span className="text-xs text-gray-500 w-24">{leftLabel}</span>
        <input
          type="range"
          min={1}
          max={5}
          value={data[field] || 3}
          onChange={(e) => onChange(field, parseInt(e.target.value))}
          className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#1a365d]"
        />
        <span className="text-xs text-gray-500 w-24 text-right">{rightLabel}</span>
      </div>
      <div className="flex justify-between px-12">
        {[1, 2, 3, 4, 5].map((n) => (
          <span
            key={n}
            className={`text-xs ${data[field] === n ? "text-[#1a365d] font-semibold" : "text-gray-400"}`}
          >
            {n}
          </span>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <label className="block text-sm font-semibold text-gray-700">
          Wellness Priorities
        </label>
        <div className="flex flex-wrap gap-2">
          {wellnessOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => toggleWellness(opt.value)}
              className={`px-4 py-2 rounded-lg border transition-all ${
                (data.wellnessPriorities || []).includes(opt.value)
                  ? "border-[#1a365d] bg-blue-50 text-[#1a365d]"
                  : "border-gray-300 hover:border-gray-400"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <SliderField
        label="Privacy Level Required"
        field="privacyLevelRequired"
        leftLabel="Open/Social"
        rightLabel="Maximum Privacy"
      />

      <SliderField
        label="Noise Sensitivity"
        field="noiseSensitivity"
        leftLabel="Tolerant"
        rightLabel="Very Sensitive"
      />

      <SliderField
        label="Indoor-Outdoor Living"
        field="indoorOutdoorLiving"
        leftLabel="Indoor Focused"
        rightLabel="Seamless Integration"
      />
    </div>
  );
}

// Step 5: Interior Spaces
function InteriorStep({ data, onChange }: StepProps) {
  const interiorOptions = [
    { value: "primary-suite", label: "Primary Suite" },
    { value: "secondary-suites", label: "Guest Suites" },
    { value: "kids-bedrooms", label: "Children's Bedrooms" },
    { value: "great-room", label: "Great Room/Living" },
    { value: "formal-living", label: "Formal Living Room" },
    { value: "family-room", label: "Family Room" },
    { value: "formal-dining", label: "Formal Dining" },
    { value: "casual-dining", label: "Casual Dining/Breakfast" },
    { value: "chef-kitchen", label: "Chef's Kitchen" },
    { value: "catering-kitchen", label: "Catering Kitchen" },
    { value: "home-office", label: "Home Office" },
    { value: "library", label: "Library" },
    { value: "media-room", label: "Media Room/Theater" },
    { value: "game-room", label: "Game Room" },
    { value: "wine-cellar", label: "Wine Cellar" },
    { value: "gym", label: "Home Gym" },
    { value: "spa-wellness", label: "Spa/Wellness Suite" },
    { value: "pool-indoor", label: "Indoor Pool" },
    { value: "sauna", label: "Sauna" },
    { value: "steam-room", label: "Steam Room" },
    { value: "staff-quarters", label: "Staff Quarters" },
    { value: "mudroom", label: "Mudroom" },
    { value: "laundry", label: "Laundry Room" },
    { value: "art-gallery", label: "Art Gallery" },
    { value: "music-room", label: "Music Room" },
    { value: "safe-room", label: "Safe Room/Panic Room" },
  ];

  const toggleSpace = (field: string, value: string) => {
    const current = data[field] || [];
    const updated = current.includes(value)
      ? current.filter((s: string) => s !== value)
      : [...current, value];
    onChange(field, updated);
  };

  const mustHave = data.mustHaveSpaces || [];

  return (
    <div className="space-y-8">
      {/* Must Have */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-1 h-5 bg-[#c9a962] rounded" />
          <label className="text-sm font-semibold text-[#1a365d] uppercase tracking-wide">
            Must Have
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          {interiorOptions.map((space) => (
            <button
              key={space.value}
              onClick={() => toggleSpace("mustHaveSpaces", space.value)}
              className={`px-4 py-2 rounded-lg border transition-all ${
                mustHave.includes(space.value)
                  ? "border-[#1a365d] bg-blue-50 text-[#1a365d]"
                  : "border-gray-300 hover:border-gray-400"
              }`}
            >
              {space.label}
            </button>
          ))}
        </div>
      </div>

      {/* Would Like */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-1 h-5 bg-[#c9a962] rounded" />
          <label className="text-sm font-semibold text-[#1a365d] uppercase tracking-wide">
            Would Like (if desired total sq footage and budget allows)
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          {interiorOptions.map((space) => (
            <button
              key={space.value}
              onClick={() => !mustHave.includes(space.value) && toggleSpace("niceToHaveSpaces", space.value)}
              disabled={mustHave.includes(space.value)}
              className={`px-4 py-2 rounded-lg border transition-all ${
                mustHave.includes(space.value)
                  ? "border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed opacity-40"
                  : (data.niceToHaveSpaces || []).includes(space.value)
                  ? "border-[#c9a227] bg-[#fef9e7] text-[#8b6914]"
                  : "border-gray-300 hover:border-gray-400"
              }`}
            >
              {space.label}
            </button>
          ))}
        </div>
      </div>

      {/* Clarifications */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-1 h-5 bg-[#c9a962] rounded" />
          <label className="text-sm font-semibold text-[#1a365d] uppercase tracking-wide">
            Space Clarifications
          </label>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[
            { field: "wantsSeparateFamilyRoom", label: "Separate Family Room?" },
            { field: "wantsSecondFormalLiving", label: "Second Formal Living?" },
            { field: "wantsBar", label: "Built-in Bar?" },
            { field: "wantsBunkRoom", label: "Kids Bunk Room?" },
            { field: "wantsBreakfastNook", label: "Breakfast Nook?" },
          ].map(({ field, label }) => (
            <div key={field} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="text-sm font-medium text-gray-700 mb-3">{label}</div>
              <div className="flex gap-2">
                <button
                  onClick={() => onChange(field, true)}
                  className={`flex-1 py-2 rounded-md border transition-all text-sm ${
                    data[field] === true
                      ? "border-[#1a365d] bg-[#1a365d] text-white"
                      : "border-gray-300 hover:border-gray-400"
                  }`}
                >
                  Yes
                </button>
                <button
                  onClick={() => onChange(field, false)}
                  className={`flex-1 py-2 rounded-md border transition-all text-sm ${
                    data[field] === false
                      ? "border-[#1a365d] bg-[#1a365d] text-white"
                      : "border-gray-300 hover:border-gray-400"
                  }`}
                >
                  No
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Step 6: Exterior Amenities
function ExteriorStep({ data, onChange }: StepProps) {
  const poolWaterOptions = [
    { value: "swimming-pool", label: "Swimming Pool" },
    { value: "pool-house", label: "Pool House/Cabana" },
    { value: "spa-hot-tub", label: "Spa/Hot Tub" },
    { value: "reflecting-pool", label: "Reflecting Pool" },
    { value: "water-feature", label: "Fountain/Water Feature" },
    { value: "koi-pond", label: "Koi Pond" },
  ];

  const sportOptions = [
    { value: "tennis-court", label: "Tennis Court" },
    { value: "pickleball-court", label: "Pickleball Court" },
    { value: "basketball-full", label: "Basketball (Full)" },
    { value: "basketball-half", label: "Basketball (Half)" },
    { value: "sport-court", label: "Multi-Sport Court" },
    { value: "putting-green", label: "Putting Green" },
    { value: "bocce-court", label: "Bocce Court" },
    { value: "playground", label: "Play Area" },
  ];

  const outdoorLivingOptions = [
    { value: "outdoor-kitchen", label: "Summer Kitchen" },
    { value: "covered-outdoor", label: "Covered Living" },
    { value: "fire-pit", label: "Fire Pit" },
    { value: "outdoor-fireplace", label: "Outdoor Fireplace" },
    { value: "event-lawn", label: "Event Lawn" },
    { value: "pergola-pavilion", label: "Pergola/Pavilion" },
    { value: "outdoor-dining", label: "Dining Terrace" },
    { value: "bar-lounge", label: "Outdoor Bar/Lounge" },
  ];

  const toggleOption = (mustField: string, wouldField: string, value: string, isMust: boolean) => {
    const targetField = isMust ? mustField : wouldField;
    const otherField = isMust ? wouldField : mustField;
    const current = data[targetField] || [];
    const other = data[otherField] || [];

    // If it's in the other list, don't allow
    if (!isMust && other.includes(value)) return;

    // Toggle in target list
    const updated = current.includes(value)
      ? current.filter((v: string) => v !== value)
      : [...current, value];
    onChange(targetField, updated);

    // If moving to must, remove from would
    if (isMust && (data[wouldField] || []).includes(value)) {
      onChange(wouldField, (data[wouldField] || []).filter((v: string) => v !== value));
    }
  };

  const ExteriorCategory = ({
    title,
    options,
    mustField,
    wouldField,
  }: {
    title: string;
    options: { value: string; label: string }[];
    mustField: string;
    wouldField: string;
  }) => {
    const mustHave = data[mustField] || [];
    const wouldLike = data[wouldField] || [];

    return (
      <div className="space-y-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <h4 className="font-semibold text-gray-700">{title}</h4>
        <div className="space-y-3">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Must Have</div>
          <div className="flex flex-wrap gap-2">
            {options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => toggleOption(mustField, wouldField, opt.value, true)}
                className={`px-3 py-1.5 rounded-md border text-sm transition-all ${
                  mustHave.includes(opt.value)
                    ? "border-[#1a365d] bg-blue-50 text-[#1a365d]"
                    : "border-gray-300 hover:border-gray-400"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Would Like</div>
          <div className="flex flex-wrap gap-2">
            {options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => toggleOption(mustField, wouldField, opt.value, false)}
                disabled={mustHave.includes(opt.value)}
                className={`px-3 py-1.5 rounded-md border text-sm transition-all ${
                  mustHave.includes(opt.value)
                    ? "border-gray-200 text-gray-400 cursor-not-allowed opacity-40"
                    : wouldLike.includes(opt.value)
                    ? "border-[#c9a227] bg-[#fef9e7] text-[#8b6914]"
                    : "border-gray-300 hover:border-gray-400"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const ancillaryOptions = [
    { value: "guest-house", label: "Guest House" },
    { value: "adu", label: "ADU/In-Law Suite" },
    { value: "caretaker-cottage", label: "Caretaker's Cottage" },
    { value: "staff-quarters", label: "Staff Quarters" },
    { value: "workshop-studio", label: "Workshop/Studio" },
    { value: "greenhouse", label: "Greenhouse" },
  ];

  const arrivalOptions = [
    { value: "motor-court", label: "Motor Court" },
    { value: "porte-cochere", label: "Porte-Cochère" },
    { value: "security-gate", label: "Security Gate" },
    { value: "guardhouse", label: "Guardhouse" },
    { value: "circular-drive", label: "Circular Drive" },
    { value: "separate-service", label: "Separate Service Entry" },
  ];

  const privacyOptions = [
    { value: "perimeter-wall", label: "Perimeter Wall" },
    { value: "hedging-screening", label: "Hedging/Screening" },
    { value: "berming", label: "Berming/Landforms" },
    { value: "tree-buffer", label: "Tree Buffer" },
    { value: "water-buffer", label: "Water Feature Buffer" },
  ];

  const gardenOptions = [
    { value: "formal-gardens", label: "Formal Gardens" },
    { value: "cutting-garden", label: "Cutting Garden" },
    { value: "orchard", label: "Orchard" },
    { value: "vegetable-garden", label: "Vegetable Garden" },
    { value: "meditation-garden", label: "Meditation Garden" },
    { value: "zen-garden", label: "Zen/Japanese Garden" },
    { value: "native-plantings", label: "Native Plantings" },
  ];

  return (
    <div className="space-y-6">
      <ExteriorCategory
        title="Pools & Water Features"
        options={poolWaterOptions}
        mustField="mustHavePoolWater"
        wouldField="wouldLikePoolWater"
      />
      <ExteriorCategory
        title="Sport & Recreation"
        options={sportOptions}
        mustField="mustHaveSport"
        wouldField="wouldLikeSport"
      />
      <ExteriorCategory
        title="Outdoor Living & Entertaining"
        options={outdoorLivingOptions}
        mustField="mustHaveOutdoorLiving"
        wouldField="wouldLikeOutdoorLiving"
      />
      <ExteriorCategory
        title="Ancillary Structures"
        options={ancillaryOptions}
        mustField="mustHaveStructures"
        wouldField="wouldLikeStructures"
      />
      <ExteriorCategory
        title="Arrival & Access"
        options={arrivalOptions}
        mustField="mustHaveAccess"
        wouldField="wouldLikeAccess"
      />
      <ExteriorCategory
        title="Privacy & Grounds"
        options={privacyOptions}
        mustField="mustHavePrivacy"
        wouldField="wouldLikePrivacy"
      />
      <ExteriorCategory
        title="Gardens & Landscape"
        options={gardenOptions}
        mustField="mustHaveGarden"
        wouldField="wouldLikeGarden"
      />
    </div>
  );
}

// Step 7: Final Details
function FinalStep({ data, onChange }: StepProps) {
  const garageOptions = [
    { value: "2-car", label: "2-Car" },
    { value: "4-car", label: "4-Car" },
    { value: "6-car", label: "6-Car" },
    { value: "8-car", label: "8-Car" },
    { value: "10-car", label: "10-Car" },
    { value: "12-plus", label: "12+ Car Gallery" },
  ];

  const garageFeatureOptions = [
    { value: "climate-controlled", label: "Climate Controlled" },
    { value: "car-lift", label: "Car Lift(s)" },
    { value: "display-lighting", label: "Display Lighting" },
    { value: "viewing-lounge", label: "Viewing Lounge" },
    { value: "car-wash-bay", label: "Car Wash Bay" },
    { value: "ev-charging", label: "EV Charging" },
    { value: "turntable", label: "Turntable" },
  ];

  const techOptions = [
    { value: "smart-home", label: "Smart Home System" },
    { value: "av-integration", label: "AV Integration" },
    { value: "security", label: "Advanced Security" },
    { value: "lighting-control", label: "Lighting Control" },
    { value: "climate-zones", label: "Climate Zones" },
    { value: "ev-charging", label: "EV Charging" },
  ];

  const sustainabilityOptions = [
    { value: "solar", label: "Solar Power" },
    { value: "geothermal", label: "Geothermal" },
    { value: "leed", label: "LEED Certification" },
    { value: "passive-house", label: "Passive House" },
    { value: "net-zero", label: "Net Zero" },
    { value: "water-reclaim", label: "Water Reclamation" },
  ];

  const viewPriorityOptions = [
    { value: "primary-suite", label: "Primary Suite" },
    { value: "living-room", label: "Living Room" },
    { value: "dining-room", label: "Dining Room" },
    { value: "kitchen", label: "Kitchen" },
    { value: "office", label: "Home Office" },
    { value: "family-room", label: "Family Room" },
    { value: "outdoor-living", label: "Outdoor Living" },
  ];

  const accessibilityOptions = [
    { value: "elevator", label: "Elevator" },
    { value: "single-floor", label: "Single-Floor Living Option" },
    { value: "wide-doorways", label: "Wide Doorways" },
    { value: "roll-in-shower", label: "Roll-in Shower" },
    { value: "grab-bars", label: "Grab Bars" },
  ];

  const storageOptions = [
    { value: "climate-controlled", label: "Climate Controlled Storage" },
    { value: "wine-storage", label: "Wine Storage" },
    { value: "art-storage", label: "Art Storage" },
    { value: "safe-room", label: "Safe Room/Vault" },
    { value: "seasonal-storage", label: "Seasonal Storage" },
  ];

  const toggleOption = (field: string, value: string) => {
    const current = data[field] || [];
    const updated = current.includes(value)
      ? current.filter((v: string) => v !== value)
      : [...current, value];
    onChange(field, updated);
  };

  return (
    <div className="space-y-6">
      {/* Garage */}
      <div className="space-y-3">
        <label className="block text-sm font-semibold text-gray-700">Garage Size</label>
        <div className="flex flex-wrap gap-2">
          {garageOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onChange("garageSize", opt.value)}
              className={`px-4 py-2 rounded-lg border transition-all ${
                data.garageSize === opt.value
                  ? "border-[#1a365d] bg-blue-50 text-[#1a365d]"
                  : "border-gray-300 hover:border-gray-400"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <label className="block text-sm font-semibold text-gray-700">Garage Features</label>
        <div className="flex flex-wrap gap-2">
          {garageFeatureOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => toggleOption("garageFeatures", opt.value)}
              className={`px-4 py-2 rounded-lg border transition-all ${
                (data.garageFeatures || []).includes(opt.value)
                  ? "border-[#1a365d] bg-blue-50 text-[#1a365d]"
                  : "border-gray-300 hover:border-gray-400"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Technology */}
      <div className="space-y-3">
        <label className="block text-sm font-semibold text-gray-700">Technology Requirements</label>
        <div className="flex flex-wrap gap-2">
          {techOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => toggleOption("technologyRequirements", opt.value)}
              className={`px-4 py-2 rounded-lg border transition-all ${
                (data.technologyRequirements || []).includes(opt.value)
                  ? "border-[#1a365d] bg-blue-50 text-[#1a365d]"
                  : "border-gray-300 hover:border-gray-400"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sustainability */}
      <div className="space-y-3">
        <label className="block text-sm font-semibold text-gray-700">Sustainability Priorities</label>
        <div className="flex flex-wrap gap-2">
          {sustainabilityOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => toggleOption("sustainabilityPriorities", opt.value)}
              className={`px-4 py-2 rounded-lg border transition-all ${
                (data.sustainabilityPriorities || []).includes(opt.value)
                  ? "border-[#1a365d] bg-blue-50 text-[#1a365d]"
                  : "border-gray-300 hover:border-gray-400"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* View Priority Rooms */}
      <div className="space-y-3">
        <label className="block text-sm font-semibold text-gray-700">
          Which rooms should prioritize views?
        </label>
        <p className="text-sm text-gray-500">Select all that apply</p>
        <div className="flex flex-wrap gap-2">
          {viewPriorityOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => toggleOption("viewPriorityRooms", opt.value)}
              className={`px-4 py-2 rounded-lg border transition-all ${
                (data.viewPriorityRooms || []).includes(opt.value)
                  ? "border-[#1a365d] bg-blue-50 text-[#1a365d]"
                  : "border-gray-300 hover:border-gray-400"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Accessibility Requirements */}
      <div className="space-y-3">
        <label className="block text-sm font-semibold text-gray-700">Accessibility Requirements</label>
        <div className="flex flex-wrap gap-2">
          {accessibilityOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => toggleOption("accessibilityRequirements", opt.value)}
              className={`px-4 py-2 rounded-lg border transition-all ${
                (data.accessibilityRequirements || []).includes(opt.value)
                  ? "border-[#1a365d] bg-blue-50 text-[#1a365d]"
                  : "border-gray-300 hover:border-gray-400"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Storage Requirements */}
      <div className="space-y-3">
        <label className="block text-sm font-semibold text-gray-700">Special Storage Requirements</label>
        <div className="flex flex-wrap gap-2">
          {storageOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => toggleOption("storageRequirements", opt.value)}
              className={`px-4 py-2 rounded-lg border transition-all ${
                (data.storageRequirements || []).includes(opt.value)
                  ? "border-[#1a365d] bg-blue-50 text-[#1a365d]"
                  : "border-gray-300 hover:border-gray-400"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lot Size & Setback */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-gray-700">
            Minimum Lot Size (acres)
          </label>
          <input
            type="number"
            min={0}
            step={0.5}
            value={data.minimumLotSize || ""}
            onChange={(e) => onChange("minimumLotSize", parseFloat(e.target.value) || null)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:border-[#1a365d] focus:ring-1 focus:ring-[#1a365d] outline-none"
            placeholder="e.g., 2.5"
          />
        </div>
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-gray-700">
            Minimum Setback from Road (feet)
          </label>
          <input
            type="number"
            min={0}
            value={data.minimumSetback || ""}
            onChange={(e) => onChange("minimumSetback", parseInt(e.target.value) || null)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:border-[#1a365d] focus:ring-1 focus:ring-[#1a365d] outline-none"
            placeholder="e.g., 100"
          />
        </div>
      </div>

      {/* Current Space Pain Points */}
      <div className="space-y-3">
        <label className="block text-sm font-semibold text-gray-700">
          Current Residence Pain Points
        </label>
        <p className="text-sm text-gray-500">
          What aspects of your current home don't work for your lifestyle?
        </p>
        <textarea
          value={data.currentSpacePainPoints || ""}
          onChange={(e) => onChange("currentSpacePainPoints", e.target.value)}
          className="w-full p-3 border border-gray-300 rounded-lg focus:border-[#1a365d] focus:ring-1 focus:ring-[#1a365d] outline-none resize-none"
          rows={3}
          placeholder="Describe what you'd like to improve..."
        />
      </div>

      {/* Daily Routines */}
      <div className="space-y-3">
        <label className="block text-sm font-semibold text-gray-700">
          Daily Routines Summary
        </label>
        <p className="text-sm text-gray-500">
          Describe a typical day and how you move through your home.
        </p>
        <textarea
          value={data.dailyRoutinesSummary || ""}
          onChange={(e) => onChange("dailyRoutinesSummary", e.target.value)}
          className="w-full p-3 border border-gray-300 rounded-lg focus:border-[#1a365d] focus:ring-1 focus:ring-[#1a365d] outline-none resize-none"
          rows={4}
          placeholder="Walk us through your typical morning, afternoon, and evening..."
        />
      </div>

      {/* Additional Notes */}
      <div className="space-y-3">
        <label className="block text-sm font-semibold text-gray-700">
          Additional Notes
        </label>
        <textarea
          value={data.additionalNotes || ""}
          onChange={(e) => onChange("additionalNotes", e.target.value)}
          className="w-full p-3 border border-gray-300 rounded-lg focus:border-[#1a365d] focus:ring-1 focus:ring-[#1a365d] outline-none resize-none"
          rows={3}
          placeholder="Anything else we should know about your ideal living space..."
        />
      </div>
    </div>
  );
}

// ===== MAIN PAGE COMPONENT =====

export default function LivingPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [stepData, setStepData] = useState<Record<string, Record<string, any>>>({});
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const { data: session, isLoading } = useQuery<SessionWithLivingResponses>({
    queryKey: ["/api/sessions", id],
  });

  // Load saved data on mount
  useEffect(() => {
    if (session?.livingResponses) {
      const loadedData: Record<string, Record<string, any>> = {};
      session.livingResponses.forEach((resp) => {
        try {
          loadedData[resp.stepId] = JSON.parse(resp.data);
        } catch (e) {
          console.error("Error parsing step data:", e);
        }
      });
      setStepData(loadedData);
    }
    if (session?.currentQuestionIndex) {
      setCurrentStepIndex(session.currentQuestionIndex);
    }
  }, [session]);

  const saveStepData = useMutation({
    mutationFn: async ({ stepId, data }: { stepId: string; data: Record<string, any> }) => {
      await apiRequest("POST", `/api/sessions/${id}/living-response`, {
        stepId,
        data: JSON.stringify(data),
        isCompleted: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions", id] });
      setLastSaved(new Date());
    },
  });

  const updateStep = useMutation({
    mutationFn: async (index: number) => {
      await apiRequest("PATCH", `/api/sessions/${id}`, { currentQuestionIndex: index });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions", id] });
    },
  });

  const completeSession = useMutation({
    mutationFn: async () => {
      // Use /complete-living for Living sessions (form-based), not /complete (audio-based)
      const res = await apiRequest("POST", `/api/sessions/${id}/complete-living`);
      return res.json();
    },
    onSuccess: () => {
      setLocation(`/report/${id}`);
    },
  });

  const currentStep = livingSteps[currentStepIndex];
  const currentData = stepData[currentStep?.id] || {};

  const handleFieldChange = (field: string, value: any) => {
    const newStepData = {
      ...stepData,
      [currentStep.id]: {
        ...currentData,
        [field]: value,
      },
    };
    setStepData(newStepData);

    // Auto-save after change
    saveStepData.mutate({
      stepId: currentStep.id,
      data: newStepData[currentStep.id],
    });
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      const newIndex = currentStepIndex - 1;
      setCurrentStepIndex(newIndex);
      updateStep.mutate(newIndex);
    }
  };

  const handleNext = () => {
    if (currentStepIndex < livingSteps.length - 1) {
      const newIndex = currentStepIndex + 1;
      setCurrentStepIndex(newIndex);
      updateStep.mutate(newIndex);
    }
  };

  const handleComplete = () => {
    completeSession.mutate();
  };

  const StepIcon = iconMap[currentStep?.icon] || Home;
  const generatedDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#1a365d]" />
      </div>
    );
  }

  const renderStepContent = () => {
    switch (currentStep.id) {
      case "work":
        return <WorkStep data={currentData} onChange={handleFieldChange} />;
      case "hobbies":
        return <HobbiesStep data={currentData} onChange={handleFieldChange} />;
      case "entertaining":
        return <EntertainingStep data={currentData} onChange={handleFieldChange} />;
      case "wellness":
        return <WellnessStep data={currentData} onChange={handleFieldChange} />;
      case "interior":
        return <InteriorStep data={currentData} onChange={handleFieldChange} />;
      case "exterior":
        return <ExteriorStep data={currentData} onChange={handleFieldChange} />;
      case "final":
        return <FinalStep data={currentData} onChange={handleFieldChange} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header Bar */}
      <header className="bg-[#1a365d] text-white px-8 py-4 flex justify-between items-center">
        <div>
          <div className="text-lg font-bold">N4S</div>
          <div className="text-xs text-white/70">Luxury Residential Advisory</div>
        </div>
        <div className="text-right">
          <div className="text-sm font-semibold">LuXeBrief Living</div>
          <div className="text-xs text-white/70">{generatedDate}</div>
        </div>
      </header>

      {/* Info Bar */}
      <div className="bg-white border-b border-gray-200 px-8 py-4 flex gap-12">
        <div className="flex gap-2">
          <span className="text-xs font-semibold text-gray-500 uppercase">Project:</span>
          <span className="text-sm font-medium text-gray-700">
            {session?.projectName || "Luxury Residence"}
          </span>
        </div>
        <div className="flex gap-2">
          <span className="text-xs font-semibold text-gray-500 uppercase">Client:</span>
          <span className="text-sm font-medium text-gray-700">{session?.clientName}</span>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-8">
        {/* Progress */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 mb-6">
          <div className="flex justify-between items-center mb-4">
            <div className="text-sm font-semibold text-[#1a365d] uppercase tracking-wide">
              Your Progress
            </div>
            <div className="text-sm text-gray-500">
              Step <span className="font-semibold text-[#1a365d]">{currentStepIndex + 1}</span> of{" "}
              <span className="font-semibold text-[#1a365d]">{livingSteps.length}</span>
            </div>
          </div>
          <div className="flex justify-between relative">
            <div className="absolute top-4 left-6 right-6 h-0.5 bg-gray-200" />
            {livingSteps.map((step, idx) => {
              const Icon = iconMap[step.icon] || Home;
              const isCompleted = idx < currentStepIndex;
              const isActive = idx === currentStepIndex;
              return (
                <div key={step.id} className="flex flex-col items-center relative z-10">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                      isCompleted
                        ? "bg-[#319795] border-[#319795] text-white"
                        : isActive
                        ? "bg-blue-50 border-[#1a365d] text-[#1a365d]"
                        : "bg-white border-gray-300 text-gray-400"
                    }`}
                  >
                    {isCompleted ? <Check size={14} /> : idx + 1}
                  </div>
                  <span
                    className={`text-xs mt-2 font-medium hidden sm:block ${
                      isCompleted
                        ? "text-[#319795]"
                        : isActive
                        ? "text-[#1a365d] font-semibold"
                        : "text-gray-400"
                    }`}
                  >
                    {step.title.split(" ")[0]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-blue-50 px-8 py-6 border-b border-blue-100">
            <h2 className="text-xl font-semibold text-[#1a365d] flex items-center gap-3">
              <StepIcon className="text-[#c9a227]" size={24} />
              {currentStep.title}
            </h2>
            <p className="text-gray-600 mt-1">{currentStep.description}</p>
          </div>

          <div className="p-8">{renderStepContent()}</div>

          {/* Navigation */}
          <div className="px-8 py-6 border-t border-gray-200 flex justify-between">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={currentStepIndex === 0}
              className="gap-2"
            >
              <ChevronLeft size={16} />
              Back
            </Button>

            {currentStepIndex < livingSteps.length - 1 ? (
              <Button onClick={handleNext} className="gap-2 bg-[#1a365d] hover:bg-[#2c5282]">
                Continue
                <ChevronRight size={16} />
              </Button>
            ) : (
              <Button
                onClick={handleComplete}
                disabled={completeSession.isPending}
                className="gap-2 bg-[#319795] hover:bg-[#2c7a7b]"
              >
                {completeSession.isPending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Check size={16} />
                )}
                Complete
              </Button>
            )}
          </div>
        </div>

        {/* Save Indicator */}
        <div className="text-center text-xs text-gray-500 mt-4">
          Progress saved automatically
          {lastSaved && (
            <>
              {" · "}
              <span className="text-[#319795] font-medium">
                Last saved {lastSaved.toLocaleTimeString()}
              </span>
            </>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 px-8 py-3 flex justify-between text-xs text-gray-500">
        <div>© 2026 Not4Sale LLC</div>
        <div className="font-medium">
          Step {currentStepIndex + 1} of {livingSteps.length}
        </div>
      </footer>
    </div>
  );
}
