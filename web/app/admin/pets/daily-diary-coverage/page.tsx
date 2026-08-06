import { SiteHeader } from "../../../components/site-header";
import { AdminAccessGate } from "../../admin-access-gate";
import { DailyDiaryCoverageConsole } from "./daily-diary-coverage-console";

export default function DailyDiaryCoveragePage() {
  return (
    <main className="admin-page">
      <SiteHeader />

      <section className="admin-hero">
        <div className="admin-hero__inner">
          <p className="section__kicker">云养宠运营</p>
          <h1>日记缺口覆盖状态</h1>
          <p>
            查看指定日期的云养宠日记覆盖情况，一键补救缺失记录。
          </p>
        </div>
      </section>

      <section className="admin-section">
        <AdminAccessGate>
          <DailyDiaryCoverageConsole />
        </AdminAccessGate>
      </section>
    </main>
  );
}
