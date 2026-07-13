"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import {
  adminLogout,
  AdminStaffProfile,
  backfillDailyDiaryCoverage,
  CloudPetDailyDiaryBackfillResult,
  CloudPetDailyDiaryCoverageResult,
  getAdminMe,
  getDailyDiaryCoverage
} from "../../admin-api";

const defaultToken = "";

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function reasonLabel(reason: string | undefined) {
  if (reason === "NO_TASK_COMPLETED") {
    return "No growth task completed today. A presence diary can be restored.";
  }

  if (reason === "NO_DIARY_GENERATED") {
    return "A diary should have been generated today but was missed.";
  }

  if (reason === "ALREADY_HAS_DIARY") {
    return "Diary already exists for this pet on the selected date.";
  }

  if (reason === "NOT_MISSING") {
    return "The selected pet is not currently missing a diary.";
  }

  if (reason === "PET_NOT_FOUND") {
    return "The selected pet could not be found.";
  }

  if (reason === "GENERATION_FAILED") {
    return "Diary generation failed for this pet.";
  }

  return reason ?? "No reason provided.";
}

function statusLabel(status: CloudPetDailyDiaryBackfillResult["results"][number]["status"]) {
  if (status === "created") {
    return "Recovered";
  }

  if (status === "skipped") {
    return "Skipped";
  }

  return "Failed";
}

export function DailyDiaryCoverageConsole() {
  const [token, setToken] = useState(defaultToken);
  const [date, setDate] = useState(todayIsoDate());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentStaff, setCurrentStaff] = useState<AdminStaffProfile | null>(null);
  const [coverage, setCoverage] = useState<CloudPetDailyDiaryCoverageResult | null>(null);
  const [selectedPetIds, setSelectedPetIds] = useState<string[]>([]);
  const [backfillLoading, setBackfillLoading] = useState(false);
  const [backfillResult, setBackfillResult] =
    useState<CloudPetDailyDiaryBackfillResult | null>(null);

  useEffect(() => {
    const storedToken = localStorage.getItem("kzt_admin_session") ?? defaultToken;
    const searchDate = new URLSearchParams(window.location.search).get("date");
    setToken(storedToken);
    if (searchDate) {
      setDate(searchDate);
      if (storedToken) {
        void loadCoverage(storedToken, searchDate);
      } else {
        setLoading(false);
      }
      return;
    }

    if (storedToken) {
      void loadCoverage(storedToken, todayIsoDate());
    } else {
      setLoading(false);
    }
  }, []);

  async function loadCoverage(nextToken = token, nextDate = date) {
    if (!nextToken) {
      setError("Admin session required");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const staff = await getAdminMe(nextToken);
      const nextCoverage = await getDailyDiaryCoverage(nextToken, nextDate);
      setCurrentStaff(staff);
      setCoverage(nextCoverage);
    } catch (caught) {
      if (
        nextToken.startsWith("admin_") &&
        caught instanceof Error &&
        caught.message === "Invalid admin session"
      ) {
        localStorage.removeItem("kzt_admin_session");
        window.location.href = "/admin/login";
        return;
      }

      setError(
        caught instanceof Error ? caught.message : "Failed to load diary coverage"
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleDateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSelectedPetIds([]);
    setBackfillResult(null);
    await loadCoverage(token, date);
  }

  function toggleSelectedPet(petId: string) {
    setSelectedPetIds((current) =>
      current.includes(petId)
        ? current.filter((item) => item !== petId)
        : [...current, petId]
    );
  }

  async function handleBackfill(mode: "missingOnly" | "selected") {
    setBackfillLoading(true);
    setError(null);

    try {
      const result = await backfillDailyDiaryCoverage(token, {
        date,
        mode,
        petIds: mode === "selected" ? selectedPetIds : undefined
      });
      setBackfillResult(result);
      if (mode === "selected") {
        setSelectedPetIds([]);
      }
      await loadCoverage(token, date);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Daily diary recovery failed"
      );
    } finally {
      setBackfillLoading(false);
    }
  }

  async function handleLogout() {
    if (token) {
      try {
        await adminLogout(token);
      } catch {
        // Ignore logout failures and clear the local session anyway.
      }
    }

    localStorage.removeItem("kzt_admin_session");
    window.location.href = "/admin/login";
  }

  return (
    <div className="admin-console">
      <section className="admin-card admin-card--token">
        <div>
          <p className="section__kicker">Cloud Pet Ops</p>
          <h2>Daily Diary Coverage Recovery</h2>
          <p>Review missing pet diaries, recover coverage, and keep retention signals healthy.</p>
        </div>
        <div className="admin-token-form">
          <div>
            <strong>{currentStaff?.name ?? "Staff session"}</strong>
            <span>{currentStaff ? currentStaff.role : "validating"}</span>
          </div>
          <button
            className="admin-button"
            onClick={() => void loadCoverage(token, date)}
            type="button"
          >
            Refresh coverage
          </button>
          <button
            className="admin-button admin-button--ghost"
            onClick={() => void handleLogout()}
            type="button"
          >
            Sign out
          </button>
        </div>
        <div className="admin-inline-actions">
          <Link className="admin-button admin-button--ghost" href="/admin">
            Back to dashboard
          </Link>
        </div>
        <p className={error ? "admin-status admin-status--error" : "admin-status"}>
          {error ??
            (loading
              ? "Loading diary coverage..."
              : "Diary coverage and recovery tools are ready.")}
        </p>
      </section>

      <section className="admin-card">
        <p className="section__kicker">Selected Date</p>
        <h2>Coverage Snapshot</h2>
        <form
          className="admin-inline-actions"
          onSubmit={(event) => void handleDateSubmit(event)}
        >
          <label>
            Date
            <input
              onChange={(event) => setDate(event.target.value)}
              type="date"
              value={date}
            />
          </label>
          <button className="admin-button" disabled={loading || backfillLoading} type="submit">
            Load coverage
          </button>
        </form>
        <div className="admin-metrics">
          {[
            ["Covered", coverage?.coveredCount ?? 0],
            ["Missing", coverage?.missingCount ?? 0],
            [
              "Coverage rate",
              `${Math.round((coverage?.coverageRate ?? 0) * 100)}%`
            ]
          ].map(([label, value]) => (
            <article className="admin-metric" key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="admin-card">
        <p className="section__kicker">Recovery Actions</p>
        <h2>Missing Diary Pets</h2>
        <div className="admin-inline-actions">
          <button
            className="admin-button"
            disabled={backfillLoading || (coverage?.missingCount ?? 0) === 0}
            onClick={() => void handleBackfill("missingOnly")}
            type="button"
          >
            {backfillLoading ? "Recovering..." : "Recover all missing diaries"}
          </button>
          <button
            className="admin-button admin-button--ghost"
            disabled={backfillLoading || selectedPetIds.length === 0}
            onClick={() => void handleBackfill("selected")}
            type="button"
          >
            Recover selected
          </button>
          <span>{selectedPetIds.length} selected</span>
        </div>

        {coverage && coverage.missingPets.length === 0 ? (
          <p className="admin-muted">Daily cloud-pet diaries are fully covered for this date.</p>
        ) : null}

        <div className="admin-list">
          {(coverage?.missingPets ?? []).map((pet) => (
            <label className="admin-row" key={pet.petId}>
              <div>
                <strong>
                  <input
                    checked={selectedPetIds.includes(pet.petId)}
                    disabled={backfillLoading}
                    onChange={() => toggleSelectedPet(pet.petId)}
                    type="checkbox"
                  />{" "}
                  {pet.petName}
                </strong>
                <span>
                  {pet.petNo} / {pet.memberPhone} / Lv.{pet.growthLevel} / {pet.careState}
                </span>
                <p>{reasonLabel(pet.reason)}</p>
              </div>
              <em>{pet.lastDiaryDate ? `Last diary: ${pet.lastDiaryDate}` : "No prior diary"}</em>
            </label>
          ))}
        </div>
      </section>

      {backfillResult ? (
        <section className="admin-card">
          <p className="section__kicker">Backfill Result</p>
          <h2>Latest Recovery Run</h2>
          <div className="admin-metrics">
            {[
              ["Attempted", backfillResult.attemptedCount],
              ["Recovered", backfillResult.successCount],
              ["Skipped", backfillResult.skippedCount],
              ["Failed", backfillResult.failedCount]
            ].map(([label, value]) => (
              <article className="admin-metric" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </article>
            ))}
          </div>
          <div className="admin-list">
            {backfillResult.results.map((item) => (
              <div className="admin-row" key={`${item.petId}-${item.status}`}>
                <div>
                  <strong>
                    {item.petName ?? item.petId} / {statusLabel(item.status)}
                  </strong>
                  <span>{item.petNo ?? item.petId}</span>
                  <p>{reasonLabel(item.reason)}</p>
                </div>
                <em>{item.diaryId ?? "No diary id returned"}</em>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
