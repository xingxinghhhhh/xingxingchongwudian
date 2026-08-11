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
import { getAdminRoleLabel, getAdminStaffNameLabel, getStatusLabel } from "../../admin-copy";

const defaultToken = "";

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function reasonLabel(reason: string | undefined) {
  if (reason === "NO_TASK_COMPLETED") {
    return "今日未完成成长任务，可补一条陪伴型日记。";
  }

  if (reason === "NO_DIARY_GENERATED") {
    return "今日应生成日记但未生成。";
  }

  if (reason === "ALREADY_HAS_DIARY") {
    return "该宠物在所选日期已有日记。";
  }

  if (reason === "NOT_MISSING") {
    return "该宠物在所选日期已有日记。";
  }

  if (reason === "PET_NOT_FOUND") {
    return "未找到选中的宠物。";
  }

  if (reason === "GENERATION_FAILED") {
    return "该宠物日记生成失败。";
  }

  return reason ?? "暂无原因。";
}

function statusLabel(status: CloudPetDailyDiaryBackfillResult["results"][number]["status"]) {
  if (status === "created") {
    return "已补救";
  }

  if (status === "skipped") {
    return "已跳过";
  }

  return "失败";
}

export function DailyDiaryCoverageConsole() {
  const [token, setToken] = useState(defaultToken);
  const [date, setDate] = useState(todayIsoDate());
  const [petNoFilter, setPetNoFilter] = useState("");
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
    const searchParams = new URLSearchParams(window.location.search);
    const searchDate = searchParams.get("date");
    const searchPetNo = searchParams.get("petNo")?.trim() ?? "";
    setToken(storedToken);
    setPetNoFilter(searchPetNo);
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
      setError("需要后台登录会话");
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
        caught instanceof Error ? caught.message : "日记覆盖状态加载失败"
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
        caught instanceof Error ? caught.message : "日记补救失败"
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
        // 无论接口是否成功，前端会话都必须清除。
      }
    }

    localStorage.removeItem("kzt_admin_session");
    window.location.href = "/admin/login";
  }

  const visibleMissingPets = (coverage?.missingPets ?? []).filter(
    (pet) => !petNoFilter || pet.petNo === petNoFilter
  );

  return (
    <div className="admin-console">
      <section className="admin-card admin-card--token">
        <div>
          <p className="section__kicker">云养宠运营</p>
          <h2>日记缺口补救</h2>
          <p>查看指定日期的云养宠日记覆盖情况，并对缺失记录执行补救。</p>
        </div>
        <div className="admin-token-form">
          <div>
            <strong>{currentStaff ? getAdminStaffNameLabel(currentStaff.name) : "员工会话"}</strong>
            <span>{currentStaff ? getAdminRoleLabel(currentStaff.role) : "校验中"}</span>
          </div>
          <button
            className="admin-button"
            onClick={() => void loadCoverage(token, date)}
            type="button"
          >
            刷新覆盖状态
          </button>
          <button
            className="admin-button admin-button--ghost"
            onClick={() => void handleLogout()}
            type="button"
          >
            退出登录
          </button>
        </div>
        <div className="admin-inline-actions">
          <Link className="admin-button admin-button--ghost" href="/admin">
            返回仪表盘
          </Link>
        </div>
        <p
          className={error ? "admin-status admin-status--error" : "admin-status"}
          data-testid="admin-diary-coverage-status"
        >
          {error ??
            (loading
              ? "正在加载覆盖状态..."
              : "请选择日期查看缺口。")}
        </p>
      </section>

      <section className="admin-card">
        <p className="section__kicker">日记补救</p>
        <h2>覆盖状态</h2>
        <form
          className="admin-inline-actions"
          onSubmit={(event) => void handleDateSubmit(event)}
        >
          <label>
              日期
            <input
              data-testid="admin-diary-coverage-date"
              onChange={(event) => setDate(event.target.value)}
              type="date"
              value={date}
            />
          </label>
          <button className="admin-button" disabled={loading || backfillLoading} type="submit">
            加载覆盖状态
          </button>
        </form>
        <div className="admin-metrics">
          {[
            ["已覆盖", coverage?.coveredCount ?? 0],
            ["缺失", coverage?.missingCount ?? 0],
            [
              "覆盖率",
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
        <p className="section__kicker">日期筛选</p>
        <h2>缺失日记补救</h2>
        <div className="admin-inline-actions">
          <button
            className="admin-button"
            data-testid="admin-diary-backfill-all"
            disabled={backfillLoading || (coverage?.missingCount ?? 0) === 0}
            onClick={() => void handleBackfill("missingOnly")}
            type="button"
          >
            {backfillLoading ? "补救中..." : "补救全部缺失日记"}
          </button>
          <button
            className="admin-button admin-button--ghost"
            data-testid="admin-diary-backfill-selected"
            disabled={backfillLoading || selectedPetIds.length === 0}
            onClick={() => void handleBackfill("selected")}
            type="button"
          >
            补救选中日记
          </button>
          <span data-testid="admin-diary-selected-count">
            已选 {selectedPetIds.length} 只
          </span>
          {petNoFilter ? (
            <span data-testid="admin-diary-coverage-pet-filter">{petNoFilter}</span>
          ) : null}
        </div>

        {coverage && visibleMissingPets.length === 0 ? (
          <p className="admin-muted">
            {petNoFilter ? "当前宠物在所选日期没有缺失日记。" : "当前日期没有缺失日记。"}
          </p>
        ) : null}

        <div className="admin-list">
          {visibleMissingPets.map((pet) => (
            <label
              className="admin-row"
              data-pet-no={pet.petNo}
              data-testid="admin-diary-missing-pet"
              key={pet.petId}
            >
              <div>
                <strong>
                  <input
                    aria-label={`选择 ${pet.petName}`}
                    checked={selectedPetIds.includes(pet.petId)}
                    disabled={backfillLoading}
                    onChange={() => toggleSelectedPet(pet.petId)}
                    type="checkbox"
                  />{" "}
                  {pet.petName}
                </strong>
                <span>
                  {pet.petNo} / {pet.memberPhone} / 等级 {pet.growthLevel} / {getStatusLabel(pet.careState)}
                </span>
                <p>{reasonLabel(pet.reason)}</p>
              </div>
              <em>{pet.lastDiaryDate ? `最近日记 ${pet.lastDiaryDate}` : "暂无日记"}</em>
            </label>
          ))}
        </div>
      </section>

      {backfillResult ? (
        <section className="admin-card" data-testid="admin-diary-backfill-result">
          <p className="section__kicker">补救结果</p>
          <h2>补救结果</h2>
          <div className="admin-metrics">
            {[
              ["尝试", backfillResult.attemptedCount],
              ["成功", backfillResult.successCount],
              ["跳过", backfillResult.skippedCount],
              ["失败", backfillResult.failedCount]
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
                <em>{item.diaryId ?? "暂无日记 ID"}</em>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
