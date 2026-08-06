"use client";

import { useEffect } from "react";
import { recordCloudPetHomepageVisit } from "../cloud-pets-api";

const visitorStorageKey = "kzt_homepage_visitor";

interface HomepageVisitTrackerProps {
  petNo: string;
  source: string;
}

export function HomepageVisitTracker({
  petNo,
  source
}: HomepageVisitTrackerProps) {
  useEffect(() => {
    let visitorId = localStorage.getItem(visitorStorageKey);

    if (!visitorId) {
      visitorId =
        typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `visitor_${Date.now().toString(36)}_${Math.random()
              .toString(36)
              .slice(2, 14)}`;
      localStorage.setItem(visitorStorageKey, visitorId);
    }

    void recordCloudPetHomepageVisit(petNo, {
      source,
      visitorId
    }).catch(() => undefined);
  }, [petNo, source]);

  return null;
}
